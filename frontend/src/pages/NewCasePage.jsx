import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cases, calendarApi } from '../api/client';

const CASE_TYPES = [
  { value: 'family', label: 'Family' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land_property', label: 'Land/Property' },
  { value: 'employment', label: 'Employment' },
  { value: 'community_dispute', label: 'Community Dispute' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PARTY_ROLES = [
  { value: 'complainant', label: 'Complainant' },
  { value: 'respondent', label: 'Respondent' },
  { value: 'witness', label: 'Witness' },
  { value: 'legal_rep', label: 'Legal Rep' },
  { value: 'support_person', label: 'Support Person' },
];

const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'Public' },
  { value: 'parties_only', label: 'Parties Only' },
  { value: 'mediator_only', label: 'Mediator Only' },
];

const DURATION_OPTIONS = [
  { value: '1_session', label: '1 session' },
  { value: '2_3_sessions', label: '2–3 sessions' },
  { value: '4_plus_sessions', label: '4+ sessions' },
  { value: 'ongoing', label: 'Ongoing' },
];

const PREFERRED_FORMATS = [
  { value: 'in_person', label: 'In-person' },
  { value: 'video', label: 'Video' },
  { value: 'phone', label: 'Phone' },
  { value: 'hybrid', label: 'Hybrid' },
];

const DESIRED_OUTCOMES = [
  { value: 'settlement', label: 'Settlement' },
  { value: 'apology', label: 'Apology' },
  { value: 'restitution', label: 'Restitution' },
  { value: 'relationship_repair', label: 'Relationship repair' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  { value: 'KE', label: 'Kenya' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'ZA', label: 'South Africa' },
];

const emptyParty = () => ({ name: '', role: 'complainant', phone: '', email: '', whatsapp: '', country_location: '', language_preference: '', relationship_to_case: '', accessibility_flags: [] });
const emptyTimeline = () => ({ event_date: new Date().toISOString().slice(0, 10), description: '' });
const emptyLink = () => ({ url: '', label: '' });

function buildPayload(form) {
  const p = {
    internal_reference: form.internal_reference || null,
    title: form.title || null,
    short_description: form.short_description || null,
    case_type: form.case_type || null,
    case_type_other: form.case_type === 'other' ? form.case_type_other : null,
    priority_level: form.priority_level || null,
    tags: form.tags?.length ? form.tags : null,
    detailed_narrative: form.detailed_narrative || null,
    desired_outcome: form.desired_outcome || null,
    desired_outcome_structured: form.desired_outcome_structured?.length ? form.desired_outcome_structured : null,
    jurisdiction_country: form.jurisdiction_country || 'KE',
    jurisdiction_region: form.jurisdiction_region || null,
    jurisdiction_county_state: form.jurisdiction_county_state || null,
    applicable_laws: form.applicable_laws || null,
    cultural_considerations: form.cultural_considerations || null,
    additional_notes: form.additional_notes || null,
    assigned_mediator_id: form.assigned_mediator_id || null,
    status: form.status || 'draft',
    confidentiality_level: form.confidentiality_level || 'parties_only',
    estimated_duration: form.estimated_duration || null,
    preferred_format: form.preferred_format?.length ? form.preferred_format : null,
  };
  const timeline = form.timeline?.filter((t) => t.event_date && t.description.trim()).map((t) => ({ event_date: t.event_date, description: t.description.trim() }));
  if (timeline?.length) p.timeline = timeline;
  const parties = form.parties?.filter((pa) => pa.name?.trim()).map((pa) => ({
    name: pa.name.trim(),
    role: pa.role || 'complainant',
    phone: pa.phone || null,
    email: pa.email || null,
    whatsapp: pa.whatsapp || null,
    country_location: pa.country_location || null,
    language_preference: pa.language_preference || null,
    relationship_to_case: pa.relationship_to_case || null,
    accessibility_flags: pa.accessibility_flags?.length ? pa.accessibility_flags : null,
  }));
  if (parties?.length) p.parties = parties;
  const links = form.external_links?.filter((l) => l.url?.trim()).map((l) => ({ url: l.url.trim(), label: l.label?.trim() || null }));
  if (links?.length) p.external_links = links;
  return p;
}

function validateSubmit(form) {
  const errs = [];
  if (!form.title?.trim() || form.title.trim().length < 5) errs.push('Title must be at least 5 characters');
  if (!form.short_description?.trim() || form.short_description.trim().length < 10) errs.push('Short description must be at least 10 characters');
  if (!form.case_type) errs.push('Case type is required');
  if (!form.priority_level) errs.push('Priority level is required');
  if (!form.confidentiality_level) errs.push('Confidentiality level is required');
  return errs;
}

function parseTags(t) {
  if (Array.isArray(t)) return t;
  if (t?.tags) return t.tags;
  return [];
}
function parseList(obj, key) {
  if (Array.isArray(obj)) return obj;
  if (obj?.[key]) return obj[key];
  return [];
}

export default function NewCasePage({ edit }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState({
    internal_reference: '',
    title: '',
    short_description: '',
    case_type: '',
    case_type_other: '',
    priority_level: '',
    tags: [],
    detailed_narrative: '',
    desired_outcome: '',
    desired_outcome_structured: [],
    jurisdiction_country: 'KE',
    jurisdiction_region: '',
    jurisdiction_county_state: '',
    applicable_laws: '',
    cultural_considerations: '',
    additional_notes: '',
    assigned_mediator_id: '',
    status: 'draft',
    confidentiality_level: 'parties_only',
    estimated_duration: '',
    preferred_format: [],
    timeline: [],
    parties: [emptyParty()],
    external_links: [],
  });
  const [expanded, setExpanded] = useState({ details: false, parties: false, supporting: false });
  const [tagInput, setTagInput] = useState('');
  const [locations, setLocations] = useState(null);
  const [mediators, setMediators] = useState([]);
  const [caseId, setCaseId] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(!!edit);

  const country = form.jurisdiction_country || 'KE';

  useEffect(() => {
    if (edit && id) {
      cases.get(id)
        .then(({ data }) => {
          setCaseId(data.id);
          setForm({
            internal_reference: data.internal_reference || '',
            title: data.title || '',
            short_description: data.short_description || '',
            case_type: data.case_type || '',
            case_type_other: data.case_type_other || '',
            priority_level: data.priority_level || '',
            tags: parseTags(data.tags),
            detailed_narrative: data.detailed_narrative || '',
            desired_outcome: data.desired_outcome || '',
            desired_outcome_structured: parseList(data.desired_outcome_structured, 'items') || [],
            jurisdiction_country: data.jurisdiction_country || 'KE',
            jurisdiction_region: data.jurisdiction_region || '',
            jurisdiction_county_state: data.jurisdiction_county_state || '',
            applicable_laws: data.applicable_laws || '',
            cultural_considerations: data.cultural_considerations || '',
            additional_notes: data.additional_notes || '',
            assigned_mediator_id: data.mediator_id || '',
            status: data.status || 'draft',
            confidentiality_level: data.confidentiality_level || 'parties_only',
            estimated_duration: data.estimated_duration || '',
            preferred_format: parseList(data.preferred_format, 'formats') || [],
            timeline: (data.timeline || []).map((t) => ({ event_date: t.event_date, description: t.description || '' })),
            parties: (data.parties || []).length ? data.parties.map((p) => ({ ...p, name: p.name || '', role: p.role || 'complainant' })) : [emptyParty()],
            external_links: (data.external_links || []).map((l) => ({ url: l.url || '', label: l.label || '' })),
          });
          setExpanded({ details: true, parties: true, supporting: true });
        })
        .catch(() => setError('Failed to load case'))
        .finally(() => setLoading(false));
    }
  }, [edit, id]);

  useEffect(() => {
    cases.getLocations(country).then(({ data }) => setLocations(data)).catch(() => setLocations(null));
  }, [country]);

  useEffect(() => {
    calendarApi.listMediators().then(({ data }) => setMediators(data || [])).catch(() => setMediators([]));
  }, []);

  const save = useCallback(async (statusOverride) => {
    if (!caseId) return;
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload({ ...form, status: statusOverride ?? form.status });
      await cases.update(caseId, payload);
      setLastSaved(new Date());
      setDirty(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [caseId, form]);

  useEffect(() => {
    if (!caseId || !dirty) return;
    const t = setTimeout(() => save(), 60000);
    return () => clearTimeout(t);
  }, [caseId, dirty, save]);

  const createDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload({ ...form, status: 'draft' });
      const { data } = await cases.create(payload);
      setCaseId(data.id);
      setLastSaved(new Date());
      setDirty(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create case');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!caseId) {
      await createDraft();
      return;
    }
    await save('draft');
  };

  const handleSubmit = async () => {
    const errs = validateSubmit(form);
    if (errs.length) {
      setError(errs.join('. '));
      return;
    }
    setError('');
    if (!caseId) {
      setSaving(true);
      try {
        const payload = buildPayload({ ...form, status: 'submitted' });
        const { data } = await cases.create(payload);
        navigate(`/cases/${data.id}`);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to submit');
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload({ ...form, status: 'submitted' });
      await cases.update(caseId, payload);
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const update = (updates) => {
    setForm((f) => ({ ...f, ...updates }));
    setDirty(true);
  };

  const addParty = () => update({ parties: [...form.parties, emptyParty()] });
  const removeParty = (i) => update({ parties: form.parties.filter((_, j) => j !== i) });
  const setParty = (i, field, val) => update({ parties: form.parties.map((p, j) => (j === i ? { ...p, [field]: val } : p)) });

  const addTimeline = () => update({ timeline: [...form.timeline, emptyTimeline()] });
  const removeTimeline = (i) => update({ timeline: form.timeline.filter((_, j) => j !== i) });
  const setTimeline = (i, field, val) => update({ timeline: form.timeline.map((t, j) => (j === i ? { ...t, [field]: val } : t)) });

  const addLink = () => update({ external_links: [...form.external_links, emptyLink()] });
  const removeLink = (i) => update({ external_links: form.external_links.filter((_, j) => j !== i) });
  const setLink = (i, field, val) => update({ external_links: form.external_links.map((l, j) => (j === i ? { ...l, [field]: val } : l)) });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && form.tags.length < 10 && !form.tags.includes(t)) {
      update({ tags: [...form.tags, t] });
      setTagInput('');
    }
  };
  const removeTag = (t) => update({ tags: form.tags.filter((x) => x !== t) });

  const toggleArray = (field, value) => {
    const arr = form[field] || [];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    update({ [field]: next });
  };

  const regions = locations?.regions || [];
  const subRegions = (locations?.sub_regions && form.jurisdiction_region ? locations.sub_regions[form.jurisdiction_region] : []) || [];
  const regionLabel = locations?.region_label || 'Region';
  const subLabel = locations?.sub_label;

  if (loading) return <div className="new-case-page"><p>Loading...</p></div>;

  return (
    <div className="new-case-page">
      <header>
        <button onClick={() => navigate(edit && id ? `/cases/${id}` : '/dashboard')}>← Back</button>
        <h1>{edit ? 'Edit Case' : 'New Case'}</h1>
        {lastSaved && <span className="last-saved">Last saved {lastSaved.toLocaleTimeString()}</span>}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <form className="case-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* Case Identification */}
        <section className="form-section">
          <h2>Case Identification</h2>
          <label>
            Internal reference
            <input type="text" maxLength={50} placeholder="Client ID, internal code" value={form.internal_reference} onChange={(e) => update({ internal_reference: e.target.value })} />
          </label>
          <label>
            Case title <span className="required">*</span>
            <input type="text" maxLength={200} placeholder="Short, descriptive title (min 5 chars)" value={form.title} onChange={(e) => update({ title: e.target.value })} />
          </label>
          <label>
            Short description <span className="required">*</span>
            <textarea rows={3} maxLength={500} placeholder="1–2 sentence summary (min 10 chars)" value={form.short_description} onChange={(e) => update({ short_description: e.target.value })} />
          </label>
          <div className="row">
            <label>
              Case type <span className="required">*</span>
              <select value={form.case_type} onChange={(e) => update({ case_type: e.target.value, case_type_other: form.case_type === 'other' ? form.case_type_other : '' })}>
                <option value="">Select</option>
                {CASE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {form.case_type === 'other' && (
              <label>
                Specify
                <input type="text" maxLength={100} value={form.case_type_other} onChange={(e) => update({ case_type_other: e.target.value })} />
              </label>
            )}
          </div>
          <label>
            Priority level <span className="required">*</span>
            <select value={form.priority_level} onChange={(e) => update({ priority_level: e.target.value })}>
              <option value="">Select</option>
              {PRIORITY_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <div className="tag-input">
              <input type="text" maxLength={30} placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
              <button type="button" onClick={addTag}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div className="tag-list">
                {form.tags.map((t) => (
                  <span key={t} className="tag"><span>{t}</span><button type="button" onClick={() => removeTag(t)} aria-label="Remove">×</button></span>
                ))}
              </div>
            )}
          </label>
        </section>

        {/* Case Details - expandable */}
        <section className="form-section expandable">
          <button type="button" className="section-toggle" onClick={() => setExpanded((e) => ({ ...e, details: !e.details }))}>
            {expanded.details ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Add Case Details
          </button>
          {expanded.details && (
            <div className="section-content">
              <label>
                Detailed narrative
                <textarea rows={6} maxLength={10000} placeholder="Full context, bullet points" value={form.detailed_narrative} onChange={(e) => update({ detailed_narrative: e.target.value })} />
              </label>
              <div className="timeline-block">
                <h4>Timeline of events</h4>
                {form.timeline.map((t, i) => (
                  <div key={i} className="repeater-row">
                    <input type="date" value={t.event_date} onChange={(e) => setTimeline(i, 'event_date', e.target.value)} />
                    <input type="text" maxLength={500} placeholder="Description" value={t.description} onChange={(e) => setTimeline(i, 'description', e.target.value)} />
                    <button type="button" onClick={() => removeTimeline(i)} aria-label="Remove"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" className="add-row" onClick={addTimeline}><Plus size={14} /> Add event</button>
              </div>
              <label>
                Desired outcome (free text)
                <textarea rows={2} maxLength={2000} value={form.desired_outcome} onChange={(e) => update({ desired_outcome: e.target.value })} />
              </label>
              <label>
                Desired outcome (structured)
                <div className="checkbox-group">
                  {DESIRED_OUTCOMES.map((o) => (
                    <label key={o.value} className="checkbox-label">
                      <input type="checkbox" checked={form.desired_outcome_structured.includes(o.value)} onChange={() => toggleArray('desired_outcome_structured', o.value)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </label>
              <label>
                Jurisdiction country
                <select value={form.jurisdiction_country} onChange={(e) => update({ jurisdiction_country: e.target.value, jurisdiction_region: '', jurisdiction_county_state: '' })}>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              {regions.length > 0 && (
                <>
                  <label>
                    {regionLabel}
                    <select value={form.jurisdiction_region} onChange={(e) => update({ jurisdiction_region: e.target.value, jurisdiction_county_state: '' })}>
                      <option value="">Select</option>
                      {regions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {subLabel && subRegions.length > 0 && (
                    <label>
                      {subLabel}
                      <select value={form.jurisdiction_county_state} onChange={(e) => update({ jurisdiction_county_state: e.target.value })}>
                        <option value="">Select</option>
                        {subRegions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              <label>
                Applicable laws/policies
                <textarea rows={2} maxLength={2000} value={form.applicable_laws} onChange={(e) => update({ applicable_laws: e.target.value })} />
              </label>
              <label>
                Cultural considerations
                <textarea rows={2} maxLength={1000} value={form.cultural_considerations} onChange={(e) => update({ cultural_considerations: e.target.value })} />
              </label>
            </div>
          )}
        </section>

        {/* Persons Involved */}
        <section className="form-section expandable">
          <button type="button" className="section-toggle" onClick={() => setExpanded((e) => ({ ...e, parties: !e.parties }))}>
            {expanded.parties ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Add Persons Involved
          </button>
          {expanded.parties && (
            <div className="section-content">
              {form.parties.map((p, i) => (
                <div key={i} className="party-card">
                  <div className="party-header">
                    <span>Party {i + 1}</span>
                    {form.parties.length > 1 && <button type="button" onClick={() => removeParty(i)} aria-label="Remove"><Trash2 size={16} /></button>}
                  </div>
                  <div className="party-fields">
                    <label>
                      Name <span className="required">*</span>
                      <input type="text" maxLength={200} value={p.name} onChange={(e) => setParty(i, 'name', e.target.value)} placeholder="Full name" />
                    </label>
                    <label>
                      Role <span className="required">*</span>
                      <select value={p.role} onChange={(e) => setParty(i, 'role', e.target.value)}>
                        {PARTY_ROLES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Phone
                      <input type="tel" value={p.phone} onChange={(e) => setParty(i, 'phone', e.target.value)} />
                    </label>
                    <label>
                      Email
                      <input type="email" value={p.email} onChange={(e) => setParty(i, 'email', e.target.value)} />
                    </label>
                    <label>
                      WhatsApp
                      <input type="tel" value={p.whatsapp} onChange={(e) => setParty(i, 'whatsapp', e.target.value)} />
                    </label>
                    <label>
                      Country/Location
                      <input type="text" value={p.country_location} onChange={(e) => setParty(i, 'country_location', e.target.value)} />
                    </label>
                    <label>
                      Language preference
                      <input type="text" placeholder="e.g. en, sw" value={p.language_preference} onChange={(e) => setParty(i, 'language_preference', e.target.value)} />
                    </label>
                    <label>
                      Relationship to case
                      <input type="text" value={p.relationship_to_case} onChange={(e) => setParty(i, 'relationship_to_case', e.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" className="add-row" onClick={addParty}><Plus size={14} /> Add party</button>
            </div>
          )}
        </section>

        {/* Supporting Information */}
        <section className="form-section expandable">
          <button type="button" className="section-toggle" onClick={() => setExpanded((e) => ({ ...e, supporting: !e.supporting }))}>
            {expanded.supporting ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Add Supporting Information
          </button>
          {expanded.supporting && (
            <div className="section-content">
              <div className="links-block">
                <h4>External links</h4>
                {form.external_links.map((l, i) => (
                  <div key={i} className="repeater-row">
                    <input type="url" maxLength={500} placeholder="URL" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} />
                    <input type="text" placeholder="Label" value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} />
                    <button type="button" onClick={() => removeLink(i)} aria-label="Remove"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" className="add-row" onClick={addLink}><Plus size={14} /> Add link</button>
              </div>
              <label>
                Additional notes
                <textarea rows={4} maxLength={5000} value={form.additional_notes} onChange={(e) => update({ additional_notes: e.target.value })} />
              </label>
            </div>
          )}
        </section>

        {/* Workflow & Metadata */}
        <section className="form-section">
          <h2>Workflow & Metadata</h2>
          <label>
            Assigned mediator
            <select value={form.assigned_mediator_id} onChange={(e) => update({ assigned_mediator_id: e.target.value || null })}>
              <option value="">None</option>
              {mediators.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
              ))}
            </select>
          </label>
          <label>
            Confidentiality level <span className="required">*</span>
            <select value={form.confidentiality_level} onChange={(e) => update({ confidentiality_level: e.target.value })}>
              {CONFIDENTIALITY_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            Estimated duration
            <select value={form.estimated_duration} onChange={(e) => update({ estimated_duration: e.target.value })}>
              <option value="">Select</option>
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred format
            <div className="checkbox-group">
              {PREFERRED_FORMATS.map((o) => (
                <label key={o.value} className="checkbox-label">
                  <input type="checkbox" checked={form.preferred_format.includes(o.value)} onChange={() => toggleArray('preferred_format', o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </label>
        </section>

        <div className="form-actions">
          <button type="button" onClick={handleSaveDraft} disabled={saving}>
            {saving ? 'Saving...' : caseId ? 'Save as Draft' : 'Create Draft'}
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Case'}
          </button>
        </div>
      </form>
    </div>
  );
}

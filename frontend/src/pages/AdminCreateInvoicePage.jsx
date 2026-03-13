import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Trash2 } from 'lucide-react';
import { paymentsApi, cases } from '../api/client';
import './AdminCreateInvoicePage.css';

const CLIENT_TYPES = [
  { value: 'client_individual', label: 'Individual Client' },
  { value: 'client_corporate', label: 'Corporate Client' },
  { value: 'mediator', label: 'Mediator' },
  { value: 'trainee', label: 'Trainee' },
];

export default function AdminCreateInvoicePage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [caseList, setCaseList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearching, setUserSearching] = useState(false);
  const [form, setForm] = useState({
    clientType: 'client_individual',
    user_id: '',
    user_display: '',
    user_details: null,
    mediator_id: '',
    case_id: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    purpose: 'mediation_session',
    currency: 'KES',
    line_items: [{ service_id: '', description: '', quantity: 1, unit_price: '' }],
    notes: '',
    terms: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [mediators, setMediators] = useState([]);

  const loadServices = useCallback(() => {
    paymentsApi.listServices().then((r) => setServices(r.data || [])).catch(() => []);
  }, []);

  useEffect(() => {
    loadServices();
    cases.list({ limit: 200 }).then((r) => setCaseList(r.data || [])).catch(() => []);
    paymentsApi.searchBillableUsers({ role: 'mediator', limit: 100 }).then((r) => setMediators(r.data || [])).catch(() => []);
  }, [loadServices]);

  useEffect(() => {
    if (!userSearch.trim()) {
      setUserResults([]);
      return;
    }
    const t = setTimeout(() => {
      setUserSearching(true);
      paymentsApi.searchBillableUsers({ q: userSearch, role: form.clientType })
        .then((r) => setUserResults(r.data || []))
        .catch(() => setUserResults([]))
        .finally(() => setUserSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, form.clientType]);

  const selectUser = (u) => {
    setForm((f) => ({
      ...f,
      user_id: u.id,
      user_display: `${u.display_name || u.email} (${u.role})`,
      user_details: u,
    }));
    setUserSearch('');
    setUserResults([]);
  };

  const addLineItem = () => {
    setForm((f) => ({ ...f, line_items: [...f.line_items, { service_id: '', description: '', quantity: 1, unit_price: '' }] }));
  };

  const updateLineItem = (i, field, val) => {
    setForm((f) => {
      const items = [...f.line_items];
      items[i] = { ...items[i], [field]: val };
      if (field === 'service_id' && val) {
        const svc = services.find((s) => s.id === val);
        if (svc) {
          items[i].description = svc.name;
          items[i].unit_price = String(svc.price ?? svc.price_minor / 100);
        }
      }
      return { ...f, line_items: items };
    });
  };

  const removeLineItem = (i) => {
    if (form.line_items.length <= 1) return;
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  };

  const computeTotal = () => {
    return form.line_items.reduce((s, li) => {
      const q = parseFloat(li.quantity) || 0;
      const up = parseFloat(li.unit_price) || 0;
      return s + q * up;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.user_id) {
      alert('Select the client/mediator/trainee to invoice');
      return;
    }
    const isPlatformInvoice = form.clientType === 'mediator';
    if (!isPlatformInvoice && mediators.length > 0 && !form.mediator_id) {
      alert('Select the earning mediator for reconciliation. This ensures client payments are correctly attributed.');
      return;
    }
    const lineItems = form.line_items.filter((li) => (li.description || '').trim() && (parseFloat(li.unit_price) || 0) > 0);
    if (lineItems.length === 0) {
      alert('Add at least one line item with description and price');
      return;
    }
    const total = lineItems.reduce((s, li) => s + (parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0), 0);
    setSubmitting(true);
    try {
      await paymentsApi.createInvoice({
        user_id: form.user_id,
        amount_minor_units: Math.round(total * 100),
        currency: form.currency,
        description: form.notes || lineItems.map((li) => li.description).join('; '),
        purpose: form.purpose || null,
        due_date: form.due_date || null,
        case_id: form.case_id || null,
        invoice_type: isPlatformInvoice ? 'platform' : 'client',
        mediator_id: !isPlatformInvoice && form.mediator_id ? form.mediator_id : null,
        line_items: lineItems.map((li) => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 1,
          unit_price_minor: Math.round((parseFloat(li.unit_price) || 0) * 100),
        })),
      });
      navigate('/admin/accounts');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-invoice-page">
      <header className="create-invoice-header">
        <Link to="/admin/accounts" className="btn-back">
          <ArrowLeft size={18} /> Back to Accounts
        </Link>
        <h1>Create Invoice</h1>
        <p>Fill in the details below. Similar to QuickBooks-style invoicing.</p>
      </header>

      <form className="create-invoice-form" onSubmit={handleSubmit}>
        <section className="invoice-section invoice-section-client">
          <h2>1. Who are you invoicing?</h2>
          <div className="form-group">
            <label>Client type *</label>
            <select
              value={form.clientType}
              onChange={(e) => {
                setForm((f) => ({ ...f, clientType: e.target.value, user_id: '', user_display: '', user_details: null }));
                setUserSearch('');
                setUserResults([]);
              }}
            >
              {CLIENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Search and select {form.clientType === 'client_individual' ? 'client' : form.clientType === 'client_corporate' ? 'client' : form.clientType} *</label>
            <div className="search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder={`Search by name, email, user ID...`}
                value={form.user_display || userSearch}
                onChange={(e) => {
                  if (form.user_id) setForm((f) => ({ ...f, user_id: '', user_display: '', user_details: null }));
                  setUserSearch(e.target.value);
                }}
              />
              {form.user_id && (
                <button type="button" className="btn-clear" onClick={() => setForm((f) => ({ ...f, user_id: '', user_display: '', user_details: null }))}>
                  Clear
                </button>
              )}
            </div>
            {userSearch && !form.user_id && (
              <div className="search-results">
                {userSearching ? (
                  <div className="search-loading">Searching...</div>
                ) : userResults.length === 0 ? (
                  <div className="search-empty">No results</div>
                ) : (
                  userResults.map((u) => (
                    <div key={u.id} className="search-result-item" onClick={() => selectUser(u)}>
                      <strong>{u.display_name || u.email}</strong>
                      {u.email && u.display_name && <span className="result-email">{u.email}</span>}
                      <span className="result-role">{u.role}</span>
                      {u.phone && <span className="result-phone">{u.phone}</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {form.clientType !== 'mediator' && mediators.length > 0 && (
            <div className="form-group">
              <label>Earning mediator (required for reconciliation) <span className="required">*</span></label>
              <select
                value={form.mediator_id}
                onChange={(e) => setForm({ ...form, mediator_id: e.target.value })}
              >
                <option value="">— None —</option>
                {mediators.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                ))}
              </select>
            </div>
          )}
          {form.user_details && (
            <div className="client-details-card">
              <h4>Client details</h4>
              <p><strong>Name:</strong> {form.user_details.display_name || '—'}</p>
              <p><strong>Email:</strong> {form.user_details.email || '—'}</p>
              <p><strong>Phone:</strong> {form.user_details.phone || '—'}</p>
              <p><strong>User ID:</strong> {form.user_details.user_id || '—'}</p>
              <p><strong>Role:</strong> {form.user_details.role || '—'}</p>
            </div>
          )}
        </section>

        <section className="invoice-section invoice-section-dates">
          <h2>2. Dates & currency</h2>
          <div className="form-row-2">
            <div className="form-group">
              <label>Invoice date</label>
              <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="KES">KES</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="form-group">
            <label>Case (optional)</label>
            <select
              value={form.case_id}
              onChange={(e) => {
                const caseId = e.target.value;
                const c = caseList.find((x) => x.id === caseId);
                setForm((f) => ({
                  ...f,
                  case_id: caseId,
                  mediator_id: c?.mediator_id && mediators.some((m) => m.id === c.mediator_id) ? c.mediator_id : f.mediator_id,
                }));
              }}
            >
              <option value="">— None —</option>
              {caseList.map((c) => (
                <option key={c.id} value={c.id}>{c.case_number} – {c.title || c.case_type || '—'}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Purpose</label>
            <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              <option value="mediation_session">Mediation session fee</option>
              <option value="consultation">Consultation</option>
              <option value="retainer">Retainer</option>
              <option value="training">Training</option>
              <option value="administrative">Administrative fee</option>
              <option value="other">Other</option>
            </select>
          </div>
        </section>

        <section className="invoice-section invoice-section-items">
          <h2>3. Line items (services)</h2>
          <div className="line-items">
            {form.line_items.map((li, i) => (
              <div key={i} className="line-item-row">
                <select
                  value={li.service_id}
                  onChange={(e) => updateLineItem(i, 'service_id', e.target.value)}
                  className="line-service-select"
                >
                  <option value="">— Custom / select service —</option>
                  {services.filter((s) => s.is_active !== false).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.currency} {(s.price ?? s.price_minor / 100).toFixed(2)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  className="line-desc"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                  className="line-qty"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit price"
                  value={li.unit_price}
                  onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                  className="line-price"
                />
                <button type="button" className="btn-remove" onClick={() => removeLineItem(i)} disabled={form.line_items.length <= 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn-add-line" onClick={addLineItem}>
              <Plus size={16} /> Add line item
            </button>
          </div>
          <div className="invoice-total">
            Total: <strong>{form.currency} {computeTotal().toFixed(2)}</strong>
          </div>
        </section>

        <section className="invoice-section invoice-section-notes">
          <h2>4. Additional details</h2>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes (optional)" />
          </div>
          <div className="form-group">
            <label>Terms & conditions</label>
            <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} placeholder="e.g. Payment due within 14 days" />
          </div>
        </section>

        <div className="form-actions">
          <Link to="/admin/accounts" className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

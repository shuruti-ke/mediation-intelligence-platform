import { useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApiClient } from '../api/client';

const STEPS = [
  { id: 'context', title: 'Your Situation' },
  { id: 'details', title: 'Conflict Details' },
  { id: 'goals', title: 'Goals & Constraints' },
  { id: 'readiness', title: 'Mediation Readiness' },
  { id: 'contact', title: 'Contact & Consent' },
];

export default function ShouldIMediatePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    dispute_type: '',
    duration: '',
    relationship: '',
    core_issue_summary: '',
    previous_attempts: '',
    other_party_aware: '',
    primary_goal: '',
    legal_representation: '',
    safety_concerns: '',
    willingness_compromise: 3,
    other_party_willingness: 3,
    urgency: '',
    timeline: '',
    consent_confidentiality: false,
    consent_marketing: false,
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await publicApiClient.shouldIMediate({
        email: form.email,
        phone: form.phone || undefined,
        dispute_type: form.dispute_type || undefined,
        duration: form.duration || undefined,
        relationship: form.relationship || undefined,
        core_issue_summary: form.core_issue_summary || undefined,
        previous_attempts: form.previous_attempts || undefined,
        other_party_aware: form.other_party_aware || undefined,
        primary_goal: form.primary_goal || undefined,
        legal_representation: form.legal_representation || undefined,
        safety_concerns: form.safety_concerns || undefined,
        willingness_compromise: form.willingness_compromise,
        other_party_willingness: form.other_party_willingness,
        urgency: form.urgency || undefined,
        timeline: form.timeline || undefined,
        consent_confidentiality: form.consent_confidentiality,
        consent_marketing: form.consent_marketing,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.dispute_type;
    if (step === 1) return true;
    if (step === 2) return form.primary_goal;
    if (step === 3) return true;
    if (step === 4) return form.email && form.consent_confidentiality;
    return true;
  };

  return (
    <div className="public-page halomd-style should-i-mediate">
      <header className="public-header compact">
        <Link to="/">← Back</Link>
        <h1>Should I Mediate?</h1>
        <p>An in-depth, confidential assessment to determine if mediation is right for your dispute.</p>
      </header>

      <div className="confidentiality-banner">
        <strong>Confidential</strong> — Your responses are stored securely and used only for this assessment. 
        We do not share your information with third parties. Mediators are bound by strict confidentiality rules.
      </div>

      <main className="public-main">
        {result ? (
          <div className="result-card">
            <h2>Your Recommendation</h2>
            <p className="recommendation">{result.recommendation}</p>
            {result.factors?.length > 0 && (
              <ul className="factors-list">
                {result.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            <p className="next-step"><strong>Next step:</strong> {result.next_step}</p>
            {result.lead_captured && (
              <p className="lead-note">We&apos;ve received your details and will follow up shortly.</p>
            )}
            <Link to="/" className="primary">Return to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="assessment-form multi-step">
            {error && <div className="error">{error}</div>}

            <div className="step-indicator">
              {STEPS.map((s, i) => (
                <span key={s.id} className={i <= step ? 'active' : ''}>
                  {i + 1}. {s.title}
                </span>
              ))}
            </div>

            {step === 0 && (
              <div className="form-step">
                <h3>Your Situation</h3>
                <label>What type of dispute are you facing? *</label>
                <select value={form.dispute_type} onChange={(e) => update('dispute_type', e.target.value)} required>
                  <option value="">Select...</option>
                  <option value="employment">Employment</option>
                  <option value="commercial">Commercial / Business</option>
                  <option value="family">Family</option>
                  <option value="landlord_tenant">Landlord-Tenant</option>
                  <option value="neighbour">Neighbour / Community</option>
                  <option value="consumer">Consumer</option>
                  <option value="other">Other</option>
                </select>
                <label>How long has this dispute been ongoing?</label>
                <select value={form.duration} onChange={(e) => update('duration', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="under_1_month">Under 1 month</option>
                  <option value="1_3_months">1–3 months</option>
                  <option value="3_6_months">3–6 months</option>
                  <option value="6_12_months">6–12 months</option>
                  <option value="over_1_year">Over 1 year</option>
                </select>
                <label>What is your relationship with the other party?</label>
                <select value={form.relationship} onChange={(e) => update('relationship', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="employer">Employer</option>
                  <option value="employee">Employee</option>
                  <option value="business_partner">Business partner</option>
                  <option value="family_member">Family member</option>
                  <option value="neighbour">Neighbour</option>
                  <option value="landlord">Landlord</option>
                  <option value="tenant">Tenant</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}

            {step === 1 && (
              <div className="form-step">
                <h3>Conflict Details</h3>
                <label>Briefly describe the core issue (optional, for better analysis)</label>
                <textarea
                  value={form.core_issue_summary}
                  onChange={(e) => update('core_issue_summary', e.target.value.slice(0, 500))}
                  placeholder="A brief summary helps our analysis. Maximum 500 characters."
                  rows={4}
                />
                <label>Have you attempted any previous resolution?</label>
                <select value={form.previous_attempts} onChange={(e) => update('previous_attempts', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="none">No attempts yet</option>
                  <option value="informal">Informal (direct discussion, etc.)</option>
                  <option value="formal">Formal (legal, arbitration, etc.)</option>
                </select>
                <label>Is the other party aware you&apos;re considering mediation?</label>
                <select value={form.other_party_aware} onChange={(e) => update('other_party_aware', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unsure">Unsure</option>
                </select>
              </div>
            )}

            {step === 2 && (
              <div className="form-step">
                <h3>Goals & Constraints</h3>
                <label>What outcome are you primarily seeking? *</label>
                <select value={form.primary_goal} onChange={(e) => update('primary_goal', e.target.value)} required>
                  <option value="">Select...</option>
                  <option value="relationship">Preserve or repair the relationship</option>
                  <option value="financial">Financial settlement</option>
                  <option value="closure">Closure / move on</option>
                  <option value="clarity">Clarity on rights or obligations</option>
                  <option value="other">Other</option>
                </select>
                <label>Do you have legal representation?</label>
                <select value={form.legal_representation} onChange={(e) => update('legal_representation', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="considering">Considering it</option>
                </select>
                <label>Are there any safety concerns or power imbalances?</label>
                <select value={form.safety_concerns} onChange={(e) => update('safety_concerns', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            )}

            {step === 3 && (
              <div className="form-step">
                <h3>Mediation Readiness</h3>
                <label>How willing are you to explore compromise? (1 = not at all, 5 = very willing)</label>
                <div className="scale-input">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="scale-opt">
                      <input type="radio" name="willingness" value={n} checked={form.willingness_compromise === n} onChange={() => update('willingness_compromise', n)} />
                      {n}
                    </label>
                  ))}
                </div>
                <label>How willing do you think the other party might be? (1–5)</label>
                <div className="scale-input">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="scale-opt">
                      <input type="radio" name="other_willingness" value={n} checked={form.other_party_willingness === n} onChange={() => update('other_party_willingness', n)} />
                      {n}
                    </label>
                  ))}
                </div>
                <label>What is your timeline for resolution?</label>
                <select value={form.timeline} onChange={(e) => update('timeline', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="urgent">Urgent (days)</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="flexible">Flexible</option>
                </select>
                <label>Urgency level</label>
                <select value={form.urgency} onChange={(e) => update('urgency', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}

            {step === 4 && (
              <div className="form-step">
                <h3>Contact & Consent</h3>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Optional" />
                <label className="consent-checkbox required">
                  <input type="checkbox" checked={form.consent_confidentiality} onChange={(e) => update('consent_confidentiality', e.target.checked)} required />
                  I understand that my responses are confidential and will only be used for this assessment and to connect me with mediation services. *
                </label>
                <label className="consent-checkbox">
                  <input type="checkbox" checked={form.consent_marketing} onChange={(e) => update('consent_marketing', e.target.checked)} />
                  I consent to receive follow-up and occasional communications about mediation services
                </label>
              </div>
            )}

            <div className="form-actions">
              {step > 0 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()} className="primary">
                  Next
                </button>
              ) : (
                <button type="submit" disabled={loading || !canProceed()} className="primary">
                  {loading ? 'Analyzing...' : 'Get Recommendation'}
                </button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

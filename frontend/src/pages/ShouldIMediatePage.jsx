import { useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApiClient } from '../api/client';

export default function ShouldIMediatePage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [disputeType, setDisputeType] = useState('');
  const [urgency, setUrgency] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await publicApiClient.shouldIMediate({
        email,
        phone: phone || undefined,
        dispute_type: disputeType || undefined,
        urgency: urgency || undefined,
        consent_marketing: consentMarketing,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-page should-i-mediate">
      <header className="public-header compact">
        <Link to="/">← Back</Link>
        <h1>Should I Mediate?</h1>
        <p>Take a quick assessment to see if mediation fits your dispute.</p>
      </header>

      <main className="public-main">
        {result ? (
          <div className="result-card">
            <h2>Your Recommendation</h2>
            <p className="recommendation">{result.recommendation}</p>
            <p className="next-step">{result.next_step}</p>
            {result.lead_captured && (
              <p className="lead-note">We&apos;ve received your details and will follow up shortly.</p>
            )}
            <Link to="/" className="primary">Return to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="assessment-form">
            {error && <div className="error">{error}</div>}
            <label>
              Email *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Dispute type
              <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)}>
                <option value="">Select...</option>
                <option value="employment">Employment</option>
                <option value="commercial">Commercial</option>
                <option value="family">Family</option>
                <option value="landlord_tenant">Landlord-Tenant</option>
                <option value="neighbour">Neighbour</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Urgency
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="">Select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={consentMarketing}
                onChange={(e) => setConsentMarketing(e.target.checked)}
              />
              I consent to receive follow-up and marketing communications
            </label>
            <button type="submit" disabled={loading} className="primary">
              {loading ? 'Submitting...' : 'Get Recommendation'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

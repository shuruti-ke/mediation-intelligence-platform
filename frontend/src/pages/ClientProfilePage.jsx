import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersApi } from '../api/client';

const COUNTRIES = [
  { value: 'KE', label: 'Kenya' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'GH', label: 'Ghana' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'UG', label: 'Uganda' },
];

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ display_name: '', email: '', phone: '', country: 'KE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      usersApi.getClientProfile(id).then(({ data }) => data).catch(() => null),
      usersApi.getClientCases(id).then(({ data }) => data || []).catch(() => []),
    ]).then(([user, caseList]) => {
      setClient(user);
      setCases(caseList);
      if (user) {
        setForm({
          display_name: user.display_name || '',
          email: user.email || '',
          phone: user.phone || '',
          country: user.country || 'KE',
        });
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await usersApi.updateClientProfile(id, form);
      setClient(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="client-profile-page"><p>Loading...</p></div>;
  if (!client) return <div className="client-profile-page"><p>Client not found</p></div>;

  return (
    <div className="client-profile-page">
      <header className="client-profile-header">
        <button type="button" onClick={() => navigate('/dashboard')} className="back-btn">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
      </header>
      <div className="client-profile-card">
        <h2>{client.display_name || client.email}</h2>
        <p className="client-profile-id">{client.user_id || '—'}</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSave} className="client-profile-form">
          <label>
            Contact name
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Contact number
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            Country
            <select
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          {cases.length > 0 && (
            <div className="client-profile-section">
              <h4>Cases assigned</h4>
              <ul className="client-case-list">
                {cases.map((c) => (
                  <li key={c.id}>
                    <Link to={`/cases/${c.id}`}>{c.case_number}</Link>
                    <span className="case-meta">{c.case_type || c.status || '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/dashboard')}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

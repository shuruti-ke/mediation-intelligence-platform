import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Scale, GraduationCap, Calendar, FolderOpen, LogOut, UserPlus } from 'lucide-react';
import { cases, usersApi } from '../api/client';

const COUNTRIES = [
  { value: 'KE', label: 'Kenya (+254)', prefix: '254' },
  { value: 'NG', label: 'Nigeria (+234)', prefix: '234' },
  { value: 'ZA', label: 'South Africa (+27)', prefix: '27' },
  { value: 'GH', label: 'Ghana (+233)', prefix: '233' },
  { value: 'TZ', label: 'Tanzania (+255)', prefix: '255' },
  { value: 'UG', label: 'Uganda (+256)', prefix: '256' },
];

export default function DashboardPage() {
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    full_name: '', email: '', phone: '', user_type: 'individual', country: 'KE', password: '',
  });
  useEffect(() => {
    const params = filter === 'draft' ? { status: 'draft' } : {};
    cases.list(params).then(({ data }) => setCaseList(data)).catch(() => setCaseList([])).finally(() => setLoading(false));
  }, [filter]);

  const handleOnboardClient = async (e) => {
    e.preventDefault();
    const countryMeta = COUNTRIES.find((c) => c.value === onboardForm.country);
    const prefix = countryMeta?.prefix || '';
    const digits = onboardForm.phone.replace(/\D/g, '');
    const phone = onboardForm.phone.startsWith('+') ? onboardForm.phone : `+${prefix}${digits}`;
    try {
      await usersApi.onboardClient({
        full_name: onboardForm.full_name,
        email: onboardForm.email,
        phone,
        user_type: onboardForm.user_type,
        country: onboardForm.country,
        password: onboardForm.password,
      });
      setOnboardOpen(false);
      setOnboardForm({ full_name: '', email: '', phone: '', user_type: 'individual', country: 'KE', password: '' });
      alert('Client submitted for admin approval.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit');
    }
  };

  return (
    <div className="dashboard mediator-dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Mediation Dashboard</h1>
        </div>
        <nav>
          <Link to="/cases/new"><Plus size={16} /> New Case</Link>
          <button type="button" onClick={() => setOnboardOpen(true)}><UserPlus size={16} /> Onboard Client</button>
          <Link to="/library"><BookOpen size={16} /> Library</Link>
          <Link to="/judiciary"><Scale size={16} /> Judiciary</Link>
          <Link to="/training"><GraduationCap size={16} /> Training</Link>
          <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}><LogOut size={16} /> Sign out</Link>
        </nav>
      </header>
      <section>
        <div className="cases-header">
          <h2 className="icon-text"><FolderOpen size={22} /> Cases</h2>
          <div className="case-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'draft' ? 'active' : ''} onClick={() => setFilter('draft')}>My Drafts</button>
          </div>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : caseList.length === 0 ? (
          <p>{filter === 'draft' ? 'No drafts yet.' : 'No cases yet.'} <Link to="/cases/new"><Plus size={14} /> Create your first case</Link></p>
        ) : (
          <ul className="case-list">
            {caseList.map((c) => (
              <li key={c.id}>
                <Link to={`/cases/${c.id}`}>
                  <span className="case-number">{c.case_number}</span>
                  <span className="case-status">{c.status}</span>
                  <span className="case-category">{c.dispute_category || '-'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {onboardOpen && (
        <div className="modal-overlay" onClick={() => setOnboardOpen(false)}>
          <div className="modal-card modal-intake" onClick={(e) => e.stopPropagation()}>
            <h3>Onboard Client (Pending Admin Approval)</h3>
            <p className="section-desc" style={{ marginBottom: '1rem' }}>Submit client details for admin approval. They will receive a User ID once approved.</p>
            <form onSubmit={handleOnboardClient} className="intake-form">
              <label>
                Full name <span className="required">*</span>
                <input type="text" placeholder="Full name or organization" value={onboardForm.full_name} onChange={(e) => setOnboardForm({ ...onboardForm, full_name: e.target.value })} required minLength={2} />
              </label>
              <label>
                Email <span className="required">*</span>
                <input type="email" placeholder="Email" value={onboardForm.email} onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })} required />
              </label>
              <label>
                User type <span className="required">*</span>
                <div className="user-type-toggle">
                  <button type="button" className={onboardForm.user_type === 'individual' ? 'active teal' : ''} onClick={() => setOnboardForm({ ...onboardForm, user_type: 'individual' })}>Individual</button>
                  <button type="button" className={onboardForm.user_type === 'corporate' ? 'active indigo' : ''} onClick={() => setOnboardForm({ ...onboardForm, user_type: 'corporate' })}>Corporate</button>
                </div>
              </label>
              <label>
                Country <span className="required">*</span>
                <select value={onboardForm.country} onChange={(e) => setOnboardForm({ ...onboardForm, country: e.target.value })}>
                  {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label>
                Phone <span className="required">*</span>
                <div className="phone-input">
                  <span className="phone-prefix">+{COUNTRIES.find((c) => c.value === onboardForm.country)?.prefix || ''}</span>
                  <input type="tel" placeholder="Phone" value={onboardForm.phone} onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })} required />
                </div>
              </label>
              <label>
                Password <span className="required">*</span>
                <input type="password" placeholder="Set password" value={onboardForm.password} onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })} required minLength={6} />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setOnboardOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

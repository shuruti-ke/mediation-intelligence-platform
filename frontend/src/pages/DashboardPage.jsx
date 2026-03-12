import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Scale, GraduationCap, Calendar, FolderOpen, LogOut, UserPlus, Search, Users } from 'lucide-react';
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
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [caseSearch, setCaseSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [clientCases, setClientCases] = useState([]);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    full_name: '', email: '', phone: '', user_type: 'individual', country: 'KE', password: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    const params = filter === 'draft' ? { status: 'draft' } : {};
    setLoading(true);
    cases.list(params).then(({ data }) => setCaseList(data)).catch(() => setCaseList([])).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setClientsLoading(true);
      usersApi.myClients({ search: clientSearch?.trim() || undefined }).then(({ data }) => setClients(data || [])).catch(() => setClients([])).finally(() => setClientsLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

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
          <button type="button" className="primary" onClick={() => setOnboardOpen(true)}><UserPlus size={16} /> Onboard Client</button>
          <Link to="/library"><BookOpen size={16} /> Library</Link>
          <Link to="/judiciary"><Scale size={16} /> Judiciary</Link>
          <Link to="/training"><GraduationCap size={16} /> Training</Link>
          <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}><LogOut size={16} /> Sign out</Link>
        </nav>
      </header>
      <section className="mediator-split-section">
        <div className="mediator-split">
          <aside className="mediator-split-left">
            <div className="mediator-panel">
              <h3 className="mediator-panel-title"><Users size={16} /> My Clients</h3>
              <div className="mediator-panel-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
              <div className="mediator-panel-list">
                {clientsLoading ? <p>Loading...</p> : clients.length === 0 ? (
                  <p className="empty-msg">No clients assigned.</p>
                ) : (
                  clients.map((c) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className={`mediator-panel-item ${selectedClient?.id === c.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedClient(c);
                        setSelectedCase(null);
                        usersApi.getClientCases(c.id).then(({ data }) => setClientCases(data || [])).catch(() => setClientCases([]));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSelectedClient(c);
                          setSelectedCase(null);
                          usersApi.getClientCases(c.id).then(({ data }) => setClientCases(data || [])).catch(() => setClientCases([]));
                        }
                      }}
                    >
                      <span className="mediator-panel-item-name">{c.display_name || c.email || '—'}</span>
                      <span className="mediator-panel-item-meta">{c.user_id || c.email}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mediator-panel">
              <div className="mediator-panel-header">
                <h3 className="mediator-panel-title"><FolderOpen size={16} /> My Cases</h3>
                <div className="case-filters case-filters-inline">
                  <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
                  <button className={filter === 'draft' ? 'active' : ''} onClick={() => setFilter('draft')}>Drafts</button>
                </div>
              </div>
              <div className="mediator-panel-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search cases..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                />
              </div>
              <div className="mediator-panel-list">
                {loading ? <p>Loading...</p> : (
                  (caseSearch ? caseList.filter((c) =>
                    (c.case_number || '').toLowerCase().includes(caseSearch.toLowerCase()) ||
                    (c.title || '').toLowerCase().includes(caseSearch.toLowerCase()) ||
                    (c.dispute_category || '').toLowerCase().includes(caseSearch.toLowerCase())
                  ) : caseList).map((c) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className={`mediator-panel-item ${selectedCase?.id === c.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedCase(c); setSelectedClient(null); setClientCases([]); }}
                      onKeyDown={(e) => e.key === 'Enter' && (setSelectedCase(c), setSelectedClient(null), setClientCases([]))}
                    >
                      <span className="mediator-panel-item-name">{c.case_number}</span>
                      <span className="mediator-panel-item-meta">{c.dispute_category || c.status || '—'}</span>
                    </div>
                  ))
                )}
                {!loading && caseList.length === 0 && <p className="empty-msg">No cases yet.</p>}
              </div>
            </div>
          </aside>
          <div className="mediator-split-right">
            {selectedClient ? (
              <div className="mediator-detail">
                <h3>{selectedClient.display_name || selectedClient.email || '—'}</h3>
                <p className="mediator-detail-id">{selectedClient.user_id || '—'}</p>
                <div className="mediator-detail-section">
                  <h4>Contact</h4>
                  <p><strong>Email:</strong> {selectedClient.email}</p>
                  <p><strong>Phone:</strong> {selectedClient.phone || '—'}</p>
                  <p><strong>Country:</strong> {selectedClient.country || '—'}</p>
                </div>
                <div className="mediator-detail-section">
                  <h4>Account</h4>
                  <p><strong>Status:</strong> {selectedClient.status}</p>
                  <p><strong>Active:</strong> {selectedClient.is_active ? 'Yes' : 'No'}</p>
                  <p><strong>Approval:</strong> {selectedClient.approval_status || '—'}</p>
                  <p><strong>Created:</strong> {selectedClient.created_at?.slice(0, 10)}</p>
                  <p><strong>Last Login:</strong> {selectedClient.last_login_at ? new Date(selectedClient.last_login_at).toLocaleString() : '—'}</p>
                </div>
                <div className="mediator-detail-section">
                  <h4>Cases assigned</h4>
                  {clientCases.length > 0 ? (
                    <ul className="mediator-case-list">
                      {clientCases.map((c) => (
                        <li key={c.id}>
                          <Link to={`/cases/${c.id}`} className="mediator-case-link">{c.case_number}</Link>
                          <span className="mediator-case-meta">{c.case_type || c.status || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-msg">No cases assigned. Use client&apos;s User ID ({selectedClient.user_id || '—'}) as Internal reference when creating a new case.</p>
                  )}
                </div>
                <div className="mediator-detail-actions">
                  <Link to={`/users/${selectedClient.id}`} className="btn-sm primary">Edit Client</Link>
                </div>
              </div>
            ) : selectedCase ? (
              <div className="mediator-detail">
                <h3>{selectedCase.case_number}</h3>
                <p className="mediator-detail-id">{selectedCase.title || selectedCase.dispute_category || '—'}</p>
                <div className="mediator-detail-section">
                  <h4>Case Details</h4>
                  <p><strong>Status:</strong> {selectedCase.status}</p>
                  <p><strong>Type:</strong> {selectedCase.case_type || selectedCase.dispute_category || '—'}</p>
                  <p><strong>Priority:</strong> {selectedCase.priority_level || '—'}</p>
                  <p><strong>Jurisdiction:</strong> {[selectedCase.jurisdiction_country, selectedCase.jurisdiction_region, selectedCase.jurisdiction_county_state].filter(Boolean).join(', ') || '—'}</p>
                </div>
                <div className="mediator-detail-section">
                  <h4>Description</h4>
                  <p>{selectedCase.short_description || selectedCase.detailed_narrative || '—'}</p>
                </div>
                <div className="mediator-detail-section">
                  <h4>Timeline</h4>
                  <p><strong>Created:</strong> {selectedCase.created_at?.slice(0, 10)}</p>
                  <p><strong>Updated:</strong> {selectedCase.updated_at?.slice(0, 10) || '—'}</p>
                </div>
                <Link to={`/cases/${selectedCase.id}`} className="btn-sm primary">View Case</Link>
              </div>
            ) : (
              <div className="mediator-detail-empty">
                <p>Select a client or case from the list to view details.</p>
                <Link to="/cases/new" className="primary"><Plus size={16} /> New Case</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {onboardOpen && (
        <div className="modal-overlay" onClick={() => setOnboardOpen(false)}>
          <div className="modal-card modal-intake" onClick={(e) => e.stopPropagation()}>
            <h3>Onboard Client (Pending Admin Approval)</h3>
            <p className="section-desc" style={{ marginBottom: '1rem' }}>Submit client details for admin approval. They will receive a User ID once approved.</p>
            <form onSubmit={handleOnboardClient} className="intake-form">
              <label>
                Contact name <span className="required">*</span>
                <input type="text" placeholder="Full name or organization" value={onboardForm.full_name} onChange={(e) => setOnboardForm({ ...onboardForm, full_name: e.target.value })} required minLength={2} />
              </label>
              <label>
                Contact email <span className="required">*</span>
                <input type="email" placeholder="Email" value={onboardForm.email} onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })} required />
              </label>
              <label>
                Contact number <span className="required">*</span>
                <div className="phone-input">
                  <span className="phone-prefix">+{COUNTRIES.find((c) => c.value === onboardForm.country)?.prefix || ''}</span>
                  <input type="tel" placeholder="Phone" value={onboardForm.phone} onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })} required />
                </div>
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

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { LayoutDashboard, Users, Building2, BookOpen, Calendar, LogOut, BarChart3, UserPlus, Upload, Trash2, UserCog, MapPin, FileText, Download, X } from 'lucide-react';
import { tenantsApi, usersApi, analyticsApi, knowledge, calendarApi } from '../api/client';

const STATUS_BADGES = {
  active: { label: 'Active', class: 'badge-active' },
  pending: { label: 'Pending', class: 'badge-pending' },
  inactive: { label: 'Inactive', class: 'badge-inactive' },
};

const USER_TYPE_BADGES = {
  client_individual: { label: 'Individual', class: 'badge-teal' },
  client_corporate: { label: 'Corporate', class: 'badge-indigo' },
};

const COUNTRIES = [
  { value: 'KE', label: 'Kenya (+254)', prefix: '254' },
  { value: 'NG', label: 'Nigeria (+234)', prefix: '234' },
  { value: 'ZA', label: 'South Africa (+27)', prefix: '27' },
  { value: 'GH', label: 'Ghana (+233)', prefix: '233' },
  { value: 'TZ', label: 'Tanzania (+255)', prefix: '255' },
  { value: 'UG', label: 'Uganda (+256)', prefix: '256' },
];

const REASSIGN_REASONS = [
  { value: 'conflict_of_interest', label: 'Conflict of Interest' },
  { value: 'user_request', label: 'User Request' },
  { value: 'workload', label: 'Workload' },
  { value: 'other', label: 'Other' },
];

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('dashboard');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [mediators, setMediators] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [mediatorPerformance, setMediatorPerformance] = useState([]);
  const [geographic, setGeographic] = useState([]);
  const [unresolved, setUnresolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    user_type: 'individual',
    country: 'KE',
    password: '',
    invite_via_link: false,
  });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignUser, setReassignUser] = useState(null);
  const [reassignForm, setReassignForm] = useState({ mediator_id: '', reason: '', note: '', notify: true });
  const [orgDocs, setOrgDocs] = useState([]);
  const [orgUploadFile, setOrgUploadFile] = useState(null);
  const [orgUploadTitle, setOrgUploadTitle] = useState('');
  const [orgUploading, setOrgUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [viewDocContent, setViewDocContent] = useState(null);

  useEffect(() => {
    if (tab === 'users') {
      calendarApi.listMediators().then(({ data }) => setMediators(data || [])).catch(() => setMediators([]));
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'orgkb') {
      setLoading(true);
      knowledge.listOrgDocuments()
        .then(({ data }) => setOrgDocs(data || []))
        .catch(() => setOrgDocs([]))
        .finally(() => setLoading(false));
    } else if (tab === 'tenants') {
      tenantsApi.list()
        .then(({ data }) => setTenants(data || []))
        .catch(() => setTenants([]))
        .finally(() => setLoading(false));
    } else if (tab === 'users') {
      usersApi.list()
        .then(({ data }) => setUsers(data || []))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(true);
      Promise.allSettled([
        analyticsApi.getDashboard().then(({ data }) => data),
        analyticsApi.getTimeseries(12).then(({ data }) => data),
        analyticsApi.getMediators().then(({ data }) => data),
        analyticsApi.getGeographic().then(({ data }) => data),
        analyticsApi.getUnresolvedCases(30).then(({ data }) => data),
      ]).then(([a, ts, m, g, u]) => {
        setAnalytics(a.status === 'fulfilled' ? a.value : null);
        setTimeseries(ts.status === 'fulfilled' ? ts.value || [] : []);
        setMediatorPerformance(m.status === 'fulfilled' ? m.value || [] : []);
        setGeographic(g.status === 'fulfilled' ? g.value || [] : []);
        setUnresolved(u.status === 'fulfilled' ? u.value || [] : []);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab]);

  const handleToggleActive = async (u) => {
    try {
      await usersApi.updateStatus(u.id, { is_active: !u.is_active, status: u.is_active ? 'inactive' : 'active' });
      setUsers(users.map(x => x.id === u.id ? { ...x, is_active: !x.is_active, status: x.is_active ? 'inactive' : 'active' } : x));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    const countryMeta = COUNTRIES.find((c) => c.value === onboardForm.country);
    const prefix = countryMeta?.prefix || '';
    const digits = onboardForm.phone.replace(/\D/g, '');
    const phone = onboardForm.phone.startsWith('+') ? onboardForm.phone : `+${prefix}${digits}`;
    const payload = {
      full_name: onboardForm.full_name,
      email: onboardForm.email,
      phone,
      user_type: onboardForm.user_type,
      country: onboardForm.country,
      invite_via_link: onboardForm.invite_via_link,
    };
    if (!onboardForm.invite_via_link) payload.password = onboardForm.password;
    try {
      await usersApi.intake(payload);
      setOnboardOpen(false);
      setOnboardForm({ full_name: '', email: '', phone: '', user_type: 'individual', country: 'KE', password: '', invite_via_link: false });
      if (tab === 'users') usersApi.list().then(({ data }) => setUsers(data || []));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignUser || !reassignForm.mediator_id) return;
    try {
      await usersApi.reassignMediator(reassignUser.id, {
        mediator_id: reassignForm.mediator_id,
        reason: reassignForm.reason || undefined,
        note: reassignForm.note || undefined,
        notify_user_and_mediator: reassignForm.notify,
      });
      setReassignOpen(false);
      setReassignUser(null);
      setReassignForm({ mediator_id: '', reason: '', note: '', notify: true });
      if (tab === 'users') usersApi.list().then(({ data }) => setUsers(data || []));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reassign');
    }
  };

  return (
    <div className="dashboard admin-dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Admin Dashboard</h1>
        </div>
        <nav>
          <button className={tab === 'dashboard' ? 'nav-active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard size={16} /> Dashboard</button>
          <button className={tab === 'users' ? 'nav-active' : ''} onClick={() => setTab('users')}><Users size={16} /> Users</button>
          <button className={tab === 'tenants' ? 'nav-active' : ''} onClick={() => setTab('tenants')}><Building2 size={16} /> Tenants</button>
          <button className={tab === 'orgkb' ? 'nav-active' : ''} onClick={() => setTab('orgkb')}><BookOpen size={16} /> Org KB</button>
          <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}><LogOut size={16} /> Sign out</Link>
        </nav>
      </header>

      {tab === 'dashboard' && (
        <section className="admin-dashboard-section">
          <h2 className="icon-text"><BarChart3 size={22} /> Analytics</h2>
          {loading ? <p>Loading...</p> : analytics ? (
            <>
              <div className="analytics-widgets">
                <div className="widget-card">
                  <span className="widget-value">{analytics.active_cases ?? 0}</span>
                  <span className="widget-label">Active Cases</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.total_cases ?? 0}</span>
                  <span className="widget-label">Total Cases</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.resolution_rate ?? 0}%</span>
                  <span className="widget-label">Resolution Rate</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.total_users ?? 0}</span>
                  <span className="widget-label">Total Users</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.new_users_30d ?? 0}</span>
                  <span className="widget-label">New Users (30d)</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.active_mediators ?? 0}</span>
                  <span className="widget-label">Active Mediators</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{analytics.training_completed ?? 0}</span>
                  <span className="widget-label">Training Completed</span>
                </div>
                <div className="widget-card">
                  <span className="widget-value">{(analytics.revenue_minor_units ?? 0) / 100}</span>
                  <span className="widget-label">Revenue (units)</span>
                </div>
              </div>

              {timeseries?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title">Cases Created vs Resolved (12 months)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={timeseries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="created" name="Created" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#34d399" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {mediatorPerformance?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title">Mediator Performance</h3>
                  <div className="mediator-grid">
                    {mediatorPerformance.map((m) => (
                      <div key={m.id} className={`mediator-card ${m.resolution_rate >= 70 ? 'high' : m.resolution_rate >= 40 ? 'medium' : 'low'}`}>
                        <span className="mediator-name">{m.name}</span>
                        <span className="mediator-cases">{m.cases_handled} cases</span>
                        <span className="mediator-rate">{m.resolution_rate}% resolution</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {geographic?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title"><MapPin size={18} /> Cases & Users by Country</h3>
                  <div className="geographic-grid">
                    {geographic.map(({ country, cases, users }) => (
                      <div key={country} className="geographic-item">
                        <span className="geo-country">{country}</span>
                        <span className="geo-cases">{cases} cases</span>
                        <span className="geo-users">{users} users</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unresolved?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title"><FileText size={18} /> Unresolved Cases (&gt;30 days)</h3>
                  <div className="unresolved-list">
                    {unresolved.slice(0, 10).map((c) => (
                      <div key={c.id} className="unresolved-item">
                        <span className="unresolved-title">{c.case_number} – {c.title}</span>
                        <span className="unresolved-meta">{c.days_unresolved}d · {c.status}</span>
                      </div>
                    ))}
                    {unresolved.length > 10 && <p className="unresolved-more">+{unresolved.length - 10} more</p>}
                  </div>
                </div>
              )}
            </>
          ) : <p>No analytics data.</p>}
        </section>
      )}

      {tab === 'users' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><Users size={22} /> User Management</h2>
            <button className="primary" onClick={() => setOnboardOpen(true)}><UserPlus size={16} /> New User</button>
          </div>
          {loading ? <p>Loading...</p> : (
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>Mediator</th>
                    <th>Status</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.display_name || '-'}</td>
                      <td>
                        <span className={`badge ${USER_TYPE_BADGES[u.role]?.class || ''}`}>
                          {USER_TYPE_BADGES[u.role]?.label || u.role}
                        </span>
                      </td>
                      <td>{u.phone || '-'}</td>
                      <td>{u.assigned_mediator_id ? 'Assigned' : 'Unassigned'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGES[u.status]?.class || 'badge-pending'}`}>
                          {STATUS_BADGES[u.status]?.label || u.status}
                        </span>
                      </td>
                      <td>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={u.is_active}
                            onChange={() => handleToggleActive(u)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td>
                        {(u.role === 'client_individual' || u.role === 'client_corporate') && (
                          <button className="btn-sm" onClick={() => { setReassignUser(u); setReassignForm({ mediator_id: u.assigned_mediator_id || '', reason: '', note: '', notify: true }); setReassignOpen(true); }} title="Reassign mediator">
                            <UserCog size={14} /> Reassign
                          </button>
                        )}
                        <button className="btn-sm" onClick={() => handleToggleActive(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="empty-msg">No users yet. Click Onboard User to add.</p>}
            </div>
          )}
        </section>
      )}

      {tab === 'orgkb' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><BookOpen size={22} /> Organization Knowledge Base</h2>
          </div>
          <p className="section-desc">Documents here are visible to all mediators. Mediators can also contribute by marking their uploads as &quot;Share with organization&quot;.</p>
          <div className="orgkb-upload">
            <input
              type="text"
              placeholder="Title (optional)"
              value={orgUploadTitle}
              onChange={e => setOrgUploadTitle(e.target.value)}
            />
            <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={e => setOrgUploadFile(e.target.files?.[0])} />
            <button
              className="primary"
              disabled={!orgUploadFile || orgUploading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={async () => {
                if (!orgUploadFile) return;
                setOrgUploading(true);
                try {
                  await knowledge.ingestOrg(orgUploadFile, orgUploadTitle || undefined);
                  setOrgUploadFile(null);
                  setOrgUploadTitle('');
                  knowledge.listOrgDocuments().then(({ data }) => setOrgDocs(data || []));
                } catch (err) {
                  alert(err.response?.data?.detail || 'Upload failed');
                } finally {
                  setOrgUploading(false);
                }
              }}
            >
              <Upload size={16} /> {orgUploading ? 'Uploading…' : 'Upload to Org KB'}
            </button>
          </div>
          {loading ? <p>Loading...</p> : (
            <ul className="orgkb-list">
              {orgDocs.map((d) => (
                <li key={d.id} className="orgkb-item">
                  <button
                    type="button"
                    className="orgkb-title-btn"
                    onClick={async () => {
                      setViewDoc(d);
                      setViewDocContent(null);
                      try {
                        const { data } = await knowledge.getDocumentContent(d.id);
                        setViewDocContent(data);
                      } catch (err) {
                        setViewDocContent({ error: err.response?.data?.detail || 'Failed to load' });
                      }
                    }}
                  >
                    {d.title}
                  </button>
                  <span className="orgkb-badge">{d.is_org ? 'Org' : 'Shared'}</span>
                  <button
                    className="btn-sm"
                    title="Download"
                    onClick={async () => {
                      try {
                        const { data } = await knowledge.downloadDocument(d.id);
                        const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = d.original_filename || `${d.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert(err.response?.data?.detail || 'Download failed');
                      }
                    }}
                  >
                    <Download size={14} />
                  </button>
                  {d.is_org && (
                    <button
                      className="btn-sm btn-danger"
                      onClick={async () => {
                        if (!confirm('Delete this document from the organization knowledge base?')) return;
                        try {
                          await knowledge.deleteDocument(d.id);
                          setOrgDocs(orgDocs.filter(x => x.id !== d.id));
                          if (viewDoc?.id === d.id) setViewDoc(null);
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Delete failed');
                        }
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </li>
              ))}
              {orgDocs.length === 0 && <p className="empty-msg">No organization documents yet.</p>}
            </ul>
          )}
          {viewDoc && (
            <div className="modal-overlay" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
              <div className="modal-card modal-doc-view" onClick={e => e.stopPropagation()}>
                <div className="modal-doc-header">
                  <h3>{viewDoc.title}</h3>
                  <button type="button" className="btn-close" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-doc-body">
                  {viewDocContent === null ? (
                    <p>Loading...</p>
                  ) : viewDocContent.error ? (
                    <p className="doc-error">{viewDocContent.error}</p>
                  ) : (
                    <pre className="doc-content">{viewDocContent.content_text || '(No content)'}</pre>
                  )}
                </div>
                <div className="modal-doc-actions">
                  {viewDocContent && !viewDocContent.error && (
                    <button
                      className="primary"
                      onClick={async () => {
                        try {
                          const { data } = await knowledge.downloadDocument(viewDoc.id);
                          const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = viewDoc.original_filename || `${viewDoc.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Download failed');
                        }
                      }}
                    >
                      <Download size={16} /> Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'tenants' && (
        <section className="admin-dashboard-section">
          <h2 className="icon-text"><Building2 size={22} /> Tenants</h2>
          {loading ? <p>Loading...</p> : tenants.length === 0 ? (
            <p>No tenants yet.</p>
          ) : (
            <ul className="tenant-list">
              {tenants.map((t) => (
                <li key={t.id}>
                  <div className="tenant-card">
                    <span className="tenant-name">{t.name}</span>
                    <span className="tenant-region">{t.data_residency_region}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {onboardOpen && (
        <div className="modal-overlay" onClick={() => setOnboardOpen(false)}>
          <div className="modal-card modal-intake" onClick={e => e.stopPropagation()}>
            <h3>New User – Minimal Intake</h3>
            <form onSubmit={handleOnboard} className="intake-form">
              <label>
                Full name <span className="required">*</span>
                <input
                  type="text"
                  placeholder="Full name or organization name"
                  value={onboardForm.full_name}
                  onChange={e => setOnboardForm({ ...onboardForm, full_name: e.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Email <span className="required">*</span>
                <input
                  type="email"
                  placeholder="Email"
                  value={onboardForm.email}
                  onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                  required
                />
              </label>
              <label>
                User type <span className="required">*</span>
                <div className="user-type-toggle">
                  <button
                    type="button"
                    className={onboardForm.user_type === 'individual' ? 'active teal' : ''}
                    onClick={() => setOnboardForm({ ...onboardForm, user_type: 'individual' })}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    className={onboardForm.user_type === 'corporate' ? 'active indigo' : ''}
                    onClick={() => setOnboardForm({ ...onboardForm, user_type: 'corporate' })}
                  >
                    Corporate
                  </button>
                </div>
              </label>
              <label>
                Country of residence <span className="required">*</span>
                <select
                  value={onboardForm.country}
                  onChange={e => setOnboardForm({ ...onboardForm, country: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Phone <span className="required">*</span>
                <div className="phone-input">
                  <span className="phone-prefix">+{COUNTRIES.find((c) => c.value === onboardForm.country)?.prefix || ''}</span>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={onboardForm.phone}
                    onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    required
                  />
                </div>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={onboardForm.invite_via_link}
                  onChange={e => setOnboardForm({ ...onboardForm, invite_via_link: e.target.checked })}
                />
                Invite via link (no password)
              </label>
              {!onboardForm.invite_via_link && (
                <label>
                  Password <span className="required">*</span>
                  <input
                    type="password"
                    placeholder="Set password"
                    value={onboardForm.password}
                    onChange={e => setOnboardForm({ ...onboardForm, password: e.target.value })}
                    required={!onboardForm.invite_via_link}
                  />
                </label>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setOnboardOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reassignOpen && reassignUser && (
        <div className="modal-overlay" onClick={() => setReassignOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Reassign Mediator – {reassignUser.display_name || reassignUser.email}</h3>
            <form onSubmit={handleReassign}>
              <label>
                Mediator
                <select
                  value={reassignForm.mediator_id}
                  onChange={e => setReassignForm({ ...reassignForm, mediator_id: e.target.value })}
                  required
                >
                  <option value="">Select mediator</option>
                  {mediators.map((m) => (
                    <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <select
                  value={reassignForm.reason}
                  onChange={e => setReassignForm({ ...reassignForm, reason: e.target.value })}
                >
                  <option value="">Select</option>
                  {REASSIGN_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <textarea
                  placeholder="Optional note"
                  value={reassignForm.note}
                  onChange={e => setReassignForm({ ...reassignForm, note: e.target.value })}
                  rows={2}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reassignForm.notify}
                  onChange={e => setReassignForm({ ...reassignForm, notify: e.target.checked })}
                />
                Notify user & new mediator
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setReassignOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Reassign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

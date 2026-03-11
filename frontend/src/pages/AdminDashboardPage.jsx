import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, BookOpen, Calendar, LogOut, BarChart3, UserPlus, Upload, Trash2 } from 'lucide-react';
import { tenantsApi, usersApi, analyticsApi, knowledge } from '../api/client';

const STATUS_BADGES = {
  active: { label: 'Active', class: 'badge-active' },
  pending: { label: 'Pending', class: 'badge-pending' },
  inactive: { label: 'Inactive', class: 'badge-inactive' },
};

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('dashboard');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ email: '', password: '', display_name: '', role: 'mediator' });
  const [orgDocs, setOrgDocs] = useState([]);
  const [orgUploadFile, setOrgUploadFile] = useState(null);
  const [orgUploadTitle, setOrgUploadTitle] = useState('');
  const [orgUploading, setOrgUploading] = useState(false);

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
      analyticsApi.getDashboard()
        .then(({ data }) => setAnalytics(data))
        .catch(() => setAnalytics(null))
        .finally(() => setLoading(false));
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
    try {
      await usersApi.onboard(onboardForm);
      setOnboardOpen(false);
      setOnboardForm({ email: '', password: '', display_name: '', role: 'mediator' });
      if (tab === 'users') usersApi.list().then(({ data }) => setUsers(data || []));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to onboard');
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
            <div className="analytics-widgets">
              <div className="widget-card">
                <span className="widget-value">{analytics.active_cases ?? 0}</span>
                <span className="widget-label">Active Cases</span>
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
                <span className="widget-value">{analytics.training_completed ?? 0}</span>
                <span className="widget-label">Training Completed</span>
              </div>
              <div className="widget-card">
                <span className="widget-value">{(analytics.revenue_minor_units ?? 0) / 100}</span>
                <span className="widget-label">Revenue (units)</span>
              </div>
            </div>
          ) : <p>No analytics data.</p>}
        </section>
      )}

      {tab === 'users' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><Users size={22} /> User Management</h2>
            <button className="primary" onClick={() => setOnboardOpen(true)}><UserPlus size={16} /> Onboard User</button>
          </div>
          {loading ? <p>Loading...</p> : (
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
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
                      <td>{u.role}</td>
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
                  <span className="orgkb-title">{d.title}</span>
                  <span className="orgkb-badge">{d.is_org ? 'Org' : 'Shared'}</span>
                  {d.is_org && (
                    <button
                      className="btn-sm btn-danger"
                      onClick={async () => {
                        if (!confirm('Delete this document from the organization knowledge base?')) return;
                        try {
                          await knowledge.deleteDocument(d.id);
                          setOrgDocs(orgDocs.filter(x => x.id !== d.id));
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
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Onboard User</h3>
            <form onSubmit={handleOnboard}>
              <input
                type="email"
                placeholder="Email"
                value={onboardForm.email}
                onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={onboardForm.password}
                onChange={e => setOnboardForm({ ...onboardForm, password: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={onboardForm.display_name}
                onChange={e => setOnboardForm({ ...onboardForm, display_name: e.target.value })}
              />
              <select
                value={onboardForm.role}
                onChange={e => setOnboardForm({ ...onboardForm, role: e.target.value })}
              >
                <option value="mediator">Mediator</option>
                <option value="trainee">Trainee</option>
                <option value="client_individual">Client (Individual)</option>
                <option value="client_corporate">Client (Corporate)</option>
              </select>
              <div className="modal-actions">
                <button type="button" onClick={() => setOnboardOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Onboard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tenantsApi, usersApi, analyticsApi } from '../api/client';

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

  useEffect(() => {
    if (tab === 'tenants') {
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
          <button className={tab === 'dashboard' ? 'nav-active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'users' ? 'nav-active' : ''} onClick={() => setTab('users')}>Users</button>
          <button className={tab === 'tenants' ? 'nav-active' : ''} onClick={() => setTab('tenants')}>Tenants</button>
          <Link to="/calendar">Calendar</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}>Sign out</Link>
        </nav>
      </header>

      {tab === 'dashboard' && (
        <section className="admin-dashboard-section">
          <h2>Analytics</h2>
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
            <h2>User Management</h2>
            <button className="primary" onClick={() => setOnboardOpen(true)}>Onboard User</button>
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

      {tab === 'tenants' && (
        <section className="admin-dashboard-section">
          <h2>Tenants</h2>
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

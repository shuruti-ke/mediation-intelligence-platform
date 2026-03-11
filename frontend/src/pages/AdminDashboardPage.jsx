import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tenantsApi } from '../api/client';

export default function AdminDashboardPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantsApi.list()
      .then(({ data }) => setTenants(data || []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard admin-dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Admin Dashboard</h1>
        </div>
        <nav>
          <Link to="/admin">Tenants</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}>Sign out</Link>
        </nav>
      </header>
      <section>
        <h2>Tenants</h2>
        {loading ? (
          <p>Loading...</p>
        ) : tenants.length === 0 ? (
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
    </div>
  );
}

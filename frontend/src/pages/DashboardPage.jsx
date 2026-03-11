import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cases } from '../api/client';

export default function DashboardPage() {
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cases.list().then(({ data }) => setCaseList(data)).catch(() => setCaseList([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Mediation Dashboard</h1>
        </div>
        <nav>
          <Link to="/cases/new">+ New Case</Link>
          <Link to="/library">Library</Link>
          <Link to="/judiciary">Judiciary Search</Link>
          <Link to="/training">Training</Link>
        </nav>
      </header>
      <section>
        <h2>Cases</h2>
        {loading ? (
          <p>Loading...</p>
        ) : caseList.length === 0 ? (
          <p>No cases yet. <Link to="/cases/new">Create your first case</Link></p>
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
    </div>
  );
}

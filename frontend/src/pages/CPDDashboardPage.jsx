import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trainingApi } from '../api/client';

export default function CPDDashboardPage() {
  const [cpd, setCpd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    trainingApi.getCpd(year)
      .then(({ data }) => setCpd(data))
      .catch(() => setCpd(null))
      .finally(() => setLoading(false));
  }, [year]);

  const pct = cpd ? Math.min(100, (cpd.hours_completed / cpd.hours_required) * 100) : 0;

  return (
    <div className="cpd-page">
      <header>
        <h1>CPD Dashboard</h1>
        <nav>
          <Link to="/training">← Training</Link>
        </nav>
      </header>
      <section>
        <div className="year-select">
          <label>Year:</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year, year - 1, year - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : cpd ? (
          <>
            <div className="cpd-progress">
              <h2>Hours Progress</h2>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p>{cpd.hours_completed} / {cpd.hours_required} hours</p>
            </div>
            {cpd.certifications?.length > 0 && (
              <div className="certifications">
                <h3>Certifications</h3>
                <ul>
                  {cpd.certifications.map((c, i) => (
                    <li key={i}>{c.name || c} - {c.date || c.issuer || ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p>No CPD data.</p>
        )}
      </section>
    </div>
  );
}

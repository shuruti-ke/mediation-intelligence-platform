import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trainingApi } from '../api/client';

export default function TrainingPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trainingApi.listModules()
      .then(({ data }) => setModules(data))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="training-page">
      <header>
        <h1>Training & Induction</h1>
        <nav>
          <Link to="/dashboard">← Dashboard</Link>
          <Link to="/training/cpd">CPD Dashboard</Link>
          <Link to="/training/role-play">Role-Play Studio</Link>
        </nav>
      </header>
      <section>
        <h2>Induction Modules</h2>
        <p className="subtitle">Complete these modules to earn CPD credits.</p>
        {loading ? (
          <p>Loading...</p>
        ) : modules.length === 0 ? (
          <p>No modules available.</p>
        ) : (
          <ul className="module-list">
            {modules.map((m) => (
              <li key={m.id}>
                <Link to={`/training/modules/${m.id}`} className="module-card">
                  <div className="module-header">
                    <h3>{m.title}</h3>
                    {m.completed ? (
                      <span className="badge completed">Completed</span>
                    ) : (
                      <span className="badge">{m.progress_pct}%</span>
                    )}
                  </div>
                  <p>{m.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

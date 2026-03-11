import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trainingApi } from '../api/client';

export default function TrainingPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reflection, setReflection] = useState(null);
  const [cpd, setCpd] = useState(null);

  useEffect(() => {
    trainingApi.listModules()
      .then(({ data }) => setModules(data))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    trainingApi.getReflection()
      .then(({ data }) => setReflection(data?.prompt))
      .catch(() => setReflection(null));
    trainingApi.getCpd()
      .then(({ data }) => setCpd(data))
      .catch(() => setCpd(null));
  }, []);

  const completedCount = modules.filter((m) => m.completed).length;
  const totalModules = modules.length;
  const cpdPct = cpd ? Math.min(100, (cpd.hours_completed / cpd.hours_required) * 100) : 0;

  return (
    <div className="training-page">
      <header>
        <h1>Training & Induction</h1>
        <nav>
          <Link to="/dashboard">← Dashboard</Link>
          <Link to="/training/cpd" className="nav-link-cpd">CPD Dashboard</Link>
          <Link to="/training/role-play" className="nav-link-roleplay">Role-Play Studio</Link>
        </nav>
      </header>

      {/* Hero stats */}
      <section className="training-hero">
        <div className="training-hero-stats">
          <div className="stat-card">
            <span className="stat-value">{completedCount}/{totalModules || '—'}</span>
            <span className="stat-label">Modules completed</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{cpd ? `${cpd.hours_completed}/${cpd.hours_required}h` : '—'}</span>
            <span className="stat-label">CPD hours this year</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{cpdPct.toFixed(0)}%</span>
            <span className="stat-label">CPD progress</span>
          </div>
        </div>
      </section>

      {/* Induction modules - primary content, shown first */}
      <section className="training-modules-section">
        <h2>Induction Modules</h2>
        <p className="subtitle">Complete these modules to earn CPD credits and deepen your mediation practice.</p>
        {loading ? (
          <div className="training-loading">
            <div className="loading-spinner" />
            <p>Loading modules...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="training-empty">
            <p>No modules available yet. Check back soon.</p>
          </div>
        ) : (
          <ul className="module-list">
            {modules.map((m) => (
              <li key={m.id}>
                <Link to={`/training/modules/${m.id}`} className="module-card">
                  <div className="module-header">
                    <h3>{m.title || 'Untitled module'}</h3>
                    {m.completed ? (
                      <span className="badge completed">✓ Completed</span>
                    ) : (
                      <span className="badge progress">{m.progress_pct}%</span>
                    )}
                  </div>
                  <p className="module-desc">{m.description || 'Complete this module to earn CPD credits.'}</p>
                  <div className="module-meta">
                    <span className="meta-item">CPD credits</span>
                    <span className="meta-item">~15–20 min</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AI / Thought-provoking reflection */}
      {reflection && (
        <section className="training-reflection">
          <div className="reflection-card">
            <span className="reflection-badge">💭 Reflect</span>
            <h3>Thought for today</h3>
            <p className="reflection-prompt">{reflection}</p>
            <p className="reflection-hint">Consider this as you work through your modules or prepare for role-plays.</p>
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="training-quick-actions">
        <Link to="/training/cpd" className="quick-action-card cpd">
          <span className="quick-icon">📊</span>
          <h4>CPD Dashboard</h4>
          <p>Track your continuing professional development hours and certifications.</p>
        </Link>
        <Link to="/training/role-play" className="quick-action-card roleplay">
          <span className="quick-icon">🎭</span>
          <h4>Role-Play Studio</h4>
          <p>Practice with AI-generated scenarios. Employment, commercial, family disputes.</p>
        </Link>
      </section>

      {/* Scenario prompts - thought-provoking */}
      <section className="training-scenarios">
        <h2>Practice scenarios</h2>
        <p className="subtitle">Challenge yourself with real-world dilemmas.</p>
        <div className="scenario-prompts">
          <div className="scenario-prompt-card">
            <h4>Power imbalance</h4>
            <p>An employee feels intimidated by their manager in a joint session. How do you create space for genuine dialogue?</p>
          </div>
          <div className="scenario-prompt-card">
            <h4>Cultural sensitivity</h4>
            <p>One party prefers indirect communication; the other expects direct answers. How do you bridge the gap?</p>
          </div>
          <div className="scenario-prompt-card">
            <h4>Hidden interests</h4>
            <p>Both parties agree on a surface solution—but you suspect deeper needs aren't being addressed. What do you do?</p>
          </div>
        </div>
        <Link to="/training/role-play" className="scenario-cta">Generate a role-play scenario →</Link>
      </section>
    </div>
  );
}

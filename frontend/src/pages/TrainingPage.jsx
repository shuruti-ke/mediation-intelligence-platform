import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, BarChart3, Theater, BookOpen, Sparkles } from 'lucide-react';
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
    <div className="training-page-modern">
      <header className="training-header">
        <Link to="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="training-hero-modern">
          <span className="training-badge"><GraduationCap size={14} /> Training & Induction</span>
          <h1>Grow Your Practice</h1>
          <p>Complete modules, earn CPD credits, and sharpen your skills.</p>
        </div>
        <nav className="training-nav-modern">
          <Link to="/training/cpd" className="nav-pill cpd"><BarChart3 size={14} /> CPD Dashboard</Link>
          <Link to="/training/role-play" className="nav-pill roleplay"><Theater size={14} /> Role-Play Studio</Link>
          <Link to="/training/trainee-academy" className="nav-pill trainee"><GraduationCap size={14} /> Trainee Academy</Link>
        </nav>
      </header>

      <section className="stats-grid-modern">
        <div className="stat-card-modern primary">
          <span className="stat-icon"><BookOpen size={24} /></span>
          <span className="stat-value">{completedCount}/{totalModules || '—'}</span>
          <span className="stat-label">Modules completed</span>
        </div>
        <div className="stat-card-modern">
          <span className="stat-icon"><BarChart3 size={24} /></span>
          <span className="stat-value">{cpd ? `${cpd.hours_completed}/${cpd.hours_required}h` : '—'}</span>
          <span className="stat-label">CPD hours this year</span>
        </div>
        <div className="stat-card-modern">
          <span className="stat-icon"><Sparkles size={24} /></span>
          <span className="stat-value">{cpdPct.toFixed(0)}%</span>
          <span className="stat-label">CPD progress</span>
        </div>
      </section>

      <section className="modules-section-modern">
        <h2>Induction Modules</h2>
        <p className="section-subtitle">Complete these modules to earn CPD credits and deepen your mediation practice.</p>
        {loading ? (
          <div className="training-loading-modern">
            <div className="loading-spinner" />
            <p>Loading modules...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="training-empty-modern">
            <span className="empty-icon">📖</span>
            <p>No modules available yet. Check back soon.</p>
          </div>
        ) : (
          <ul className="module-grid-modern">
            {modules.map((m) => (
              <li key={m.id}>
                <Link to={`/training/modules/${m.id}`} className="module-card-modern">
                  <div className="module-card-header">
                    <h3>{m.title || 'Untitled module'}</h3>
                    {m.completed ? (
                      <span className="badge-modern completed">✓ Done</span>
                    ) : (
                      <span className="badge-modern progress">{m.progress_pct}%</span>
                    )}
                  </div>
                  <p className="module-desc-modern">{m.description || 'Complete this module to earn CPD credits.'}</p>
                  <div className="module-meta-modern">
                    <span>CPD credits</span>
                    <span>~15–20 min</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reflection && (
        <section className="reflection-section-modern">
          <div className="reflection-card-modern">
            <span className="reflection-badge-modern">💭 Reflect</span>
            <h3>Thought for today</h3>
            <p className="reflection-prompt-modern">{reflection}</p>
            <p className="reflection-hint-modern">Consider this as you work through your modules or prepare for role-plays.</p>
          </div>
        </section>
      )}

      <section className="quick-actions-modern">
        <Link to="/training/cpd" className="quick-card-modern cpd">
          <span className="quick-icon-modern"><BarChart3 size={28} /></span>
          <h4>CPD Dashboard</h4>
          <p>Track your continuing professional development hours and certifications.</p>
        </Link>
        <Link to="/training/role-play" className="quick-card-modern roleplay">
          <span className="quick-icon-modern"><Theater size={28} /></span>
          <h4>Role-Play Studio</h4>
          <p>Practice with AI-generated scenarios. Employment, commercial, family disputes.</p>
        </Link>
        <Link to="/training/trainee-academy" className="quick-card-modern trainee">
          <span className="quick-icon-modern"><GraduationCap size={28} /></span>
          <h4>Trainee Academy</h4>
          <p>5-module certification program: fundamentals, communication, Kenya law, practical techniques, specialized areas.</p>
        </Link>
      </section>

      <section className="scenarios-section-modern">
        <h2>Practice scenarios</h2>
        <p className="section-subtitle">Challenge yourself with real-world dilemmas.</p>
        <div className="scenario-grid-modern">
          <div className="scenario-card-modern">
            <h4>Power imbalance</h4>
            <p>An employee feels intimidated by their manager in a joint session. How do you create space for genuine dialogue?</p>
          </div>
          <div className="scenario-card-modern">
            <h4>Cultural sensitivity</h4>
            <p>One party prefers indirect communication; the other expects direct answers. How do you bridge the gap?</p>
          </div>
          <div className="scenario-card-modern">
            <h4>Hidden interests</h4>
            <p>Both parties agree on a surface solution—but you suspect deeper needs aren't being addressed. What do you do?</p>
          </div>
        </div>
        <Link to="/training/role-play" className="scenario-cta-modern">Generate a role-play scenario →</Link>
      </section>
    </div>
  );
}

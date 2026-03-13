import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Theater, CheckCircle, BookOpen, Lightbulb } from 'lucide-react';
import { getScenarioById, getCompletedIds } from '../data/practiceScenarios';
import { trainingApi } from '../api/client';

const COMPLETION_KEY = 'practiceScenarioCompleted';

function markCompletedLocal(id) {
  const ids = getCompletedIds();
  if (!ids.includes(id)) {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify([...ids, id]));
  }
}

export default function PracticeScenarioPage() {
  const { scenarioId } = useParams();
  const navigate = useNavigate();
  const scenario = getScenarioById(scenarioId);
  const [expandedSections, setExpandedSections] = useState({ overview: true, challenges: false, strategies: false, reflection: false, resources: false });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const checkCompleted = async () => {
      const localDone = getCompletedIds().includes(scenarioId);
      if (localDone) {
        setCompleted(true);
        return;
      }
      try {
        const { data } = await trainingApi.getPracticeCompletions(scenarioId);
        const serverDone = (data || []).some((c) => c.scenario_id === scenarioId);
        setCompleted(serverDone);
      } catch {
        setCompleted(localDone);
      }
    };
    checkCompleted();
  }, [scenarioId]);

  const toggleSection = (key) => {
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const handlePracticeNow = async () => {
    if (!scenario) return;
    try {
      const { data } = await trainingApi.generateRolePlay({ dispute_category: scenario.disputeCategory });
      const { data: sessionData } = await trainingApi.createRolePlaySession(data.id);
      navigate(`/training/role-play/session/${sessionData.id}`, { replace: true });
    } catch (err) {
      console.error(err);
      navigate('/training/role-play', { state: { category: scenario.disputeCategory }, replace: true });
    }
  };

  const handleMarkComplete = async () => {
    markCompletedLocal(scenarioId);
    setCompleted(true);
    try {
      await trainingApi.completePracticeScenario(scenarioId, { completed_at: new Date().toISOString() });
    } catch {
      // Local state already updated; backend sync is best-effort
    }
  };

  if (!scenario) {
    return (
      <div className="training-page-modern">
        <header className="training-header">
          <Link to="/training" className="back-link">← Training</Link>
          <h1>Scenario not found</h1>
        </header>
        <p className="section-subtitle">Return to <Link to="/training">Training</Link> to browse scenarios.</p>
      </div>
    );
  }

  const { richContent } = scenario;

  return (
    <div className="training-page-modern practice-scenario-detail">
      <header className="training-header">
        <Link to="/training" className="back-link">← Training</Link>
        <div className="training-hero-modern">
          <span className="training-badge"><Lightbulb size={14} /> Practice scenario</span>
          <h1>{scenario.title}</h1>
          <p className="scenario-summary-hero">{scenario.summary}</p>
        </div>
      </header>

      <section className="scenario-rich-content">
        {/* Overview - progressive disclosure */}
        <div className="scenario-section-card">
          <button
            className="scenario-section-toggle"
            onClick={() => toggleSection('overview')}
            aria-expanded={expandedSections.overview}
          >
            {expandedSections.overview ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3>Overview</h3>
          </button>
          {expandedSections.overview && (
            <div className="scenario-section-body">
              <p>{richContent.overview}</p>
            </div>
          )}
        </div>

        {/* Key challenges */}
        <div className="scenario-section-card">
          <button
            className="scenario-section-toggle"
            onClick={() => toggleSection('challenges')}
            aria-expanded={expandedSections.challenges}
          >
            {expandedSections.challenges ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3>Key challenges</h3>
          </button>
          {expandedSections.challenges && (
            <ul className="scenario-section-body">
              {richContent.keyChallenges.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>

        {/* Strategies */}
        <div className="scenario-section-card">
          <button
            className="scenario-section-toggle"
            onClick={() => toggleSection('strategies')}
            aria-expanded={expandedSections.strategies}
          >
            {expandedSections.strategies ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3>Strategies</h3>
          </button>
          {expandedSections.strategies && (
            <ul className="scenario-section-body">
              {richContent.strategies.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>

        {/* Reflection prompts */}
        <div className="scenario-section-card">
          <button
            className="scenario-section-toggle"
            onClick={() => toggleSection('reflection')}
            aria-expanded={expandedSections.reflection}
          >
            {expandedSections.reflection ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3>Reflection prompts</h3>
          </button>
          {expandedSections.reflection && (
            <div className="scenario-section-body">
              <p className="reflection-hint">Consider these before or during your role-play:</p>
              <ul>
                {richContent.reflectionPrompts.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Linked resources */}
        <div className="scenario-section-card">
          <button
            className="scenario-section-toggle"
            onClick={() => toggleSection('resources')}
            aria-expanded={expandedSections.resources}
          >
            {expandedSections.resources ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3>Related resources</h3>
          </button>
          {expandedSections.resources && (
            <div className="scenario-section-body">
              {richContent.linkedResources.map((r, i) => (
                <Link key={i} to={r.path} className="scenario-resource-link">
                  <BookOpen size={16} /> {r.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive practice CTA */}
      <section className="scenario-actions">
        <button onClick={handlePracticeNow} className="btn-practice-now">
          <Theater size={20} /> Practice now in Role-Play Studio
        </button>
        <p className="scenario-cta-hint">Generate a {scenario.disputeCategory} scenario and practice as the mediator with AI parties.</p>

        {!completed && (
          <button onClick={handleMarkComplete} className="btn-mark-complete">
            <CheckCircle size={18} /> Mark as completed
          </button>
        )}
        {completed && (
          <p className="completed-badge"><CheckCircle size={18} /> Completed</p>
        )}
      </section>

      <section className="scenario-back">
        <Link to="/training" className="back-link">← Back to Training</Link>
      </section>
    </div>
  );
}


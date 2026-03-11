import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trainingApi } from '../api/client';

const REFLECTION_QUESTIONS = {
  employment: [
    'How would you address the power imbalance between employee and manager?',
    'What questions might uncover interests beyond "fair treatment"?',
    'When might you suggest a caucus (private session) with each party?',
  ],
  commercial: [
    'How do you balance relationship preservation with accountability?',
    'What role might force majeure play in your opening statement?',
    'How would you help parties move from positions to interests?',
  ],
  family: [
    'How do you keep the child\'s best interests central when parents disagree?',
    'What ground rules would you set for emotional discussions?',
    'When might you recommend family counselling alongside mediation?',
  ],
};

export default function RolePlayPage() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('employment');
  const [currentScenario, setCurrentScenario] = useState(null);

  useEffect(() => {
    trainingApi.listRolePlays()
      .then(({ data }) => setScenarios(data))
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setCurrentScenario(null);
    try {
      const { data } = await trainingApi.generateRolePlay({ dispute_category: disputeCategory });
      setCurrentScenario(data);
      setScenarios((s) => [{ id: data.id, title: data.scenario?.title, dispute_category: disputeCategory, created_at: data.created_at }, ...s]);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const reflectionQ = REFLECTION_QUESTIONS[disputeCategory] || REFLECTION_QUESTIONS.employment;

  return (
    <div className="role-play-page">
      <header>
        <h1>Role-Play Studio</h1>
        <nav>
          <Link to="/training">← Training</Link>
        </nav>
      </header>

      <section className="role-play-intro">
        <p className="intro-text">
          Practice mediation with AI-generated scenarios. Choose a dispute category, generate a scenario, and work through the reflection questions to deepen your practice.
        </p>
      </section>

      <section className="role-play-generate">
        <h2>Generate scenario</h2>
        <div className="generate-form">
          <select value={disputeCategory} onChange={(e) => setDisputeCategory(e.target.value)}>
            <option value="employment">Employment</option>
            <option value="commercial">Commercial</option>
            <option value="family">Family</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} className="primary">
            {generating ? 'Generating...' : 'Generate scenario'}
          </button>
        </div>
      </section>

      {currentScenario && (
        <section className="scenario-display">
          <h2>{currentScenario.scenario?.title}</h2>
          <div className="scenario-card">
            <div className="scenario-section">
              <h4>Parties</h4>
              <p>{currentScenario.scenario?.parties?.join(' • ')}</p>
            </div>
            <div className="scenario-section">
              <h4>Facts</h4>
              <p>{currentScenario.scenario?.facts}</p>
            </div>
            <div className="scenario-section">
              <h4>Objectives</h4>
              <ul>
                {currentScenario.scenario?.objectives && Object.entries(currentScenario.scenario.objectives).map(([k, v]) => (
                  <li key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {v}</li>
                ))}
              </ul>
            </div>
            {currentScenario.scenario?.script_hints && (
              <div className="scenario-section script-hints">
                <h4>Script hints</h4>
                <ul>
                  {currentScenario.scenario.script_hints.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="reflection-section">
            <h3>💭 Reflection questions</h3>
            <p className="reflection-intro">Consider these as you prepare or debrief your role-play:</p>
            <ul className="reflection-list">
              {reflectionQ.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="recent-scenarios">
        <h3>Recent scenarios</h3>
        {loading ? (
          <p>Loading...</p>
        ) : scenarios.length === 0 ? (
          <p>No scenarios yet. Generate one above.</p>
        ) : (
          <ul className="scenario-list">
            {scenarios.map((s) => (
              <li key={s.id}>
                <span className="scenario-title">{s.title || s.dispute_category}</span>
                <span className="scenario-date">{s.created_at?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

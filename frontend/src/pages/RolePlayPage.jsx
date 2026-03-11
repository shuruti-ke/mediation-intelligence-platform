import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trainingApi } from '../api/client';

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

  return (
    <div className="role-play-page">
      <header>
        <h1>Role-Play Studio</h1>
        <nav>
          <Link to="/training">← Training</Link>
        </nav>
      </header>
      <section>
        <h2>Generate Scenario</h2>
        <div className="generate-form">
          <select value={disputeCategory} onChange={(e) => setDisputeCategory(e.target.value)}>
            <option value="employment">Employment</option>
            <option value="commercial">Commercial</option>
            <option value="family">Family</option>
          </select>
          <button onClick={handleGenerate} disabled={generating} className="primary">
            {generating ? 'Generating...' : 'Generate Scenario'}
          </button>
        </div>
        {currentScenario && (
          <div className="scenario-card">
            <h3>{currentScenario.scenario?.title}</h3>
            <p><strong>Parties:</strong> {currentScenario.scenario?.parties?.join(', ')}</p>
            <p><strong>Facts:</strong> {currentScenario.scenario?.facts}</p>
            <p><strong>Objectives:</strong></p>
            <ul>
              {currentScenario.scenario?.objectives && Object.entries(currentScenario.scenario.objectives).map(([k, v]) => (
                <li key={k}>{k}: {v}</li>
              ))}
            </ul>
            {currentScenario.scenario?.script_hints && (
              <p><strong>Script hints:</strong> {currentScenario.scenario.script_hints.join('; ')}</p>
            )}
          </div>
        )}
        <h3>Recent Scenarios</h3>
        {loading ? (
          <p>Loading...</p>
        ) : scenarios.length === 0 ? (
          <p>No scenarios yet. Generate one above.</p>
        ) : (
          <ul className="scenario-list">
            {scenarios.map((s) => (
              <li key={s.id}>{s.title || s.dispute_category} - {s.created_at?.slice(0, 10)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

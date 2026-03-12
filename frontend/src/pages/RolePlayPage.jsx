import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const categoryFromState = location.state?.category;
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState(categoryFromState || 'employment');
  const [currentScenario, setCurrentScenario] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState(null);
  const scenarioDisplayRef = useRef(null);

  useEffect(() => {
    if (categoryFromState) setDisputeCategory(categoryFromState);
  }, [categoryFromState]);

  useEffect(() => {
    trainingApi.listRolePlays()
      .then(({ data }) => setScenarios(data))
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (sessionId) {
      setSessionLoading(true);
      trainingApi.getRolePlaySession(sessionId)
        .then(({ data }) => setSession(data))
        .catch(() => setSession(null))
        .finally(() => setSessionLoading(false));
    } else {
      setSession(null);
    }
  }, [sessionId]);

  const loadScenario = (id) => {
    setScenarioError(null);
    setLoadingScenario(true);
    trainingApi.getRolePlayScenario(id)
      .then(({ data }) => {
        setCurrentScenario(data);
        setScenarioError(null);
        scenarioDisplayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(() => setScenarioError('Could not load scenario. It may have been deleted.'))
      .finally(() => setLoadingScenario(false));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setCurrentScenario(null);
    setSession(null);
    setScenarioError(null);
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

  const handleStartRolePlay = async () => {
    const scenarioId = currentScenario?.id || session?.scenario_id;
    if (!scenarioId) return;
    setSessionLoading(true);
    try {
      const { data } = await trainingApi.createRolePlaySession(scenarioId);
      setSession(data);
      navigate(`/training/role-play/session/${data.id}`, { replace: true });
    } catch (err) {
      console.error(err);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = messageText.trim();
    if (!text || !session?.id || sending) return;
    setSending(true);
    setMessageText('');
    try {
      const { data } = await trainingApi.sendRolePlayMessage(session.id, text);
      setSession((s) => s ? { ...s, messages: data.messages } : null);
    } catch (err) {
      console.error(err);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const handleEndSession = async () => {
    if (!session?.id || ending) return;
    setEnding(true);
    try {
      const { data } = await trainingApi.endRolePlaySession(session.id);
      setSession(data);
    } catch (err) {
      console.error(err);
    } finally {
      setEnding(false);
    }
  };

  const reflectionQ = REFLECTION_QUESTIONS[disputeCategory] || REFLECTION_QUESTIONS.employment;
  const scenario = session?.scenario || currentScenario?.scenario;
  const isActiveSession = session?.status === 'active';
  const isEnded = session?.status === 'ended';

  if (sessionLoading && sessionId) {
    return (
      <div className="role-play-page">
        <header>
          <h1>Role-Play Studio</h1>
          <nav><Link to="/training">← Training</Link></nav>
        </header>
        <p className="role-play-loading">Loading session...</p>
      </div>
    );
  }

  if (session && (isActiveSession || isEnded)) {
    return (
      <div className="role-play-page role-play-chat-view">
        <header>
          <div className="role-play-phase-badge">
            {isEnded ? 'Phase 3: Debrief' : 'Phase 2: Role play'}
          </div>
          <h1>Role-Play: {session.scenario?.title || 'Session'}</h1>
          <nav>
            <Link to="/training/role-play">← Back to Studio</Link>
          </nav>
        </header>

        <div className="role-play-chat-container">
          {isActiveSession && (
            <div className="role-play-process-hints">
              <span>Process: Opening → Party statements → Facilitation → Closing</span>
            </div>
          )}
          <div className="role-play-chat-messages">
            {(!session.messages || session.messages.length === 0) && (
              <p className="role-play-chat-empty">
                Start the mediation: introduce yourself, set ground rules, then invite each party to share their perspective.
              </p>
            )}
            {session.messages?.map((m, i) => (
              <div key={i} className={`role-play-msg role-play-msg-${m.role}`}>
                <span className="role-play-msg-speaker">{m.speaker || m.role}</span>
                <p>{m.text}</p>
              </div>
            ))}
          </div>

          {isActiveSession && (
            <form className="role-play-chat-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Your message as mediator..."
                disabled={sending}
              />
              <button type="submit" disabled={sending || !messageText.trim()} className="primary">
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button type="button" onClick={handleEndSession} disabled={ending} className="secondary">
                {ending ? 'Ending...' : 'End session'}
              </button>
            </form>
          )}
        </div>

        {isEnded && session.debrief && (
          <section className="role-play-debrief">
            <h3>📋 Session debrief</h3>
            <div className="debrief-strengths">
              <h4>Strengths</h4>
              <ul>
                {session.debrief.strengths?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="debrief-improvements">
              <h4>Areas to improve</h4>
              <ul>
                {session.debrief.improvements?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <p className="debrief-feedback">{session.debrief.feedback}</p>
          </section>
        )}
      </div>
    );
  }

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
          Practice mediation with AI-generated scenarios. Choose a dispute category, generate a scenario, then start a role-play to chat with AI parties.
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
        <section className="scenario-display" ref={scenarioDisplayRef}>
          <div className="role-play-phase-badge">Phase 1: Preparation</div>
          <h2>{currentScenario.scenario?.title}</h2>
          <p className="phase-instruction">Read the scenario below. When ready, start the role-play to practice as the mediator.</p>
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

          <button onClick={handleStartRolePlay} disabled={sessionLoading} className="primary role-play-start-btn">
            {sessionLoading ? 'Starting...' : 'I\'ve reviewed – Start role play (Phase 2)'}
          </button>

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
        <h3>Your scenarios – click to open</h3>
        {loading ? (
          <p>Loading...</p>
        ) : scenarios.length === 0 ? (
          <p>No scenarios yet. Generate one above.</p>
        ) : (
          <>
            {scenarioError && <p className="scenario-error">{scenarioError}</p>}
            {loadingScenario && <p className="scenario-loading">Loading scenario...</p>}
            <ul className="scenario-list">
              {scenarios.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="scenario-list-item-btn"
                    onClick={() => loadScenario(s.id)}
                    aria-label={`Open ${s.title || s.dispute_category}`}
                  >
                    <span className="scenario-title">{s.title || s.dispute_category}</span>
                    <span className="scenario-date">{s.created_at?.slice(0, 10)}</span>
                    <span className="scenario-open-hint">→ Open</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

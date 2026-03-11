import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { publicApiClient } from '../api/client';

export default function FreeTierPage() {
  const [info, setInfo] = useState(null);
  const [email, setEmail] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    publicApiClient.freeTierInfo()
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo({ free_sessions: 1, message: 'Your first mediation session is free.' }));
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await publicApiClient.freeTierCheck(email.trim());
      setCheckResult(data);
    } catch {
      setCheckResult({ free_sessions_remaining: 0, max_free_sessions: 1 });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="public-page halomd-style free-tier">
      <header className="public-header compact">
        <Link to="/">← Back</Link>
        <h1>Free First Session</h1>
      </header>

      <main className="public-main">
        {info && (
          <section className="free-tier-info">
            <h2>{info.message}</h2>
            <p className="free-sessions">You get <strong>{info.free_sessions}</strong> free mediation session{info.free_sessions > 1 ? 's' : ''}.</p>
            {info.conditions && <p className="conditions">{info.conditions}</p>}
          </section>
        )}

        <section className="check-eligibility">
          <h3>Check your eligibility</h3>
          <form onSubmit={handleCheck}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={checking}>
              {checking ? 'Checking...' : 'Check'}
            </button>
          </form>
          {checkResult && (
            <div className="eligibility-result">
              <p>
                Free sessions remaining: <strong>{checkResult.free_sessions_remaining}</strong> of {checkResult.max_free_sessions}
              </p>
              {checkResult.free_sessions_remaining > 0 ? (
                <p className="eligible">You&apos;re eligible for a free session. <Link to="/login">Sign up</Link> or contact us to book.</p>
              ) : (
                <p className="used">You&apos;ve used your free session(s). Contact us for paid sessions.</p>
              )}
            </div>
          )}
        </section>

        <p className="signup-cta">
          <Link to="/login" className="primary">Sign in / Register</Link> to get started
        </p>
      </main>
    </div>
  );
}

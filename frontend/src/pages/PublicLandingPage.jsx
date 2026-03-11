import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { publicApiClient } from '../api/client';

export default function PublicLandingPage() {
  const [awareness, setAwareness] = useState(null);

  useEffect(() => {
    publicApiClient.awareness()
      .then(({ data }) => setAwareness(data))
      .catch(() => setAwareness({ title: 'What is Mediation?', sections: [] }));
  }, []);

  return (
    <div className="public-landing">
      <header className="public-header">
        <img src="/logo.png" alt="Mediation Intelligence Platform" className="header-logo" />
        <p className="tagline">Resolve disputes faster, confidentially, and cost-effectively</p>
        <nav className="public-nav">
          <Link to="/login">Sign in</Link>
          <Link to="/should-i-mediate">Should I Mediate?</Link>
          <Link to="/free-tier">Free Session</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <img
          src="/mediation-hero.png"
          alt="Professional multicultural mediation meeting in Kenya"
          className="hero-image"
        />
      </section>

      <main className="public-main">
        {awareness && (
          <section className="awareness-section">
            <h2>{awareness.title}</h2>
            {awareness.sections?.map((s, i) => (
              <div key={i} className="awareness-block">
                <h3>{s.heading}</h3>
                <p>{s.content}</p>
              </div>
            ))}
          </section>
        )}

        <section className="cta-section">
          <h2>Get Started</h2>
          <div className="cta-cards">
            <Link to="/should-i-mediate" className="cta-card">
              <h3>Should I Mediate?</h3>
              <p>Take a quick assessment to see if mediation is right for your dispute.</p>
            </Link>
            <Link to="/free-tier" className="cta-card">
              <h3>Free First Session</h3>
              <p>Your first mediation session is free. Sign up to get started.</p>
            </Link>
            <Link to="/login" className="cta-card">
              <h3>Mediator Portal</h3>
              <p>Already a mediator? Sign in to manage cases and sessions.</p>
            </Link>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <p>© Mediation Intelligence Platform. Confidential, professional dispute resolution.</p>
      </footer>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { publicApiClient } from '../api/client';

const PROCESS_STEPS = [
  { title: 'Initial Intake', desc: 'Submit your dispute through our portal. Our system assesses each case for mediation eligibility.' },
  { title: 'Case Assessment', desc: 'We evaluate your situation and recommend the best path forward under applicable frameworks.' },
  { title: 'Strategy & Preparation', desc: 'Using insights from our knowledge base, we prepare a tailored approach for your case.' },
  { title: 'Documentation', desc: 'We gather and organize necessary documentation, ensuring nothing is overlooked.' },
  { title: 'Mediation Session', desc: 'Expert mediators facilitate confidential, structured dialogue between parties.' },
  { title: 'Resolution', desc: 'Our platform ensures prompt resolution with mutually acceptable outcomes.' },
  { title: 'Ongoing Support', desc: 'Detailed reporting and follow-up available for all resolved cases.' },
];

export default function PublicLandingPage() {
  const [awareness, setAwareness] = useState(null);

  useEffect(() => {
    publicApiClient.awareness()
      .then(({ data }) => setAwareness(data))
      .catch(() => setAwareness({ title: 'What is Mediation?', sections: [] }));
  }, []);

  return (
    <div className="public-landing halomd-style">
      <header className="landing-topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo-link">
            <img src="/logo.png" alt="Mediation Intelligence Platform" className="header-logo" />
          </Link>
          <nav className="topbar-nav">
            <Link to="/login">Client Log In</Link>
            <Link to="/should-i-mediate">Should I Mediate?</Link>
            <Link to="/free-tier">Free Session</Link>
            <Link to="/login" className="btn-demo">Request a Demo</Link>
          </nav>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-inner">
          <h1>Experts in Mediation & Dispute Resolution</h1>
          <p className="hero-sub">Utilizing Kenya&apos;s mediation framework and industry best practices</p>
          <Link to="/login" className="btn-hero">Request a Demo</Link>
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-inner">
          <div className="stat-item">
            <span className="stat-value">1</span>
            <span className="stat-label">Free First Session</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">100%</span>
            <span className="stat-label">Confidential</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">24/7</span>
            <span className="stat-label">Portal Access</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">AI</span>
            <span className="stat-label">Powered Insights</span>
          </div>
        </div>
      </section>

      <section className="pioneering-section">
        <div className="section-inner">
          <h2>A Pioneering Force</h2>
          <p>
            With an exclusive focus on <strong>mediation and alternative dispute resolution</strong>, Mediation Intelligence Platform supports individuals and organizations across Kenya and beyond. Our work reinforces fair outcomes in employment, commercial, family, and community disputes—ensuring parties can resolve conflicts without costly litigation.
          </p>
          <Link to="/login" className="btn-demo">Request a Demo</Link>
        </div>
      </section>

      <section className="process-section">
        <div className="section-inner">
          <h2>Navigating Mediation with Precision and Power</h2>
          <p className="process-intro">
            Mediation Intelligence Platform manages dispute resolution at scale. Our proprietary platform adapts to evolving needs and ensures every case is handled with accuracy and compliance. Every dispute is managed with transparency and consistency.
          </p>
          <div className="process-grid">
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className="process-step">
                <span className="step-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-hero">
        <div className="section-inner">
          <img
            src="/mediation-hero.png"
            alt="Professional multicultural mediation meeting in Kenya"
            className="hero-image"
          />
        </div>
      </section>

      {awareness && awareness.sections?.length > 0 && (
        <section className="awareness-section halomd-aware">
          <div className="section-inner">
            <h2>{awareness.title}</h2>
            {awareness.sections.map((s, i) => (
              <div key={i} className="awareness-block">
                <h3>{s.heading}</h3>
                <p>{s.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cta-section halomd-cta">
        <div className="section-inner">
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
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <p>© Mediation Intelligence Platform. Confidential, professional dispute resolution.</p>
        </div>
      </footer>
    </div>
  );
}

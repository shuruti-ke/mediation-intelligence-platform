import { Link } from 'react-router-dom';

export default function ClientDashboardPage() {
  return (
    <div className="dashboard client-dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Client Portal</h1>
        </div>
        <nav>
          <Link to="/client">My Dashboard</Link>
          <Link to="/should-i-mediate">Should I Mediate?</Link>
          <Link to="/free-tier">Book a Session</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}>Sign out</Link>
        </nav>
      </header>
      <section className="client-welcome">
        <h2>Welcome</h2>
        <p>As a client, you can explore mediation options and book sessions.</p>
        <div className="client-actions">
          <Link to="/should-i-mediate" className="action-card">
            <span className="action-icon">🤔</span>
            <h3>Should I Mediate?</h3>
            <p>Take a short assessment to see if mediation is right for your dispute.</p>
          </Link>
          <Link to="/free-tier" className="action-card">
            <span className="action-icon">📅</span>
            <h3>Book a Session</h3>
            <p>Schedule a free introductory session with a mediator.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}

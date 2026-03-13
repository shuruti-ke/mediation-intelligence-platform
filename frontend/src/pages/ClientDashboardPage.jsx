import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Calendar, LogOut, FileText, User, Mail, CreditCard } from 'lucide-react';
import { usersApi, paymentsApi } from '../api/client';
import GlobalSearch from '../components/GlobalSearch';

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      usersApi.getMyDashboard().then(({ data }) => data).catch(() => null),
      paymentsApi.getAccountSummary().then(({ data }) => data).catch(() => null),
    ]).then(([d, a]) => {
      setDashboard(d.status === 'fulfilled' ? d.value : null);
      setAccountSummary(a.status === 'fulfilled' ? a.value : null);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard client-dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Client Portal</h1>
        </div>
        <GlobalSearch className="client-header-search" />
        <nav>
          <Link to="/client">My Dashboard</Link>
          <Link to="/client/account"><CreditCard size={16} /> Account & Billing</Link>
          <Link to="/should-i-mediate">Should I Mediate?</Link>
          <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
          <Link to="/free-tier">Book a Session</Link>
          <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}><LogOut size={16} /> Sign out</Link>
        </nav>
      </header>

      <section className="client-welcome">
        <h2>Welcome{dashboard?.user?.display_name ? `, ${dashboard.user.display_name}` : ''}</h2>
        <p>View your cases, upcoming sessions, and mediator contact.</p>

        {loading ? (
          <p>Loading...</p>
        ) : dashboard ? (
          <>
            {dashboard.mediator && (
              <div className="client-mediator-card">
                <h3><User size={18} /> Your Mediator</h3>
                <p className="mediator-name">{dashboard.mediator.display_name}</p>
                <a href={`mailto:${dashboard.mediator.email}`} className="mediator-email"><Mail size={14} /> {dashboard.mediator.email}</a>
              </div>
            )}

            {accountSummary && (accountSummary.balance_due > 0 || accountSummary.invoices_pending > 0) && (
              <div className="client-account-alert">
                <Link to="/client/account" className="account-alert-link">
                  <CreditCard size={18} />
                  <span>You have {accountSummary.invoices_pending} pending invoice(s) – {accountSummary.balance_due} KES due. <strong>View & pay</strong></span>
                </Link>
              </div>
            )}

            <div className="client-cases-section">
              <h3><FileText size={18} /> My Cases</h3>
              {dashboard.cases?.length > 0 ? (
                <ul className="client-case-list">
                  {dashboard.cases.map((c) => (
                    <li key={c.id}>
                      <Link to={`/cases/${c.id}`} className="client-case-link">
                        <span className="case-num">{c.case_number}</span>
                        <span className="case-title">{c.title || c.case_type || '—'}</span>
                        <span className={`case-status status-${(c.status || '').toLowerCase()}`}>{c.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-msg">No cases yet. Your mediator will add you to a case when one is opened.</p>
              )}
            </div>

            <div className="client-bookings-section">
              <h3><Calendar size={18} /> Upcoming Sessions</h3>
              {dashboard.bookings?.length > 0 ? (
                <ul className="client-booking-list">
                  {dashboard.bookings.map((b) => (
                    <li key={b.id}>
                      <span className="booking-date">{b.slot_date}</span>
                      <span className="booking-time">{b.start_time} – {b.end_time}</span>
                      <span className="booking-type">{b.meeting_type}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-msg">No upcoming sessions. <Link to="/calendar">Book a consultation</Link>.</p>
              )}
            </div>

            <div className="client-actions">
              <Link to="/should-i-mediate" className="action-card">
                <span className="action-icon"><HelpCircle size={28} /></span>
                <h3>Should I Mediate?</h3>
                <p>Take a short assessment to see if mediation is right for your dispute.</p>
              </Link>
              <Link to="/calendar" className="action-card">
                <span className="action-icon"><Calendar size={28} /></span>
                <h3>Calendar & Bookings</h3>
                <p>View your sessions and book consultations with mediators.</p>
              </Link>
            </div>
          </>
        ) : (
          <div className="client-actions">
            <Link to="/should-i-mediate" className="action-card">
              <span className="action-icon"><HelpCircle size={28} /></span>
              <h3>Should I Mediate?</h3>
              <p>Take a short assessment to see if mediation is right for your dispute.</p>
            </Link>
            <Link to="/calendar" className="action-card">
              <span className="action-icon"><Calendar size={28} /></span>
              <h3>Calendar & Bookings</h3>
              <p>View your sessions and book consultations with mediators.</p>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

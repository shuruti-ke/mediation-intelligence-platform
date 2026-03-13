import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Smartphone, Bell, ArrowLeft, FileText, CheckCircle, Printer } from 'lucide-react';
import { paymentsApi, notificationsApi } from '../api/client';
import { PrintClientStatement } from '../components/PrintView';

export default function ClientAccountPage() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payPhone, setPayPhone] = useState('');
  const [printStatement, setPrintStatement] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      paymentsApi.listInvoices(),
      paymentsApi.getAccountSummary(),
      notificationsApi.list({ unread_only: false }),
    ])
      .then(([invRes, sumRes, notifRes]) => {
        setInvoices(invRes.data || []);
        setSummary(sumRes.data || {});
        setNotifications(notifRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payModal || !payPhone.trim()) return;
    try {
      const { data } = await paymentsApi.initPayment({
        invoice_id: payModal.id,
        provider: 'mpesa',
        phone: payPhone.trim(),
      });
      alert(data.message || 'Check your phone for M-Pesa prompt.');
      setPayModal(null);
      setPayPhone('');
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Payment failed');
    }
  };

  return (
    <div className="dashboard client-dashboard client-account-page">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Client Portal</h1>
        </div>
        <nav>
          <Link to="/client"><ArrowLeft size={16} /> My Dashboard</Link>
          <Link to="/client/account" className="nav-active"><CreditCard size={16} /> Account & Billing</Link>
        </nav>
      </header>

      <section className="client-account-section">
        <h2><CreditCard size={22} /> Account & Billing</h2>
        <p className="section-desc">View invoices, pay with M-Pesa, and manage your account.</p>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {summary && (
              <div className="account-summary-cards">
                <div className="account-card balance-due">
                  <span className="account-value">{summary.balance_due ?? 0} KES</span>
                  <span className="account-label">Balance due</span>
                </div>
                <div className="account-card total-paid">
                  <span className="account-value">{summary.total_paid ?? 0} KES</span>
                  <span className="account-label">Total paid</span>
                </div>
                <div className="account-card invoices-pending">
                  <span className="account-value">{summary.invoices_pending ?? 0}</span>
                  <span className="account-label">Pending invoices</span>
                </div>
              </div>
            )}

            <div className="client-invoices-section">
              <div className="client-invoices-header">
                <h3><FileText size={18} /> My Invoices</h3>
                <button type="button" className="btn-sm" onClick={() => setPrintStatement({
                  client_name: invoices[0]?.user_name || invoices[0]?.user_email || 'My Account',
                  user_name: invoices[0]?.user_name || invoices[0]?.user_email || 'My Account',
                  invoices,
                  balance_due: summary?.balance_due ?? 0,
                  total_paid: summary?.total_paid ?? 0,
                  currency: 'KES',
                })}>
                  <Printer size={14} /> Print Statement
                </button>
              </div>
              {invoices.length === 0 ? (
                <p className="empty-msg">No invoices yet.</p>
              ) : (
                <ul className="client-invoice-list">
                  {invoices.map((inv) => (
                    <li key={inv.id} className={`client-invoice-item status-${inv.status?.toLowerCase()}`}>
                      <div className="invoice-info">
                        <span className="invoice-num">{inv.invoice_number}</span>
                        <span className="invoice-amount">{inv.amount} {inv.currency}</span>
                        <span className={`badge ${inv.status === 'PAID' ? 'badge-active' : 'badge-pending'}`}>
                          {inv.status === 'PAID' ? <CheckCircle size={12} /> : null} {inv.status}
                        </span>
                        <span className="invoice-date">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      {inv.status !== 'PAID' && (
                        <button
                          className="btn-mpesa"
                          onClick={() => { setPayModal(inv); setPayPhone(''); }}
                        >
                          <Smartphone size={14} /> Pay with M-Pesa
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="client-notifications-section">
              <h3><Bell size={18} /> Notifications</h3>
              {notifications.length === 0 ? (
                <p className="empty-msg">No notifications.</p>
              ) : (
                <ul className="client-notif-list">
                  {notifications.slice(0, 10).map((n) => (
                    <li key={n.id} className={n.read_at ? '' : 'unread'}>
                      <strong>{n.title}</strong>
                      {n.body && <p>{n.body}</p>}
                      <span className="notif-date">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                      {n.link && <Link to={n.link}>View</Link>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-card modal-mpesa" onClick={(e) => e.stopPropagation()}>
            <h3><Smartphone size={20} /> Pay with M-Pesa</h3>
            <p className="mpesa-desc">Enter your M-Pesa phone number. You will receive an STK push to complete payment.</p>
            <p className="mpesa-amount"><strong>{payModal.amount} {payModal.currency}</strong> – {payModal.invoice_number}</p>
            <form onSubmit={handlePay}>
              <label>Phone number
                <input
                  type="tel"
                  placeholder="0712345678 or +254712345678"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="primary">Send M-Pesa Prompt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printStatement && (
        <PrintClientStatement data={printStatement} onDone={() => setPrintStatement(null)} />
      )}
    </div>
  );
}

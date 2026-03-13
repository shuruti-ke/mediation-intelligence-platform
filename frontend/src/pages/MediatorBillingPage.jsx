import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Smartphone, Plus, ArrowLeft, Printer } from 'lucide-react';
import { paymentsApi } from '../api/client';
import { PrintInvoice } from '../components/PrintView';

export default function MediatorBillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payPhone, setPayPhone] = useState('');
  const [detailInv, setDetailInv] = useState(null);
  const [detailPayments, setDetailPayments] = useState([]);
  const [printView, setPrintView] = useState(null);

  const load = () => {
    setLoading(true);
    paymentsApi.listInvoices()
      .then((r) => setInvoices(r.data || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openDetail = (inv) => {
    setDetailInv(inv);
    paymentsApi.listInvoicePayments(inv.id)
      .then((r) => r.data || [])
      .then((d) => setDetailPayments(Array.isArray(d) ? d : []))
      .catch(() => setDetailPayments([]));
  };

  const handlePrintInvoice = (inv) => {
    paymentsApi.listInvoicePayments(inv.id)
      .then((r) => r.data || [])
      .then((payments) => setPrintView({ type: 'invoice', invoice: inv, payments }))
      .catch(() => setPrintView({ type: 'invoice', invoice: inv, payments: [] }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payModal || !payPhone.trim()) return;
    try {
      const { data } = await paymentsApi.initPayment({ invoice_id: payModal.id, provider: 'mpesa', phone: payPhone.trim() });
      alert(data.message || 'Check your phone for M-Pesa prompt.');
      setPayModal(null);
      setPayPhone('');
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Payment failed');
    }
  };

  return (
    <div className="dashboard mediator-dashboard mediator-billing-page">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Mediation Dashboard</h1>
        </div>
        <nav>
          <Link to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>
          <Link to="/dashboard/billing" className="nav-active"><CreditCard size={16} /> Billing</Link>
        </nav>
      </header>

      <section className="mediator-billing-section">
        <div className="section-header">
          <h2><CreditCard size={22} /> Invoicing</h2>
          <Link to="/dashboard/billing/create-invoice" className="primary btn-link">
            <Plus size={16} /> Create Invoice
          </Link>
        </div>
        <p className="section-desc">Create invoices for clients. They can pay via M-Pesa from their Account & Billing page.</p>

        {loading ? <p>Loading...</p> : invoices.length === 0 ? (
          <div className="empty-state">
            <p className="empty-msg">No invoices yet. Create one for a client.</p>
            <Link to="/dashboard/billing/create-invoice" className="primary">Create your first invoice</Link>
          </div>
        ) : (
          <div className="invoices-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><code>{inv.invoice_number}</code></td>
                    <td>{inv.amount} {inv.currency}</td>
                    <td><span className={`badge ${inv.status === 'PAID' ? 'badge-active' : 'badge-pending'}`}>{inv.status}</span></td>
                    <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="btn-sm" onClick={() => openDetail(inv)}>View</button>
                      <button className="btn-sm" onClick={() => handlePrintInvoice(inv)} title="Print invoice"><Printer size={14} /> Print</button>
                      {inv.status !== 'PAID' && (
                        <button className="btn-sm btn-mpesa" onClick={() => { setPayModal(inv); setPayPhone(''); }} title="Pay with M-Pesa"><Smartphone size={14} /> M-Pesa</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailInv && (
        <div className="modal-overlay" onClick={() => setDetailInv(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Invoice {detailInv.invoice_number}</h3>
              <div className="modal-header-actions">
                <button type="button" className="btn-ghost" onClick={() => handlePrintInvoice(detailInv)}><Printer size={16} /> Print</button>
                <button type="button" className="btn-ghost" onClick={() => setDetailInv(null)}>× Close</button>
              </div>
            </div>
            <div className="modal-detail-body">
              <p><strong>Bill to:</strong> {detailInv.user_name || detailInv.user_email || '—'}</p>
              <p><strong>Amount:</strong> {detailInv.currency} {(detailInv.amount ?? 0).toFixed(2)}</p>
              <p><strong>Status:</strong> {detailInv.status}</p>
              {detailInv.total_paid != null && Number(detailInv.total_paid) > 0 && (
                <p><strong>Paid:</strong> {detailInv.currency} {Number(detailInv.total_paid).toFixed(2)}</p>
              )}
            </div>
            {detailPayments.length > 0 && (
              <div className="modal-payments-section">
                <h4>Payments Received</h4>
                <table className="accounts-payments-table">
                  <thead>
                    <tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th></tr>
                  </thead>
                  <tbody>
                    {detailPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.received_at ? new Date(p.received_at).toLocaleString() : '—'}</td>
                        <td>{p.method}</td>
                        <td>{p.currency} {(p.amount ?? p.amount_minor_units / 100).toFixed(2)}</td>
                        <td>{p.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {printView?.type === 'invoice' && (
        <PrintInvoice invoice={printView.invoice} payments={printView.payments} onDone={() => setPrintView(null)} />
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-card modal-mpesa" onClick={(e) => e.stopPropagation()}>
            <h3><Smartphone size={20} /> Pay with M-Pesa</h3>
            <p className="mpesa-desc">Enter client M-Pesa phone number for STK push.</p>
            <p className="mpesa-amount"><strong>{payModal.amount} {payModal.currency}</strong> – {payModal.invoice_number}</p>
            <form onSubmit={handlePay}>
              <label>Phone number
                <input type="tel" placeholder="0712345678 or +254712345678" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} required />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="primary">Send M-Pesa Prompt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

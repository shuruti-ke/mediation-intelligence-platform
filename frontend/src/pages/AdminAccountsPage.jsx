import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, DollarSign, Package, Plus, ArrowLeft, Smartphone, RefreshCw, Receipt, FileText } from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';
import LanguageSelector from '../components/LanguageSelector';
import { paymentsApi } from '../api/client';
import './AdminAccountsPage.css';

const PAYMENT_METHODS = [
  { value: 'MPESA', label: 'M-Pesa (Paybill)', refPlaceholder: 'Transaction code (e.g. ABC123XY)' },
  { value: 'CASH', label: 'Cash', refPlaceholder: 'Optional reference' },
  { value: 'CHEQUE', label: 'Bankers Cheque', refPlaceholder: 'Cheque number' },
  { value: 'EFT_RTGS', label: 'EFT / RTGS Bank Transfer', refPlaceholder: 'Bank reference' },
];

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ provider: 'mpesa', phone: '' });
  const [detailInv, setDetailInv] = useState(null);
  const [detailPayments, setDetailPayments] = useState([]);
  const [recordPaymentInv, setRecordPaymentInv] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ method: 'MPESA', amount: '', reference: '', attachment: null });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      paymentsApi.listInvoices().then((r) => r.data || []).catch(() => []),
      paymentsApi.listServices().then((r) => r.data || []).catch(() => []),
    ])
      .then(([inv, svc]) => {
        setInvoices(Array.isArray(inv) ? inv : []);
        setServices(Array.isArray(svc) ? svc : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const statusBadge = (s) => {
    const c = { PENDING: 'pending', PAID: 'paid', CANCELLED: 'cancelled', DRAFT: 'draft' }[s] || 'pending';
    return <span className={`accounts-badge accounts-badge-${c}`}>{s}</span>;
  };

  const openDetail = (inv) => {
    setDetailInv(inv);
    paymentsApi.listInvoicePayments(inv.id)
      .then((r) => r.data || [])
      .then((d) => setDetailPayments(Array.isArray(d) ? d : []))
      .catch(() => setDetailPayments([]));
  };

  const openRecordPayment = (inv) => {
    setRecordPaymentInv(inv);
    const balance = (inv.amount ?? 0) - (inv.total_paid ?? 0);
    setPaymentForm({
      method: 'MPESA',
      amount: balance > 0 ? String(balance.toFixed(2)) : '',
      reference: '',
      attachment: null,
    });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!recordPaymentInv) return;
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      alert('Enter a valid amount');
      return;
    }
    setPaymentSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('method', paymentForm.method);
      fd.append('amount_minor_units', Math.round(amt * 100));
      fd.append('currency', recordPaymentInv.currency || 'KES');
      if (paymentForm.reference?.trim()) fd.append('reference', paymentForm.reference.trim());
      if (paymentForm.attachment) fd.append('attachment', paymentForm.attachment);

      const { data } = await paymentsApi.recordPayment(recordPaymentInv.id, fd);
      setRecordPaymentInv(null);
      setPaymentForm({ method: 'MPESA', amount: '', reference: '', attachment: null });
      load();
      if (detailInv?.id === recordPaymentInv.id) {
        setDetailInv((prev) => ({ ...prev, status: data.invoice_status, total_paid: (prev?.total_paid ?? 0) + amt }));
        setDetailPayments((prev) => [{ ...data, amount: amt }, ...prev]);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const downloadAttachment = async (receiptId) => {
    try {
      const { data } = await paymentsApi.getPaymentAttachment(receiptId);
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch {
      alert('Could not open attachment');
    }
  };

  return (
    <div className="admin-accounts-page">
      <header className="admin-accounts-header">
        <div className="admin-accounts-header-left">
          <Link to="/admin" className="btn-back">
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <h1><CreditCard size={24} /> Accounts Management</h1>
          <p>Manage billing, invoicing, and platform services.</p>
        </div>
        <div className="admin-accounts-header-right">
          <GlobalSearch className="accounts-search" />
          <LanguageSelector />
          <Link to="/admin/accounts/create-invoice" className="btn-primary">
            <Plus size={18} /> Create Invoice
          </Link>
        </div>
      </header>

      <nav className="admin-accounts-tabs">
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>
          <DollarSign size={18} /> Invoices
        </button>
        <button className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>
          <Package size={18} /> Services
        </button>
      </nav>

      {tab === 'invoices' && (
        <section className="admin-accounts-section">
          <div className="section-toolbar">
            <h2>Invoices</h2>
            <button className="btn-ghost" onClick={load}><RefreshCw size={16} /> Refresh</button>
          </div>
          {loading ? (
            <p className="accounts-loading">Loading...</p>
          ) : invoices.length === 0 ? (
            <div className="accounts-empty">
              <p>No invoices yet.</p>
              <Link to="/admin/accounts/create-invoice" className="btn-primary">Create your first invoice</Link>
            </div>
          ) : (
            <div className="accounts-table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Bill To</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoice_number}</td>
                      <td>{inv.user_name || inv.user_email || inv.user_id || '—'}</td>
                      <td>{inv.currency} {(inv.amount ?? 0).toFixed(2)}</td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                      <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="accounts-row-actions">
                          <button className="btn-sm" onClick={() => openDetail(inv)}>View</button>
                          {inv.status === 'PENDING' && (
                            <>
                              <button
                                className="btn-sm btn-mpesa"
                                onClick={() => { setPayModal(inv); setPayForm({ provider: 'mpesa', phone: '' }); }}
                                title="Pay with M-Pesa (STK Push)"
                              >
                                <Smartphone size={14} /> M-Pesa
                              </button>
                              <button
                                className="btn-sm btn-receipt"
                                onClick={() => openRecordPayment(inv)}
                                title="Record payment received (paybill, cheque, cash, EFT)"
                              >
                                <Receipt size={14} /> Record Payment
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'services' && (
        <section className="admin-accounts-section">
          <ServicesTab services={services} onUpdate={load} />
        </section>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-card modal-mpesa" onClick={(e) => e.stopPropagation()}>
            <h3><Smartphone size={20} /> Pay with M-Pesa</h3>
            <p className="mpesa-desc">Enter your M-Pesa phone number. You will receive an STK push to complete payment.</p>
            <p className="mpesa-amount"><strong>{payModal.amount} {payModal.currency}</strong> – {payModal.invoice_number}</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const { data } = await paymentsApi.initPayment({
                  invoice_id: payModal.id,
                  provider: 'mpesa',
                  phone: payForm.phone,
                });
                alert(data.message || 'Check your phone for M-Pesa prompt.');
                setPayModal(null);
                load();
              } catch (err) {
                alert(err.response?.data?.detail || 'Payment initiation failed');
              }
            }}>
              <label>Phone number</label>
              <input type="tel" placeholder="07XXXXXXXX" value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone: e.target.value })} required />
              <div className="modal-actions">
                <button type="button" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="primary">Send M-Pesa Prompt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailInv && (
        <div className="modal-overlay" onClick={() => setDetailInv(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Invoice {detailInv.invoice_number}</h3>
              <button type="button" className="btn-ghost" onClick={() => setDetailInv(null)}>× Close</button>
            </div>
            <div className="modal-detail-body">
              <p><strong>Bill to:</strong> {detailInv.user_name || detailInv.user_email || '—'}</p>
              <p><strong>Amount:</strong> {detailInv.currency} {(detailInv.amount ?? 0).toFixed(2)}</p>
              <p><strong>Status:</strong> {statusBadge(detailInv.status)}</p>
              {detailInv.total_paid != null && Number(detailInv.total_paid) > 0 && (
                <p><strong>Paid:</strong> {detailInv.currency} {Number(detailInv.total_paid).toFixed(2)}</p>
              )}
              {detailInv.status === 'PENDING' && (
                <button type="button" className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => { setDetailInv(null); openRecordPayment(detailInv); }}>
                  <Receipt size={16} /> Record Payment
                </button>
              )}
            </div>
            {detailPayments.length > 0 && (
              <div className="modal-payments-section">
                <h4>Payments Received</h4>
                <table className="accounts-payments-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.received_at ? new Date(p.received_at).toLocaleString() : '—'}</td>
                        <td>{p.method}</td>
                        <td>{p.currency} {(p.amount ?? p.amount_minor_units / 100).toFixed(2)}</td>
                        <td>{p.reference || '—'}</td>
                        <td>
                          {p.has_attachment && (
                            <button type="button" className="btn-sm" onClick={() => downloadAttachment(p.id)}><FileText size={12} /> View</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {recordPaymentInv && (
        <div className="modal-overlay" onClick={() => setRecordPaymentInv(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3><Receipt size={20} /> Record Payment — {recordPaymentInv.invoice_number}</h3>
            <p className="receipt-hint">Customer pays via paybill (provide M-Pesa code), cheque, cash, or bank transfer. Enter amount and reference. Optionally attach proof (cheque image or transaction screenshot).</p>
            <form onSubmit={handleRecordPayment}>
              <label>Payment method *</label>
              <select value={paymentForm.method} onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <label>Amount received ({recordPaymentInv.currency}) *</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} />
              <label>{paymentForm.method === 'MPESA' ? 'M-Pesa transaction code' : paymentForm.method === 'CHEQUE' ? 'Cheque number' : 'Reference'}</label>
              <input type="text" placeholder={PAYMENT_METHODS.find((m) => m.value === paymentForm.method)?.refPlaceholder} value={paymentForm.reference} onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))} />
              <label>Proof (optional) — cheque image or transaction screenshot</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setPaymentForm((f) => ({ ...f, attachment: e.target.files?.[0] || null }))} />
              {paymentForm.attachment && <span className="file-name">{paymentForm.attachment.name}</span>}
              <div className="modal-actions">
                <button type="button" onClick={() => setRecordPaymentInv(null)}>Cancel</button>
                <button type="submit" className="primary" disabled={paymentSubmitting}>{paymentSubmitting ? 'Recording…' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesTab({ services, onUpdate }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', currency: 'KES' });

  const handleCreate = async (e) => {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!form.name.trim() || isNaN(price) || price < 0) {
      alert('Enter valid name and price');
      return;
    }
    try {
      await paymentsApi.createService({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_minor: Math.round(price * 100),
        currency: form.currency,
      });
      setCreateOpen(false);
      setForm({ name: '', description: '', price: '', currency: 'KES' });
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create service');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editId) return;
    const price = parseFloat(form.price);
    if (!form.name.trim() || isNaN(price) || price < 0) {
      alert('Enter valid name and price');
      return;
    }
    try {
      await paymentsApi.updateService(editId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_minor: Math.round(price * 100),
        currency: form.currency,
      });
      setEditId(null);
      setForm({ name: '', description: '', price: '', currency: 'KES' });
      onUpdate();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update service');
    }
  };

  const openEdit = (s) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      description: s.description || '',
      price: String(s.price ?? s.price_minor / 100),
      currency: s.currency || 'KES',
    });
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this service?')) return;
    try {
      await paymentsApi.deleteService(id);
      onUpdate();
    } catch {
      alert('Failed to deactivate');
    }
  };

  return (
    <>
      <div className="section-toolbar">
        <h2>Services</h2>
        <button className="btn-primary" onClick={() => { setCreateOpen(true); setForm({ name: '', description: '', price: '', currency: 'KES' }); }}>
          <Plus size={16} /> Add Service
        </button>
      </div>
      {services.length === 0 ? (
        <div className="accounts-empty">
          <p>No services yet. Add services to use when creating invoices.</p>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>Add first service</button>
        </div>
      ) : (
        <div className="accounts-table-wrap">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Description</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="accounts-desc">{s.description || '—'}</td>
                  <td>{s.currency} {(s.price ?? s.price_minor / 100).toFixed(2)}</td>
                  <td>
                    <button className="btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    {s.is_active !== false && (
                      <button className="btn-sm" onClick={() => handleDeactivate(s.id)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add Service</h3>
            <form onSubmit={handleCreate}>
              <label>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Mediation session fee" />
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional" />
              <label>Price *</label>
              <div className="form-row">
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="modal-overlay" onClick={() => setEditId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Service</h3>
            <form onSubmit={handleUpdate}>
              <label>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              <label>Price *</label>
              <div className="form-row">
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditId(null)}>Cancel</button>
                <button type="submit" className="primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

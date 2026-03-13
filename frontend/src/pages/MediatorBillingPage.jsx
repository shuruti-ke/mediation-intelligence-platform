import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Smartphone, Plus, ArrowLeft } from 'lucide-react';
import { paymentsApi, usersApi, cases } from '../api/client';

const INVOICE_PURPOSES = [
  { value: 'mediation_session', label: 'Mediation session fee' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'administrative', label: 'Administrative fee' },
  { value: 'other', label: 'Other' },
];

export default function MediatorBillingPage() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [payPhone, setPayPhone] = useState('');
  const [form, setForm] = useState({
    amount: '',
    currency: 'KES',
    description: '',
    purpose: 'mediation_session',
    due_date: '',
    user_id: '',
    case_id: '',
    line_items: [{ description: '', quantity: 1, unit_price: '' }],
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      paymentsApi.listInvoices(),
      usersApi.myClients({ limit: 100 }).then((r) => r.data || []).catch(() => []),
      cases.list({ limit: 100 }).then((r) => r.data || []).catch(() => []),
    ]).then(([invRes, cl, cs]) => {
      setInvoices(invRes.data || []);
      setClients(cl);
      setCaseList(cs);
    }).finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const addLineItem = () => {
    setForm((f) => ({ ...f, line_items: [...f.line_items, { description: '', quantity: 1, unit_price: '' }] }));
  };

  const updateLineItem = (i, field, val) => {
    setForm((f) => {
      const items = [...f.line_items];
      items[i] = { ...items[i], [field]: val };
      return { ...f, line_items: items };
    });
  };

  const removeLineItem = (i) => {
    if (form.line_items.length <= 1) return;
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  };

  const computeTotal = () => {
    let total = 0;
    for (const li of form.line_items) {
      const q = parseFloat(li.quantity) || 0;
      const up = parseFloat(li.unit_price) || 0;
      total += q * up;
    }
    return total;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const total = computeTotal();
    if (total <= 0) {
      alert('Add at least one line item with valid amount');
      return;
    }
    const line_items = form.line_items
      .filter((li) => (li.description || '').trim() && (parseFloat(li.unit_price) || 0) > 0)
      .map((li) => ({
        description: li.description.trim(),
        quantity: parseFloat(li.quantity) || 1,
        unit_price_minor: Math.round((parseFloat(li.unit_price) || 0) * 100),
      }));
    if (line_items.length === 0) {
      alert('Add at least one line item');
      return;
    }
    try {
      await paymentsApi.createInvoice({
        amount_minor_units: Math.round(total * 100),
        currency: form.currency,
        description: form.description || INVOICE_PURPOSES.find((p) => p.value === form.purpose)?.label || 'Invoice',
        purpose: form.purpose,
        due_date: form.due_date || null,
        user_id: form.user_id || null,
        case_id: form.case_id || null,
        line_items: line_items.length > 0 ? line_items : undefined,
      });
      setCreateOpen(false);
      setForm({ amount: '', currency: 'KES', description: '', purpose: 'mediation_session', due_date: '', user_id: '', case_id: '', line_items: [{ description: '', quantity: 1, unit_price: '' }] });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create invoice');
    }
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

  const total = computeTotal();

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
          <button className="primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Create Invoice</button>
        </div>
        <p className="section-desc">Create invoices for clients. They can pay via M-Pesa from their Account & Billing page.</p>

        {loading ? <p>Loading...</p> : invoices.length === 0 ? (
          <p className="empty-msg">No invoices yet. Create one for a client.</p>
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

      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-card modal-invoice-create" onClick={(e) => e.stopPropagation()}>
            <h3>Create Invoice</h3>
            <form onSubmit={handleCreate}>
              <label>Bill to (client) <span className="required">*</span>
                <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} required>
                  <option value="">— Select client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.display_name || c.email} ({c.user_id || c.id})</option>
                  ))}
                </select>
              </label>
              <label>Purpose
                <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                  {INVOICE_PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label>Case (optional)
                <select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
                  <option value="">— None —</option>
                  {caseList.map((c) => (
                    <option key={c.id} value={c.id}>{c.case_number} – {c.title || c.case_type || '—'}</option>
                  ))}
                </select>
              </label>
              <label>Due date (optional)
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </label>
              <label>Currency
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </label>

              <div className="invoice-line-items">
                <h4>Line items</h4>
                {form.line_items.map((li, i) => (
                  <div key={i} className="line-item-row">
                    <input type="text" placeholder="Description" value={li.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
                    <input type="number" step="0.01" min="0" placeholder="Qty" value={li.quantity} onChange={(e) => updateLineItem(i, 'quantity', e.target.value)} style={{ width: '70px' }} />
                    <input type="number" step="0.01" min="0" placeholder="Unit price" value={li.unit_price} onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)} />
                    <button type="button" className="btn-sm" onClick={() => removeLineItem(i)} disabled={form.line_items.length <= 1}>×</button>
                  </div>
                ))}
                <button type="button" className="btn-sm" onClick={addLineItem}>+ Add line</button>
              </div>

              <div className="invoice-total">Total: <strong>{total.toFixed(2)} {form.currency}</strong></div>

              <label>Notes / terms (optional)
                <input type="text" placeholder="e.g. Payment due within 14 days" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>

              <div className="modal-actions">
                <button type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
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

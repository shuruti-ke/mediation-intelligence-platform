import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { paymentsApi, usersApi, cases } from '../api/client';
import './AdminCreateInvoicePage.css';

const INVOICE_PURPOSES = [
  { value: 'mediation_session', label: 'Mediation session fee' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'administrative', label: 'Administrative fee' },
  { value: 'other', label: 'Other' },
];

export default function MediatorCreateInvoicePage() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    user_id: '',
    case_id: '',
    due_date: '',
    purpose: 'mediation_session',
    currency: 'KES',
    line_items: [{ service_id: '', description: '', quantity: 1, unit_price: '' }],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      paymentsApi.listServices().then((r) => r.data || []),
      usersApi.myClients({ limit: 100 }).then((r) => r.data || []),
      cases.list({ limit: 200 }).then((r) => r.data || []),
    ])
      .then(([svc, cl, cs]) => {
        setServices(svc);
        setClients(cl);
        setCaseList(cs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const addLineItem = () => {
    setForm((f) => ({ ...f, line_items: [...f.line_items, { service_id: '', description: '', quantity: 1, unit_price: '' }] }));
  };

  const updateLineItem = (i, field, val) => {
    setForm((f) => {
      const items = [...f.line_items];
      items[i] = { ...items[i], [field]: val };
      if (field === 'service_id' && val) {
        const svc = services.find((s) => s.id === val);
        if (svc) {
          items[i].description = svc.name;
          items[i].unit_price = String(svc.price ?? svc.price_minor / 100);
        }
      }
      return { ...f, line_items: items };
    });
  };

  const removeLineItem = (i) => {
    if (form.line_items.length <= 1) return;
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  };

  const computeTotal = () => {
    return form.line_items.reduce((s, li) => {
      const q = parseFloat(li.quantity) || 0;
      const up = parseFloat(li.unit_price) || 0;
      return s + q * up;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.user_id) {
      alert('Select the client to invoice');
      return;
    }
    const lineItems = form.line_items.filter((li) => (li.description || '').trim() && (parseFloat(li.unit_price) || 0) > 0);
    if (lineItems.length === 0) {
      alert('Add at least one line item with description and price');
      return;
    }
    const total = lineItems.reduce((s, li) => s + (parseFloat(li.quantity) || 1) * (parseFloat(li.unit_price) || 0), 0);
    setSubmitting(true);
    try {
      await paymentsApi.createInvoice({
        user_id: form.user_id,
        amount_minor_units: Math.round(total * 100),
        currency: form.currency,
        description: form.notes || lineItems.map((li) => li.description).join('; '),
        purpose: form.purpose || null,
        due_date: form.due_date || null,
        case_id: form.case_id || null,
        line_items: lineItems.map((li) => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 1,
          unit_price_minor: Math.round((parseFloat(li.unit_price) || 0) * 100),
        })),
      });
      navigate('/dashboard/billing');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="create-invoice-page">
        <div className="create-invoice-header">
          <Link to="/dashboard/billing" className="btn-back"><ArrowLeft size={18} /> Back to Billing</Link>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-invoice-page">
      <header className="create-invoice-header">
        <Link to="/dashboard/billing" className="btn-back">
          <ArrowLeft size={18} /> Back to Billing
        </Link>
        <h1>Create Invoice</h1>
        <p>Fill in the details below. Clients can pay via M-Pesa from their Account & Billing page.</p>
      </header>

      <form className="create-invoice-form" onSubmit={handleSubmit}>
        <section className="invoice-section invoice-section-client">
          <h2>1. Who are you invoicing?</h2>
          <div className="form-group">
            <label>Client *</label>
            <select
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              required
            >
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.email} ({c.user_id || c.id})
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="invoice-section invoice-section-dates">
          <h2>2. Dates & details</h2>
          <div className="form-row-2">
            <div className="form-group">
              <label>Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Purpose</label>
            <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {INVOICE_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Case (optional)</label>
            <select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
              <option value="">— None —</option>
              {caseList.map((c) => (
                <option key={c.id} value={c.id}>{c.case_number} – {c.title || c.case_type || '—'}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="invoice-section invoice-section-items">
          <h2>3. Line items (services)</h2>
          <div className="line-items">
            {form.line_items.map((li, i) => (
              <div key={i} className="line-item-row">
                <select
                  value={li.service_id}
                  onChange={(e) => updateLineItem(i, 'service_id', e.target.value)}
                  className="line-service-select"
                >
                  <option value="">— Custom / select service —</option>
                  {services.filter((s) => s.is_active !== false).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.currency} {(s.price ?? s.price_minor / 100).toFixed(2)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  className="line-desc"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                  className="line-qty"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit price"
                  value={li.unit_price}
                  onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                  className="line-price"
                />
                <button type="button" className="btn-remove" onClick={() => removeLineItem(i)} disabled={form.line_items.length <= 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn-add-line" onClick={addLineItem}>
              <Plus size={16} /> Add line item
            </button>
          </div>
          <div className="invoice-total">
            Total: <strong>{form.currency} {computeTotal().toFixed(2)}</strong>
          </div>
        </section>

        <section className="invoice-section invoice-section-notes">
          <h2>4. Additional details</h2>
          <div className="form-group">
            <label>Notes / terms (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="e.g. Payment due within 14 days" />
          </div>
        </section>

        <div className="form-actions">
          <Link to="/dashboard/billing" className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

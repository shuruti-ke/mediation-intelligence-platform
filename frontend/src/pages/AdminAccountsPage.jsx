import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, DollarSign, Package, Plus, ArrowLeft, Smartphone, RefreshCw, Receipt, FileText, Scale, Printer, Edit2 } from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';
import LanguageSelector from '../components/LanguageSelector';
import { paymentsApi } from '../api/client';
import { PrintInvoice, PrintReceipt, PrintReconciliation, PrintMediatorStatement, PrintClientStatement } from '../components/PrintView';
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
  const [reconciliation, setReconciliation] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [commissionEdit, setCommissionEdit] = useState(false);
  const [commissionValue, setCommissionValue] = useState('');
  const [printView, setPrintView] = useState(null);
  const [editInvType, setEditInvType] = useState(false);
  const [invTypeForm, setInvTypeForm] = useState({ invoice_type: 'client', mediator_id: '' });
  const [mediators, setMediators] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientStatement, setClientStatement] = useState(null);
  const [statementType, setStatementType] = useState(null); // 'client' | 'mediator'
  const [clientStatementLoading, setClientStatementLoading] = useState(false);

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

  const loadReconciliation = () => {
    setReconLoading(true);
    setCommissionEdit(false);
    paymentsApi.getReconciliation()
      .then((r) => r.data)
      .then((d) => {
        setReconciliation(d || {});
        setCommissionValue(String(d?.platform_commission_pct ?? 0));
      })
      .catch(() => setReconciliation(null))
      .finally(() => setReconLoading(false));
  };

  const saveCommission = async () => {
    const pct = parseFloat(commissionValue);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert('Enter a valid percentage (0–100)');
      return;
    }
    try {
      await paymentsApi.updatePlatformCommission(pct);
      setCommissionEdit(false);
      loadReconciliation();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update commission');
    }
  };

  useEffect(load, []);
  useEffect(() => {
    paymentsApi.searchBillableUsers({ role: 'mediator', limit: 100 }).then((r) => setMediators(r.data || [])).catch(() => []);
  }, []);

  const statusBadge = (s) => {
    const c = { PENDING: 'pending', PAID: 'paid', CANCELLED: 'cancelled', DRAFT: 'draft' }[s] || 'pending';
    return <span className={`accounts-badge accounts-badge-${c}`}>{s}</span>;
  };

  const openDetail = (inv) => {
    setDetailInv(inv);
    setEditInvType(false);
    setInvTypeForm({ invoice_type: inv.invoice_type || 'client', mediator_id: '' });
    paymentsApi.listInvoicePayments(inv.id)
      .then((r) => r.data || [])
      .then((d) => setDetailPayments(Array.isArray(d) ? d : []))
      .catch(() => setDetailPayments([]));
  };

  const handleUpdateInvoiceType = async () => {
    if (!detailInv) return;
    const payload = { invoice_type: invTypeForm.invoice_type };
    payload.mediator_id = invTypeForm.invoice_type === 'client' && invTypeForm.mediator_id ? invTypeForm.mediator_id : null;
    try {
      await paymentsApi.updateInvoice(detailInv.id, payload);
      setDetailInv((prev) => ({ ...prev, invoice_type: invTypeForm.invoice_type }));
      setEditInvType(false);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update invoice');
    }
  };

  const handlePrintInvoice = () => {
    setPrintView({ type: 'invoice', invoice: detailInv, payments: detailPayments });
  };

  const handlePrintInvoiceFromRow = (inv) => {
    paymentsApi.listInvoicePayments(inv.id)
      .then((r) => r.data || [])
      .then((payments) => setPrintView({ type: 'invoice', invoice: inv, payments: Array.isArray(payments) ? payments : [] }))
      .catch(() => setPrintView({ type: 'invoice', invoice: inv, payments: [] }));
  };

  const handlePrintReceipt = (receipt) => {
    setPrintView({ type: 'receipt', invoice: detailInv, receipt });
  };

  const handlePrintReconciliation = () => {
    setPrintView({ type: 'reconciliation', data: reconciliation });
  };

  const handlePrintMediatorStatement = (m) => {
    paymentsApi.getReconciliation({ mediator_id: m.mediator_id })
      .then((r) => r.data)
      .then((data) => setPrintView({ type: 'mediator_statement', data, mediatorName: m.mediator_name }))
      .catch(() => alert('Failed to load mediator statement'));
  };

  const searchClients = useCallback(() => {
    if (!clientSearch.trim()) {
      setClientSearchResults([]);
      return;
    }
    setClientSearching(true);
    paymentsApi.searchBillableUsers({ q: clientSearch.trim(), limit: 20 })
      .then((r) => r.data || [])
      .then((users) => {
        setClientSearchResults(users);
      })
      .catch(() => setClientSearchResults([]))
      .finally(() => setClientSearching(false));
  }, [clientSearch]);

  useEffect(() => {
    const t = setTimeout(searchClients, 300);
    return () => clearTimeout(t);
  }, [clientSearch, searchClients]);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientStatement(null);
    setStatementType(null);
    setClientSearch('');
    setClientSearchResults([]);
    setClientStatementLoading(true);
    const isMediator = client.role === 'mediator';
    if (isMediator) {
      paymentsApi.getReconciliation({ mediator_id: client.id })
        .then((r) => r.data)
        .then((data) => {
          setClientStatement(data);
          setStatementType('mediator');
        })
        .catch(() => {
          alert('Failed to load mediator statement');
          setSelectedClient(null);
        })
        .finally(() => setClientStatementLoading(false));
    } else {
      paymentsApi.getClientStatement({ user_id: client.id })
        .then((r) => r.data)
        .then((data) => {
          setClientStatement(data);
          setStatementType('client');
        })
        .catch(() => {
          alert('Failed to load client statement');
          setSelectedClient(null);
        })
        .finally(() => setClientStatementLoading(false));
    }
  };

  const handlePrintStatement = () => {
    if (!clientStatement) return;
    if (statementType === 'mediator') {
      setPrintView({
        type: 'mediator_statement',
        data: clientStatement,
        mediatorName: selectedClient?.display_name || selectedClient?.email,
      });
    } else {
      setPrintView({ type: 'client_statement', data: clientStatement });
    }
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
        <button className={tab === 'reconciliation' ? 'active' : ''} onClick={() => { setTab('reconciliation'); loadReconciliation(); }}>
          <Scale size={18} /> Reconciliation
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
                    <th>Type</th>
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
                      <td><span className={`accounts-badge accounts-badge-${inv.invoice_type === 'platform' ? 'platform' : 'client'}`}>{inv.invoice_type === 'platform' ? 'Platform' : 'Client'}</span></td>
                      <td>{inv.user_name || inv.user_email || inv.user_id || '—'}</td>
                      <td>{inv.currency} {Number(inv.amount ?? 0).toFixed(2)}</td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                      <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="accounts-row-actions">
                          <button className="btn-sm" onClick={() => openDetail(inv)}>View</button>
                          <button className="btn-sm" onClick={() => handlePrintInvoiceFromRow(inv)} title="Print invoice"><Printer size={14} /> Print</button>
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

      {tab === 'reconciliation' && (
        <section className="admin-accounts-section">
          <div className="section-toolbar">
            <h2>Two-Tier Reconciliation</h2>
            <div className="toolbar-actions">
              <button className="btn-ghost" onClick={handlePrintReconciliation} disabled={!reconciliation} title="Print reconciliation">
                <Printer size={16} /> Print
              </button>
              <button className="btn-ghost" onClick={loadReconciliation} disabled={reconLoading}>
                <RefreshCw size={16} /> {reconLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>
          {reconLoading && !reconciliation ? (
            <p className="accounts-loading">Loading reconciliation…</p>
          ) : reconciliation ? (
            <div className="reconciliation-panel">
              <div className="recon-summary-cards">
                <div className="recon-card">
                  <span className="recon-label">Funds from clients (mediation fees)</span>
                  <span className="recon-value">{reconciliation.currency} {Number(reconciliation.funds_from_clients ?? 0).toFixed(2)}</span>
                  <span className="recon-desc">Total paid on client invoices</span>
                </div>
                <div className="recon-card">
                  <span className="recon-label">Funds from mediator (platform access)</span>
                  <span className="recon-value">{reconciliation.currency} {Number(reconciliation.funds_from_mediator ?? 0).toFixed(2)}</span>
                  <span className="recon-desc">Total paid on platform invoices</span>
                </div>
                <div className="recon-card recon-card-commission">
                  <span className="recon-label">
                    Platform commission
                    {commissionEdit ? (
                      <span className="recon-edit-inline">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionValue}
                          onChange={(e) => setCommissionValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveCommission()}
                        />
                        % <button type="button" className="btn-sm" onClick={saveCommission}>Save</button>
                        <button type="button" className="btn-ghost" onClick={() => { setCommissionEdit(false); setCommissionValue(String(reconciliation.platform_commission_pct ?? 0)); }}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="recon-edit-btn" onClick={() => { setCommissionEdit(true); setCommissionValue(String(reconciliation.platform_commission_pct ?? 0)); }} title="Edit">
                        ({reconciliation.platform_commission_pct ?? 0}%) ✎
                      </button>
                    )}
                  </span>
                  <span className="recon-value">{reconciliation.currency} {Number(reconciliation.platform_commission_amount ?? 0).toFixed(2)}</span>
                  <span className="recon-desc">Retained from client payments</span>
                </div>
                <div className="recon-card recon-card-unpaid">
                  <span className="recon-label">Unpaid platform invoices</span>
                  <span className="recon-value">{reconciliation.currency} {Number(reconciliation.unpaid_platform_invoices ?? 0).toFixed(2)}</span>
                  <span className="recon-desc">Mediators owe platform (offset from payout)</span>
                </div>
                <div className="recon-card recon-card-payout">
                  <span className="recon-label">Mediator payout owed</span>
                  <span className="recon-value">{reconciliation.currency} {Number(reconciliation.mediator_payout_owed ?? 0).toFixed(2)}</span>
                  <span className="recon-desc">Client payments minus commission minus unpaid platform invoices</span>
                </div>
              </div>
              <div className="recon-by-client">
                <h3>Client & mediator statements</h3>
                <p className="recon-desc">Search for a client or mediator, select from the dropdown, view their statement, then print.</p>
                <div className="client-statement-search">
                  <input
                    type="text"
                    placeholder="Search by name, email..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onFocus={() => clientSearch.trim() && searchClients()}
                  />
                  {clientSearch.trim() && (
                    <div className="client-search-dropdown">
                      {clientSearching ? (
                        <p className="client-search-msg">Searching...</p>
                      ) : clientSearchResults.length === 0 ? (
                        <p className="client-search-msg">No clients found</p>
                      ) : (
                        clientSearchResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="client-search-option"
                            onClick={() => handleSelectClient(c)}
                          >
                            {c.display_name || c.email}
                            {c.role && <span className="client-search-role"> — {c.role.replace('_', ' ')}</span>}
                            {c.email && c.display_name && <span className="client-search-email"> ({c.email})</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedClient && (
                  <div className="client-statement-view">
                    <div className="client-statement-view-header">
                      <h4>Statement for {selectedClient.display_name || selectedClient.email} {selectedClient.role && <span className="statement-role-badge">({selectedClient.role})</span>}</h4>
                      <button type="button" className="btn-sm btn-primary" onClick={handlePrintStatement} disabled={!clientStatement}>
                        <Printer size={14} /> Print
                      </button>
                    </div>
                    {clientStatementLoading ? (
                      <p className="client-statement-loading">Loading statement...</p>
                    ) : clientStatement ? (
                      <div className="client-statement-content">
                        {statementType === 'mediator' ? (
                          <>
                            <div className="statement-mediator-cards">
                              <div className="recon-card recon-card-clients">
                                <span className="recon-label">Funds from clients (mediation fees)</span>
                                <span className="recon-value">{clientStatement.currency} {Number(clientStatement.funds_from_clients ?? 0).toFixed(2)}</span>
                                <span className="recon-desc">Payments received from clients for mediation services</span>
                              </div>
                              <div className="recon-card recon-card-platform">
                                <span className="recon-label">Funds paid to platform</span>
                                <span className="recon-value">{clientStatement.currency} {Number(clientStatement.funds_from_mediator ?? 0).toFixed(2)}</span>
                                <span className="recon-desc">Platform access fees paid by mediator</span>
                              </div>
                              <div className="recon-card recon-card-commission">
                                <span className="recon-label">Platform commission ({Number(clientStatement.platform_commission_pct ?? 0)}%)</span>
                                <span className="recon-value">{clientStatement.currency} {Number(clientStatement.platform_commission_amount ?? 0).toFixed(2)}</span>
                                <span className="recon-desc">Retained from client payments</span>
                              </div>
                              <div className="recon-card recon-card-unpaid">
                                <span className="recon-label">Unpaid platform invoices</span>
                                <span className="recon-value">{clientStatement.currency} {Number(clientStatement.unpaid_platform_invoices ?? 0).toFixed(2)}</span>
                                <span className="recon-desc">Offset from payout</span>
                              </div>
                              <div className="recon-card recon-card-payout">
                                <span className="recon-label">Payout owed to mediator</span>
                                <span className="recon-value">{clientStatement.currency} {Number(clientStatement.mediator_payout_owed ?? 0).toFixed(2)}</span>
                                <span className="recon-desc">Client payments minus commission minus unpaid platform invoices</span>
                              </div>
                            </div>
                            <button type="button" className="btn-ghost btn-clear-client" onClick={() => { setSelectedClient(null); setClientStatement(null); setStatementType(null); }}>
                              Clear / Select different mediator
                            </button>
                          </>
                        ) : (
                          <>
                            <p><strong>Balance due:</strong> {clientStatement.currency} {Number(clientStatement.balance_due ?? 0).toFixed(2)}</p>
                            <p><strong>Total paid:</strong> {clientStatement.currency} {Number(clientStatement.total_paid ?? 0).toFixed(2)}</p>
                            {clientStatement.invoices?.length > 0 && (
                              <>
                                <h4>Invoices</h4>
                                <table className="accounts-table">
                                  <thead>
                                    <tr><th>Invoice #</th><th>Amount</th><th>Paid</th><th>Status</th><th>Date</th></tr>
                                  </thead>
                                  <tbody>
                                    {clientStatement.invoices.map((inv) => (
                                      <tr key={inv.id}>
                                        <td>{inv.invoice_number}</td>
                                        <td>{clientStatement.currency} {Number(inv.amount ?? 0).toFixed(2)}</td>
                                        <td>{clientStatement.currency} {Number(inv.total_paid ?? 0).toFixed(2)}</td>
                                        <td>{inv.status}</td>
                                        <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            )}
                            <button type="button" className="btn-ghost btn-clear-client" onClick={() => { setSelectedClient(null); setClientStatement(null); setStatementType(null); }}>
                              Clear / Select different client
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {reconciliation.by_mediator && reconciliation.by_mediator.length > 0 && (
                <div className="recon-by-mediator">
                  <h3>Per-mediator breakdown</h3>
                  <table className="accounts-table">
                    <thead>
                      <tr>
                        <th>Mediator</th>
                        <th>Funds from clients</th>
                        <th>Platform commission</th>
                        <th>Unpaid platform invoices</th>
                        <th>Payout owed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliation.by_mediator.map((m) => (
                        <tr key={m.mediator_id}>
                          <td>{m.mediator_name}</td>
                          <td>{reconciliation.currency} {Number(m.funds_from_clients ?? 0).toFixed(2)}</td>
                          <td>{reconciliation.currency} {Number(m.platform_commission ?? 0).toFixed(2)}</td>
                          <td>{reconciliation.currency} {Number(m.unpaid_platform_invoices ?? 0).toFixed(2)}</td>
                          <td><strong>{reconciliation.currency} {Number(m.payout_owed ?? 0).toFixed(2)}</strong></td>
                          <td>
                            <button type="button" className="btn-sm" onClick={() => handlePrintMediatorStatement(m)} title="Print mediator statement">
                              <Printer size={12} /> Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="accounts-loading">Unable to load reconciliation.</p>
          )}
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
              <div className="modal-header-actions">
                <button type="button" className="btn-ghost" onClick={handlePrintInvoice} title="Print invoice"><Printer size={16} /> Print</button>
                <button type="button" className="btn-ghost" onClick={() => setDetailInv(null)}>× Close</button>
              </div>
            </div>
            <div className="modal-detail-body">
              {editInvType ? (
                <div className="edit-invoice-type">
                  <label>Invoice type</label>
                  <select value={invTypeForm.invoice_type} onChange={(e) => setInvTypeForm((f) => ({ ...f, invoice_type: e.target.value }))}>
                    <option value="client">Client</option>
                    <option value="platform">Platform</option>
                  </select>
                  {invTypeForm.invoice_type === 'client' && (
                    <>
                      <label>Earning mediator</label>
                      <select value={invTypeForm.mediator_id} onChange={(e) => setInvTypeForm((f) => ({ ...f, mediator_id: e.target.value }))}>
                        <option value="">— None —</option>
                        {mediators.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.email}</option>)}
                      </select>
                    </>
                  )}
                  <div className="edit-type-actions">
                    <button type="button" className="btn-ghost" onClick={() => setEditInvType(false)}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={handleUpdateInvoiceType}>Save</button>
                  </div>
                </div>
              ) : (
                <p>
                  <strong>Type:</strong> {detailInv.invoice_type === 'platform' ? 'Platform' : 'Client'}
                  <button type="button" className="btn-sm btn-edit-type" onClick={() => { setEditInvType(true); setInvTypeForm({ invoice_type: detailInv.invoice_type || 'client', mediator_id: '' }); }} title="Change invoice type">
                    <Edit2 size={14} /> Change type
                  </button>
                </p>
              )}
              <p><strong>Bill to:</strong> {detailInv.user_name || detailInv.user_email || '—'}</p>
              <p><strong>Amount:</strong> {detailInv.currency} {Number(detailInv.amount ?? 0).toFixed(2)}</p>
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.received_at ? new Date(p.received_at).toLocaleString() : '—'}</td>
                        <td>{p.method}</td>
                        <td>{p.currency} {Number(p.amount ?? p.amount_minor_units / 100).toFixed(2)}</td>
                        <td>{p.reference || '—'}</td>
                        <td>
                          <button type="button" className="btn-sm" onClick={() => handlePrintReceipt(p)} title="Print receipt"><Printer size={12} /> Print</button>
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

      {printView?.type === 'invoice' && (
        <PrintInvoice invoice={printView.invoice} payments={printView.payments} onDone={() => setPrintView(null)} />
      )}
      {printView?.type === 'receipt' && (
        <PrintReceipt invoice={printView.invoice} receipt={printView.receipt} onDone={() => setPrintView(null)} />
      )}
      {printView?.type === 'reconciliation' && (
        <PrintReconciliation data={printView.data} onDone={() => setPrintView(null)} />
      )}
      {printView?.type === 'mediator_statement' && (
        <PrintMediatorStatement data={printView.data} mediatorName={printView.mediatorName} onDone={() => setPrintView(null)} />
      )}
      {printView?.type === 'client_statement' && (
        <PrintClientStatement data={printView.data} onDone={() => setPrintView(null)} />
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
                  <td>{s.currency} {Number(s.price ?? s.price_minor / 100).toFixed(2)}</td>
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

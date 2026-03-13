import { useEffect, useRef } from 'react';

/**
 * Renders print-friendly content. On mount, triggers window.print().
 * Use with @media print CSS to show only this content.
 */
export function PrintInvoice({ invoice, payments = [], onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = () => onDone?.();
    window.addEventListener('afterprint', handler);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handler);
    };
  }, [onDone]);

  return (
    <div ref={ref} id="print-area" className="print-view print-invoice">
      <div className="print-header">
        <h1>INVOICE</h1>
        <p className="print-invoice-number">{invoice?.invoice_number}</p>
      </div>
      <div className="print-body">
        <p><strong>Bill to:</strong> {invoice?.user_name || invoice?.user_email || '—'}</p>
        <p><strong>Amount:</strong> {invoice?.currency || 'KES'} {Number(invoice?.amount ?? 0).toFixed(2)}</p>
        <p><strong>Status:</strong> {invoice?.status}</p>
        {invoice?.total_paid != null && Number(invoice?.total_paid) > 0 && (
          <p><strong>Paid:</strong> {invoice?.currency} {Number(invoice?.total_paid).toFixed(2)}</p>
        )}
        {invoice?.due_date && <p><strong>Due date:</strong> {new Date(invoice.due_date).toLocaleDateString()}</p>}
        <p><strong>Created:</strong> {invoice?.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}</p>
      </div>
      {payments?.length > 0 && (
        <div className="print-payments">
          <h3>Payments Received</h3>
          <table>
            <thead>
              <tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.received_at ? new Date(p.received_at).toLocaleString() : '—'}</td>
                  <td>{p.method}</td>
                  <td>{p.currency} {Number(p.amount ?? p.amount_minor_units / 100).toFixed(2)}</td>
                  <td>{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="print-footer">
        <p>Mediation Intelligence Platform</p>
      </div>
    </div>
  );
}

export function PrintReceipt({ invoice, receipt, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = () => onDone?.();
    window.addEventListener('afterprint', handler);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handler);
    };
  }, [onDone]);

  return (
    <div ref={ref} id="print-area" className="print-view print-receipt">
      <div className="print-header">
        <h1>PAYMENT RECEIPT</h1>
      </div>
      <div className="print-body">
        <p><strong>Invoice:</strong> {invoice?.invoice_number}</p>
        <p><strong>Bill to:</strong> {invoice?.user_name || invoice?.user_email || '—'}</p>
        <p><strong>Amount received:</strong> {receipt?.currency || 'KES'} {Number(receipt?.amount ?? receipt?.amount_minor_units / 100 ?? 0).toFixed(2)}</p>
        <p><strong>Method:</strong> {receipt?.method}</p>
        {receipt?.reference && <p><strong>Reference:</strong> {receipt.reference}</p>}
        <p><strong>Date:</strong> {receipt?.received_at ? new Date(receipt.received_at).toLocaleString() : '—'}</p>
      </div>
      <div className="print-footer">
        <p>Mediation Intelligence Platform</p>
      </div>
    </div>
  );
}

export function PrintMediatorStatement({ data, mediatorName, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = () => onDone?.();
    window.addEventListener('afterprint', handler);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handler);
    };
  }, [onDone]);

  return (
    <div ref={ref} id="print-area" className="print-view print-reconciliation">
      <div className="print-header">
        <h1>Mediator Statement</h1>
        <p className="print-mediator-name"><strong>{mediatorName || 'Mediator'}</strong></p>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
      <div className="print-body">
        <table>
          <tbody>
            <tr><td>Funds from clients (mediation fees)</td><td>{data?.currency} {Number(data?.funds_from_clients ?? 0).toFixed(2)}</td></tr>
            <tr><td>Funds paid to platform (platform access)</td><td>{data?.currency} {Number(data?.funds_from_mediator ?? 0).toFixed(2)}</td></tr>
            <tr><td>Platform commission ({Number(data?.platform_commission_pct ?? 0)}%)</td><td>{data?.currency} {Number(data?.platform_commission_amount ?? 0).toFixed(2)}</td></tr>
            <tr><td>Unpaid platform invoices</td><td>{data?.currency} {Number(data?.unpaid_platform_invoices ?? 0).toFixed(2)}</td></tr>
            <tr><td><strong>Payout owed to mediator</strong></td><td><strong>{data?.currency} {Number(data?.mediator_payout_owed ?? 0).toFixed(2)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className="print-footer">
        <p>Mediation Intelligence Platform</p>
      </div>
    </div>
  );
}

export function PrintClientStatement({ data, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = () => onDone?.();
    window.addEventListener('afterprint', handler);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handler);
    };
  }, [onDone]);

  const clientName = data?.client_name || data?.user_name || 'Client';
  const invoices = data?.invoices || [];
  const currency = data?.currency || 'KES';

  return (
    <div ref={ref} id="print-area" className="print-view print-reconciliation">
      <div className="print-header">
        <h1>Client Statement</h1>
        <p className="print-mediator-name"><strong>{clientName}</strong></p>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
      <div className="print-body">
        <p><strong>Balance due:</strong> {currency} {Number(data?.balance_due ?? 0).toFixed(2)}</p>
        <p><strong>Total paid:</strong> {currency} {Number(data?.total_paid ?? 0).toFixed(2)}</p>
        {invoices.length > 0 && (
          <>
            <h3>Invoices</h3>
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Amount</th><th>Paid</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{currency} {Number(inv.amount ?? 0).toFixed(2)}</td>
                    <td>{currency} {Number(inv.total_paid ?? 0).toFixed(2)}</td>
                    <td>{inv.status}</td>
                    <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="print-footer">
        <p>Mediation Intelligence Platform</p>
      </div>
    </div>
  );
}

export function PrintReconciliation({ data, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = () => onDone?.();
    window.addEventListener('afterprint', handler);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', handler);
    };
  }, [onDone]);

  return (
    <div ref={ref} id="print-area" className="print-view print-reconciliation">
      <div className="print-header">
        <h1>Two-Tier Reconciliation</h1>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
      <div className="print-body">
        <table>
          <tbody>
            <tr><td>Funds from clients (mediation fees)</td><td>{data?.currency} {Number(data?.funds_from_clients ?? 0).toFixed(2)}</td></tr>
            <tr><td>Funds from mediator (platform access)</td><td>{data?.currency} {Number(data?.funds_from_mediator ?? 0).toFixed(2)}</td></tr>
            <tr><td>Platform commission ({Number(data?.platform_commission_pct ?? 0)}%)</td><td>{data?.currency} {Number(data?.platform_commission_amount ?? 0).toFixed(2)}</td></tr>
            <tr><td>Unpaid platform invoices</td><td>{data?.currency} {Number(data?.unpaid_platform_invoices ?? 0).toFixed(2)}</td></tr>
            <tr><td><strong>Mediator payout owed</strong></td><td><strong>{data?.currency} {Number(data?.mediator_payout_owed ?? 0).toFixed(2)}</strong></td></tr>
          </tbody>
        </table>
        {data?.by_mediator?.length > 0 && (
          <>
            <h3>Per-mediator breakdown</h3>
            <table>
              <thead>
                <tr><th>Mediator</th><th>Funds from clients</th><th>Commission</th><th>Unpaid platform</th><th>Payout owed</th></tr>
              </thead>
              <tbody>
                {data.by_mediator.map((m) => (
                  <tr key={m.mediator_id}>
                    <td>{m.mediator_name}</td>
                    <td>{data.currency} {Number(m.funds_from_clients ?? 0).toFixed(2)}</td>
                    <td>{data.currency} {Number(m.platform_commission ?? 0).toFixed(2)}</td>
                    <td>{data.currency} {Number(m.unpaid_platform_invoices ?? 0).toFixed(2)}</td>
                    <td><strong>{data.currency} {Number(m.payout_owed ?? 0).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="print-footer">
        <p>Mediation Intelligence Platform</p>
      </div>
    </div>
  );
}

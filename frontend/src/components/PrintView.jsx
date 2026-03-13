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
        <p><strong>Amount:</strong> {invoice?.currency || 'KES'} {(invoice?.amount ?? 0).toFixed(2)}</p>
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
                  <td>{p.currency} {(p.amount ?? p.amount_minor_units / 100).toFixed(2)}</td>
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
        <p><strong>Amount received:</strong> {receipt?.currency || 'KES'} {(receipt?.amount ?? (receipt?.amount_minor_units / 100) ?? 0).toFixed(2)}</p>
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
            <tr><td>Funds from clients (mediation fees)</td><td>{data?.currency} {(data?.funds_from_clients ?? 0).toFixed(2)}</td></tr>
            <tr><td>Funds from mediator (platform access)</td><td>{data?.currency} {(data?.funds_from_mediator ?? 0).toFixed(2)}</td></tr>
            <tr><td>Platform commission ({data?.platform_commission_pct ?? 0}%)</td><td>{data?.currency} {(data?.platform_commission_amount ?? 0).toFixed(2)}</td></tr>
            <tr><td>Unpaid platform invoices</td><td>{data?.currency} {(data?.unpaid_platform_invoices ?? 0).toFixed(2)}</td></tr>
            <tr><td><strong>Mediator payout owed</strong></td><td><strong>{data?.currency} {(data?.mediator_payout_owed ?? 0).toFixed(2)}</strong></td></tr>
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
                    <td>{data.currency} {(m.funds_from_clients ?? 0).toFixed(2)}</td>
                    <td>{data.currency} {(m.platform_commission ?? 0).toFixed(2)}</td>
                    <td>{data.currency} {(m.unpaid_platform_invoices ?? 0).toFixed(2)}</td>
                    <td><strong>{data.currency} {(m.payout_owed ?? 0).toFixed(2)}</strong></td>
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

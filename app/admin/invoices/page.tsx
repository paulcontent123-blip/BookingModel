import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDateTime, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Invoices' };

export default async function AdminInvoicesPage() {
  const invoices = await db.list('invoices', { orderBy: 'issued_at', ascending: false });
  const paid = invoices.filter((i) => i.status === 'paid');
  const total = paid.reduce((s, i) => s + i.total_usd, 0);
  const fees = paid.reduce((s, i) => s + i.platform_fee_usd, 0);

  return (
    <>
      <h1 className="pg-title">Invoices</h1>
      <p className="pg-sub">Generated automatically on every successful payment.</p>

      <div className="stat-grid">
        <div className="stat-card"><div className="sc-n">{invoices.length}</div><div className="sc-l">Invoices issued</div></div>
        <div className="stat-card"><div className="sc-n">{money(total)}</div><div className="sc-l">Total invoiced</div></div>
        <div className="stat-card"><div className="sc-n">{money(fees)}</div><div className="sc-l">Platform fee revenue</div></div>
        <div className="stat-card"><div className="sc-n">{money(total - fees)}</div><div className="sc-l">Creator payouts due</div></div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-head"><div className="tbl-title">All invoices</div></div>
        {invoices.length === 0 ? (
          <div className="empty-state"><span className="ico">🧾</span>No invoices yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th><th>Billed to</th><th>Email</th><th>Subtotal</th>
                <th>Fee</th><th>Total</th><th>Provider</th><th>Status</th><th>Issued</th><th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="mono" style={{ color: 'var(--blue)', fontWeight: 700 }}>{i.invoice_no}</td>
                  <td>{i.bill_to_company ?? i.bill_to_name}</td>
                  <td>{i.bill_to_email}</td>
                  <td>{money(i.subtotal_usd)}</td>
                  <td>{money(i.platform_fee_usd)}</td>
                  <td><strong>{money(i.total_usd)}</strong></td>
                  <td>{i.payment_provider}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>{formatDateTime(i.issued_at)}</td>
                  <td>
                    <Link href={`/invoices/${i.invoice_no}`} className="btn btn-ghost btn-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

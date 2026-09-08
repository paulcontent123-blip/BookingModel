import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { formatDate, money } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Invoices' };

export default async function InvoicesPage() {
  const user = await requireUser();
  const all = await db.list('invoices', { orderBy: 'issued_at', ascending: false });
  const invoices = all.filter((i) => i.brand_id === user.id || i.bill_to_email === user.email);

  const total = invoices.reduce((sum, i) => sum + (i.status === 'paid' ? i.total_usd : 0), 0);

  return (
    <div className="bm-admin" style={{ marginTop: 22 }}>
      {invoices.length === 0 ? (
        <div className="empty-state"><span className="ico">🧾</span>No invoices yet.</div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-head">
            <div className="tbl-title">Invoices ({invoices.length})</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Total paid: <strong style={{ color: 'var(--ink)' }}>{money(total)}</strong>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>Invoice</th><th>Billed to</th><th>Issued</th><th>Total</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="mono" style={{ color: 'var(--blue)', fontWeight: 700 }}>{i.invoice_no}</td>
                  <td>{i.bill_to_company ?? i.bill_to_name}</td>
                  <td>{formatDate(i.issued_at)}</td>
                  <td>{money(i.total_usd)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>
                    <Link href={`/invoices/${i.invoice_no}`} className="btn btn-ghost btn-xs">
                      View / Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

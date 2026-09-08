import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { feePercentLabel, formatDate, money } from '@/lib/utils';
import { PrintButton } from '@/components/print-button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ no: string }>;
}): Promise<Metadata> {
  const { no } = await params;
  return { title: `Invoice ${decodeURIComponent(no)}` };
}

export default async function InvoicePage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const invoice = await db.findOne('invoices', { invoice_no: decodeURIComponent(no) });
  if (!invoice) notFound();

  const deal = await db.get('deals', invoice.deal_id);
  const creator = deal ? await db.get('creators', deal.creator_id) : null;

  return (
    <section className="sec" style={{ maxWidth: 900 }}>
      <div className="row gap-8 mb-16 no-print" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Link href="/dashboard/invoices" className="sol-back">← All invoices</Link>
        <div className="row gap-8">
          <PrintButton />
          {deal && (
            <Link href={`/booking/success/${deal.deal_ref}`} className="btn-ghost">
              Booking {deal.deal_ref}
            </Link>
          )}
        </div>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-head">
          <div>
            <div className="invoice-title">INVOICE</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              {invoice.invoice_no}
            </div>
            {invoice.status === 'paid' && (
              <div style={{ marginTop: 12 }}>
                <span className="invoice-stamp">PAID</span>
              </div>
            )}
          </div>
          <div className="invoice-meta">
            <div style={{ fontFamily: 'var(--mont)', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
              BookingModel<span style={{ color: 'var(--blue)' }}>.com</span>
            </div>
            VEA Group · VEA Tech
            <br />
            {config.manager.email}
            <br />
            {config.manager.phone}
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <div className="invoice-party-label">Billed to</div>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>
              {invoice.bill_to_company ?? invoice.bill_to_name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
              {invoice.bill_to_name}
              <br />
              {invoice.bill_to_email}
              {invoice.bill_to_address && (
                <>
                  <br />
                  {invoice.bill_to_address}
                </>
              )}
            </div>
          </div>
          <div>
            <div className="invoice-party-label">Invoice details</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>
              Issued: <strong style={{ color: 'var(--ink)' }}>{formatDate(invoice.issued_at)}</strong>
              <br />
              Paid: <strong style={{ color: 'var(--ink)' }}>{formatDate(invoice.paid_at)}</strong>
              <br />
              Booking ref: <strong style={{ color: 'var(--ink)' }}>{deal?.deal_ref ?? '—'}</strong>
              <br />
              Payment: <strong style={{ color: 'var(--ink)' }}>{invoice.payment_provider}</strong>
              <br />
              <span className="mono" style={{ fontSize: 11.5 }}>{invoice.payment_ref}</span>
            </div>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>{deal?.content_type ?? 'Creator content'}</strong>
                <br />
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  {creator ? `${creator.name} (${creator.handle}) · ${creator.platform}` : 'Creator booking'}
                  {deal?.due_date && ` · delivery by ${formatDate(deal.due_date)}`}
                </span>
              </td>
              <td className="num">{deal?.quantity ?? 1}</td>
              <td className="num">{money(deal?.unit_price_usd ?? 0)}</td>
              <td className="num">{money(invoice.subtotal_usd)}</td>
            </tr>
            <tr>
              <td>
                Platform fee
                <br />
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  Creator vetting, contracting, escrow and campaign management
                </span>
              </td>
              <td className="num">—</td>
              <td className="num">{feePercentLabel(invoice.platform_fee_percent)}%</td>
              <td className="num">{money(invoice.platform_fee_usd)}</td>
            </tr>
          </tbody>
        </table>

        <table className="invoice-totals">
          <tbody>
            <tr>
              <td style={{ padding: '6px 0', color: 'var(--muted)' }}>Subtotal</td>
              <td style={{ padding: '6px 0', textAlign: 'right' }}>{money(invoice.subtotal_usd)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 0', color: 'var(--muted)' }}>Platform fee</td>
              <td style={{ padding: '6px 0', textAlign: 'right' }}>{money(invoice.platform_fee_usd)}</td>
            </tr>
            {invoice.tax_usd > 0 && (
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--muted)' }}>Tax</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>{money(invoice.tax_usd)}</td>
              </tr>
            )}
            <tr>
              <td
                style={{
                  padding: '12px 0 0',
                  borderTop: '2px solid var(--ink)',
                  fontFamily: 'var(--mont)',
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                Total {invoice.currency}
              </td>
              <td
                style={{
                  padding: '12px 0 0',
                  borderTop: '2px solid var(--ink)',
                  textAlign: 'right',
                  fontFamily: 'var(--mont)',
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {money(invoice.total_usd)}
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontSize: 11.5, color: 'var(--muted2)', marginTop: 34, lineHeight: 1.7 }}>
          Payment received in full. This invoice was generated automatically by BookingModel.com.
          Creator payouts are released after content approval, net of the platform fee shown above.
          For billing questions contact {config.manager.email}.
        </p>
      </div>
    </section>
  );
}

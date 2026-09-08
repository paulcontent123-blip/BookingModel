import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { ImportPanel } from '@/components/admin/import-panel';

export const metadata = { title: 'Import / Excel Sync' };

const COLUMNS: [string, string, string][] = [
  ['name', 'required', 'Creator display name'],
  ['handle', 'required', '@handle — the unique key used to skip duplicates'],
  ['platform', 'required', 'TikTok | YouTube | Instagram | Facebook'],
  ['channel_url', 'optional', 'Full profile URL'],
  ['audience', 'optional', '82K or 82000'],
  ['er', 'optional', '6.2% or 6.2'],
  ['rate', 'optional', '$150-350'],
  ['niche', 'optional', 'Healthy Meal Prep / Budget'],
  ['category', 'optional', 'Food & Beverage, Beauty & Skincare, …'],
  ['contact', 'optional', 'Email or contact hint — an email in this field is auto-extracted'],
  ['notes', 'optional', 'Internal BD notes'],
  ['photo_url', 'optional', 'Direct image URL (Unsplash, Cloudinary, any CDN)'],
  ['video_url', 'optional', 'YouTube URL — added to the portfolio with its thumbnail'],
];

export default async function ImportPage() {
  const batches = await db.list('import_batches', {
    orderBy: 'created_at',
    ascending: false,
    limit: 20,
  });

  const sample = [
    COLUMNS.map(([c]) => c).join(','),
    'Olivia Tiedemann,@oliviatiedemann,TikTok,https://tiktok.com/@oliviatiedemann,82K,6.2%,$150-350,Healthy Meal Prep,Food & Beverage,olivia@gmail.com,Very responsive,https://images.unsplash.com/photo-1494790108377-be9c29b29330,',
  ].join('\n');

  return (
    <>
      <h1 className="pg-title">Import / Excel Sync</h1>
      <p className="pg-sub">
        Bulk-load creators from a spreadsheet. Rows whose handle already exists are skipped, so you
        can re-upload the same file safely.
      </p>

      <ImportPanel />

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title">Column mapping</div>
        <table>
          <thead><tr><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
          <tbody>
            {COLUMNS.map(([col, req, note]) => (
              <tr key={col}>
                <td><code>{col}</code></td>
                <td>
                  <span className={`badge ${req === 'required' ? 'badge-red' : 'badge-gray'}`}>{req}</span>
                </td>
                <td>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 12 }}>
          Header names are matched case-insensitively and spaces become underscores, so
          &ldquo;Channel URL&rdquo; maps to <code>channel_url</code>. Unknown columns are ignored.
        </p>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Sample CSV
          </summary>
          <pre
            style={{
              marginTop: 8, padding: 12, background: 'var(--bg)', borderRadius: 6,
              fontSize: 11, overflowX: 'auto', border: '1px solid var(--border)',
            }}
          >
            {sample}
          </pre>
        </details>
      </div>

      {batches.length > 0 && (
        <div className="tbl-wrap" style={{ marginTop: 18 }}>
          <div className="tbl-head"><div className="tbl-title">Import history</div></div>
          <table>
            <thead>
              <tr><th>File</th><th>Rows</th><th>Imported</th><th>Duplicates</th><th>Errors</th><th>When</th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.filename}</td>
                  <td>{b.total_rows}</td>
                  <td><span className="badge badge-green">{b.imported}</span></td>
                  <td><span className="badge badge-gray">{b.duplicates}</span></td>
                  <td>
                    {b.errors > 0
                      ? <span className="badge badge-amber">{b.errors}</span>
                      : <span className="badge badge-gray">0</span>}
                  </td>
                  <td>{formatDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

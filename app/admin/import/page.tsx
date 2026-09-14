import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import { ImportPanel } from '@/components/admin/import-panel';

export const metadata = { title: 'Import / Excel Sync' };

const COLUMNS: [string, string, string][] = [
  ['legacy_id', 'optional', 'STT / source row number'],
  ['name', 'required', 'Creator display name'],
  ['handle', 'required', 'Handle / Username — duplicate key within each platform'],
  ['platform', 'required', 'TikTok | YouTube | Instagram | Facebook'],
  ['channel_url', 'optional', 'Profile URL'],
  ['audience', 'optional', 'Followers / Subs, for example 82K or 82000'],
  ['niche', 'optional', 'Creator content niche'],
  ['avg_views_likes', 'optional', 'Avg Views / Likes, for example 2800'],
  ['er', 'optional', '6.2% or 6.2'],
  ['tier', 'optional', 'Source tier such as Micro, Macro or Mega'],
  ['location', 'optional', 'Location (US), for example Miami, FL'],
  ['notes', 'optional', 'Internal BD notes'],
  ['avatar_filename', 'optional', 'Original avatar filename; Excel hyperlinks are imported as image URLs'],
  ['rate', 'optional', '$150-350'],
  ['category', 'optional', 'Food & Beverage, Beauty & Skincare, …'],
  ['contact', 'optional', 'Email or contact hint — an email in this field is auto-extracted'],
  ['photo_url', 'optional', 'Direct image URL; an Avatar hyperlink from Excel is copied here automatically'],
  ['avatar_url', 'optional', 'Direct avatar image URL; Google Drive share links are converted automatically'],
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
    ',Olivia Tiedemann,@oliviatiedemann,TikTok,https://tiktok.com/@oliviatiedemann,82K,Healthy Meal Prep,2800,6.2%,Micro,"Miami, FL",Very responsive,olivia.jpg,$150-350,Food & Beverage,olivia@gmail.com,https://images.unsplash.com/photo-1494790108377-be9c29b29330,,',
  ].join('\n');

  return (
    <>
      <h1 className="pg-title">Import / Excel Sync</h1>
      <p className="pg-sub">
        Bulk-load creators from CSV or Excel. Rows whose platform and handle already exist are
        skipped, while existing external avatar links are re-hosted to Cloudinary. The official
        US creator workbook can be uploaded without remapping its headers.
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
          Header names are matched case-insensitively. The official
          <code>BookingModel_US_20_Creator.xlsx</code> headers such as <code>Handle / Username</code>,
          <code>Followers / Subs</code>, <code>ER (%)</code> and <code>Location (US)</code> are mapped
          automatically. Unknown columns are ignored.
          Excel hyperlinks in the <code>Avatar</code> column are also read and converted into image
          URLs, including links to Google Drive. On Apply, those image links are downloaded to the
          server, uploaded to Cloudinary and the resulting Cloudinary URL is saved in the creator
          record. Configure all three Cloudinary environment variables before importing rows with
          image links.
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

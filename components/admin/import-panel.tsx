'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

/**
 * CSV / Excel creator import (TechSpec §4).
 *
 * Parsing happens in the browser so the server route only ever sees normalised
 * rows: PapaParse for .csv/.tsv, SheetJS for .xlsx/.xls (loaded on demand so it
 * stays out of the initial bundle).
 */

interface ImportRow {
  legacy_id?: string;
  name?: string;
  handle?: string;
  platform?: string;
  channel_url?: string;
  audience?: string;
  niche?: string;
  avg_views_likes?: string;
  er?: string;
  tier?: string;
  location?: string;
  notes?: string;
  avatar_filename?: string;
  rate?: string;
  category?: string;
  contact?: string;
  photo_url?: string;
  avatar_url?: string;
  video_url?: string;
}

/** Canonical fields plus the headers used by BookingModel_US_20_Creator.xlsx. */
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  stt: 'legacy_id',
  no: 'legacy_id',
  legacy_id: 'legacy_id',
  name: 'name',
  platform: 'platform',
  handle: 'handle',
  username: 'handle',
  handle_username: 'handle',
  channel_url: 'channel_url',
  profile_url: 'channel_url',
  audience: 'audience',
  followers: 'audience',
  subscribers: 'audience',
  followers_subs: 'audience',
  niche: 'niche',
  avg_views_likes: 'avg_views_likes',
  average_views_likes: 'avg_views_likes',
  avg_views: 'avg_views_likes',
  er: 'er',
  engagement_rate: 'er',
  tier: 'tier',
  location: 'location',
  location_us: 'location',
  notes: 'notes',
  contact: 'contact',
  contact_email: 'contact',
  rate: 'rate',
  category: 'category',
  photo_url: 'photo_url',
  photo: 'photo_url',
  photo_link: 'photo_url',
  profile_photo: 'photo_url',
  avatar_url: 'avatar_url',
  avatar_link: 'avatar_url',
  profile_image: 'avatar_url',
  image: 'avatar_url',
  image_url: 'avatar_url',
  headshot: 'avatar_url',
  avatar: 'avatar_filename',
  avatar_filename: 'avatar_filename',
  video_url: 'video_url',
};

type Row = ImportRow;

interface DryRun {
  willImport: number;
  willUpdate: number;
  duplicates: number;
  errors: { row: number; reason: string }[];
  preview: Record<string, unknown>[];
}

async function readApiJson<T>(response: Response): Promise<T & { error?: string }> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`Import server returned an empty response (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    throw new Error(`Import server returned invalid JSON (HTTP ${response.status}).`);
  }
}

export function ImportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    duplicates: number;
    imagesUploaded: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function normaliseHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[%()[\]]/g, '')
      .replace(/[\\/]+/g, '_')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function imageLinkFromValue(value: string): string {
    const hyperlink = value.match(/^=HYPERLINK\(\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (hyperlink) return hyperlink;

    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : '';
    } catch {
      return '';
    }
  }

  function normalise(raw: Record<string, unknown>[]): Row[] {
    return raw.map((r) => {
      const out: Row = {};
      for (const [key, value] of Object.entries(r)) {
        const mapped = HEADER_ALIASES[normaliseHeader(key)];
        if (!mapped) continue;
        const text = String(value ?? '').trim();
        const imageLink = imageLinkFromValue(text);
        if (mapped === 'avatar_filename' && imageLink) {
          out.avatar_url = imageLink;
          out.photo_url = imageLink;
          continue;
        }
        if ((mapped === 'photo_url' || mapped === 'avatar_url') && imageLink) {
          out[mapped] = imageLink;
          continue;
        }
        out[mapped] = text;
      }
      return out;
    });
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setDry(null);
    setFilename(file.name);
    setBusy(true);

    try {
      let parsed: Record<string, unknown>[];

      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]!]!;

        // sheet_to_json keeps the displayed Avatar filename but drops the
        // hyperlink stored on that cell. Build the rows directly so the
        // Google Drive image URL survives the browser-side parse as well.
        const rangeRef = sheet['!ref'];
        if (typeof rangeRef !== 'string') {
          parsed = [];
        } else {
          const range = XLSX.utils.decode_range(rangeRef);
          const cells = (address: string) => sheet[address] as unknown as {
            v?: unknown;
            w?: unknown;
            l?: { Target?: string; target?: string };
          } | undefined;
          const headers = new Map<number, string>();

          for (let column = range.s.c; column <= range.e.c; column += 1) {
            const cell = cells(XLSX.utils.encode_cell({ r: range.s.r, c: column }));
            const header = String(cell?.v ?? cell?.w ?? '').trim();
            if (header) headers.set(column, header);
          }

          const isAvatarColumn = (header: string) => {
            const normalized = normaliseHeader(header);
            return normalized === 'avatar' || normalized === 'avatar_filename'
              || normalized === 'avatar_url' || normalized === 'photo_url';
          };

          parsed = [];
          for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
            const row: Record<string, unknown> = {};
            let hasValue = false;
            let imageLink = '';

            for (const [column, header] of headers) {
              const cell = cells(XLSX.utils.encode_cell({ r: rowIndex, c: column }));
              const value = cell?.v ?? '';
              row[header] = value;
              if (String(value).trim()) hasValue = true;

              if (isAvatarColumn(header) && !imageLink) {
                imageLink = (cell?.l?.Target ?? cell?.l?.target ?? '').trim();
              }
            }

            if (!hasValue) continue;
            if (imageLink) {
              row.avatar_url = imageLink;
              row.photo_url = imageLink;
            }
            parsed.push(row);
          }
        }
      } else {
        const text = await file.text();
        const res = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        if (res.errors.length) {
          setError(`Parse warning on row ${res.errors[0]!.row}: ${res.errors[0]!.message}`);
        }
        parsed = res.data;
      }

      const normalised = normalise(parsed);
      setRows(normalised);
      await preview(normalised, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  }

  async function preview(data: Row[], name: string) {
    const res = await fetch('/api/admin/creators/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: data, filename: name, dryRun: true }),
    });
    const json = await readApiJson<DryRun>(res);
    if (!res.ok) {
      setError(json.error ?? 'Preview failed.');
      return;
    }
    setDry(json);
  }

  async function confirmImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/creators/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, filename }),
      });
      const json = await readApiJson<{
        imported: number;
        updated: number;
        duplicates: number;
        images_uploaded?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Import failed.');
      setResult({
        imported: json.imported,
        updated: json.updated ?? 0,
        duplicates: json.duplicates,
        imagesUploaded: json.images_uploaded ?? 0,
      });
      setDry(null);
      setRows([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRows([]);
    setDry(null);
    setResult(null);
    setError(null);
    setFilename(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="card">
      <div className="card-title">Upload CSV / Excel</div>

      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <div className="alert alert-ok">
          <strong>Imported {result.imported} creators.</strong>{' '}
          {result.updated > 0 && `Updated ${result.updated} existing avatar(s). `}
          {result.imagesUploaded > 0 && `Uploaded ${result.imagesUploaded} image(s) to Cloudinary. `}
          {result.duplicates > 0 && `${result.duplicates} duplicate handle(s) skipped.`}{' '}
          <a href="/admin/creators" style={{ fontWeight: 700 }}>View the roster →</a>
        </div>
      )}

      <div
        className={`drop-zone${dragging ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <div className="drop-ico">📥</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {filename ?? 'Drop a .csv, .tsv, .xlsx or .xls file here'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          or click to browse · up to 10,000 rows per batch
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      {busy && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>Working…</p>}

      {dry && (
        <div style={{ marginTop: 18 }}>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="sc-n">{dry.willImport}</div><div className="sc-l">Will be imported</div>
            </div>
            <div className="stat-card">
              <div className="sc-n">{dry.willUpdate}</div><div className="sc-l">Existing avatars to update</div>
            </div>
            <div className="stat-card">
              <div className="sc-n">{dry.duplicates}</div><div className="sc-l">Duplicate handles (skipped)</div>
            </div>
            <div className="stat-card">
              <div className="sc-n">{dry.errors.length}</div><div className="sc-l">Invalid rows</div>
            </div>
          </div>

          {dry.errors.length > 0 && (
            <div className="alert alert-warn">
              {dry.errors.slice(0, 5).map((e) => (
                <div key={e.row}>Row {e.row}: {e.reason}</div>
              ))}
              {dry.errors.length > 5 && <div>…and {dry.errors.length - 5} more.</div>}
            </div>
          )}

          {dry.preview.length > 0 && (
            <div className="tbl-wrap" style={{ marginTop: 14 }}>
              <div className="tbl-head"><div className="tbl-title">Preview — first 10 rows</div></div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Handle</th><th>Platform</th><th>Tier</th>
                    <th>Audience</th><th>Avg views / likes</th><th>Location</th><th>Avatar</th>
                  </tr>
                </thead>
                <tbody>
                  {dry.preview.map((p, i) => (
                    <tr key={i}>
                      <td>{String(p.name ?? '')}</td>
                      <td>{String(p.handle ?? '')}</td>
                      <td>{String(p.platform ?? '')}</td>
                      <td>{String(p.tier ?? '')}</td>
                      <td>{String(p.audience ?? '')}</td>
                      <td>{String(p.avg_views_likes ?? '')}</td>
                      <td>{String(p.location ?? '')}</td>
                      <td>
                        {String(p.avatar_filename ?? '')}
                        {typeof p.photo_url === 'string' && p.photo_url && (
                          <div style={{ fontSize: 11, color: 'var(--green)' }}>
                            Image link found — uploads to Cloudinary on Apply
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={confirmImport}
              disabled={busy || (dry.willImport === 0 && dry.willUpdate === 0)}
            >
              Apply {dry.willImport} new creators{dry.willUpdate > 0 ? ` and update ${dry.willUpdate} avatars` : ''}
            </button>
            <button className="btn btn-ghost" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

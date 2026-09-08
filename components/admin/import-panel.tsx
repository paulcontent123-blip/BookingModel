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

const COLUMNS = [
  'name', 'handle', 'platform', 'channel_url', 'audience', 'er',
  'rate', 'niche', 'category', 'contact', 'notes', 'photo_url', 'video_url',
];

type Row = Record<string, string>;

interface DryRun {
  willImport: number;
  duplicates: number;
  errors: { row: number; reason: string }[];
  preview: Record<string, unknown>[];
}

export function ImportPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function normalise(raw: Record<string, unknown>[]): Row[] {
    return raw.map((r) => {
      const out: Row = {};
      for (const [key, value] of Object.entries(r)) {
        const k = key.trim().toLowerCase().replace(/\s+/g, '_');
        if (COLUMNS.includes(k)) out[k] = String(value ?? '').trim();
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
        parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
    const json = await res.json();
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import failed.');
      setResult({ imported: json.imported, duplicates: json.duplicates });
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
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="sc-n">{dry.willImport}</div><div className="sc-l">Will be imported</div>
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
                  <tr><th>Name</th><th>Handle</th><th>Platform</th><th>Niche</th><th>Audience</th><th>Contact</th></tr>
                </thead>
                <tbody>
                  {dry.preview.map((p, i) => (
                    <tr key={i}>
                      <td>{String(p.name ?? '')}</td>
                      <td>{String(p.handle ?? '')}</td>
                      <td>{String(p.platform ?? '')}</td>
                      <td>{String(p.niche ?? '')}</td>
                      <td>{String(p.audience ?? '')}</td>
                      <td>{String(p.contact_email ?? p.contact_hint ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={confirmImport} disabled={busy || dry.willImport === 0}>
              Confirm import of {dry.willImport} creators
            </button>
            <button className="btn btn-ghost" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

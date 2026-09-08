'use client';

export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button className="btn-solid" onClick={() => window.print()}>
      {label}
    </button>
  );
}

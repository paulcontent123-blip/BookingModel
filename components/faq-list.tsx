'use client';

import { useState } from 'react';

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <div className={`faq-item${open === i ? ' open' : ''}`} key={i}>
          <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
            {item.q}
            <i className="faq-ico">+</i>
          </button>
          <div className="faq-a">{item.a}</div>
        </div>
      ))}
    </div>
  );
}

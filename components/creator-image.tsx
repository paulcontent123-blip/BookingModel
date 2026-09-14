'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

interface CreatorImageProps {
  sources: string[];
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: 'eager' | 'lazy';
  fallback?: ReactNode;
}

/**
 * Render a creator image and move to the next database-provided source when a
 * CDN/Drive URL is stale or temporarily unavailable.
 */
export function CreatorImage({
  sources,
  alt,
  className,
  style,
  loading = 'lazy',
  fallback = null,
}: CreatorImageProps) {
  const uniqueSources = Array.from(new Set(sources.filter(Boolean)));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(uniqueSources.length === 0);

  if (failed || !uniqueSources[sourceIndex]) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={uniqueSources[sourceIndex]}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        if (sourceIndex + 1 < uniqueSources.length) {
          setSourceIndex((index) => index + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

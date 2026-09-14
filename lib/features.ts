/**
 * Build-time feature switches for optional product areas.
 *
 * Brand Showcase is intentionally off by default for now. To bring it back,
 * set NEXT_PUBLIC_ENABLE_BRAND_SHOWCASE=true before starting/building Next.js.
 */
export const BRAND_SHOWCASE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_BRAND_SHOWCASE === 'true';

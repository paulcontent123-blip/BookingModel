/**
 * Send a custom GA4 event from client components. No-op when GA is not loaded
 * (no Measurement ID, admin pages, ad blockers).
 *
 *   trackEvent('generate_lead', { form: 'contact' });
 */
type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: 'event', name: string, params?: GtagParams) => void;
  }
}

export function trackEvent(name: string, params?: GtagParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

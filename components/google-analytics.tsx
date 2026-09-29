import Script from 'next/script';

/**
 * Loads GA4 (gtag.js). Mounted only in the public (site) layout, so /admin is
 * never tracked. Client-side navigations are recorded by GA4 Enhanced
 * Measurement ("Page changes based on browser history events", on by default).
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  );
}

// Loads an external <script> once, on demand. Payment SDKs (Paystack,
// Monipay) used to be pulled in via <Script> tags that rendered whenever a
// buy/gift button mounted — fetching the SDK on every page load and letting
// its internal console noise fire sitewide. Injecting at pay-time keeps the
// SDK off the page until it's actually needed.
const cache = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = cache.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later retry after a transient network failure.
      cache.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(script);
  });
  cache.set(src, promise);
  return promise;
}

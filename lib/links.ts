// Artists type social handles as often as full URLs ("instagram.com/me",
// "x.com/me"). Store a usable absolute URL either way, but never reject
// input: every profile field is optional and free-form.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = HAS_SCHEME.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  // A bare scheme has no destination; treat it as "not filled in".
  return withScheme.replace(HAS_SCHEME, "").trim() ? withScheme : null;
}

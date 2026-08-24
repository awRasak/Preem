// URL slugs. Must stay byte-for-byte consistent with the SQL generated
// columns in 0023_slugs.sql -- the DB resolves /artist/<slug>/... requests,
// this side builds the links, so both sides derive identical values.

export function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params accept either a raw uuid (legacy/shared links) or a slug. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function artistPath(artistName: string | null | undefined): string {
  return `/artist/${slugify(artistName)}`;
}

export function dropPath(
  artistName: string | null | undefined,
  dropTitle: string | null | undefined,
): string {
  return `/artist/${slugify(artistName)}/${slugify(dropTitle)}`;
}

export function trackPath(
  artistName: string | null | undefined,
  dropTitle: string | null | undefined,
  trackTitle: string | null | undefined,
): string {
  return `${dropPath(artistName, dropTitle)}/${slugify(trackTitle)}`;
}

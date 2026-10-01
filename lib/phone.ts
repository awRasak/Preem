// Canonical phone form for all fan_phone writes and comparisons.
//
// Incident (Oct 2026): a fan paid with "+234 704 691 7132" stored verbatim
// at checkout, then typed "07046917132" at lookup. The library/streaming
// queries exact-match fan_phone, so a successful purchase was invisible.
// Every write and every comparison must go through normalizePhone so
// country-code, spacing, and dash variants collapse to one form.
//
// Canonical form: digits only; Nigerian 13-digit 234-numbers become
// 11-digit local (070...). Non-Nigerian numbers keep full digits.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

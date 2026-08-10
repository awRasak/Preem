export const PREVIEW_SECONDS = 15;

// /api/preview/[dropId] computes an exact byte length for PREVIEW_SECONDS
// when it can read a WAV file's byte-rate from its header (today's real
// upload format), falling back to this flat cap otherwise. Sized to cover a
// generous range of compressed bitrates for PREVIEW_SECONDS.
export const PREVIEW_FALLBACK_BYTES = 1.5 * 1024 * 1024;

// Absolute ceiling /api/preview will ever serve, regardless of format or
// computed target -- the actual security backstop (kept far below any real
// full track, even uncompressed).
export const PREVIEW_HARD_CAP_BYTES = 8 * 1024 * 1024;

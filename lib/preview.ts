export const PREVIEW_SECONDS = 15;

// Byte cap enforced server-side by /api/preview/[dropId] so the endpoint can
// never be used to fetch a complete track. Sized for the highest realistic
// encode bitrate (320kbps) so playback duration lands close to
// PREVIEW_SECONDS; lower-bitrate files preview a bit longer, never shorter —
// but always far short of a full track, which is the actual guarantee this
// cap provides (no exact server-side audio trimming is done).
export const PREVIEW_MAX_BYTES = 700 * 1024; // ~15s at 320kbps mp3

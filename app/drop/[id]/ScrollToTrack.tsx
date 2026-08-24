"use client";

import { useEffect } from "react";

// Scrolls a deep-linked track (/artist/a/d/song-name) into view once on
// mount. The row itself gets a soft highlight class server-side.
export function ScrollToTrack({ trackId }: { trackId: string }) {
  useEffect(() => {
    document
      .getElementById(`track-${trackId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [trackId]);
  return null;
}

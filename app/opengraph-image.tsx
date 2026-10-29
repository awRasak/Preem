import { ImageResponse } from "next/og";

// Site-wide share card. The file-convention image at the app/ root is the
// fallback for every route that doesn't define its own OG image; artist and
// drop pages override with real artwork via generateMetadata.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Preem — Live off your music";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0e0d12",
          color: "#f5f4f7",
          padding: "88px 96px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 26,
              backgroundColor: "#ff6b39",
            }}
          />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Preem</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -3 }}>
            Live off your music
          </div>
          <div style={{ fontSize: 40, color: "#8b889a", maxWidth: 950 }}>
            Sell early access to unreleased drops, tickets and more — direct to
            your fans, priced in naira.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#ffab8a", fontWeight: 700 }}>
          preem.ng
        </div>
      </div>
    ),
    { ...size },
  );
}

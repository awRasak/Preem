import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PlayerProvider } from "@/lib/player-context";
import { PlayerBar } from "@/components/PlayerBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const esKlarheit = localFont({
  src: [
    { path: "./fonts/ESKlarheitGrotesk-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/ESKlarheitGrotesk-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/ESKlarheitGrotesk-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-es-klarheit",
  display: "swap",
});

// Plakat only ships one usable display cut (Extra Bold) — no separate
// plain-Bold face exists in the trial family. Registered across the
// 700-900 range so both h1 (800) and h2 (700) resolve to it.
const esKlarheitPlakat = localFont({
  src: [{ path: "./fonts/ESKlarheitPlakat-ExtraBold.otf", weight: "700 900", style: "normal" }],
  variable: "--font-es-klarheit-plakat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Preem — Live off your music",
  description:
    "Preem is a Naira-native, Paystack-powered direct-to-fan music marketplace. Sell early access to unreleased tracks straight to your fans.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Preem",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#17151d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${esKlarheit.variable} ${esKlarheitPlakat.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Code:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-paper pb-20">
        <PlayerProvider>
          {children}
          <PlayerBar />
        </PlayerProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

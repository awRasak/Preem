import type { Metadata } from "next";
import "./globals.css";
import { PlayerProvider } from "@/lib/player-context";
import { PlayerBar } from "@/components/PlayerBar";

export const metadata: Metadata = {
  title: "Preem — Live off your music",
  description:
    "Preem is a Naira-native, Paystack-powered direct-to-fan music marketplace. Sell early access to unreleased tracks straight to your fans.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
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
      </body>
    </html>
  );
}

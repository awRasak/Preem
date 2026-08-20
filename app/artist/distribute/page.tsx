import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Distributing after early access — Preem",
  description: "How to take a track live everywhere else once its Preem window closes.",
};

const STEPS = [
  "Export your final master (WAV or high-bitrate MP3) if you haven't already.",
  "Pick a distributor — DistroKid, SoundOn, or your existing one works fine.",
  "Submit the track for Spotify, Apple Music, Audiomack, and Boomplay.",
  "Distributors typically take a few days to a couple of weeks to go live — plan your public release date accordingly.",
  "Once it's live everywhere, share the links with the fans who bought early access here — they already have the track, but they'll want to stream/save it on their usual platform too.",
];

export default function DistributeGuidePage() {
  return (
    <>
      <Nav role="artist" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Distributing after early access</h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Preem doesn&apos;t push to streaming platforms automatically. Here&apos;s how to
          take it from here yourself.
        </p>
        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}

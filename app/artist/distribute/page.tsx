import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Distributing to streaming — Preem",
  description:
    "Take your Preem drop live on Spotify, Apple Music, Audiomack and Boomplay — right from your drop page.",
};

const STEPS = [
  "Open your drop page and use the Distribution panel — or opt in while publishing.",
  "Pick your street date (the countdown close is suggested) and the stores you want.",
  "Preem pushes your artwork and masters to the DSPs and tracks the review status back on the same panel.",
  "Stores typically ingest within a few days — Boomplay can take up to ~2 weeks, so plan your street date ahead.",
  "Once it's live everywhere, share the links with the fans who bought early access here — they already have the track, but they'll want to stream/save it on their usual platform too.",
];

export default function DistributeGuidePage() {
  return (
    <>
      <Nav role="artist" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Distributing to streaming</h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Preem pushes your releases to the major streaming services from your
          own drop page. Here&apos;s the flow.
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

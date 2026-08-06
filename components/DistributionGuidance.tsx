const STEPS = [
  "Export your final master (WAV or high-bitrate MP3) if you haven't already.",
  "Pick a distributor — DistroKid, SoundOn, or your existing one works fine.",
  "Submit the track for Spotify, Apple Music, Audiomack, and Boomplay.",
  "Distributors typically take a few days to a couple of weeks to go live — plan your public release date accordingly.",
  "Once it's live everywhere, share the links with the fans who bought early access here — they already have the track, but they'll want to stream/save it on their usual platform too.",
];

export function DistributionGuidance() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-1 text-sm font-bold">Your window has closed — time to distribute</h3>
      <p className="mb-4 text-xs text-muted">
        Preem doesn&apos;t push to streaming platforms automatically. Here&apos;s how to
        take it from here yourself.
      </p>
      <ol className="space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">
              {i + 1}
            </span>
            <span className="text-paper/90">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

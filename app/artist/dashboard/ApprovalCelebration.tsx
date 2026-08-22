"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/Button";

const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-dot-red)",
  "var(--color-dot-green)",
  "var(--color-dot-yellow)",
  "var(--color-dot-purple)",
];

type ConfettiPiece = { id: number; left: number; color: string; delay: number; duration: number };

export function ApprovalCelebration() {
  const router = useRouter();
  const [stage, setStage] = useState<"congrats" | "first-drop" | null>("congrats");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // Randomized per-piece placement/timing is decorative and client-only
    // (never rendered on the server, never re-derived from props/state), so
    // this one-time setState-in-effect isn't syncing anything that could
    // cascade -- it's the only place Math.random() can legally run under
    // the purity rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfetti(
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
      })),
    );
    // Marks the approval as seen server-side so this never shows again on a
    // later visit -- refresh once it lands so the dashboard's own
    // server-fetched `artist.approval_seen` is immediately in sync too,
    // not just this modal's local state.
    fetch("/api/artist/mark-approval-seen", { method: "POST" })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  if (!stage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      {stage === "congrats" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((p) => (
            <span
              key={p.id}
              className="confetti-piece"
              style={{
                left: `${p.left}%`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6 text-center">
        {stage === "congrats" ? (
          <>
            <PartyPopper className="mx-auto mb-2 h-9 w-9 text-accent" />
            <h2 className="mb-2 text-xl font-bold">Congratulations!</h2>
            <p className="mb-6 text-sm text-muted">
              Your artist profile is approved — you&apos;re ready to start selling directly to your fans.
            </p>
            <Button variant="primary" className="w-full" onClick={() => setStage("first-drop")}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-xl font-bold">Add your first drop</h2>
            <p className="mb-6 text-sm text-muted">Your fans can&apos;t wait.</p>
            <div className="flex flex-col gap-2">
              <Button variant="primary" className="w-full" href="/artist/drops/new">
                + New drop
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setStage(null)}
              >
                Not now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

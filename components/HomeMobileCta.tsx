"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { usePlayer } from "@/lib/player-context";

// PlayerBar (app/layout.tsx) is also fixed to the same bottom edge whenever
// a track is loaded, and both sit at the same z-40 -- rendering this too
// would stack the two mobile bars on top of each other. The player bar
// itself is enough of a "there's something to do here" affordance in that
// moment, so this CTA just steps aside instead of trying to offset above a
// player bar whose height varies (mini vs. mini+gift-row).
export function HomeMobileCta({
  accountHref,
  accountLabel,
  showSignInLink,
}: {
  accountHref: string;
  accountLabel: string;
  showSignInLink: boolean;
}) {
  const { track } = usePlayer();
  if (track) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-4 backdrop-blur sm:hidden">
      <Button href={accountHref} variant="primary" className="w-full">
        {accountLabel}
      </Button>
      {showSignInLink && (
        <Link
          href="/fans"
          className="mt-2 block text-center text-xs text-muted underline"
        >
          Sign in as a fan instead
        </Link>
      )}
    </div>
  );
}

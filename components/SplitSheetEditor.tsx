"use client";

import { useState } from "react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Loader";
import { Avatar } from "@/components/Avatar";

export type SheetArtist = {
  artistId: string;
  stageName: string;
  avatarUrl: string | null;
  shareBps: number;
};

export type SheetInvite = {
  name: string;
  email: string;
  shareBps: number;
};

function toPercent(bps: number): string {
  return String(Math.round((bps / 100) * 10) / 10);
}

function toBps(input: string): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 100);
}

// A sheet is submittable when empty (100% owner) or every row has a share
// and the others leave the owner a non-negative remainder.
export function isSheetValid(splits: SheetArtist[], invites: SheetInvite[]): boolean {
  if (splits.length === 0 && invites.length === 0) return true;
  if (![...splits, ...invites].every((x) => x.shareBps > 0)) return false;
  const othersTotal = [...splits, ...invites].reduce((s, x) => s + x.shareBps, 0);
  return othersTotal <= 10000;
}

// Shape the editor state into the sheet API payload: others as listed,
// owner as the auto-remainder (omitted when the others take the full 100%).
// Returns null when the sheet can't be saved as-is.
export function buildSheetPayload(
  ownerId: string,
  splits: SheetArtist[],
  invites: SheetInvite[],
): { splits: { artistId: string; shareBps: number }[]; invites: { name: string; email: string; shareBps: number }[] } | null {
  const others = splits.filter((s) => s.artistId !== ownerId);
  if (!isSheetValid(others, invites)) return null;
  const total = [...others, ...invites].reduce((s, x) => s + x.shareBps, 0);
  if (total === 0) return { splits: [], invites: [] };
  const ownerBps = 10000 - total;
  return {
    splits: [
      ...others.map((s) => ({ artistId: s.artistId, shareBps: s.shareBps })),
      ...(ownerBps > 0 ? [{ artistId: ownerId, shareBps: ownerBps }] : []),
    ],
    invites: invites.map((i) => ({ name: i.name, email: i.email, shareBps: i.shareBps })),
  };
}

// Controlled split-sheet editor: the owner plus added contributors must
// total exactly 100% (or the sheet stays empty = 100% owner). Used in the
// drop wizard (draft state) and on the drop page (loaded state).
export function SplitSheetEditor({
  owner,
  splits,
  invites,
  onChange,
}: {
  owner: { id: string; stageName: string };
  splits: SheetArtist[];
  invites: SheetInvite[];
  onChange: (splits: SheetArtist[], invites: SheetInvite[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SheetArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const othersTotal = [...splits, ...invites].reduce((s, x) => s + x.shareBps, 0);
  const hasRows = splits.length + invites.length > 0;
  const ownerBps = 10000 - othersTotal;
  const allSet = [...splits, ...invites].every((x) => x.shareBps > 0);
  const valid = isSheetValid(splits, invites);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const res = await fetch(`/api/artist/search?q=${encodeURIComponent(q.trim())}`);
    const body = await res.json();
    setSearching(false);
    setResults(
      ((body.artists ?? []) as { id: string; stage_name: string; avatar_url: string | null }[])
        .filter((a) => !splits.some((s) => s.artistId === a.id))
        .map((a) => ({ artistId: a.id, stageName: a.stage_name, avatarUrl: a.avatar_url, shareBps: 0 })),
    );
  }

  function addArtist(a: SheetArtist) {
    onChange([...splits, { ...a, shareBps: 0 }], invites);
    setQuery("");
    setResults([]);
  }

  function addInvite() {
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (invites.some((i) => i.email.toLowerCase() === email)) return;
    onChange(splits, [...invites, { name, email, shareBps: 0 }]);
    setInviteName("");
    setInviteEmail("");
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="mb-1 text-xs font-bold">Revenue split</p>
      <p className="mb-3 text-xs text-muted">
        Who gets paid when this track sells. They&apos;ll be notified when
        money moves -- anyone off Preem gets an invite to join and claim.
      </p>

      <ul className="mb-3 space-y-2">
        <li className="flex items-center justify-between gap-2 text-sm">
          <span className="font-bold">
            {owner.stageName} <span className="font-normal text-muted">(you)</span>
          </span>
          <span className="text-sm font-bold text-accent">{toPercent(Math.max(ownerBps, 0))}%</span>
        </li>
        {splits.map((s) => (
          <li key={s.artistId} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar src={s.avatarUrl} seed={s.artistId} alt={s.stageName} size={28} />
              <span className="truncate text-sm">{s.stageName}</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                value={s.shareBps === 0 ? "" : toPercent(s.shareBps)}
                onChange={(e) => {
                  const bps = toBps(e.target.value);
                  onChange(
                    splits.map((x) => (x.artistId === s.artistId ? { ...x, shareBps: bps ?? 0 } : x)),
                    invites,
                  );
                }}
                placeholder="%"
                aria-label={`${s.stageName} share percent`}
                className="w-20 px-2 py-1.5 text-right"
              />
              <button
                type="button"
                onClick={() => onChange(splits.filter((x) => x.artistId !== s.artistId), invites)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:text-red-400"
                aria-label={`Remove ${s.stageName}`}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.email} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm">
              {i.name} <span className="text-muted">· {i.email} (invite)</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                value={i.shareBps === 0 ? "" : toPercent(i.shareBps)}
                onChange={(e) => {
                  const bps = toBps(e.target.value);
                  onChange(
                    splits,
                    invites.map((x) => (x.email === i.email ? { ...x, shareBps: bps ?? 0 } : x)),
                  );
                }}
                placeholder="%"
                aria-label={`${i.name} share percent`}
                className="w-20 px-2 py-1.5 text-right"
              />
              <button
                type="button"
                onClick={() => onChange(splits, invites.filter((x) => x.email !== i.email))}
                className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:text-red-400"
                aria-label={`Remove invite for ${i.name}`}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">Others total</span>
        <span className={`font-bold ${valid ? "text-paper" : "text-red-400"}`}>
          {toPercent(othersTotal)}%
          {hasRows && !allSet
            ? " -- set every share before saving"
            : othersTotal > 10000
              ? " -- over 100%, lower some shares"
              : ""}
        </span>
      </div>

      <Field label="Add a Preem artist">
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type at least 2 letters of their stage name…"
        />
      </Field>
      {searching && (
        <p className="mb-2 inline-flex items-center gap-2 text-xs text-muted">
          <Spinner size="xs" /> Searching…
        </p>
      )}
      {results.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-xl border border-line bg-bg">
          {results.map((a) => (
            <li key={a.artistId}>
              <button
                type="button"
                onClick={() => addArtist(a)}
                className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-surface-2/50"
              >
                <Avatar src={a.avatarUrl} seed={a.artistId} alt={a.stageName} size={28} />
                <span className="truncate">{a.stageName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Invite someone off Preem (name)">
          <Input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Full name"
            maxLength={120}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="them@email.com"
            maxLength={200}
          />
        </Field>
        <Button type="button" variant="outline" onClick={addInvite} className="mb-4">
          Add invite
        </Button>
      </div>
      <p className="-mt-2 text-xs text-muted">
        They get an email to join Preem and claim their share. Unclaimed money
        stays held until they do.
      </p>
    </div>
  );
}

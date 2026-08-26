"use client";

import { useState } from "react";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

type Props = {
  artistId: string;
  artistName: string;
  followerCount: number;
  initialFollowing: boolean;
  // Whether the visitor already carries a fan identity (auth session or
  // phone-session cookie). When false, following asks for a phone number.
  hasIdentity: boolean;
};

export function FollowButton({
  artistId,
  artistName,
  followerCount,
  initialFollowing,
  hasIdentity,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [askPhone, setAskPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function follow(phoneNumber?: string) {
    const wasFollowing = following;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        ...(phoneNumber ? { phone: phoneNumber } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong — try again.");
      setSubmitting(false);
      return;
    }
    setFollowing(true);
    if (!wasFollowing) setCount((c) => c + 1);
    setAskPhone(false);
    setSubmitting(false);
  }

  async function unfollow() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/follows?artistId=${encodeURIComponent(artistId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not unfollow — try again.");
      setSubmitting(false);
      return;
    }
    setFollowing(false);
    setCount((c) => Math.max(0, c - 1));
    setSubmitting(false);
  }

  function handleClick() {
    if (following) {
      unfollow();
    } else if (hasIdentity) {
      follow();
    } else {
      setAskPhone(true);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1 sm:items-start">
        <Button
          onClick={handleClick}
          variant={following ? "outline" : "primary"}
          disabled={submitting}
        >
          {following ? "Following ✓" : "Follow"}
        </Button>
        <span className="text-[11px] text-muted">
          {count === 1 ? "1 follower" : `${count} followers`}
        </span>
        {error && !askPhone && <p className="text-xs text-[#ff6b6b]">{error}</p>}
      </div>

      {askPhone && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="follow-modal-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setAskPhone(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="follow-modal-title" className="mb-2 text-lg font-bold">
              Follow {artistName}
            </h2>
            <p className="mb-5 text-sm text-muted">
              Drop your phone number and you&apos;ll see their next release the moment it
              lands — right on your My Music page.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                follow(phone);
              }}
              className="text-left"
            >
              <Field label="Phone number">
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  autoFocus
                />
              </Field>
              {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "…" : "Follow"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

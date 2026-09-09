"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Field, Textarea } from "@/components/Field";
import { AUDIO_ACCEPT } from "../new/types";
import type { TrackChangeRequest } from "@/lib/types";

export function TrackAudioChange({
  trackId,
  trackTitle,
  pending,
}: {
  trackId: string;
  trackTitle: string;
  pending: TrackChangeRequest | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!file) {
      setError("Choose a replacement audio file first.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Tell us why you're changing the audio (at least a sentence).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired — sign in again.");

      // Staged under a pending- prefix so it can never be confused with a
      // live track file -- it only goes live if an admin approves it.
      const ext = file.name.split(".").pop();
      const path = `${user.id}/pending-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(path, file);
      if (uploadError) throw new Error("Could not upload replacement audio.");

      const res = await fetch("/api/artist/track-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, newAudioPath: path, reason: reason.trim() }),
      });
      if (!res.ok) {
        // Don't strand the staged file if the request row failed.
        await supabase.storage.from("audio").remove([path]);
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not submit request.");
      }

      setOpen(false);
      setFile(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!pending) return;
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch(`/api/artist/track-change-requests/${pending.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not withdraw request.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setWithdrawing(false);
    }
  }

  if (pending) {
    return (
      <div className="mt-2 rounded-lg border border-line bg-surface-2 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Badge status="pending">Audio change pending review</Badge>
        </div>
        <p className="mb-2 text-xs text-muted">
          <span className="font-bold text-paper">Your reason:</span> {pending.reason}
        </p>
        {error && <p className="mb-2 text-xs text-[#ff6b6b]">{error}</p>}
        <Button
          variant="outline"
          disabled={withdrawing}
          onClick={handleWithdraw}
          className="!px-3 !py-1.5 text-xs"
        >
          {withdrawing ? "Withdrawing…" : "Withdraw request"}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="mt-2 text-[11px] font-bold text-muted underline hover:text-paper"
        aria-label={`Request audio change for ${trackTitle}`}
      >
        Replace audio
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="mb-2 text-xs font-bold">Replace audio — goes to admin for approval</p>
      <input
        type="file"
        accept={AUDIO_ACCEPT}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-2 block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-paper"
      />
      {file && <p className="mb-2 text-xs text-muted">{file.name}</p>}
      <Field label="Why are you changing it?">
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Wrong mix uploaded — this is the final master"
        />
      </Field>
      {error && <p className="mb-2 text-xs text-[#ff6b6b]">{error}</p>}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="!px-4 !py-1.5 text-xs"
        >
          {submitting ? "Sending…" : "Send for approval"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="!px-4 !py-1.5 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

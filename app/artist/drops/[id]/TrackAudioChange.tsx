"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Field, Textarea } from "@/components/Field";
import { AUDIO_ACCEPT } from "../new/types";
import { ProgressBar, Spinner } from "@/components/Loader";
import type { TrackChangeRequest } from "@/lib/types";

// supabase-js upload() reports no progress, so large audio files upload
// blind. A signed URL + XHR PUT gives real byte progress everywhere;
// if signing fails we fall back to the plain upload (indeterminate bar).
function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Could not upload replacement audio."));
    xhr.onerror = () => reject(new Error("Could not upload replacement audio."));
    xhr.send(file);
  });
}

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
  const [progress, setProgress] = useState<number | null>(null);
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
    setProgress(null);
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
      const { data: signed } = await supabase.storage
        .from("audio")
        .createSignedUploadUrl(path);
      if (signed?.signedUrl) {
        setProgress(0);
        await uploadWithProgress(signed.signedUrl, file, setProgress);
      } else {
        // Signing unavailable -- plain upload, indeterminate progress.
        const { error: uploadError } = await supabase.storage
          .from("audio")
          .upload(path, file);
        if (uploadError) throw new Error("Could not upload replacement audio.");
      }

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
      setProgress(null);
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
      <div className="-order-1 mb-4 flex basis-full flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5">
            <Badge status="pending">Audio change pending review</Badge>
          </div>
          <p className="text-xs text-muted">
            <span className="font-bold text-paper">Your reason:</span> {pending.reason}
          </p>
          {error && <p className="mt-1.5 text-xs text-[#ff6b6b]">{error}</p>}
        </div>
        <Button
          variant="outline"
          disabled={withdrawing}
          onClick={handleWithdraw}
          className="!px-4 !py-2 text-xs flex-shrink-0 sm:ml-auto"
        >
          {withdrawing ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" /> Withdrawing…
            </span>
          ) : (
            "Withdraw request"
          )}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="!px-5 !py-2.5 text-xs ml-auto"
        aria-label={`Request audio change for ${trackTitle}`}
      >
        Replace audio
      </Button>
    );
  }

  return (
    <div className="-order-1 mb-4 basis-full rounded-lg border border-line bg-surface-2 p-3">
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
      {submitting && (
        <ProgressBar label="Uploading replacement audio" percent={progress} />
      )}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="!px-4 !py-1.5 text-xs"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" tone="current" /> Sending…
            </span>
          ) : (
            "Send for approval"
          )}
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

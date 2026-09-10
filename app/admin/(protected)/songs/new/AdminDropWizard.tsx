"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/Field";
import { prepareArtworkFile } from "@/lib/client-image";
import { Step1ReleaseSetup } from "@/app/artist/drops/new/Step1ReleaseSetup";
import { Step2TrackDetails } from "@/app/artist/drops/new/Step2TrackDetails";
import { Step3Pricing } from "@/app/artist/drops/new/Step3Pricing";
import { Step4Review } from "@/app/artist/drops/new/Step4Review";
import { PreviewCard } from "@/app/artist/drops/new/PreviewCard";
import { WizardBottomBar } from "@/app/artist/drops/new/WizardBottomBar";
import { ProgressBar } from "@/components/Loader";
import {
  initialWizardState,
  type WizardState,
} from "@/app/artist/drops/new/types";

const STEP_TITLES: Record<number, string> = {
  0: "Artist",
  1: "Release setup",
  2: "Track details",
  3: "Pricing",
  4: "Review",
};

type UploadProgress = (percent: number) => void;

// Browser-direct upload through an admin-minted signed URL, so bytes never
// pass through the Next server. Storage RLS would reject an admin writing
// into an artist's folder, which is why the URL (not the session) carries
// the permission here.
function signedUpload(
  signedUrl: string,
  file: File,
  onPercent: UploadProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPercent(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Storage error (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

async function uploadFile(
  bucket: "audio" | "artwork",
  artistId: string,
  file: File,
  label: string,
  onPercent: UploadProgress,
): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${artistId}/${crypto.randomUUID()}.${ext}`;

  const urlRes = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  if (!urlRes.ok) throw new Error(`Could not prepare ${label} upload.`);
  const { signedUrl } = await urlRes.json();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await signedUpload(signedUrl, file, onPercent);
      return path;
    } catch (e) {
      lastError = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(
    `Could not upload ${label} file: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`,
  );
}

export function AdminDropWizard({
  artists,
}: {
  artists: { id: string; stageName: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [artistId, setArtistId] = useState("");
  const [state, setState] = useState<WizardState>(initialWizardState());
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"publish" | "save" | null>(null);
  const [progress, setProgress] = useState<{ label: string; percent: number | null } | null>(
    null,
  );

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  const isBundle = state.releaseType !== "single";

  function step0Valid() {
    return artistId !== "";
  }

  function step1Valid() {
    if (!state.title.trim()) return false;
    if (isBundle) return state.tracks.length > 0;
    return state.singleAudioFile !== null;
  }

  function step2Valid() {
    return state.tracks.every((t) => t.file && t.title.trim() && Number(t.minPriceNaira) > 0);
  }

  function step3Valid() {
    const minKobo = Math.round((Number(state.minPriceNaira) || 0) * 100);
    if (minKobo <= 0) return false;
    if (isBundle) {
      const sum = state.tracks.reduce(
        (acc, t) => acc + Math.round((Number(t.minPriceNaira) || 0) * 100),
        0,
      );
      if (minKobo >= sum) return false;
    }
    return true;
  }

  function goNext() {
    setError(null);
    if (step === 0) setStep(1);
    else if (step === 1) setStep(isBundle ? 2 : 3);
    else if (step === 2) setStep(3);
    else if (step === 3) setStep(4);
  }

  function goBack() {
    setError(null);
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(isBundle ? 2 : 1);
    else if (step === 4) setStep(3);
  }

  async function submit(mode: "publish" | "save") {
    setError(null);
    if (!artistId) {
      setError("Pick an artist first.");
      setStep(0);
      return;
    }
    if (mode === "publish") {
      if (!step1Valid() || (isBundle && !step2Valid()) || !step3Valid()) {
        setError("Fill in the required fields before publishing.");
        return;
      }
    } else if (!state.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    setSubmitting(mode);
    const supabase = createClient();
    try {
      let artworkPublicUrl: string | null = null;
      if (state.artworkFile) {
        const prepared = await prepareArtworkFile(state.artworkFile);
        if (!prepared) throw new Error("Could not read the artwork file.");
        setProgress({ label: "Uploading artwork", percent: 0 });
        const artPath = await uploadFile("artwork", artistId, prepared, "artwork", (p) =>
          setProgress({ label: "Uploading artwork", percent: p }),
        );
        artworkPublicUrl = supabase.storage.from("artwork").getPublicUrl(artPath).data.publicUrl;
      }

      const releaseMinPriceKobo = Math.round((Number(state.minPriceNaira) || 0) * 100) || 1;
      const strict = mode === "publish";

      type TrackPayload = {
        title: string;
        audioPath: string;
        minPriceNaira: number;
        collaborators: string | null;
        lyrics: string | null;
      };
      const trackPayloads: TrackPayload[] = [];
      if (!isBundle) {
        if (!state.singleAudioFile) {
          if (strict) throw new Error("Add a track file.");
        } else {
          setProgress({ label: "Uploading track", percent: 0 });
          const audioPath = await uploadFile("audio", artistId, state.singleAudioFile, "track", (p) =>
            setProgress({ label: "Uploading track", percent: p }),
          );
          trackPayloads.push({
            title: state.title,
            audioPath,
            minPriceNaira: releaseMinPriceKobo / 100,
            collaborators: null,
            lyrics: null,
          });
        }
      } else {
        const usable = strict
          ? state.tracks
          : state.tracks.filter((t) => t.file && t.title.trim());
        for (const track of usable) {
          if (!track.file) {
            if (strict) throw new Error("Every track needs an audio file.");
            continue;
          }
          const trackNumber = trackPayloads.length + 1;
          setProgress({ label: `Uploading track ${trackNumber} of ${usable.length}`, percent: 0 });
          const audioPath = await uploadFile("audio", artistId, track.file, "track", (p) =>
            setProgress({ label: `Uploading track ${trackNumber} of ${usable.length}`, percent: p }),
          );
          trackPayloads.push({
            title: track.title || `Track ${trackNumber}`,
            audioPath,
            minPriceNaira: strict
              ? Number(track.minPriceNaira)
              : Number(track.minPriceNaira) || 0.01,
            collaborators: track.collaborators || null,
            lyrics: track.lyrics || null,
          });
        }
      }

      if (strict && trackPayloads.length === 0) throw new Error("Add at least one track.");

      setProgress({ label: "Saving drop", percent: null });
      const res = await fetch("/api/admin/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          title: state.title,
          description: state.description || null,
          releaseType: state.releaseType,
          genre: state.genre,
          secondaryGenre: state.secondaryGenre || null,
          status: mode === "publish" ? "published" : "draft",
          minPriceNaira: releaseMinPriceKobo / 100,
          artworkPath: artworkPublicUrl,
          isExclusive: state.dropType === "exclusive",
          releaseDate: state.releaseDate || null,
          tracks: trackPayloads,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not save the drop.");
      }

      router.push("/admin/songs");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(null);
      setProgress(null);
    }
  }

  const primaryDisabled =
    (step === 0 && !step0Valid()) ||
    (step === 1 && !step1Valid()) ||
    (step === 2 && !step2Valid()) ||
    (step === 3 && !step3Valid());

  return (
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-28 pt-8 sm:px-8">
        <Link href="/admin/songs" className="mb-4 inline-block text-sm text-muted hover:text-paper">
          ← Songs
        </Link>
        <h1 className="mb-1 text-xl font-bold">New drop for an artist</h1>
        <p className="mb-6 text-xs font-bold uppercase tracking-wide text-muted">
          Step {step} of 4 · {STEP_TITLES[step]}
        </p>
        <div className={`grid gap-8 ${step === 4 ? "" : "lg:grid-cols-[1fr_280px]"}`}>
          <div>
            {step === 0 && (
              <Field label="Artist">
                <select
                  value={artistId}
                  onChange={(e) => setArtistId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
                >
                  <option value="">Pick an artist…</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.stageName}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted">
                  Only approved artists — the drop lands in their catalogue.
                </p>
              </Field>
            )}
            {step === 1 && <Step1ReleaseSetup state={state} onChange={patch} />}
            {step === 2 && <Step2TrackDetails state={state} onChange={patch} />}
            {step === 3 && <Step3Pricing state={state} onChange={patch} />}
            {step === 4 && <Step4Review state={state} />}
            {progress && (
              <ProgressBar label={progress.label} percent={progress.percent} />
            )}
            {error && <p className="mt-4 text-sm text-[#ff6b6b]">{error}</p>}
          </div>
          {step !== 4 && (
            <div className="hidden lg:block">
              <div className="sticky top-8">
                <PreviewCard state={state} />
              </div>
            </div>
          )}
        </div>
      </main>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <PreviewCard state={state} />
          </div>
        </div>
      )}

      <WizardBottomBar
        onBack={step === 0 ? undefined : goBack}
        onSaveAndClose={() => submit("save")}
        onPreview={() => setShowPreview(true)}
        primaryLabel={step === 4 ? "Publish drop" : "Continue"}
        onPrimary={step === 4 ? () => submit("publish") : goNext}
        primaryDisabled={primaryDisabled || submitting !== null}
        primaryLoading={submitting === "publish"}
      />
    </>
  );
}

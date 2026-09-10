"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { splitLyrics } from "@/lib/lrc";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/Button";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { Step1ReleaseSetup } from "./Step1ReleaseSetup";
import { Step2TrackDetails } from "./Step2TrackDetails";
import { Step3Pricing } from "./Step3Pricing";
import { Step4Review } from "./Step4Review";
import { PreviewCard } from "./PreviewCard";
import { WizardBottomBar } from "./WizardBottomBar";
import { initialWizardState } from "./types";
import type { WizardState } from "./types";
import {
  draftStorageKey,
  isEmptyDraft,
  parseDraft,
  serializeDraft,
  type RestoredDraft,
} from "./types";

type Step = "capture" | 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Exclude<Step, "capture">, string> = {
  1: "Release setup",
  2: "Track details",
  3: "Pricing & window",
  4: "Review & publish",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The browser client's cookie-based session can take a moment to settle
// right after a fresh page load/login — the very first Supabase call fired
// can transiently fail RLS auth even though the artist is genuinely
// approved. One retry after a short delay clears this reliably.
//
// Uploads deliberately bypass supabase-js (.upload() is fetch-based, which
// offers no progress events) and use XHR so the UI can render real
// byte-level progress over slow links.
type UploadProgress = (percent: number) => void;

function storageUpload(
  bucket: "audio" | "artwork",
  path: string,
  file: File,
  token: string,
  onPercent: UploadProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    xhr.setRequestHeader("x-upsert", "true");
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
  userId: string,
  token: string,
  bucket: "audio" | "artwork",
  file: File,
  label: string,
  onPercent: UploadProgress,
): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await storageUpload(bucket, path, file, token, onPercent);
      return path;
    } catch (e) {
      lastError = e;
      // Same transient-session-race protection as before: the very first
      // authenticated call can fail RLS while the session cookie settles.
      if (attempt === 0) await sleep(500);
    }
  }
  throw new Error(
    `Could not upload ${label} file: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`,
  );
}

export default function CreateDropWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("capture");
  const [state, setState] = useState<WizardState>(initialWizardState());
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"publish" | "save" | null>(null);
  const [progress, setProgress] = useState<{ label: string; percent: number | null } | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [resumeOffer, setResumeOffer] = useState<RestoredDraft | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  // Look for an autosaved session once the session (and therefore the
  // storage key) is known. Runs once -- later keystrokes only write.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (cancelled || !user) return;
        setUserId(user.id);
        try {
          const raw = localStorage.getItem(draftStorageKey(user.id));
          if (!raw) return;
          const draft = parseDraft(raw);
          if (draft) setResumeOffer(draft);
        } catch {
          // Private mode / disabled storage -- the wizard just won't resume.
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist every change (debounced) so an abandoned session is resumable.
  // Empty shells clear the key so a finished/discarded draft never haunts
  // the next visit.
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      try {
        if (isEmptyDraft(state)) {
          localStorage.removeItem(draftStorageKey(userId));
        } else {
          localStorage.setItem(draftStorageKey(userId), serializeDraft(step, state));
        }
      } catch {
        // Storage full or unavailable -- non-fatal.
      }
    }, 500);
    return () => clearTimeout(t);
  }, [state, step, userId]);

  function clearAutosave() {
    if (!userId) return;
    try {
      localStorage.removeItem(draftStorageKey(userId));
    } catch {
      // Non-fatal.
    }
  }

  function resumeDraft() {
    if (!resumeOffer) return;
    setState(resumeOffer.state);
    setStep(resumeOffer.step as Step);
    setError(null);
    if (resumeOffer.hadFiles) {
      setRestoredNotice(
        "Picked up where you left off — re-attach your audio and artwork files, browsers can't save those.",
      );
    }
    setResumeOffer(null);
  }

  function discardResumeOffer() {
    clearAutosave();
    setResumeOffer(null);
  }

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function handleDiscard() {
    clearAutosave();
    router.push("/artist/dashboard");
  }

  const isBundle = state.releaseType !== "single";

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
    if (step === "capture") setStep(1);
    else if (step === 1) setStep(isBundle ? 2 : 3);
    else if (step === 2) setStep(3);
    else if (step === 3) setStep(4);
  }

  function goBack() {
    setError(null);
    if (step === 1) setStep("capture");
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(isBundle ? 2 : 1);
    else if (step === 4) setStep(3);
  }

  async function buildTrackRows(
    token: string,
    userId: string,
    releaseMinPriceKobo: number,
    strict: boolean,
  ) {
    if (!isBundle) {
      if (!state.singleAudioFile) {
        if (strict) throw new Error("Add a track file.");
        return [];
      }
      setProgress({ label: "Uploading track", percent: 0 });
      const audioPath = await uploadFile(userId, token, "audio", state.singleAudioFile, "track", (p) =>
        setProgress({ label: "Uploading track", percent: p }),
      );
      return [
        {
          track_number: 1,
          title: state.title,
          audio_file_path: audioPath,
          min_price_kobo: releaseMinPriceKobo,
          collaborators: null,
          lyrics: null,
        },
      ];
    }

    const usable = strict ? state.tracks : state.tracks.filter((t) => t.file && t.title.trim());
    const rows: {
      track_number: number;
      title: string;
      audio_file_path: string;
      min_price_kobo: number;
      collaborators: string | null;
      lyrics: string | null;
      lyrics_lrc: string | null;
    }[] = [];
    for (const track of usable) {
      if (!track.file) {
        if (strict) throw new Error("Every track needs an audio file.");
        continue;
      }
      const trackNumber = rows.length + 1;
      const of = ` of ${usable.length}`;
      setProgress({ label: `Uploading track ${trackNumber}${of}`, percent: 0 });
      const audioPath = await uploadFile(userId, token, "audio", track.file, "track", (p) =>
        setProgress({ label: `Uploading track ${trackNumber}${of}`, percent: p }),
      );
      const { lyrics: plainLyrics, lyricsLrc } = splitLyrics(track.lyrics);
      rows.push({
        track_number: trackNumber,
        title: track.title || `Track ${trackNumber}`,
        audio_file_path: audioPath,
        min_price_kobo: strict
          ? Math.round(Number(track.minPriceNaira) * 100)
          : Math.round((Number(track.minPriceNaira) || 0) * 100) || 1,
        collaborators: track.collaborators || null,
        lyrics: plainLyrics,
        lyrics_lrc: lyricsLrc,
      });
    }
    return rows;
  }

  async function submit(mode: "publish" | "save") {
    setError(null);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired — sign in again.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — sign in again.");

      let artworkPublicUrl: string | null = null;
      if (state.artworkFile) {
        setProgress({ label: "Uploading artwork", percent: 0 });
        const artPath = await uploadFile(user.id, session.access_token, "artwork", state.artworkFile, "artwork", (p) =>
          setProgress({ label: "Uploading artwork", percent: p }),
        );
        artworkPublicUrl = supabase.storage.from("artwork").getPublicUrl(artPath).data.publicUrl;
      }

      const releaseMinPriceKobo = Math.round((Number(state.minPriceNaira) || 0) * 100) || 1;
      const isExclusive = state.dropType === "exclusive";
      const windowEnd =
        mode === "publish" && isExclusive
          ? null
          : mode === "publish" && state.releaseDate
            ? new Date(`${state.releaseDate}T23:59:59`).toISOString()
            : null;

      const dropInsert = {
        artist_id: user.id,
        title: state.title,
        description: state.description || null,
        release_type: state.releaseType,
        genre: state.genre,
        secondary_genre: state.secondaryGenre || null,
        status: mode === "publish" ? "published" : "draft",
        min_price_kobo: releaseMinPriceKobo,
        artwork_path: artworkPublicUrl,
        window_end: windowEnd,
        is_exclusive: isExclusive,
      };

      let { data: drop, error: dropError } = await supabase
        .from("drops")
        .insert(dropInsert)
        .select("id")
        .single();

      // Same transient-session-race protection as uploadFile(): retry once
      // if this was the very first Supabase call in the flow (no artwork).
      if (dropError && !state.artworkFile) {
        await sleep(500);
        ({ data: drop, error: dropError } = await supabase
          .from("drops")
          .insert(dropInsert)
          .select("id")
          .single());
      }

      if (dropError || !drop) {
        throw new Error(
          dropError?.message
            ? `Could not save the drop: ${dropError.message}`
            : "Could not save the drop.",
        );
      }

      const trackRows = await buildTrackRows(session.access_token, user.id, releaseMinPriceKobo, mode === "publish");
      setProgress({ label: "Saving tracklist", percent: null });
      if (trackRows.length > 0) {
        const { error: tracksError } = await supabase
          .from("drop_tracks")
          .insert(trackRows.map((r) => ({ ...r, drop_id: drop.id })));
        if (tracksError) throw new Error("Could not save the tracklist.");
      }

      router.push(mode === "publish" ? `/artist/drops/${drop.id}` : "/artist/dashboard");
      clearAutosave();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(null);
      setProgress(null);
    }
  }

  if (resumeOffer) {
    const when = resumeOffer.savedAt
      ? new Date(resumeOffer.savedAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
    return (
      <>
        <Nav role="artist" />
        <main className="mx-auto w-full max-w-sm flex-1 px-5 py-16 text-center">
          <h1 className="mb-2 text-2xl font-bold">Unfinished drop</h1>
          <p className="mb-6 text-sm text-muted">
            {resumeOffer.state.title.trim() || "Untitled"}
            {when ? ` · saved ${when}` : ""}
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full" onClick={resumeDraft}>
              Continue where I left off
            </Button>
            <Button variant="outline" className="w-full" onClick={discardResumeOffer}>
              Start fresh
            </Button>
          </div>
        </main>
      </>
    );
  }

  if (step === "capture") {
    return (
      <>
        <Nav role="artist" />
        <QuickCaptureModal
          state={state}
          onChange={patch}
          onDiscard={handleDiscard}
          onContinue={goNext}
        />
      </>
    );
  }

  const primaryDisabled =
    (step === 1 && !step1Valid()) ||
    (step === 2 && !step2Valid()) ||
    (step === 3 && !step3Valid());

  return (
    <>
      <Nav role="artist" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-28 pt-8 sm:px-8">
        <div className="mb-1 flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="-ml-2 rounded-full p-1 text-muted transition-colors hover:text-paper"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">Create a drop</h1>
        </div>
        <p className="mb-6 text-xs font-bold uppercase tracking-wide text-muted">
          Step {step} of 4 · {STEP_TITLES[step]}
        </p>
        {restoredNotice && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-xs text-muted">{restoredNotice}</p>
            <button
              type="button"
              onClick={() => setRestoredNotice(null)}
              aria-label="Dismiss"
              className="flex-shrink-0 text-muted hover:text-paper"
            >
              ✕
            </button>
          </div>
        )}
        <div className={`grid gap-8 ${step === 4 ? "" : "lg:grid-cols-[1fr_280px]"}`}>
          <div>
            {step === 1 && <Step1ReleaseSetup state={state} onChange={patch} />}
            {step === 2 && <Step2TrackDetails state={state} onChange={patch} />}
            {step === 3 && <Step3Pricing state={state} onChange={patch} />}
            {step === 4 && <Step4Review state={state} />}
            {progress && (
              <div className="mt-4" aria-live="polite">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {progress.label}
                  {progress.percent !== null ? ` · ${progress.percent}%` : "…"}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  {progress.percent !== null ? (
                    <div
                      className="h-full rounded-full bg-paper transition-all duration-200"
                      style={{ width: `${progress.percent}%` }}
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-full bg-paper/40" />
                  )}
                </div>
              </div>
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

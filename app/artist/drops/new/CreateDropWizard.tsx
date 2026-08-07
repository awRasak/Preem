"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Nav } from "@/components/Nav";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { Step1ReleaseSetup } from "./Step1ReleaseSetup";
import { Step2TrackDetails } from "./Step2TrackDetails";
import { Step3Pricing } from "./Step3Pricing";
import { Step4Review } from "./Step4Review";
import { PreviewCard } from "./PreviewCard";
import { WizardBottomBar } from "./WizardBottomBar";
import { initialWizardState } from "./types";
import type { WizardState } from "./types";

type Step = "capture" | 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Exclude<Step, "capture">, string> = {
  1: "Release setup",
  2: "Track details",
  3: "Pricing & window",
  4: "Review & publish",
};

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  bucket: "audio" | "artwork",
  userId: string,
  file: File,
) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw new Error(`Could not upload ${bucket === "audio" ? "track" : "artwork"} file.`);
  return path;
}

export default function CreateDropWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("capture");
  const [state, setState] = useState<WizardState>(initialWizardState());
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"publish" | "save" | null>(null);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function handleDiscard() {
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
    supabase: ReturnType<typeof createClient>,
    userId: string,
    releaseMinPriceKobo: number,
    strict: boolean,
  ) {
    if (!isBundle) {
      if (!state.singleAudioFile) {
        if (strict) throw new Error("Add a track file.");
        return [];
      }
      const audioPath = await uploadFile(supabase, "audio", userId, state.singleAudioFile);
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
    }[] = [];
    for (const track of usable) {
      if (!track.file) {
        if (strict) throw new Error("Every track needs an audio file.");
        continue;
      }
      const trackNumber = rows.length + 1;
      const audioPath = await uploadFile(supabase, "audio", userId, track.file);
      rows.push({
        track_number: trackNumber,
        title: track.title || `Track ${trackNumber}`,
        audio_file_path: audioPath,
        min_price_kobo: strict
          ? Math.round(Number(track.minPriceNaira) * 100)
          : Math.round((Number(track.minPriceNaira) || 0) * 100) || 1,
        collaborators: track.collaborators || null,
        lyrics: track.lyrics || null,
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

      let artworkPublicUrl: string | null = null;
      if (state.artworkFile) {
        const artPath = await uploadFile(supabase, "artwork", user.id, state.artworkFile);
        artworkPublicUrl = supabase.storage.from("artwork").getPublicUrl(artPath).data.publicUrl;
      }

      const releaseMinPriceKobo = Math.round((Number(state.minPriceNaira) || 0) * 100) || 1;
      const isExclusive = state.dropType === "exclusive";
      const windowEnd =
        mode === "publish" && isExclusive
          ? null
          : mode === "publish"
            ? new Date(Date.now() + state.windowHours * 60 * 60 * 1000).toISOString()
            : null;

      const { data: drop, error: dropError } = await supabase
        .from("drops")
        .insert({
          artist_id: user.id,
          title: state.title,
          description: state.description || null,
          release_type: state.releaseType,
          status: mode === "publish" ? "published" : "draft",
          min_price_kobo: releaseMinPriceKobo,
          artwork_path: artworkPublicUrl,
          window_end: windowEnd,
          is_exclusive: isExclusive,
        })
        .select("id")
        .single();

      if (dropError || !drop) {
        throw new Error("Could not save the drop. Make sure your artist account is approved.");
      }

      const trackRows = await buildTrackRows(supabase, user.id, releaseMinPriceKobo, mode === "publish");
      if (trackRows.length > 0) {
        const { error: tracksError } = await supabase
          .from("drop_tracks")
          .insert(trackRows.map((r) => ({ ...r, drop_id: drop.id })));
        if (tracksError) throw new Error("Could not save the tracklist.");
      }

      router.push(mode === "publish" ? `/artist/drops/${drop.id}` : "/artist/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(null);
    }
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
        <h1 className="mb-1 text-xl font-bold">Create a drop</h1>
        <p className="mb-6 text-xs font-bold uppercase tracking-wide text-muted">
          Step {step} of 4 · {STEP_TITLES[step]}
        </p>
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            {step === 1 && <Step1ReleaseSetup state={state} onChange={patch} />}
            {step === 2 && <Step2TrackDetails state={state} onChange={patch} />}
            {step === 3 && <Step3Pricing state={state} onChange={patch} />}
            {step === 4 && <Step4Review state={state} />}
            {error && <p className="mt-4 text-sm text-[#ff6b6b]">{error}</p>}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <PreviewCard state={state} />
            </div>
          </div>
        </div>
      </main>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <PreviewCard state={state} />
          </div>
        </div>
      )}

      <WizardBottomBar
        onBack={goBack}
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

"use client";

// Byte-level storage uploads with real progress. supabase-js .upload() is
// fetch-based (no progress events), so this bypasses it with XHR --
// extracted from CreateDropWizard so every upload surface (avatar,
// thank-you media, show art, drop artwork) reports the same live percent.
//
// The browser client's cookie-based session can take a moment to settle
// right after a fresh page load/login -- the very first call can
// transiently fail RLS auth even though the user is genuine, hence one
// retry after a short delay.

export type UploadProgress = (percent: number) => void;

export type UploadBucket = "audio" | "artwork" | "thankyou";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageUpload(
  bucket: UploadBucket,
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

export async function uploadFileWithProgress(
  userId: string,
  token: string,
  bucket: UploadBucket,
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
      // Same transient-session-race protection as above: the very first
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

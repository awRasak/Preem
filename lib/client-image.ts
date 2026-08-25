"use client";

// Artwork gets served through next/image's optimizer, which chokes (times
// out or 500s) on very large source images -- a phone photo straight out of
// a modern camera can be 4000px+ per side and several MB. Downscaling and
// re-encoding client-side, before upload, keeps every artwork file within a
// size the optimizer (and mobile data plans) can handle without needing any
// user-facing "your file is too big" rejection.
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;

export async function prepareArtworkFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

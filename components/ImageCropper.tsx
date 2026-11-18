"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./Button";
import { Spinner } from "./Loader";

type Props = {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
  size?: number;
};

export function ImageCropper({ file, onConfirm, onCancel, size = 256 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgDims, setImgDims] = useState({ width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      setImgDims({ width: img.width, height: img.height });
      const minScale = Math.max(size / img.width, size / img.height);
      setScale(minScale);
      setOffset({
        x: (size - img.width * minScale) / 2,
        y: (size - img.height * minScale) / 2,
      });
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file, size]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, size, Math.max(0, offset.y));
    ctx.fillRect(0, Math.min(size, offset.y + img.height * scale), size, size);
    ctx.fillRect(0, Math.max(0, offset.y), Math.max(0, offset.x), Math.min(size, offset.y + img.height * scale) - Math.max(0, offset.y));
    ctx.fillRect(Math.min(size, offset.x + img.width * scale), Math.max(0, offset.y), size - Math.min(size, offset.x + img.width * scale), Math.min(size, offset.y + img.height * scale) - Math.max(0, offset.y));

    ctx.strokeStyle = "#ff6b39";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [scale, offset, size]);

  useEffect(() => {
    draw();
  }, [draw]);

  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const touch = e.touches[0];
    setOffset({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  }

  function handleTouchEnd() {
    setDragging(false);
  }

  function handleZoom(e: React.ChangeEvent<HTMLInputElement>) {
    const img = imgRef.current;
    if (!img) return;
    const newScale = parseFloat(e.target.value);
    const center = { x: size / 2, y: size / 2 };
    const ratio = newScale / scale;
    setOffset({
      x: center.x - (center.x - offset.x) * ratio,
      y: center.y - (center.y - offset.y) * ratio,
    });
    setScale(newScale);
  }

  async function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setSaving(false); return; }

    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    const srcW = size / scale;
    const srcH = size / scale;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) { setSaving(false); return; }

    const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + "_cropped.jpg", {
      type: "image/jpeg",
    });
    onConfirm(croppedFile);
  }

  const minScale = imgLoaded
    ? Math.max(size / imgDims.width, size / imgDims.height)
    : 1;
  const maxScale = minScale * 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-4">
        <h3 className="mb-3 text-lg font-bold">Crop photo</h3>
        <p className="mb-3 text-xs text-muted">
          Drag to reposition. Use the slider to zoom.
        </p>

        {!imgLoaded ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : (
          <>
            <div
              className="relative mx-auto cursor-grab overflow-hidden rounded-lg border-2 border-accent"
              style={{ width: size, height: size, maxWidth: "100%" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="block"
                style={{ width: "100%", height: "auto", aspectRatio: "1/1" }}
              />
            </div>

            <div className="mt-3">
              <label className="text-xs text-muted">Zoom</label>
              <input
                type="range"
                min={minScale}
                max={maxScale}
                step={0.01}
                value={scale}
                onChange={handleZoom}
                className="w-full accent-accent"
              />
            </div>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm} disabled={saving || !imgLoaded}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="xs" tone="current" /> Cropping...
              </span>
            ) : (
              "Crop and upload"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

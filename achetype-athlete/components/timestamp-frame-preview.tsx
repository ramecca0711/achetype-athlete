/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/athlete/request-review/page.tsx`
 * - `app/coach/exercises/page.tsx`
 * - `app/coach/review-log/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useEffect, useState } from "react";

type Props = {
  videoUrl: string;
  timestampSeconds: number | null | undefined;
  label: string;
};

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|ogg)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\//i.test(url);
}

function parseYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim() || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function appendTimestamp(url: string, seconds: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be") || parsed.hostname.includes("youtube.com")) {
      parsed.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
      return parsed.toString();
    }
    if (parsed.hostname.includes("loom.com")) {
      parsed.searchParams.set("t", String(Math.max(0, Math.floor(seconds))));
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export default function TimestampFramePreview({ videoUrl, timestampSeconds, label }: Props) {
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [error, setError] = useState("");
  const youtubeId = parseYouTubeId(videoUrl);
  const timestamp = typeof timestampSeconds === "number" ? Math.max(0, timestampSeconds) : 0;
  const timestampedLink = appendTimestamp(videoUrl, timestamp);
  const canCaptureFrame = isDirectVideoUrl(videoUrl);

  useEffect(() => {
    let cancelled = false;

    async function capture() {
      setError("");
      setImageDataUrl("");
      setThumbnailUrl("");

      if (!videoUrl || timestampSeconds === null || timestampSeconds === undefined) {
        setError("No timestamp frame available.");
        return;
      }

      if (!canCaptureFrame) {
        if (youtubeId) {
          setThumbnailUrl(`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`);
          return;
        }
        if (/loom\.com/i.test(videoUrl)) {
          setError("Frame capture is unavailable for Loom links. Open link at timestamp.");
          return;
        }
        setError("Frame capture requires a direct uploaded video URL.");
        return;
      }

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.src = videoUrl;

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Unable to load video for frame capture."));
        });
      } catch (captureError) {
        if (!cancelled) setError((captureError as Error).message);
        return;
      }

      if (cancelled) return;

      const safeTimestamp = Math.max(0, Math.min(Number(timestampSeconds), Number(video.duration || 0)));
      video.currentTime = safeTimestamp;

      try {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("Unable to seek video for frame capture."));
        });
      } catch (captureError) {
        if (!cancelled) setError((captureError as Error).message);
        return;
      }

      if (cancelled) return;

      const width = video.videoWidth || 320;
      const height = video.videoHeight || 180;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        if (!cancelled) setError("Could not create frame preview.");
        return;
      }

      context.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (!cancelled) setImageDataUrl(dataUrl);
    }

    capture();
    return () => {
      cancelled = true;
    };
  }, [videoUrl, timestampSeconds, canCaptureFrame, youtubeId]);

  return (
    <div className="border rounded-lg p-2 bg-white">
      <p className="text-xs meta">{label}</p>
      {imageDataUrl || thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageDataUrl || thumbnailUrl} alt={label} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
      ) : (
        <div className="w-full h-32 rounded mt-1 bg-slate-50 flex items-center justify-center text-xs meta">
          {error || "Loading frame..."}
        </div>
      )}
      {typeof timestampSeconds === "number" && (
        <p className="text-xs mt-1">Timestamp: {timestampSeconds.toFixed(1)}s</p>
      )}
      <a className="text-xs underline text-blue-700 mt-1 inline-block" href={timestampedLink} target="_blank">
        Open at timestamp
      </a>
    </div>
  );
}

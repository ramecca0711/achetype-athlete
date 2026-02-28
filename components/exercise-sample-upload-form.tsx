/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/coach/exercises/page.tsx`
 * - `lib/supabase/client.ts`
 * - `lib/supabase/resumable-upload.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { uploadFileResumable } from "@/lib/supabase/resumable-upload";

type ExerciseOption = {
  id: string;
  name: string;
  category?: string | null;
  exercise_group?: string | null;
  exercise_subgroup?: string | null;
  structural_goal?: string | null;
  cues?: string | null;
  purpose_impact?: string | null;
  where_to_feel?: string | null;
  dos_examples?: string | null;
  donts_examples?: string | null;
};

type UploadedVideo = {
  url: string;
  duration: number;
  name: string;
};

type RepPhotoSlot = "top" | "middle" | "bottom";

type Props = {
  exercises: ExerciseOption[];
  fixedExerciseId?: string;
  initialVideoUrl?: string;
  initialTopTs?: number | null;
  initialMiddleTs?: number | null;
  initialBottomTs?: number | null;
  action: (formData: FormData) => void;
  embeddedInParentForm?: boolean;
  hideExerciseSelect?: boolean;
  showSubmitButton?: boolean;
};

const MAX_VIDEOS = 1;
const MAX_DURATION_SECONDS = 180;
const IMAGE_ACCEPT = "image/*";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatClock(value: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number(value ?? 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseClockInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+:\d{1,2}$/.test(trimmed)) {
    const [m, s] = trimmed.split(":");
    const minutes = Number(m);
    const seconds = Number(s);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
    return Math.max(0, minutes * 60 + seconds);
  }
  const asSeconds = Number(trimmed);
  if (!Number.isFinite(asSeconds) || asSeconds < 0) return null;
  return asSeconds;
}

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
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = pathParts.findIndex((part) => part === "shorts");
      if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) return pathParts[shortsIndex + 1];
      const embedIndex = pathParts.findIndex((part) => part === "embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) return pathParts[embedIndex + 1];
    }
  } catch {
    return null;
  }
  return null;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("loom.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const shareId = parts[parts.length - 1] ?? "";
      if (shareId) return `https://www.loom.com/embed/${shareId}`;
    }
    const youtubeId = parseYouTubeId(url);
    if (youtubeId) return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
  } catch {
    return null;
  }
  return null;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Unable to read video metadata."));
    };
    video.src = URL.createObjectURL(file);
  });
}

export default function ExerciseSampleUploadForm({
  exercises,
  fixedExerciseId,
  initialVideoUrl = "",
  initialTopTs = null,
  initialMiddleTs = null,
  initialBottomTs = null,
  action,
  embeddedInParentForm = false,
  hideExerciseSelect = false,
  showSubmitButton = true
}: Props) {
  const trimmedInitialVideoUrl = initialVideoUrl.trim();
  const initialSource: "upload" | "link" =
    trimmedInitialVideoUrl && isDirectVideoUrl(trimmedInitialVideoUrl) ? "upload" : "link";

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [selectedExerciseId, setSelectedExerciseId] = useState(fixedExerciseId ?? "");
  const [videoSource, setVideoSource] = useState<"upload" | "link">(trimmedInitialVideoUrl ? initialSource : "upload");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>(
    trimmedInitialVideoUrl && initialSource === "upload"
      ? [{ url: trimmedInitialVideoUrl, duration: 0, name: "Saved sample video" }]
      : []
  );
  const [linkInput, setLinkInput] = useState(trimmedInitialVideoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [loadedLinkUrl, setLoadedLinkUrl] = useState(initialSource === "link" ? trimmedInitialVideoUrl : "");
  const [loadedLinkKey, setLoadedLinkKey] = useState(0);

  const [cursor, setCursor] = useState(0);
  const [typedTime, setTypedTime] = useState("");
  const [duration, setDuration] = useState(0);
  const [topTs, setTopTs] = useState<number | null>(initialTopTs);
  const [middleTs, setMiddleTs] = useState<number | null>(initialMiddleTs);
  const [bottomTs, setBottomTs] = useState<number | null>(initialBottomTs);
  const [topPhotoUrl, setTopPhotoUrl] = useState("");
  const [middlePhotoUrl, setMiddlePhotoUrl] = useState("");
  const [bottomPhotoUrl, setBottomPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState<RepPhotoSlot | null>(null);
  const [photoDragOver, setPhotoDragOver] = useState<Record<RepPhotoSlot, boolean>>({
    top: false,
    middle: false,
    bottom: false
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const linkedUrls = useMemo(() => (linkInput.trim() ? [linkInput.trim()] : []), [linkInput]);
  const hasValidLinkUrls = useMemo(() => {
    if (linkedUrls.length !== 1) return false;
    return linkedUrls.every((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }, [linkedUrls]);

  async function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = Array.from(event.target.files ?? []);

    if (!selected.length) return;
    if (selected.length > MAX_VIDEOS) {
      setError(`You can upload up to ${MAX_VIDEOS} videos.`);
      return;
    }

    try {
      for (const file of selected) {
        const seconds = await getVideoDuration(file);
        if (seconds > MAX_DURATION_SECONDS) {
          throw new Error(`${file.name} is longer than 3 minutes.`);
        }
      }
      setFiles(selected);
      setUploadedVideos([]);
      setSelectedVideoIndex(0);
      setTopTs(null);
      setMiddleTs(null);
      setBottomTs(null);
    } catch (metadataError) {
      setError((metadataError as Error).message);
    }
  }

  async function uploadFiles() {
    if (!files.length) {
      setError("Choose 1 video first.");
      return;
    }

    setUploading(true);
    setError("");

    const uploaded: UploadedVideo[] = [];
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const actorId = user?.id;
    if (!actorId) {
      setUploading(false);
      setError("You are signed out. Please sign in and retry upload.");
      return;
    }

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const seconds = await getVideoDuration(file);
      if (seconds > MAX_DURATION_SECONDS) {
        setUploading(false);
        setError(`${file.name} is longer than 3 minutes.`);
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "mp4";
      const path = `${actorId}/exercise-sample-${Date.now()}-${i + 1}.${safeExt}`;
      let publicUrl = "";
      try {
        const resumable = await uploadFileResumable({
          supabase,
          bucket: "exercise-sample-videos",
          path,
          file,
          upsert: true,
          cacheControl: "3600"
        });
        publicUrl = resumable.publicUrl;
      } catch (resumableError) {
        setUploading(false);
        const filePart = ` File size: ${formatBytes(file.size)}.`;
        setError(`Upload failed.${filePart} ${String((resumableError as Error).message)}`);
        return;
      }

      uploaded.push({ url: publicUrl, duration: Math.round(seconds), name: file.name });
    }

    setUploadedVideos(uploaded);
    setUploading(false);
    setSelectedVideoIndex(0);
    setCursor(0);
    setTopTs(null);
    setMiddleTs(null);
    setBottomTs(null);
    setTopPhotoUrl("");
    setMiddlePhotoUrl("");
    setBottomPhotoUrl("");
  }

  function onVideoLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const d = Number(event.currentTarget.duration || 0);
    setDuration(d);
    setCursor(0);
  }

  function onScrub(value: number) {
    setCursor(value);
    if (videoSource === "upload" && videoRef.current) {
      videoRef.current.currentTime = value;
      return;
    }
    if (videoSource === "link" && loadedLinkYouTubeId && youtubePlayerRef.current?.seekTo) {
      youtubePlayerRef.current.seekTo(value, true);
      window.setTimeout(() => {
        const current = Number(youtubePlayerRef.current?.getCurrentTime?.() || value);
        if (Number.isFinite(current)) setCursor(current);
      }, 80);
    }
  }

  function getTypedSeconds(): number | null {
    return parseClockInput(typedTime);
  }

  function loadLinkVideo() {
    setError("");
    const url = linkInput.trim();
    if (!url) {
      setError("Paste one Loom or YouTube link first.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setError("Enter a valid video URL.");
      return;
    }

    setLoadedLinkUrl(url);
    setLoadedLinkKey((prev) => prev + 1);
    setCursor(0);
    setDuration(0);
    setTopTs(null);
    setMiddleTs(null);
    setBottomTs(null);
    setTopPhotoUrl("");
    setMiddlePhotoUrl("");
    setBottomPhotoUrl("");
    setYoutubeReady(false);
  }

  async function captureAndUploadFrame(slot: RepPhotoSlot) {
    if (videoSource !== "upload" || !videoRef.current) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    const actorId = user?.id;
    if (!actorId) {
      setError("You are signed out. Please sign in and retry.");
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not create frame image.");
      return;
    }

    let blob: Blob | null = null;
    try {
      context.drawImage(video, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    } catch {
      setError("Frame capture blocked by browser security for this video source. Upload a local file or add screenshots manually.");
      return;
    }
    if (!blob) {
      setError("Could not encode frame image.");
      return;
    }

    const path = `${actorId}/exercise-rep-${slot}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("exercise-sample-videos")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("exercise-sample-videos").getPublicUrl(path);
    if (slot === "top") setTopPhotoUrl(data.publicUrl);
    if (slot === "middle") setMiddlePhotoUrl(data.publicUrl);
    if (slot === "bottom") setBottomPhotoUrl(data.publicUrl);
  }

  async function onSetTimestamp(slot: RepPhotoSlot) {
    if (slot === "top") setTopTs(cursor);
    if (slot === "middle") setMiddleTs(cursor);
    if (slot === "bottom") setBottomTs(cursor);
    await captureAndUploadFrame(slot);
  }

  async function uploadManualScreenshot(slot: RepPhotoSlot, file: File) {
    setError("");
    setPhotoUploading(slot);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const actorId = user?.id;
    if (!actorId) {
      setPhotoUploading(null);
      setError("You are signed out. Please sign in and retry.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${actorId}/manual-rep-${slot}-${Date.now()}.${safeExt}`;
    const { error: uploadError } = await supabase.storage
      .from("exercise-sample-videos")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type || "image/jpeg" });

    if (uploadError) {
      setPhotoUploading(null);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("exercise-sample-videos").getPublicUrl(path);
    if (slot === "top") setTopPhotoUrl(data.publicUrl);
    if (slot === "middle") setMiddlePhotoUrl(data.publicUrl);
    if (slot === "bottom") setBottomPhotoUrl(data.publicUrl);
    setPhotoUploading(null);
  }

  async function onManualPhotoInput(slot: RepPhotoSlot, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadManualScreenshot(slot, file);
  }

  async function onDropManualPhoto(slot: RepPhotoSlot, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setPhotoDragOver((prev) => ({ ...prev, [slot]: false }));
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadManualScreenshot(slot, file);
  }

  function markerLeft(seconds: number | null, maxDuration: number): string {
    if (seconds === null || !Number.isFinite(seconds) || maxDuration <= 0) return "0%";
    const clamped = Math.max(0, Math.min(seconds, maxDuration));
    return `${(clamped / maxDuration) * 100}%`;
  }

  function jumpToTimestamp(seconds: number | null) {
    if (seconds === null || !Number.isFinite(seconds)) return;
    onScrub(seconds);
  }

  function renderTimestampMarkers() {
    const fallbackDuration =
      duration > 0
        ? duration
        : (videoSource === "upload" ? activeVideo?.duration ?? 0 : 180);
    const maxDuration = Math.max(fallbackDuration, 1);

    const markers: Array<{ label: string; seconds: number | null; color: string }> = [
      { label: "Top", seconds: topTs, color: "bg-blue-600" },
      { label: "Mid", seconds: middleTs, color: "bg-amber-500" },
      { label: "Bottom", seconds: bottomTs, color: "bg-red-500" }
    ];

    return (
      <div className="mt-2">
        <p className="text-[11px] text-slate-500 mb-1">Timestamp markers</p>
        <div className="relative h-10 border rounded bg-slate-50">
          {markers.map((marker) => {
            if (marker.seconds === null) {
              return (
                <div
                  key={`marker-${marker.label}-empty`}
                  className="absolute top-4 -translate-x-1/2 flex items-center justify-center"
                  style={{
                    left: marker.label === "Top" ? "15%" : marker.label === "Mid" ? "50%" : "85%"
                  }}
                  title={`${marker.label}: not set`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full opacity-25 ${marker.color}`} />
                </div>
              );
            }
            return (
              <button
                type="button"
                key={`marker-${marker.label}`}
                className="absolute -translate-x-1/2 top-0 flex flex-col items-center"
                style={{ left: markerLeft(marker.seconds, maxDuration) }}
                title={`${marker.label}: ${formatClock(marker.seconds)} (click to go)`}
                onClick={() => jumpToTimestamp(marker.seconds)}
              >
                <span className="text-[10px] leading-none text-slate-600">↑</span>
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${marker.color}`} />
                <span className="text-[10px] leading-none text-slate-600 mt-0.5">{marker.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const activeVideo = uploadedVideos[selectedVideoIndex];
  const loadedLinkEmbedUrl = useMemo(() => toEmbedUrl(loadedLinkUrl), [loadedLinkUrl]);
  const loadedLinkYouTubeId = useMemo(() => parseYouTubeId(loadedLinkUrl), [loadedLinkUrl]);
  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedExerciseId),
    [exercises, selectedExerciseId]
  );

  useEffect(() => {
    if (!loadedLinkYouTubeId || videoSource !== "link") return;
    const start = () => {
      if (!youtubeContainerRef.current || !window.YT?.Player) return;
      youtubePlayerRef.current?.destroy?.();
      const player = new window.YT.Player(youtubeContainerRef.current, {
        videoId: loadedLinkYouTubeId,
        playerVars: { rel: 0 },
        events: {
          onReady: (event: any) => {
            const d = Number(event?.target?.getDuration?.() || 0);
            if (d > 0) setDuration(d);
            setYoutubeReady(true);
            const current = Number(event?.target?.getCurrentTime?.() || 0);
            if (Number.isFinite(current)) setCursor(current);
          },
          onStateChange: () => {
            // Time sync is polled while player is ready.
          }
        }
      });
      youtubePlayerRef.current = player;
    };

    if (window.YT?.Player) {
      start();
    } else {
      const priorHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        priorHandler?.();
        start();
      };
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }

    return () => {
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
      setYoutubeReady(false);
    };
  }, [loadedLinkYouTubeId, videoSource, loadedLinkKey]);

  useEffect(() => {
    if (videoSource !== "link" || !loadedLinkYouTubeId || !youtubeReady) return;
    const id = window.setInterval(() => {
      const current = Number(youtubePlayerRef.current?.getCurrentTime?.() || 0);
      if (Number.isFinite(current)) setCursor(current);
      const d = Number(youtubePlayerRef.current?.getDuration?.() || 0);
      if (d > 0) setDuration(d);
    }, 250);
    return () => window.clearInterval(id);
  }, [videoSource, loadedLinkYouTubeId, youtubeReady]);

  function getLiveCursorSeconds(): number {
    if (videoSource === "link" && loadedLinkYouTubeId && youtubePlayerRef.current?.getCurrentTime) {
      const live = Number(youtubePlayerRef.current.getCurrentTime() || 0);
      if (Number.isFinite(live) && live >= 0) {
        setCursor(live);
        return live;
      }
    }
    return cursor;
  }

  function setTimestampFromLiveCursor(slot: RepPhotoSlot) {
    if (videoSource === "link" && loadedLinkYouTubeId && !youtubeReady) {
      setError("YouTube player is still loading. Try again in a second.");
      return;
    }
    setError("");
    const seconds = getLiveCursorSeconds();
    if (slot === "top") setTopTs(seconds);
    if (slot === "middle") setMiddleTs(seconds);
    if (slot === "bottom") setBottomTs(seconds);
  }

  function setTimestampFromTyped(slot: RepPhotoSlot) {
    const parsed = getTypedSeconds();
    if (parsed === null) {
      setError("Enter time as m:ss (example 1:23) or seconds.");
      return;
    }
    setError("");
    setCursor(parsed);
    onScrub(parsed);
    if (slot === "top") setTopTs(parsed);
    if (slot === "middle") setMiddleTs(parsed);
    if (slot === "bottom") setBottomTs(parsed);
  }

  const formContent = (
    <>
      {fixedExerciseId ? (
        <input type="hidden" name="exercise_id" value={fixedExerciseId} readOnly />
      ) : !hideExerciseSelect ? (
        <label className="text-sm block md:col-span-2">
          Exercise
          <select
            className="select mt-1"
            name="exercise_id"
            value={selectedExerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            required
          >
            <option value="">Select</option>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {!hideExerciseSelect && selectedExercise && (
        <details className="md:col-span-2 border rounded p-3 bg-white" open={false}>
          <summary className="cursor-pointer list-none text-sm font-semibold">
            Exercise Database Info
          </summary>
          <div className="mt-2 space-y-1 text-sm">
            <p><span className="meta">Name:</span> {selectedExercise.name}</p>
            <p><span className="meta">Category:</span> {selectedExercise.category ?? "-"}</p>
            <p><span className="meta">Group:</span> {selectedExercise.exercise_group ?? "-"}</p>
            <p><span className="meta">Subgroup:</span> {selectedExercise.exercise_subgroup ?? "-"}</p>
            <p><span className="meta">Structural goal:</span> {selectedExercise.structural_goal ?? "-"}</p>
            <p><span className="meta">Cues:</span> {selectedExercise.cues ?? "-"}</p>
            <p><span className="meta">Purpose/Impact:</span> {selectedExercise.purpose_impact ?? "-"}</p>
            <p><span className="meta">Where to feel:</span> {selectedExercise.where_to_feel ?? "-"}</p>
            <p><span className="meta">Do:</span> {selectedExercise.dos_examples ?? "-"}</p>
            <p><span className="meta">Don&apos;t:</span> {selectedExercise.donts_examples ?? "-"}</p>
          </div>
        </details>
      )}

      <div className="md:col-span-2 border rounded p-3 bg-white">
        <p className="text-sm font-semibold">Sample Video Source (1 file or 1 link)</p>
        <div className="mt-2 flex gap-4 flex-wrap">
          <label className="text-sm flex items-center gap-2">
            <input
              type="radio"
              name="video_source"
              value="upload"
              checked={videoSource === "upload"}
              onChange={() => {
                setVideoSource("upload");
                setError("");
                if (trimmedInitialVideoUrl && isDirectVideoUrl(trimmedInitialVideoUrl) && uploadedVideos.length === 0) {
                  setUploadedVideos([{ url: trimmedInitialVideoUrl, duration: 0, name: "Saved sample video" }]);
                }
              }}
            />
            Upload file
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="radio"
              name="video_source"
              value="link"
              checked={videoSource === "link"}
              onChange={() => {
                setVideoSource("link");
                setError("");
                if (trimmedInitialVideoUrl && !isDirectVideoUrl(trimmedInitialVideoUrl)) {
                  setLoadedLinkUrl(trimmedInitialVideoUrl);
                }
              }}
            />
            Paste Loom / YouTube link
          </label>
        </div>

        {videoSource === "upload" && (
          <div className="mt-2">
            <p className="text-xs meta">Upload 1 video (max 3 minutes).</p>
            <input className="input mt-2" type="file" accept="video/*" onChange={onPickFiles} />
            {!!files[0] && (
              <p className="text-xs meta mt-1">Selected: {files[0].name} ({formatBytes(files[0].size)})</p>
            )}
            <button className="btn btn-secondary mt-2" type="button" onClick={uploadFiles} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Sample Video"}
            </button>
          </div>
        )}

        {videoSource === "link" && (
          <div className="mt-2 space-y-2">
            <p className="text-xs meta">Paste one Loom or YouTube link.</p>
            <input
              className="input"
              type="url"
              placeholder="https://youtu.be/... or https://www.loom.com/share/..."
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={loadLinkVideo}
              disabled={!hasValidLinkUrls}
            >
              Load Video Link
            </button>
            {!!loadedLinkUrl && (
              <p className="text-xs text-green-700">Loaded video is persisted for this exercise.</p>
            )}
            <p className="text-xs meta">
              Exact timestamp screenshots are only generated for uploaded video files.
            </p>
          </div>
        )}

        {error && <p className="text-red-700 text-sm mt-2">{error}</p>}

        {videoSource === "upload" && !!uploadedVideos.length && (
          <div className="mt-3 space-y-2">
            {uploadedVideos.map((video, index) => (
              <label key={video.url} className="block text-sm border rounded p-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="selected_video_index"
                    checked={selectedVideoIndex === index}
                    onChange={() => setSelectedVideoIndex(index)}
                  />
                  <span>{video.name} ({video.duration}s)</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {videoSource === "upload" && activeVideo && (
        <div className="md:col-span-2 border rounded p-3 bg-white space-y-2">
          <p className="text-sm font-semibold">Frame Cursor for Top / Middle / Bottom</p>
          <video
            ref={videoRef}
            className="w-full max-h-[440px] object-contain rounded border bg-black"
            crossOrigin="anonymous"
            controls
            src={activeVideo.url}
            onLoadedMetadata={onVideoLoadedMetadata}
          />
          <label className="text-xs block">
            Cursor: {formatClock(cursor)}
            <input
              className="w-full"
              type="range"
              min={0}
              max={Math.max(duration || activeVideo?.duration || 0.1, 0.1)}
              step={0.1}
              value={cursor}
              onChange={(event) => onScrub(Number(event.target.value))}
            />
          </label>
          <div className="flex gap-2 items-end flex-wrap">
            <label className="text-xs">
              Type time (m:ss or seconds)
              <input
                className="input mt-1 w-44"
                value={typedTime}
                onChange={(event) => setTypedTime(event.target.value)}
                placeholder="1:23"
              />
            </label>
          </div>
          {renderTimestampMarkers()}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("top")}>Set Top</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("top")}>Set Top (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(topTs)} disabled={topTs == null}>Go Top</button>
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("middle")}>Set Middle</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("middle")}>Set Middle (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(middleTs)} disabled={middleTs == null}>Go Middle</button>
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("bottom")}>Set Bottom</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("bottom")}>Set Bottom (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(bottomTs)} disabled={bottomTs == null}>Go Bottom</button>
          </div>
          <p className="text-xs meta">Top: {topTs == null ? "-" : formatClock(topTs)} | Middle: {middleTs == null ? "-" : formatClock(middleTs)} | Bottom: {bottomTs == null ? "-" : formatClock(bottomTs)}</p>
        </div>
      )}

      {videoSource === "link" && !!loadedLinkUrl && (
        <div className="md:col-span-2 border rounded p-3 bg-white space-y-2">
          <p className="text-sm font-semibold">Frame Cursor for Top / Middle / Bottom</p>
          {loadedLinkYouTubeId ? (
            <div className="rounded border overflow-hidden bg-black">
              <div ref={youtubeContainerRef} className="w-full h-[420px]" />
            </div>
          ) : loadedLinkEmbedUrl ? (
            <div className="rounded border overflow-hidden bg-black">
              <iframe
                src={loadedLinkEmbedUrl}
                className="w-full h-[420px]"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Sample link video"
              />
            </div>
          ) : (
            <div className="rounded border p-3 text-sm bg-slate-50">
              <p>Preview unavailable for this URL type.</p>
              <a href={loadedLinkUrl} target="_blank" className="underline text-blue-700">
                Open link in new tab
              </a>
            </div>
          )}
          <label className="text-xs block">
            Cursor: {formatClock(cursor)}
            <input
              className="w-full"
              type="range"
              min={0}
              max={Math.max(duration || 180, 0.1)}
              step={0.1}
              value={cursor}
              onChange={(event) => onScrub(Number(event.target.value))}
            />
          </label>
          <div className="flex gap-2 items-end flex-wrap">
            <label className="text-xs">
              Type time (m:ss or seconds)
              <input
                className="input mt-1 w-44"
                value={typedTime}
                onChange={(event) => setTypedTime(event.target.value)}
                placeholder="1:23"
              />
            </label>
          </div>
          {renderTimestampMarkers()}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromLiveCursor("top")}>Set Top</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("top")}>Set Top (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(topTs)} disabled={topTs == null}>Go Top</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromLiveCursor("middle")}>Set Middle</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("middle")}>Set Middle (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(middleTs)} disabled={middleTs == null}>Go Middle</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromLiveCursor("bottom")}>Set Bottom</button>
            <button type="button" className="btn btn-secondary" onClick={() => setTimestampFromTyped("bottom")}>Set Bottom (typed)</button>
            <button type="button" className="btn btn-secondary" onClick={() => jumpToTimestamp(bottomTs)} disabled={bottomTs == null}>Go Bottom</button>
          </div>
          <p className="text-xs meta">Top: {topTs == null ? "-" : formatClock(topTs)} | Middle: {middleTs == null ? "-" : formatClock(middleTs)} | Bottom: {bottomTs == null ? "-" : formatClock(bottomTs)}</p>
        </div>
      )}

      <div className="md:col-span-2 border rounded p-3 bg-white">
        <p className="text-sm font-semibold">Manual Screenshots (fallback for links)</p>
        <p className="text-xs meta mt-1">Drag and drop or choose from Photos app for top/middle/bottom.</p>
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {([
            { slot: "top", label: "Top screenshot", url: topPhotoUrl },
            { slot: "middle", label: "Middle screenshot", url: middlePhotoUrl },
            { slot: "bottom", label: "Bottom screenshot", url: bottomPhotoUrl }
          ] as const).map((item) => (
            <div
              key={`manual-${item.slot}`}
              className={`border rounded p-2 ${photoDragOver[item.slot] ? "border-blue-400 bg-blue-50" : "bg-slate-50"}`}
              onDragOver={(event) => {
                event.preventDefault();
                setPhotoDragOver((prev) => ({ ...prev, [item.slot]: true }));
              }}
              onDragLeave={() => setPhotoDragOver((prev) => ({ ...prev, [item.slot]: false }))}
              onDrop={(event) => onDropManualPhoto(item.slot, event)}
            >
              <p className="text-xs meta">{item.label}</p>
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.label} className="w-full h-24 object-contain rounded mt-1 bg-white" />
              ) : (
                <div className="w-full h-24 rounded mt-1 bg-white border border-dashed flex items-center justify-center text-xs meta">
                  Drop image here
                </div>
              )}
              <label className="btn btn-secondary mt-2 w-full text-center cursor-pointer">
                {photoUploading === item.slot ? "Uploading..." : "Choose image"}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(event) => onManualPhotoInput(item.slot, event)}
                  disabled={photoUploading !== null}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <input
        type="hidden"
        name="sample_video_urls"
        value={JSON.stringify(videoSource === "upload" ? uploadedVideos.map((video) => video.url) : (loadedLinkUrl ? [loadedLinkUrl] : []))}
        readOnly
      />
      <input
        type="hidden"
        name="sample_video_durations"
        value={JSON.stringify(videoSource === "upload" ? uploadedVideos.map((video) => video.duration) : [duration ? Math.round(duration) : null])}
        readOnly
      />
      <input type="hidden" name="loom_url" value={videoSource === "upload" ? activeVideo?.url ?? "" : loadedLinkUrl} readOnly />
      <input
        type="hidden"
        name="ts_top_seconds"
        value={topTs ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="ts_middle_seconds"
        value={middleTs ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="ts_bottom_seconds"
        value={bottomTs ?? ""}
        readOnly
      />
      <input type="hidden" name="photo_top" value={topPhotoUrl} readOnly />
      <input type="hidden" name="photo_middle" value={middlePhotoUrl} readOnly />
      <input type="hidden" name="photo_bottom" value={bottomPhotoUrl} readOnly />

      {showSubmitButton && (
        <button
          className="btn btn-primary md:col-span-2"
          type="submit"
          disabled={
            uploading ||
            (videoSource === "upload" ? !uploadedVideos.length : !loadedLinkUrl)
          }
        >
          Save Sample
        </button>
      )}
    </>
  );

  if (embeddedInParentForm) {
    return <div className="grid md:grid-cols-2 gap-3 mt-3">{formContent}</div>;
  }

  return (
    <form action={action} className="grid md:grid-cols-2 gap-3 mt-3">
      {formContent}
    </form>
  );
}

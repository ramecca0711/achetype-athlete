/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/athlete/request-review/page.tsx`
 * - `lib/supabase/client.ts`
 * - `lib/types.ts`
 * - `lib/supabase/resumable-upload.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { confidencePhrases } from "@/lib/types";
import { uploadFileResumable } from "@/lib/supabase/resumable-upload";

type ExerciseOption = {
  id: string;
  name: string;
  exercise_group: string;
};

type ExerciseSamplePhotosByExercise = Record<
  string,
  {
    top?: string;
    middle?: string;
    bottom?: string;
  }
>;

type UploadedVideo = {
  url: string;
  duration: number;
  name: string;
};

type RepPhotoSlot = "top" | "middle" | "bottom";

type Props = {
  exercises: ExerciseOption[];
  samplePhotosByExercise: ExerciseSamplePhotosByExercise;
  action: (formData: FormData) => void;
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

function getTimestampHref(url: string, seconds: number | null): string {
  if (!url || seconds === null || !Number.isFinite(seconds)) return url;
  const rounded = Math.max(0, Math.round(seconds));
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      parsed.searchParams.set("t", String(rounded));
      return parsed.toString();
    }
    if (host.includes("youtube.com")) {
      parsed.searchParams.set("t", String(rounded));
      return parsed.toString();
    }
    if (host.includes("loom.com")) {
      parsed.searchParams.set("t", String(rounded));
      return parsed.toString();
    }
  } catch {
    return `${url}#t=${rounded}`;
  }
  return `${url}#t=${rounded}`;
}

export default function RequestReviewForm({ exercises, samplePhotosByExercise, action }: Props) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(0);
  const [duration, setDuration] = useState(0);
  const [topTs, setTopTs] = useState<number | null>(null);
  const [middleTs, setMiddleTs] = useState<number | null>(null);
  const [bottomTs, setBottomTs] = useState<number | null>(null);
  const [topPhotoUrl, setTopPhotoUrl] = useState("");
  const [middlePhotoUrl, setMiddlePhotoUrl] = useState("");
  const [bottomPhotoUrl, setBottomPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState<RepPhotoSlot | null>(null);
  const [photoDragOver, setPhotoDragOver] = useState<Record<RepPhotoSlot, boolean>>({
    top: false,
    middle: false,
    bottom: false
  });
  const [submitValidationError, setSubmitValidationError] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  async function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setSubmitValidationError("");
    const selected = Array.from(event.target.files ?? []);

    if (!selected.length) return;
    if (selected.length > MAX_VIDEOS) {
      setError(`You can upload up to ${MAX_VIDEOS} videos.`);
      return;
    }

    try {
      // Validate duration before committing to state or uploading
      for (const file of selected) {
        const durationSeconds = await getVideoDuration(file);
        if (durationSeconds > MAX_DURATION_SECONDS) {
          throw new Error(`${file.name} is longer than 3 minutes.`);
        }
      }
      // Reset all state for the new video
      setFiles(selected);
      setUploadedVideos([]);
      setTopTs(null);
      setMiddleTs(null);
      setBottomTs(null);
      setTopPhotoUrl("");
      setMiddlePhotoUrl("");
      setBottomPhotoUrl("");
      // Auto-start upload immediately after validation so the Submit button
      // becomes enabled without a separate "Upload Video" click step.
      await uploadFilesInternal(selected);
    } catch (metadataError) {
      setError((metadataError as Error).message);
    }
  }

  // Core upload logic — accepts explicit file list so it can be called
  // both from the retry button (using `files` state) and from onPickFiles
  // (using freshly validated files before state has settled).
  async function uploadFilesInternal(filesToUpload: File[]) {
    setUploading(true);
    setError("");
    setSubmitValidationError("");

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

    for (let i = 0; i < filesToUpload.length; i += 1) {
      const file = filesToUpload[i];
      const durationSeconds = await getVideoDuration(file);

      if (durationSeconds > MAX_DURATION_SECONDS) {
        setUploading(false);
        setError(`${file.name} is longer than 3 minutes.`);
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "mp4";
      const path = `${actorId}/review-${Date.now()}-${i + 1}.${safeExt}`;

      let publicUrl = "";
      try {
        const resumable = await uploadFileResumable({
          supabase,
          bucket: "review-videos",
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

      uploaded.push({
        url: publicUrl,
        duration: Math.round(durationSeconds),
        name: file.name
      });
    }

    setUploadedVideos(uploaded);
    setUploading(false);
    setCursor(0);
    setTopTs(null);
    setMiddleTs(null);
    setBottomTs(null);
    setTopPhotoUrl("");
    setMiddlePhotoUrl("");
    setBottomPhotoUrl("");
  }

  // Retry button wrapper — uploads from current `files` state.
  async function uploadFiles() {
    if (!files.length) {
      setError("Choose 1 video file first.");
      return;
    }
    await uploadFilesInternal(files);
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    setSubmitValidationError("");

    if (uploading) {
      event.preventDefault();
      setSubmitValidationError("Please wait for the video upload to finish before submitting.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!uploadedVideos.length) {
      event.preventDefault();
      setSubmitValidationError("Upload one video before submitting your review request.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const form = event.currentTarget;
    const exerciseId = String(new FormData(form).get("exercise_id") ?? "").trim();
    if (!exerciseId) {
      event.preventDefault();
      setSubmitValidationError("Select an exercise before submitting your review request.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function onVideoLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const d = Number(event.currentTarget.duration || 0);
    setDuration(d);
    setCursor(0);
  }

  function onScrub(value: number) {
    setCursor(value);
    if (videoRef.current) {
      videoRef.current.currentTime = value;
    }
  }

  function markerLeft(seconds: number | null, maxDuration: number): string {
    if (seconds === null || !Number.isFinite(seconds) || maxDuration <= 0) return "0%";
    const clamped = Math.max(0, Math.min(seconds, maxDuration));
    return `${(clamped / maxDuration) * 100}%`;
  }

  function renderTimestampMarkers() {
    const maxDuration = Math.max(duration || activeVideo?.duration || 0, 1);
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
              <div
                key={`marker-${marker.label}`}
                className="absolute -translate-x-1/2 top-0 flex flex-col items-center"
                style={{ left: markerLeft(marker.seconds, maxDuration) }}
                title={`${marker.label}: ${marker.seconds.toFixed(1)}s`}
              >
                <span className="text-[10px] leading-none text-slate-600">↑</span>
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${marker.color}`} />
                <span className="text-[10px] leading-none text-slate-600 mt-0.5">{marker.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  async function captureAndUploadFrame(slot: "top" | "middle" | "bottom") {
    if (!videoRef.current) return;
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
    const path = `${actorId}/request-rep-${slot}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("review-videos")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("review-videos").getPublicUrl(path);
    if (slot === "top") setTopPhotoUrl(data.publicUrl);
    if (slot === "middle") setMiddlePhotoUrl(data.publicUrl);
    if (slot === "bottom") setBottomPhotoUrl(data.publicUrl);
  }

  async function onSetTimestamp(slot: "top" | "middle" | "bottom") {
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

    if (!file.type.startsWith("image/")) {
      setPhotoUploading(null);
      setError("Please upload an image file.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${actorId}/request-manual-rep-${slot}-${Date.now()}.${safeExt}`;
    const { error: uploadError } = await supabase.storage
      .from("review-videos")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type || "image/jpeg" });

    if (uploadError) {
      setPhotoUploading(null);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("review-videos").getPublicUrl(path);
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

  const activeVideo = uploadedVideos[0];

  return (
    <form action={action} className="space-y-4" onSubmit={onFormSubmit}>
      {submitValidationError && (
        <p className="text-red-700 text-sm border border-red-200 bg-red-50 rounded p-2">
          {submitValidationError}
        </p>
      )}
      <label className="text-sm block">
        Select Exercise
        <select
          className="select mt-1"
          name="exercise_id"
          value={selectedExerciseId}
          onChange={(event) => setSelectedExerciseId(event.target.value)}
          required
        >
          <option value="">Select...</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name} ({exercise.exercise_group})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm block">
        Confidence Score
        <select className="select mt-1" name="confidence_score" defaultValue="3">
          {Object.entries(confidencePhrases).map(([score, phrase]) => (
            <option key={score} value={score}>
              {score} - {phrase}
            </option>
          ))}
        </select>
      </label>

      <div className="border rounded p-3 bg-white">
        <p className="text-sm font-semibold">Upload 1 video (max 3 minutes)</p>
        <input className="input mt-2" type="file" accept="video/*" onChange={onPickFiles} />
        {!!files[0] && (
          <p className="text-xs meta mt-1">Selected: {files[0].name} ({formatBytes(files[0].size)})</p>
        )}
        {/* Upload starts automatically on file selection; this button retries if needed */}
        <button className="btn btn-secondary mt-2" type="button" onClick={uploadFiles} disabled={uploading || !files.length}>
          {uploading ? "Uploading..." : "Retry Upload"}
        </button>
        {error && <p className="text-red-700 text-sm mt-2">{error}</p>}

        {!!uploadedVideos.length && (
          <div className="mt-3 space-y-2">
            <div className="block text-sm border rounded p-2">
              {uploadedVideos[0].name} ({uploadedVideos[0].duration}s)
            </div>
          </div>
        )}
      </div>

      {activeVideo && (
        <div className="border rounded p-3 bg-white space-y-2">
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
            Cursor: {cursor.toFixed(1)}s
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
          {renderTimestampMarkers()}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("top")}>Set Top</button>
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("middle")}>Set Middle</button>
            <button type="button" className="btn btn-secondary" onClick={() => onSetTimestamp("bottom")}>Set Bottom</button>
          </div>
          <p className="text-xs meta">
            Top: {topTs?.toFixed(1) ?? "-"}s | Middle: {middleTs?.toFixed(1) ?? "-"}s | Bottom: {bottomTs?.toFixed(1) ?? "-"}s
          </p>
          <div className="space-y-2">
            {([
              { key: "top", label: "top", timestamp: topTs, requestPhoto: topPhotoUrl },
              { key: "middle", label: "middle", timestamp: middleTs, requestPhoto: middlePhotoUrl },
              { key: "bottom", label: "bottom", timestamp: bottomTs, requestPhoto: bottomPhotoUrl }
            ] as const).map((item) => {
              const samplePhoto = selectedExerciseId ? samplePhotosByExercise[selectedExerciseId]?.[item.key] : undefined;
              const timestampHref = activeVideo?.url ? getTimestampHref(activeVideo.url, item.timestamp) : "";

              return (
                <div key={`request-compare-${item.key}`} className="grid md:grid-cols-2 gap-2">
                  <div className="border rounded-lg p-2 bg-white">
                    <p className="text-xs meta">Your form photo ({item.label})</p>
                    {item.requestPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.requestPhoto} alt={`Your form photo ${item.label}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                    ) : (
                      <div className="w-full h-32 rounded mt-1 bg-slate-50 border border-dashed flex items-center justify-center text-xs meta">
                        No timestamp frame available.
                      </div>
                    )}
                    {timestampHref && item.timestamp !== null && (
                      <a href={timestampHref} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700 mt-1 inline-block">
                        Open at timestamp
                      </a>
                    )}
                  </div>
                  <div className="border rounded-lg p-2 bg-white">
                    <p className="text-xs meta">Master sample photo ({item.label})</p>
                    {samplePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={samplePhoto} alt={`Master sample ${item.label}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                    ) : (
                      <div className="w-full h-32 rounded mt-1 bg-slate-50 flex items-center justify-center text-xs meta">
                        No sample photo
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <details className="border rounded p-3 bg-white" open={false}>
        <summary className="cursor-pointer list-none text-sm font-semibold flex items-center justify-between">
          Manual Screenshots (fallback)
          <span className="meta text-xs">v</span>
        </summary>
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
      </details>

      <label className="text-sm block">
        Feedback Category
        <input className="input mt-1" name="feedback_category" placeholder="breathing, hip shift" />
      </label>

      <label className="text-sm block">
        Notes / Questions
        <textarea className="textarea mt-1" name="notes" />
      </label>

      <input type="hidden" name="request_video_urls" value={JSON.stringify(uploadedVideos.map((video) => video.url))} readOnly />
      <input type="hidden" name="request_video_durations" value={JSON.stringify(uploadedVideos.map((video) => video.duration))} readOnly />
      <input type="hidden" name="submission_video_url" value={activeVideo?.url ?? ""} readOnly />
      <input type="hidden" name="ts_top_seconds" value={topTs ?? ""} readOnly />
      <input type="hidden" name="ts_middle_seconds" value={middleTs ?? ""} readOnly />
      <input type="hidden" name="ts_bottom_seconds" value={bottomTs ?? ""} readOnly />
      <input type="hidden" name="request_photo_top" value={topPhotoUrl} readOnly />
      <input type="hidden" name="request_photo_middle" value={middlePhotoUrl} readOnly />
      <input type="hidden" name="request_photo_bottom" value={bottomPhotoUrl} readOnly />

      <button className="btn btn-primary" type="submit" disabled={uploading}>
        Submit Review Request
      </button>
    </form>
  );
}

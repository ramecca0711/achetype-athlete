/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/coach/exercises/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ytdl from "@distube/ytdl-core";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

type TimestampSet = {
  top?: number | null;
  middle?: number | null;
  bottom?: number | null;
};

function toSafeSeconds(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.max(0, Math.floor(value));
}

function isYoutubeUrl(url: string): boolean {
  return ytdl.validateURL(url);
}

async function downloadYoutubeToTempFile(url: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `yt-${randomUUID()}.mp4`);
  const info = await ytdl.getInfo(url);
  const format =
    ytdl.chooseFormat(info.formats, { quality: "18" }) ||
    ytdl.chooseFormat(info.formats, { quality: "lowestvideo" });
  const stream = ytdl.downloadFromInfo(info, { format });
  await pipeline(stream, createWriteStream(tempPath));
  return tempPath;
}

async function downloadDirectFileToTempFile(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Video fetch failed (${response.status})`);
  const tempPath = path.join(os.tmpdir(), `video-${randomUUID()}.mp4`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

async function captureFrameToFile(videoPath: string, seconds: number): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `frame-${randomUUID()}-${seconds}.jpg`);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(seconds)
      .frames(1)
      .outputOptions(["-q:v 2"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
  return outputPath;
}

export async function generateTimestampScreenshots(
  videoUrl: string,
  timestamps: TimestampSet
): Promise<Partial<Record<"top" | "middle" | "bottom", Buffer>>> {
  const safeTimestamps: Record<"top" | "middle" | "bottom", number | null> = {
    top: toSafeSeconds(timestamps.top),
    middle: toSafeSeconds(timestamps.middle),
    bottom: toSafeSeconds(timestamps.bottom)
  };

  const requested = (Object.keys(safeTimestamps) as Array<keyof typeof safeTimestamps>).filter(
    (key) => safeTimestamps[key] !== null
  );
  if (!requested.length) return {};

  let videoPath = "";
  try {
    if (isYoutubeUrl(videoUrl)) {
      videoPath = await downloadYoutubeToTempFile(videoUrl);
    } else {
      videoPath = await downloadDirectFileToTempFile(videoUrl);
    }

    const result: Partial<Record<"top" | "middle" | "bottom", Buffer>> = {};
    for (const slot of requested) {
      const seconds = safeTimestamps[slot];
      if (seconds === null) continue;
      const framePath = await captureFrameToFile(videoPath, seconds);
      const frameBuffer = await fs.readFile(framePath);
      result[slot] = frameBuffer;
      await fs.unlink(framePath).catch(() => undefined);
    }
    return result;
  } finally {
    if (videoPath) {
      await fs.unlink(videoPath).catch(() => undefined);
    }
  }
}

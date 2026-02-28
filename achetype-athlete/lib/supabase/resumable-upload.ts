/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `components/exercise-sample-upload-form.tsx`
 * - `components/request-review-form.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { Upload } from "tus-js-client";

type UploadArgs = {
  supabase: any;
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  cacheControl?: string;
};

export async function uploadFileResumable({
  supabase,
  bucket,
  path,
  file,
  upsert = true,
  cacheControl = "3600"
}: UploadArgs): Promise<{ publicUrl: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public env vars for resumable upload.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Signed-in session required for resumable upload.");
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1500, 3000, 5000, 8000],
      uploadDataDuringCreation: false,
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
        "x-upsert": upsert ? "true" : "false"
      },
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl
      },
      onError(error) {
        reject(error);
      },
      onSuccess() {
        resolve();
      }
    });
    upload.start();
  });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

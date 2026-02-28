/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/athlete/profile/page.tsx`
 * - `app/onboarding/page.tsx`
 * - `lib/supabase/client.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Slot = "front" | "back" | "left" | "right";

type Props = {
  athleteId: string;
  slot: Slot;
  initialUrl?: string;
};

export default function PosturePhotoInput({ athleteId, slot, initialUrl = "" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState(initialUrl);

  const supabase = useMemo(() => createSupabaseBrowser(), []);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setError("You must be signed in to upload photos.");
      setUploading(false);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${user.id}/${athleteId}-${slot}-${Date.now()}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from("posture-photos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("posture-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="text-sm block border rounded-xl p-3 bg-white">
      <label className="font-medium">{slot.toUpperCase()} Photo</label>
      <input
        className="input mt-2"
        type="file"
        accept="image/*"
        onChange={onFileChange}
      />
      <input type="hidden" name={`photo_${slot}`} value={photoUrl} readOnly />
      {uploading && <p className="text-xs text-blue-700 mt-2">Uploading...</p>}
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
      {photoUrl && (
        <a className="text-xs text-blue-700 underline mt-2 inline-block" href={photoUrl} target="_blank">
          View uploaded photo
        </a>
      )}
    </div>
  );
}

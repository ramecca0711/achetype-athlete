/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/coach/clients/page.tsx`
 * - `lib/supabase/client.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type AthleteOption = {
  id: string;
  full_name: string;
  email: string;
};

type Props = {
  athletes?: AthleteOption[];
  fixedAthleteId?: string;
  fixedAthleteLabel?: string;
  action: (formData: FormData) => void;
};

export default function ProgramLoadForm({ athletes = [], fixedAthleteId, fixedAthleteLabel, action }: Props) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [sourceType, setSourceType] = useState<"trainerize_link" | "pdf_upload">("trainerize_link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfPath, setPdfPath] = useState("");

  async function onPdfSelected(event: React.ChangeEvent<HTMLInputElement>) {
    setUploadError("");
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please upload a PDF file.");
      return;
    }

    setUploading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setUploadError("You must be signed in to upload a PDF.");
      setUploading(false);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const safeExt = extension.replace(/[^a-z0-9]/g, "") || "pdf";
    const path = `${user.id}/program-import-${Date.now()}.${safeExt}`;

    const { error: uploadErrorResult } = await supabase.storage
      .from("program-imports")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: "application/pdf" });

    if (uploadErrorResult) {
      setUploadError(uploadErrorResult.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("program-imports").getPublicUrl(path);
    setPdfUrl(data.publicUrl);
    setPdfPath(path);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-3 mt-4">
      {fixedAthleteId ? (
        <>
          <input type="hidden" name="athlete_id" value={fixedAthleteId} />
          <p className="text-sm">
            <span className="meta">Athlete:</span> {fixedAthleteLabel ?? "Selected athlete"}
          </p>
        </>
      ) : (
        <label className="text-sm block">
          Athlete
          <select className="select mt-1" name="athlete_id" required>
            <option value="">Select athlete</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.full_name} ({athlete.email})
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-sm block">
        Program Name (optional)
        <input className="input mt-1" name="program_name" placeholder="If blank, generated from source" />
      </label>

      <div className="flex gap-4 flex-wrap">
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            name="source_type"
            value="trainerize_link"
            checked={sourceType === "trainerize_link"}
            onChange={() => setSourceType("trainerize_link")}
          />
          Trainerize Link
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            name="source_type"
            value="pdf_upload"
            checked={sourceType === "pdf_upload"}
            onChange={() => setSourceType("pdf_upload")}
          />
          PDF Upload
        </label>
      </div>

      {sourceType === "trainerize_link" ? (
        <label className="text-sm block">
          Trainerize PrintTrackingLog Link
          <input
            className="input mt-1"
            name="source_url"
            type="url"
            placeholder="https://.../PrintTrackingLog.aspx#workoutPlanID=...&userID=..."
            required
          />
        </label>
      ) : (
        <div className="space-y-2">
          <label className="text-sm block">
            Upload Program PDF
            <input className="input mt-1" type="file" accept="application/pdf" onChange={onPdfSelected} />
          </label>
          {uploading && <p className="text-xs text-blue-700">Uploading PDF...</p>}
          {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
          {pdfUrl && (
            <p className="text-xs">
              PDF uploaded:{" "}
              <a className="underline text-blue-700" href={pdfUrl} target="_blank">
                Open
              </a>
            </p>
          )}
          <input type="hidden" name="source_pdf_url" value={pdfUrl} readOnly />
          <input type="hidden" name="source_pdf_path" value={pdfPath} readOnly />
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={uploading || (sourceType === "pdf_upload" && !pdfUrl)}>
        Load Program
      </button>
    </form>
  );
}

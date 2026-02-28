/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/coach/review-log/page.tsx`
 * - `lib/archetype.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArchetypeKind, suggestArchetypeFromRatio } from "@/lib/archetype";

type Props = {
  athleteId: string;
  fullName: string;
  shoulderWidth: number | null;
  hipWidth: number | null;
  postureFeedbackLoomUrl?: string | null;
  frontPhotoUrl?: string;
  backPhotoUrl?: string;
  photoCount: number;
  action: (formData: FormData) => void;
};

type Point = { x: number; y: number };

const pointLabels = ["Shoulder Left", "Shoulder Right", "Hip Left", "Hip Right"] as const;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function ArchetypeApprovalForm({
  athleteId,
  fullName,
  shoulderWidth,
  hipWidth,
  postureFeedbackLoomUrl,
  frontPhotoUrl,
  backPhotoUrl,
  photoCount,
  action
}: Props) {
  const frontPhotoRef = useRef<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<Array<Point | null>>([null, null, null, null]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fallbackShoulder = Number(shoulderWidth ?? 0);
  const fallbackHip = Number(hipWidth ?? 0);

  const measuredShoulder = useMemo(() => {
    if (!points[0] || !points[1]) return 0;
    return distance(points[0], points[1]);
  }, [points]);
  const measuredHip = useMemo(() => {
    if (!points[2] || !points[3]) return 0;
    return distance(points[2], points[3]);
  }, [points]);

  const numericShoulder = measuredShoulder > 0 ? measuredShoulder : fallbackShoulder;
  const numericHip = measuredHip > 0 ? measuredHip : fallbackHip;
  const hasMeasurements = numericShoulder > 0 && numericHip > 0;
  const isMeasuredFromPhoto = measuredShoulder > 0 && measuredHip > 0;
  const nextPointIndex = points.findIndex((point) => !point);

  const initialSuggestion = useMemo(() => {
    if (hasMeasurements) return suggestArchetypeFromRatio(numericShoulder, numericHip).archetype;
    return "H" as ArchetypeKind;
  }, [hasMeasurements, numericShoulder, numericHip]);
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeKind>(initialSuggestion);
  const [manualOverride, setManualOverride] = useState(false);

  const aiSuggestion = useMemo(() => {
    if (!hasMeasurements) return null;
    return suggestArchetypeFromRatio(numericShoulder, numericHip);
  }, [hasMeasurements, numericShoulder, numericHip]);

  useEffect(() => {
    if (!manualOverride && aiSuggestion?.archetype) {
      setSelectedArchetype(aiSuggestion.archetype);
    }
  }, [aiSuggestion, manualOverride]);

  useEffect(() => {
    if (dragIndex === null) return;

    const onPointerMove = (event: PointerEvent) => {
      const rect = frontPhotoRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;

      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

      setPoints((prev) => {
        const next = [...prev];
        next[dragIndex] = { x, y };
        return next;
      });
    };

    const onPointerUp = () => {
      setDragIndex(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragIndex]);

  function placePoint(event: MouseEvent<HTMLDivElement>) {
    const index = points.findIndex((point) => !point);
    if (index === -1) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    setPoints((prev) => {
      const next = [...prev];
      next[index] = { x, y };
      return next;
    });
  }

  function resetPoints() {
    setPoints([null, null, null, null]);
  }

  function startDragPoint(index: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragIndex(index);
  }

  return (
    <form action={action} className="border rounded-xl p-3 bg-white space-y-3">
      <input type="hidden" name="athlete_id" value={athleteId} readOnly />

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold">{fullName}</p>
          <p className="text-xs meta">Photo set complete: {photoCount} / 4</p>
        </div>
        <div className="badge">AI suggestion {aiSuggestion?.archetype ?? "-"}</div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="border rounded-lg p-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs meta">
              Front photo {frontPhotoUrl ? "- click to place points" : ""}
            </p>
            {frontPhotoUrl && (
              <button type="button" className="btn btn-secondary !py-1 !px-2 !text-xs" onClick={resetPoints}>
                Reset points
              </button>
            )}
          </div>
          {frontPhotoUrl ? (
            <div ref={frontPhotoRef} className="relative rounded bg-slate-50 cursor-crosshair" onClick={placePoint}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frontPhotoUrl} alt={`${fullName} front posture`} className="w-full h-64 object-contain rounded bg-slate-50" />
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {points[0] && points[1] && (
                  <line
                    x1={points[0].x * 100}
                    y1={points[0].y * 100}
                    x2={points[1].x * 100}
                    y2={points[1].y * 100}
                    stroke="#2563eb"
                    strokeWidth="0.8"
                  />
                )}
                {points[2] && points[3] && (
                  <line
                    x1={points[2].x * 100}
                    y1={points[2].y * 100}
                    x2={points[3].x * 100}
                    y2={points[3].y * 100}
                    stroke="#ef4444"
                    strokeWidth="0.8"
                  />
                )}
              </svg>
              {points.map((point, index) =>
                point ? (
                  <button
                    type="button"
                    key={pointLabels[index]}
                    className="absolute h-2.5 w-2.5 rounded-full border border-white bg-black cursor-grab active:cursor-grabbing"
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: "translate(-50%, -50%)" }}
                    title={pointLabels[index]}
                    onPointerDown={(event) => startDragPoint(index, event)}
                  />
                ) : null
              )}
            </div>
          ) : (
            <p className="text-xs meta">No front photo</p>
          )}
          <p className="text-xs meta mt-2">
            {nextPointIndex === -1
              ? "Points set: shoulder and hip lines complete."
              : `Next point: ${pointLabels[nextPointIndex]}`}
          </p>
        </div>
        <div className="border rounded-lg p-2">
          <p className="text-xs meta mb-1">Back photo</p>
          {backPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backPhotoUrl} alt={`${fullName} back posture`} className="w-full h-56 object-contain rounded bg-slate-50" />
          ) : (
            <p className="text-xs meta">No back photo</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs meta uppercase tracking-wide">Archetype Analysis</p>
        <div className="grid md:grid-cols-2 gap-2">
          <div className="border rounded-lg p-3 bg-slate-50">
            <p className="text-xs meta">Distance ratio (shoulders : hips)</p>
            <p className="text-2xl font-semibold mt-1">{aiSuggestion?.ratio ? aiSuggestion.ratio.toFixed(2) : "-"}</p>
            <p className="text-xs meta mt-1">
              {isMeasuredFromPhoto ? "Measured from front photo points." : "Using saved measurements until points are set."}
            </p>
          </div>
          <div className="border rounded-lg p-3 bg-slate-50">
            <p className="text-xs meta">Suggested archetype (editable)</p>
            <p className="text-2xl font-semibold mt-1">{selectedArchetype}</p>
            <label className="text-sm block mt-2">
              <select
                className="select mt-1 bg-white"
                name="archetype_final"
                value={selectedArchetype}
                onChange={(event) => {
                  setManualOverride(true);
                  setSelectedArchetype(event.target.value as ArchetypeKind);
                }}
              >
                <option value="V">V (shoulders &gt; hips)</option>
                <option value="A">A (hips &gt; shoulders)</option>
                <option value="H">H (close ratio)</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <label className="text-sm block">
        Posture Photo Feedback Loom Link
        <input
          className="input mt-1"
          type="url"
          name="posture_feedback_loom_url"
          defaultValue={postureFeedbackLoomUrl ?? ""}
          placeholder="https://www.loom.com/share/..."
        />
      </label>

      <input type="hidden" name="shoulder_width" value={hasMeasurements ? String(numericShoulder) : ""} readOnly />
      <input type="hidden" name="hip_width" value={hasMeasurements ? String(numericHip) : ""} readOnly />

      {!hasMeasurements && (
        <p className="text-xs text-red-700">
          Shoulder/hip measurements are missing, so ratio cannot be generated yet.
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={!hasMeasurements}>
        Generate + Approve Archetype
      </button>
    </form>
  );
}

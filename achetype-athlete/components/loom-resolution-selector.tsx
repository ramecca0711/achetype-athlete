/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/coach/new-loom-upload/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useMemo, useState } from "react";

type Athlete = {
  id: string;
  full_name: string;
};

type Request = {
  id: string;
  athlete_id: string;
  exercise_name: string;
  created_at: string;
};

type Props = {
  athletes: Athlete[];
  requests: Request[];
};

export default function LoomResolutionSelector({ athletes, requests }: Props) {
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>(athletes.slice(0, 1).map((a) => a.id));

  const requestsByAthlete = useMemo(() => {
    const map = new Map<string, Request[]>();
    for (const athlete of athletes) {
      map.set(athlete.id, []);
    }
    for (const request of requests) {
      const list = map.get(request.athlete_id) ?? [];
      list.push(request);
      map.set(request.athlete_id, list);
    }
    return map;
  }, [athletes, requests]);

  function toggleAthlete(athleteId: string, checked: boolean) {
    setSelectedAthleteIds((prev) => {
      if (checked) {
        if (prev.includes(athleteId)) return prev;
        return [...prev, athleteId];
      }
      return prev.filter((id) => id !== athleteId);
    });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold">1) Athlete(s)</legend>
        <div className="mt-2 space-y-2">
          {athletes.map((athlete) => (
            <label key={athlete.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="athlete_ids"
                value={athlete.id}
                checked={selectedAthleteIds.includes(athlete.id)}
                onChange={(event) => toggleAthlete(athlete.id, event.target.checked)}
              />
              {athlete.full_name}
            </label>
          ))}
          {!athletes.length && <p className="meta text-sm">No athletes with open requests.</p>}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">2) Open Exercise Review Requests (by selected athlete)</legend>
        <div className="mt-2 space-y-3">
          {selectedAthleteIds.map((athleteId) => {
            const athlete = athletes.find((row) => row.id === athleteId);
            const athleteRequests = requestsByAthlete.get(athleteId) ?? [];
            return (
              <details key={athleteId} className="border rounded p-3 bg-white" open>
                <summary className="text-sm font-semibold cursor-pointer">
                  {athlete?.full_name ?? "Athlete"} ({athleteRequests.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {athleteRequests.map((request) => (
                    <label key={request.id} className="block text-sm border rounded p-2">
                      <span className="flex items-start gap-2">
                        <input type="checkbox" name="review_request_ids" value={request.id} />
                        <span>
                          <span className="font-semibold">{request.exercise_name}</span>
                          <span className="block meta text-xs">{new Date(request.created_at).toLocaleString()}</span>
                          <span className="block meta text-xs">Request ID: {request.id}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                  {!athleteRequests.length && (
                    <p className="meta text-sm">No open requests for this athlete.</p>
                  )}
                </div>
              </details>
            );
          })}
          {!selectedAthleteIds.length && <p className="meta text-sm">Select at least one athlete to load requests.</p>}
        </div>
      </fieldset>
    </div>
  );
}

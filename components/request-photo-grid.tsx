import TimestampFramePreview from "@/components/timestamp-frame-preview";

type Position = "top" | "middle" | "bottom";

type Props = {
  requestId: string;
  submissionVideoUrl: string | null | undefined;
  timestamps: {
    top: number | null | undefined;
    middle: number | null | undefined;
    bottom: number | null | undefined;
  };
  athletePhotoByPosition: Map<Position, string>;
  samplePhotoByPosition: Partial<Record<Position, string | undefined>>;
  /** Label prefix for the left (athlete) photo column. Defaults to "Athlete form photo". */
  athletePhotoLabel?: string;
};

const positions: Position[] = ["top", "middle", "bottom"];

export default function RequestPhotoGrid({
  requestId,
  submissionVideoUrl,
  timestamps,
  athletePhotoByPosition,
  samplePhotoByPosition,
  athletePhotoLabel = "Athlete form photo"
}: Props) {
  return (
    <div className="space-y-2">
      {positions.map((pos) => {
        const athletePhotoUrl = athletePhotoByPosition.get(pos);
        const samplePhotoUrl = samplePhotoByPosition[pos];
        const timestamp = timestamps[pos];
        return (
          <div key={`${requestId}-${pos}`} className="grid md:grid-cols-2 gap-2">
            {athletePhotoUrl ? (
              <div className="border rounded-lg p-2 bg-white">
                <p className="text-xs meta">{athletePhotoLabel} ({pos})</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={athletePhotoUrl} alt={`${athletePhotoLabel} ${pos}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
                <p className="text-xs mt-1">Timestamp: {typeof timestamp === "number" ? `${timestamp.toFixed(1)}s` : "-"}</p>
              </div>
            ) : (
              <TimestampFramePreview
                videoUrl={submissionVideoUrl ?? ""}
                timestampSeconds={timestamp}
                label={`${athletePhotoLabel} (${pos})`}
              />
            )}
            <div className="border rounded-lg p-2 bg-white">
              <p className="text-xs meta">Master sample photo ({pos})</p>
              {samplePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={samplePhotoUrl} alt={`Master sample ${pos}`} className="w-full h-32 object-contain rounded mt-1 bg-slate-50" />
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
  );
}

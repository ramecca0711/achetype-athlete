import PosturePhotoInput from "@/components/posture-photo-input";

type Slot = "front" | "back" | "left" | "right";
const slots: Slot[] = ["front", "back", "left", "right"];

type Defaults = {
  full_name?: string | null;
  training_experience?: string | null;
  weekly_training_days?: number | null;
  gender?: string | null;
  birth_date?: string | null;
  height_inches?: number | null;
  weight_lbs?: number | null;
  goals?: string[] | null;
  injuries?: string | null;
  imbalances?: string | null;
  intro_survey_notes?: string | null;
  share_feedback_publicly?: boolean | null;
};

type Props = {
  defaults?: Defaults;
  /** When provided, renders real PosturePhotoInput with upload. Omit for a static preview. */
  athleteId?: string;
  /** Pre-filled photo URLs for profile edit mode. */
  photoInitialUrls?: Partial<Record<Slot, string>>;
  /** Current saved age — shown as a read-only display field when provided. */
  currentAge?: number | null;
};

export default function AthleteOnboardingFields({
  defaults = {},
  athleteId,
  photoInitialUrls,
  currentAge
}: Props) {
  const existingHeightInches = Number(defaults.height_inches ?? 0) || 0;
  const existingWeightLbs = Number(defaults.weight_lbs ?? 0) || 0;
  const defaultFeet = existingHeightInches > 0 ? Math.floor(existingHeightInches / 12) : "";
  const defaultInchesPart = existingHeightInches > 0 ? Number((existingHeightInches % 12).toFixed(1)) : "";
  const defaultHeightCm = existingHeightInches > 0 ? Number((existingHeightInches * 2.54).toFixed(1)) : "";
  const defaultWeightKg = existingWeightLbs > 0 ? Number((existingWeightLbs / 2.2046226218).toFixed(1)) : "";

  return (
    <>
      <label className="text-sm block">
        Full Name
        <input className="input mt-1" name="full_name" defaultValue={defaults.full_name ?? ""} required />
      </label>

      <label className="text-sm block">
        Training Experience
        <input className="input mt-1" name="training_experience" defaultValue={defaults.training_experience ?? ""} placeholder="Beginner / Intermediate / Advanced" />
      </label>

      <label className="text-sm block">
        Weekly Training Days
        <input className="input mt-1" type="number" min={1} max={7} name="weekly_training_days" defaultValue={defaults.weekly_training_days ?? ""} />
      </label>

      <label className="text-sm block">
        Gender
        <select className="select mt-1" name="gender" defaultValue={defaults.gender ?? ""}>
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non_binary">Non-binary</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </label>

      <label className="text-sm block">
        Birthday
        <input className="input mt-1" type="date" name="birth_date" defaultValue={defaults.birth_date ?? ""} />
      </label>

      {currentAge !== undefined && (
        <div className="text-sm block">
          <p>Calculated age</p>
          <p className="input mt-1 bg-slate-50">{currentAge ?? "-"}</p>
        </div>
      )}

      <label className="text-sm block">
        Units
        <select className="select mt-1" name="measurement_unit" defaultValue="imperial">
          <option value="imperial">Imperial (ft/in, lbs)</option>
          <option value="metric">Metric (cm, kg)</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm block">
          Height (ft)
          <input className="input mt-1" type="number" min={0} step="1" name="height_feet" defaultValue={defaultFeet} />
        </label>
        <label className="text-sm block">
          Height (in)
          <input className="input mt-1" type="number" min={0} step="0.1" name="height_inches_part" defaultValue={defaultInchesPart} />
        </label>
      </div>

      <label className="text-sm block">
        Height (cm, for metric)
        <input className="input mt-1" type="number" min={0} step="0.1" name="height_cm" defaultValue={defaultHeightCm} />
      </label>

      <label className="text-sm block">
        Weight (lbs, for imperial)
        <input className="input mt-1" type="number" min={0} step="0.1" name="weight_lbs_input" defaultValue={defaults.weight_lbs ?? ""} />
      </label>

      <label className="text-sm block">
        Weight (kg, for metric)
        <input className="input mt-1" type="number" min={0} step="0.1" name="weight_kg" defaultValue={defaultWeightKg} />
      </label>

      <label className="text-sm block">
        Goals (comma separated)
        <input className="input mt-1" name="goals" defaultValue={(defaults.goals ?? []).join(", ")} placeholder="Strength, posture, shoulder stability" />
      </label>

      <label className="text-sm block">
        Injuries
        <textarea className="textarea mt-1" name="injuries" defaultValue={defaults.injuries ?? ""} />
      </label>

      <label className="text-sm block">
        Imbalances / Notes
        <textarea className="textarea mt-1" name="imbalances" defaultValue={defaults.imbalances ?? ""} />
      </label>

      <label className="text-sm block">
        Additional Intro Notes
        <textarea className="textarea mt-1" name="intro_survey_notes" defaultValue={defaults.intro_survey_notes ?? ""} />
      </label>

      <label className="text-sm block">
        Public Review Board Visibility
        <select className="select mt-1" name="share_feedback_publicly" defaultValue={defaults.share_feedback_publicly ? "public" : "private"}>
          <option value="private">Private (do not auto-share my requests/notifications)</option>
          <option value="public">Public (share my requests/notifications on Public Review Board)</option>
        </select>
      </label>

      <div className="grid md:grid-cols-2 gap-3">
        {slots.map((slot) =>
          athleteId ? (
            <PosturePhotoInput
              key={slot}
              athleteId={athleteId}
              slot={slot}
              initialUrl={photoInitialUrls?.[slot] ?? ""}
            />
          ) : (
            <div key={slot} className="text-sm block border rounded-xl p-3 bg-white">
              <p className="font-medium">{slot.toUpperCase()} Photo</p>
              <input className="input mt-2" type="file" accept="image/*" />
            </div>
          )
        )}
      </div>
    </>
  );
}

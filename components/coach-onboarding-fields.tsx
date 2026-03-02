type Defaults = {
  full_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  intro_survey_notes?: string | null;
};

type Props = {
  defaults?: Defaults;
};

export default function CoachOnboardingFields({ defaults = {} }: Props) {
  return (
    <>
      <label className="text-sm block">
        Full Name
        <input className="input mt-1" name="full_name" defaultValue={defaults.full_name ?? ""} required />
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

      <label className="text-sm block">
        Setup Notes
        <textarea className="textarea mt-1" name="intro_survey_notes" defaultValue={defaults.intro_survey_notes ?? ""} />
      </label>
    </>
  );
}

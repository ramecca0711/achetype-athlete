-- AUTO-DOC: File overview
-- Purpose: Supabase SQL migration/seed script for schema or test data.
-- Related pages/files:
-- `app/onboarding/page.tsx`
-- `app/coach/clients/page.tsx`
-- `app/coach/exercises/page.tsx`
-- `app/athlete/request-review/page.tsx`
-- `lib/supabase/server.ts`
-- `lib/supabase/client.ts`
-- Note: Keep this script aligned with UI/server flows that read/write the same tables.

with seed(name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples) as (
  values
    ('High Oblique Sit', 'Openers/Positional', 'Reach long, keep height, low tension.', 'Open ribcage and pelvic space.', 'Low oblique + lateral trunk.', 'Less effort is better for positioning.', 'Do not crunch or over-fold.'),
    ('Diagonal Sit', 'Openers/Positional', 'Stay long through torso, protract without collapsing.', 'Decompress tailbone-to-femur relationship.', 'Hip capsule + obliques.', 'Reach and lengthen.', 'Do not force butt to floor.'),
    ('Frog Breathing', 'Breathing', 'Breathe into mid/low back and hips.', 'Improve expansion and positional breathing.', 'Posterior ribcage + hip bowl.', 'Slow 5-breath cycles.', 'Do not shrug or brace hard.'),
    ('Hook Lying D2', 'Breathing/Core', 'Controlled breath with rib position.', 'Restore trunk control and patterning.', 'Anterior core + obliques.', 'Slow controlled reps.', 'Do not overextend low back.'),
    ('Rolling Arm Bars', 'Shoulder Stability', 'Keep reach active and shoulder packed.', 'Shoulder stability + thoracic control.', 'Shoulder girdle + upper back.', 'Move segment by segment.', 'Do not lose shoulder position.'),
    ('Box Jump High Seated', 'Power', 'Explode through hips, stick landing.', 'Lower body power + coordination.', 'Glutes + quads.', 'Reset each rep.', 'Do not collapse on landing.'),
    ('Reverse Inchworm w/ Breathing', 'Mobility/Control', 'Inhale in down-dog, exhale to plank.', 'Shoulder/scap control and trunk pressure strategy.', 'Lats + trunk + serratus.', 'Bend knees slightly and press floor away.', 'Do not round excessively or shrug.'),
    ('Heel Elevated Front Squat to Box', 'Lower Push', 'Tall trunk, full-foot pressure.', 'Squat mechanics and leg strength.', 'Quads + glutes + trunk.', 'Controlled eccentric.', 'Do not cave knees.'),
    ('Band Plyo Split Squat', 'Lower Push', 'Explode up and stay balanced.', 'Reactive single-leg power.', 'Front leg glute + quad.', 'Soft landing mechanics.', 'Do not lose alignment.'),
    ('Alt Cable Pulldown in High Squat', 'Upper Pull', 'Stay tall in squat while pulling.', 'Integrate upper pull with lower-body position.', 'Lats + mid back + legs.', 'Keep ribs stacked.', 'Do not arch lower back.'),
    ('FFE Goblet Split Squat', 'Lower Push', 'Drive through front foot with control.', 'Single-leg strength and pelvic control.', 'Front leg glute + quad.', 'Pause at bottom.', 'Do not rotate pelvis.'),
    ('Burpee Jumping Pull Ups', 'Conditioning/Power', 'Use full-body rhythm and clean pull.', 'Conditioning + upper pull power.', 'Lats + trunk + legs.', 'Smooth cycle tempo.', 'Do not over-fatigue form.'),
    ('Split Lunges', 'Lower Push', 'Vertical torso and stable knee path.', 'Unilateral leg strength.', 'Glute + quad.', 'Control lowering.', 'Do not collapse knee inward.'),
    ('Get Up Arm Bar', 'Shoulder Stability', 'Lock arm, eyes on bell, press from floor.', 'Pump-handle mechanics and overhead stability.', 'Shoulder + trunk + hip.', 'Pause at top for control.', 'Do not lose reach or shoulder space.'),
    ('Toes Elevated Camporini Deadlift', 'Lower Pull', 'Load glute/hamstring with neutral spine.', 'Posterior-chain loading and hinge pattern.', 'Glute + hamstring.', 'Reach for toe while staying long.', 'Do not chase range by rounding.'),
    ('Retro Skip', 'Power/Coordination', 'Rhythm and rebound quality.', 'Reactive patterning and stiffness control.', 'Calves + hips.', 'Stay springy and tall.', 'Do not overstride.'),
    ('Burpee Broad Jump', 'Power', 'Use arm throw and full extension.', 'Horizontal power and athletic coordination.', 'Glutes + trunk + calves.', 'Stick each landing.', 'Do not collapse chest on takeoff.'),
    ('Split Stance KB Deadlift', 'Lower Pull', 'Vertical shin, drive floor away.', 'Unilateral hinge strength.', 'Glute + hamstring.', 'Keep pelvis square.', 'Do not rotate sacrum.'),
    ('High to Low Cable Press', 'Upper Push/Rotation', 'Hinge with press, then stand through hamstring.', 'Rotational trunk control and press mechanics.', 'Obliques + glutes + hamstring.', 'Light load and precise tempo.', 'Do not finish with lumbar extension.'),
    ('Supine Alt DB Tricep Skull Crusher', 'Upper Push', 'Keep elbow path stable while alternating.', 'Arm strength with rib control.', 'Triceps + upper chest.', 'Controlled alternation.', 'Do not flare elbows.'),
    ('Wall Lean Lateral Raise', 'Upper Accessory', 'Lean and raise in scapular plane.', 'Deltoid strength and shoulder mechanics.', 'Lateral delt.', 'Light tempo-controlled reps.', 'Do not shrug into neck.'),
    ('Right Sidelying Fencer', 'Openers/Positional', 'Stay heavy into floor, active top glute.', 'Hip/rib integration and rotational control.', 'Glute med + lateral trunk.', 'Exhale through straw cadence.', 'Do not let top knee cave inward.'),
    ('Alt Bent Over Med Ball Slam', 'Upper Power', 'Rotate sternum with stable head.', 'Thoracic rotation power and arm drive.', 'Upper back + trunk.', 'Reload to hip each rep.', 'Do not shrug or arm-only throw.')
)
insert into public.exercises (
  name,
  exercise_group,
  cues,
  purpose_impact,
  where_to_feel,
  dos_examples,
  donts_examples
)
select
  s.name,
  s.exercise_group,
  s.cues,
  s.purpose_impact,
  s.where_to_feel,
  s.dos_examples,
  s.donts_examples
from seed s
where not exists (
  select 1
  from public.exercises e
  where lower(e.name) = lower(s.name)
);

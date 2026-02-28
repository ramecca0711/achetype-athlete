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

begin;

alter table public.exercises add column if not exists category text;
alter table public.exercises add column if not exists exercise_subgroup text;
alter table public.exercises add column if not exists structural_goal text;

create table if not exists public.exercise_feedback_log (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  client_name text not null,
  feedback_date date not null,
  feedback_text text not null,
  created_at timestamptz not null default now(),
  unique (exercise_id, client_name, feedback_date)
);

alter table public.exercise_feedback_log enable row level security;

drop policy if exists exercise_feedback_select on public.exercise_feedback_log;
create policy exercise_feedback_select on public.exercise_feedback_log for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'coach', 'athlete')
  )
);

drop policy if exists exercise_feedback_insert_coach_admin on public.exercise_feedback_log;
create policy exercise_feedback_insert_coach_admin on public.exercise_feedback_log for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'coach')
  )
);

drop policy if exists exercise_feedback_update_coach_admin on public.exercise_feedback_log;
create policy exercise_feedback_update_coach_admin on public.exercise_feedback_log for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'coach')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'coach')
  )
);

with src as (
  select *
  from (
    values
      ('Frog Breathing','Category I: Breathing, Mobility, & Foundational Positioning','Warm-up','Positional Drill','Opening ISA (Narrow ISA)','Promoting posterior lower mediastinum expansion and increasing the infrasternal angle.','Quadruped position; knees and elbows wider than torso; forearms press into floor; neutral spine.','Mid-to-low back, glutes, lateral ribs and abdominal wall expansion.','Lift head slightly to keep cervical neutrality.','Do not drop chest through shoulders or lose protraction.','Natural spinal rounding is acceptable; prioritize posterior ribcage expansion.'),
      ('High Oblique Sit (w/ Band) - Left Side','Category I: Breathing, Mobility, & Foundational Positioning','Warm-up','Stretch','Unjamming Hips / Restoring IR (Archetype H)','Open lower right pelvis and create space for collarbone descent via ribcage expansion.','Diagonal sit; right hand behind pushing away; left hand band distraction; shoulder away from ear; shift right knee and hip open.','Space between femoral neck and sit bone; lower right pelvis expansion.','Keep hand fully grounded in one long line.','Do not arch lumbar spine to reach the position.','Actively reach hip out; move hand farther out to keep line.'),
      ('Diagonal Sit (Low & High)','Category I: Breathing, Mobility, & Foundational Positioning','Warm-up','Positional Drill','Decompressing Tailbone / Lowering Pelvis (Archetype V)','Decompress tailbone-to-sitbone area and pull femur out of socket.','90/90 foot-to-knee connection; palms around knee with gentle push; reach knee away; move opposite arm further away.','Abductor and back hip capsule.','Maintain long torso line.','Do not crunch upper back or fold chest.','Use a gentle decompression intent; close knee angle if needed to reduce tension.'),
      ('Hook Lying D2','Category I: Breathing, Mobility, & Foundational Positioning','Warm-up','Positional Drill','Opening ISA / Thoracic Expansion (Narrow ISA)','Expand mid-upper back and restore pump-handle ribcage mechanics.','Band on thumb; heels and big toes heavy; reach high diagonal aligned with ribcage.','Mid-upper back below scapula.','Keep reach at eye-level high diagonal.','Do not create upper trap or neck tension.','High-diagonal arm path is key for serratus without shrugging.'),
      ('Right Sidelying Fencer','Category I: Breathing, Mobility, & Foundational Positioning','Warm-up','Positional Drill','Pelvic Stability / Internal Rotation (Wide ISA)','Stabilize pelvis and build heavy ground contact.','Bottom foot on wall; top leg 90 degrees; heavy hip/rib floor contact; long exhale.','Top glute and heavy downside hip contact.','Reach top knee open without pulling.','Do not let top knee collapse inward.','Maintain heavy ground sensation through full exhale.'),
      ('Front Squat to Box (Heel Elev.)','Category II: Lower Body Push & Pull Mechanics','Lower Push','Strength','Leg Strength / Vertical Displacement (Archetype A)','Build quad strength with vertical stacked torso and less lumbar shear.','Front rack; elbows up/in and forward; straight-down elevator pattern.','Quads, trunk, glutes.','Keep torso and shins vertical.','Do not hinge hips back or arch low back.','Set box around 90 degrees; use goblet/front-load variation when needed.'),
      ('Toes Elevated Camporini Deadlift','Category II: Lower Body Push & Pull Mechanics','Lower Pull','Strength','Posterior Chain Loading (Archetype H)','Load glutes/hamstrings without anterior hip pinch.','Staggered stance; front heel in line with back toe; load ramp side; reach bell to big toe; arm hangs heavy.','Deep glute and hamstring stretch.','Keep spine neutral.','Do not round back or descend too low.','Bias load progression; prioritize loading quality over extra depth.'),
      ('Split Stance KB Deadlift','Category II: Lower Body Push & Pull Mechanics','Lower Pull','Strength','Pelvic Squaring / Sacral Decompression','Drive force through lead leg while stabilizing sacrum.','Two kettlebells around front foot; vertical shin; drive floor away; vertical torso.','Lead glute and hamstring.','Keep sacrum stable and square.','Do not rotate pelvis.','Heavier right-side bell can improve sacral positioning.'),
      ('FFE Goblet Split Squat','Category II: Lower Body Push & Pull Mechanics','Lower Push','Strength','Lowering Pelvis (Archetype A)','Create vertical pelvic displacement and quad isolation.','Elbows forward/protracted; tuck pelvis; straight-down elevator path; heel-heavy front foot.','Quads and heel pressure.','Stay upright with trunk stacked.','Do not hinge torso or stretch back hip.','Elbows-forward reach helps keep upper body unshrugged.'),
      ('SL Med Ball Hamstring Curl','Category II: Lower Body Push & Pull Mechanics','Lower Pull','Integration','Posterior Chain Integration','Use hamstrings to pull pelvis forward and underneath.','Exhale up, inhale down; stabilize non-working leg; full foot contact when possible.','Hamstring curl driving pelvis forward to neutral.','Use slow controlled return.','Do not arch low back or use momentum.','Emphasize true curl sensation for pelvic control.'),
      ('Get Up Arm Bar','Category III: Upper Body Push & Pull Mechanics','Upper Push','Stability','Pump Handle Mechanics / Shoulder Stability','Restore overhead stability and thoracic expansion.','Locked arm reaches forward; initiate roll with same-side foot; drive through forearm; eyes on bell.','Shoulder stability and floor-side glute contact.','Keep space between shoulder and ear.','Do not shrug or compress neck.','Palm stays flat; roll initiated by leg, not crunch.'),
      ('High to Low Cable Press','Category III: Upper Body Push & Pull Mechanics','Upper Push','Rotation','Thoracic Rotation / Pelvic Integration (Wide ISA)','Integrate hinge with rotational power.','Outside arm to cable; rotate toward opposite hip; rear heel heavy; drag front foot back energetically.','Hamstring-driven pelvis pull plus anterior shoulder/chest.','Hinge as arm presses.','Do not stand tall and arch at extension.','Hips move back as arm presses forward.'),
      ('Retro Landmine Press','Category III: Upper Body Push & Pull Mechanics','Upper Push','Strength','Thoracic Expansion (Narrow ISA)','Open pump-handle ribcage and challenge obliques.','Staggered stance; heavy back heel; press more forward than up; soften knees.','Hamstrings and obliques.','Stay long through torso.','Do not shrug or get neck-dominant.','Use load that keeps neck relaxed and trunk engaged.'),
      ('Alt. Cable Pulldown in High Squat','Category III: Upper Body Push & Pull Mechanics','Upper Pull','Integration','Scapular Float / Lat Length','Expand lateral ribs and allow scapular movement without trap dominance.','Hips at or above parallel; heel heavy; pelvis tucked; inhale top/exhale switch.','Lat stretch and lower rib expansion.','Maintain slight side bend with long neck.','Do not elevate shoulder into neck.','Breathe into lower ribs to create length and reduce neck tension.'),
      ('Short Seated Cable Pulldown','Category III: Upper Body Push & Pull Mechanics','Upper Pull','Rotation','Thoracic Rotation / Scapular Float (Narrow ISA)','Restore thoracic rotation and lat engagement.','Knees bent; 45-degree pull; elbow initiates; scapula floats high then drips on reach.','Lat and mid-back expansion.','Reach high on return.','Do not move shoulder blade before elbow drive.','Allow full high reach for better scapular float.'),
      ('Supine Alt DB Tricep Skull Crusher','Category III: Upper Body Push & Pull Mechanics','Upper Push','Isolation','Upper Body Expansion','Expand upper ribcage while isolating triceps.','Feet elevated; elbows fixed; inhale lowering, exhale extension.','Triceps and upper ribcage expansion.','Keep neck relaxed and elbows stable.','Do not let elbows drift.','Use inhale on lowering phase to drive expansion.'),
      ('Band Assisted/Plyo Split Squats','Category IV: Dynamic Power, Plyometrics, & Locomotion','Plyometric','Deceleration','Catch and Deceleration / Overriding Abduction','Develop spring while maintaining aligned tracks.','Ski tracks stance; hands at chin height; elbows forward/down; vertical shin; full-foot push.','Full foot and heel-heavy contact.','Stay long in torso with stable landing.','Do not collapse into unstable flamingo landings.','Use lighter band and enough rig offset for clean assistance.'),
      ('Burpee Broad Jump','Category IV: Dynamic Power, Plyometrics, & Locomotion','Power','Locomotor Power','Opening Front of Body','Maximize hip extension and thoracic power.','Use arm throw for leverage; arms high; stick landing with feet together.','Full-body extension and hip opening.','Use momentum into jump.','Do not land on toes or split feet.','Emphasize large front-body extension in flight.'),
      ('Box Jump High Seated','Category IV: Dynamic Power, Plyometrics, & Locomotion','Power','Jump','Hip Opening','Explosive hip opening from seated setup.','Hips above knees; arm swing sequence; feet planted before jump.','Hips and glutes.','Prioritize opening and clean mechanics.','Do not chase box height at cost of mechanics.','Reduce height if needed; prioritize hip opening quality.'),
      ('Retro Skipping','Category IV: Dynamic Power, Plyometrics, & Locomotion','Locomotion','Coordination','Thoracic Rotation / Power (Wide ISA)','Build contralateral coordination and upper-body power.','Reach elbows high; punch overhead line; stay tall and relaxed.','Calves/feet and elastic power.','Increase backward travel distance.','Do not shrug or crunch torso.','Travel farther while keeping upper body relaxed.'),
      ('Beast Crawl Backwards','Category IV: Dynamic Power, Plyometrics, & Locomotion','Locomotion','Integration','Core Stability / Contralateral Power','Connect obliques and limbs through ground force.','Opposite hand/opposite leg together; short steps; hand push drives opposite side.','Core and shoulders.','Stay low with stable hips.','Do not crunch abs or round back.','Short steps improve oblique recruitment.'),
      ('Alt Bent Over Med Ball Slam','Category IV: Dynamic Power, Plyometrics, & Locomotion','Upper Power','Rotation','Thoracic Rotation','Develop rotational power with light med ball.','Hip hinge; torso parallel; rotate up and slam down; pull ball back to hip.','Obliques, lats, midsection.','Keep head quiet while sternum rotates.','Do not shrug or dribble ball.','Treat slam like a press; keep load light and crisp.'),
      ('Overcoming Bear Plank','Category V: Core Stability & Integration Drills','Core Stability','Isometric','Scapular Protraction / Core Integration','Build shoulder and abdominal stability from ground force.','Push earth away; feet on wall; knees one inch up; push wall with feet.','Abs and armpit-to-chest region.','Maintain tension and controlled shaking.','Do not round back or drop chest.','Drive turf away from wall to lock protraction.'),
      ('Short Lever Side Plank Supinated','Category V: Core Stability & Integration Drills','Core Stability','Oblique','Oblique Engagement','Isolate obliques with minimal lumbar load.','Pressure bottom knee; top knee staggered forward; slight hip tuck.','Obliques.','Keep top knee in front.','Do not feel load in low back.','Staggered knee setup shifts tension off low back.'),
      ('AP Cable Chop','Category V: Core Stability & Integration Drills','Integration Drill','Rotation','Opening Front & Back / Coat Hanger Torso','Unwind body and reduce gravity load on hips.','Elbows down/forward; subtle hinge/rotation; move into glute; rope near chin level.','Armpit-to-chest area and glutes.','Tailbone goes back while belt buckle stays forward.','Do not booty-pop or overuse traps/neck.','Stand closer and keep hand line near chin to avoid shrugging.'),
      ('Reverse Inchworm w/ Breathing','Category V: Core Stability & Integration Drills','Integration Drill','Breathing-Integration','Pelvic Floor Launch / Thoracic Protraction','Teach pelvic floor-to-trunk sequencing with upper-back stability.','Inhale in down-dog; exhale to plank; drive floor away to stay unshrugged.','Abs, lats, and hamstrings pulling pelvis forward.','Bend knees to keep back flat.','Do not round upper back or shrug.','Bend knees enough to preserve flat-back mechanics.')
  ) as t(
    name,
    category,
    exercise_group,
    exercise_subgroup,
    structural_goal,
    purpose_impact,
    cues,
    where_to_feel,
    dos_examples,
    donts_examples,
    most_recent_feedback
  )
),
upserted as (
  insert into public.exercises (
    name,
    category,
    exercise_group,
    exercise_subgroup,
    structural_goal,
    purpose_impact,
    cues,
    where_to_feel,
    dos_examples,
    donts_examples
  )
  select
    s.name,
    s.category,
    s.exercise_group,
    s.exercise_subgroup,
    s.structural_goal,
    s.purpose_impact,
    s.cues,
    s.where_to_feel,
    s.dos_examples,
    s.donts_examples
  from src s
  on conflict ((lower(btrim(name))))
  do update set
    category = excluded.category,
    exercise_group = excluded.exercise_group,
    exercise_subgroup = excluded.exercise_subgroup,
    structural_goal = excluded.structural_goal,
    purpose_impact = excluded.purpose_impact,
    cues = excluded.cues,
    where_to_feel = excluded.where_to_feel,
    dos_examples = excluded.dos_examples,
    donts_examples = excluded.donts_examples
  returning id, name
)
insert into public.exercise_feedback_log (exercise_id, client_name, feedback_date, feedback_text)
select
  e.id,
  'Master Database' as client_name,
  current_date as feedback_date,
  s.most_recent_feedback as feedback_text
from src s
join public.exercises e on lower(btrim(e.name)) = lower(btrim(s.name))
where nullif(trim(s.most_recent_feedback), '') is not null
on conflict (exercise_id, client_name, feedback_date)
do update set feedback_text = excluded.feedback_text;

commit;

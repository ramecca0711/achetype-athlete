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

create table if not exists public.exercise_feedback_log (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  client_name text not null,
  feedback_date date not null,
  feedback_text text not null,
  created_at timestamptz not null default now(),
  unique (exercise_id, client_name, feedback_date)
);

with src(exercise_name, client_name, feedback_text) as (
  values
    ('Frog Breathing', 'Coach feedback (from Archetype Athlete Notes)', 'My rounding is okay and natural, could lift head a bit; Think about driving air into mid to low back and into the hip bones and love handle areas; Otherwise good

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('High Oblique Sit (w/ Band) - Left Side', 'Coach feedback (from Archetype Athlete Notes)', 'Intention open up space in lower right pelvis, more space between femur and sit bone; Space where collarbone needs to come down by creating space in the ribcage; Great adjustments like when hip reaches out with left knee

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Diagonal Sit (Low & High)', 'Coach feedback (from Archetype Athlete Notes)', 'Upper back rounding and crunching no bueno too much of a fold think pants up left side; plank instead more length, move left arm further away; Do want protraction but dont lose height; Can close angle of the knee; Relax shoulders less is more for positional drill, less you feel the better you are doing, do; not want a…

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Hook Lying D2', 'Coach feedback (from Archetype Athlete Notes)', 'Not so far away think heil; Rolling Arm Bars; Demo cues:; Purpose: restore internal rotation to hip on side we are rolling into, crushing hip; (wont feel but that is what is happening); Midsection engaged from start; KB or DB doesnt matter; Packed and stacked above shoulder, other arm off to side and out of the way; U…

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Right Sidelying Fencer', 'Ryan CSV Import', 'Pending review.

Coach score: Pending review | Athlete confidence: 3 (Decent) | Source: Ryan CSV Import'),
    ('Front Squat to Box (Heel Elev.)', 'Coach feedback (from Archetype Athlete Notes)', 'Get box higher up, should end at 90 degrees dont go as deep (you can if you; want though looks good form); Load with weight

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Toes Elevated Camporini Deadlift', 'Coach feedback (from Archetype Athlete Notes)', 'Dont have to go quite as low; Need butt more than hamstrings; Bit too low, go hand just pass knee; LOAD it dont just stretch it - heavier; Retro Skip [ 12-16 alt ] - SEE SAT (4)

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Split Stance KB Deadlift', 'Coach feedback (from Archetype Athlete Notes)', 'Right side: go heavier with right and ONLY right side bell so sacrum moves away from it; and can get back foot closer to front foot; Dont wanna see the left buttcheck dont want sacrum to rotate

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('FFE Goblet Split Squat', 'Coach feedback (from Archetype Athlete Notes)', 'Good just remember shoulders; Burpee Jumping Pull Ups; Demo cues: N/A; Feedback to me:; Get right under bar to avoid swinging; Split Lunges; Demo cues:; Hit center stand tall then drop into lunge; Always hit center before dropping in again; Movement is about catch and deceleration with the drop lower than the up - foc…

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('SL Med Ball Hamstring Curl', 'Ryan CSV Import', 'Pending review.

Coach score: Pending review | Athlete confidence: 3 (Decent) | Source: Ryan CSV Import'),
    ('Get Up Arm Bar', 'Coach feedback (from Archetype Athlete Notes)', 'Palm on the ground; Make sure space between shoulders; Can splay legs some more instead of parallel; Look up at the bell; Should feel like massaging butt cheek; Push out of the foot

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('High to Low Cable Press', 'Coach feedback (from Archetype Athlete Notes)', 'Hinge to standing through hamstring; Think about dragging front food backwards like hamstring curl machine to pull pelvis; forward and underneath you, energetically glue and push back (glute stretch on back; leg, pull front leg to bring hip forward); Good stretch on back leg; Hips back and forth; Make sure not standin…

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Retro Landmine Press', 'Ryan CSV Import', 'Pending review.

Coach score: Pending review | Athlete confidence: 3 (Decent) | Source: Ryan CSV Import'),
    ('Alt. Cable Pulldown in High Squat', 'Coach feedback (from Archetype Athlete Notes)', 'Keep everything out of the neck, shoulders down to create space between trap; and neck; Pull down but dont raise shoulder up as you do, more dist ear and shoulder; Breath into lower ribs as you do to create length

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Short Seated Cable Pulldown', 'Coach feedback (from Archetype Athlete Notes)', 'Remove the block and let knees be where they want to be; Let scap region float; Let hand pull up and reach and drip; Initiate pull with elbows, bring elbow down to the side (dont move shoulder blade, just; elbow down - will fix the winging off); Heels Elevated DB Goblet Squat [ 6-8 *inhale down, exhl up ]; Demo:; Inte…

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Supine Alt DB Tricep Skull Crusher', 'Coach feedback (from Archetype Athlete Notes)', 'great

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Band Assisted/Plyo Split Squats', 'Coach feedback (from Archetype Athlete Notes)', 'Need to get shoulders down, NO shrug; Elbows reach down then forward, back protracted and lock in; Need those elbows out in front and not glued to the body, hands at; chin entire time, step back behind the rig/band set up; Don’t crunch core, stay long in the torso; Keep hands at chin the whole time; Lighter band than …

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Burpee Broad Jump', 'Coach feedback (from Archetype Athlete Notes)', 'Use arm throw as leverage to move forward, arms out and up way up above head (think; high jumper arching back and opening front of body); Big extension and opening on front of body open torso; Get feet together and moving together

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Box Jump High Seated', 'Coach feedback (from Archetype Athlete Notes)', 'Feet planted on ground; Add a plate to get a little higher so not as close to 90; Don''t care about landing box height - drop it down so you open up more; Trying to get open throwing arms like a high jumper; Open hips more

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Retro Skipping', 'Coach feedback (from Archetype Athlete Notes)', 'Focus more on moving backwards and staying relaxed in upper body (may just need; more space); Be loosy goosy in trunk while stiff and snappy in lower; Looks good just looser and move backwards more than up

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Beast Crawl Backwards', 'Coach feedback (from Archetype Athlete Notes)', 'Good, short steps, not crunching abs, low - good; Heels Elev. Goblet Squat [ 4 breath cycles]; Demo:; Exhale slow down to 60-90 degrees, inhale down to bottom, pause at bottom exhale and; inhale, exhale explode up; Elbows in and reaching forward; Make sure not to hinge forward in squat

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Alt Bent Over Med Ball Slam', 'Coach feedback (from Archetype Athlete Notes)', 'Sternum rotation, keep head still; Push ball up into rotation then slam down with open palm, push into it like a press; Less basketball more firing with arm; Pull ball back towards hip; Low and rotation to get away from shrug

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('Overcoming Bear Plank', 'Ryan CSV Import', 'Pending review.

Coach score: Pending review | Athlete confidence: 3 (Decent) | Source: Ryan CSV Import'),
    ('Short Lever Side Plank Supinated', 'Coach feedback (from Archetype Athlete Notes)', 'Looks great; Put more pressure on knee that is on the ground, move upper knee forward to; accomplish this so goes out a bit in front of bottom knee; ^will help feel more obliques, make sure not feeling low back - looks fantastic; Good position with little hip tuck

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)'),
    ('AP Cable Chop', 'Ryan CSV Import', 'Pending review.

Coach score: Pending review | Athlete confidence: 3 (Decent) | Source: Ryan CSV Import'),
    ('Reverse Inchworm w/ Breathing', 'Coach feedback (from Archetype Athlete Notes)', 'Upper back rounding because not bending the knees enough, back should stay; flat; Protract at the buttom and pull head; Think guts up, and teach pelvic floor to launch guts back up; Inverting is sending more guts up (also plyometrics); Take breath at top for guts then step back

Coach score: Almost there | Athlete confidence: 3 (Decent) | Source: Coach feedback (from Archetype Athlete Notes)')
), matched as (
  select e.id as exercise_id, s.client_name, s.feedback_text
  from src s
  join public.exercises e on lower(btrim(e.name)) = lower(btrim(s.exercise_name))
)
insert into public.exercise_feedback_log (exercise_id, client_name, feedback_date, feedback_text)
select m.exercise_id, m.client_name, current_date, m.feedback_text
from matched m
on conflict (exercise_id, client_name, feedback_date)
do update set feedback_text = excluded.feedback_text;

-- Optional check: exercises in CSV not found in exercises table
select s.exercise_name
from (
  values
    ('Frog Breathing'),
    ('High Oblique Sit (w/ Band) - Left Side'),
    ('Diagonal Sit (Low & High)'),
    ('Hook Lying D2'),
    ('Right Sidelying Fencer'),
    ('Front Squat to Box (Heel Elev.)'),
    ('Toes Elevated Camporini Deadlift'),
    ('Split Stance KB Deadlift'),
    ('FFE Goblet Split Squat'),
    ('SL Med Ball Hamstring Curl'),
    ('Get Up Arm Bar'),
    ('High to Low Cable Press'),
    ('Retro Landmine Press'),
    ('Alt. Cable Pulldown in High Squat'),
    ('Short Seated Cable Pulldown'),
    ('Supine Alt DB Tricep Skull Crusher'),
    ('Band Assisted/Plyo Split Squats'),
    ('Burpee Broad Jump'),
    ('Box Jump High Seated'),
    ('Retro Skipping'),
    ('Beast Crawl Backwards'),
    ('Alt Bent Over Med Ball Slam'),
    ('Overcoming Bear Plank'),
    ('Short Lever Side Plank Supinated'),
    ('AP Cable Chop'),
    ('Reverse Inchworm w/ Breathing')
) as s(exercise_name)
left join public.exercises e on lower(btrim(e.name)) = lower(btrim(s.exercise_name))
where e.id is null;

commit;
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

create extension if not exists pgcrypto;

do $$
declare
  v_coach_id uuid;
  athlete_row record;
  idx int := 0;
  v_request_id uuid;
  v_feedback_video_id uuid;
  ex_resp uuid;
  ex_komodo uuid;
  ex_rolling uuid;
  ex_frontsquat uuid;
  ex_cable_press uuid;
  ex_goblet_iso uuid;
begin
  select id into v_coach_id
  from public.profiles
  where role = 'coach'
  order by created_at asc
  limit 1;

  if v_coach_id is null then
    raise exception 'No coach found. Create at least one coach account first.';
  end if;

  -- Exercises pulled from transcript themes (no duplicates on reruns).
  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Respiratory Stack Drill',
    'Breathing',
    'Stay long, neutral spine, press away from floor, breathe into front/back ribs + sternum.',
    'Improve rib-cage expansion, stack, and movement quality.',
    'Mid-rib cage, sternum, upper back expansion.',
    'Use subtle positional awareness and controlled nasal breathing.',
    'Do not tuck butt, round spine, or over-pressurize by crunching ribs.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('Respiratory Stack Drill'));

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Komodo Crawl',
    'Core/Locomotion',
    'Level pelvis, coordinate steps, keep right/left loading balanced.',
    'Cross-body coordination and core/shoulder stability.',
    'Core, shoulders, contralateral hip.',
    'Small clean steps with level belt line.',
    'Do not lean into one side or twist pelvis excessively.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('Komodo Crawl'));

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Rolling Armbar',
    'Shoulder Stability',
    'Choose one pattern: rolling armbar OR get-up progression; keep planted foot glued when getting up.',
    'Shoulder control with trunk integration.',
    'Posterior shoulder, obliques, trunk.',
    'Keep mechanics consistent and controlled.',
    'Do not blend patterns in a way that loses leverage and control.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('Rolling Armbar'));

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Front Squat to Box',
    'Lower Push',
    'Front rack mechanics, stacked torso, load enough to get stimulus.',
    'Leg strength and trunk positioning.',
    'Quads, trunk, glutes.',
    'Use goblet/friendly front-load variation if barbell mechanics are weak.',
    'Do not do empty-bar reps with unstable front rack pattern.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('Front Squat to Box'));

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'High-to-Low Cable Press',
    'Upper Push/Rotation',
    'Press away, avoid neck tension, keep shoulder head down, maintain rib-to-shoulder flush.',
    'Scap-thoracic control and rotational pressing mechanics.',
    'Mid-back, serratus, obliques.',
    'Let elbows drift slightly forward and keep load manageable.',
    'Do not over-arch or squeeze shoulder blades back hard.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('High-to-Low Cable Press'));

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Goblet Squat ISO',
    'Lower Push',
    'Stay stacked over front leg, avoid tight-rope stance, push away from ramp through foot pressure.',
    'Isometric trunk/leg control and stance awareness.',
    'Quads, glutes, foot pressure chain.',
    'Use moderate load and stable stance width.',
    'Do not arch to create depth or over-narrow stance.'
  where not exists (select 1 from public.exercises e where lower(e.name) = lower('Goblet Squat ISO'));

  select id into ex_resp from public.exercises where name = 'Respiratory Stack Drill' limit 1;
  select id into ex_komodo from public.exercises where name = 'Komodo Crawl' limit 1;
  select id into ex_rolling from public.exercises where name = 'Rolling Armbar' limit 1;
  select id into ex_frontsquat from public.exercises where name = 'Front Squat to Box' limit 1;
  select id into ex_cable_press from public.exercises where name = 'High-to-Low Cable Press' limit 1;
  select id into ex_goblet_iso from public.exercises where name = 'Goblet Squat ISO' limit 1;

  -- Take first 3 athletes and map them to transcript names for testing.
  for athlete_row in
    select p.id
    from public.profiles p
    where p.role = 'athlete'
    order by p.created_at asc
    limit 3
  loop
    idx := idx + 1;

    update public.profiles
    set
      full_name = case idx
        when 1 then 'Marcus Transcript Demo'
        when 2 then 'Ryan Transcript Demo'
        else 'Brian Transcript Demo'
      end,
      onboarding_completed = true,
      posture_photos_required = false,
      intro_survey_notes = coalesce(intro_survey_notes, 'Seeded from Loom transcript-derived coaching notes.'),
      updated_at = now()
    where id = athlete_row.id;

    insert into public.athlete_relationships (athlete_id, coach_id)
    values (athlete_row.id, v_coach_id)
    on conflict (athlete_id, coach_id) do nothing;

    -- Request 1: respiratory stack / spine rounding correction.
    insert into public.review_requests (
      athlete_id, coach_id, exercise_id, confidence_score, notes,
      submission_video_url, ts_top_seconds, ts_middle_seconds, ts_bottom_seconds,
      feedback_category, feedback_text, feedback_score, quick_notes, status
    )
    select
      athlete_row.id,
      v_coach_id,
      ex_resp,
      2,
      'Feeling rounding and unsure where to direct breath in this drill.',
      'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
      16, 23, 40,
      'stack_breathing',
      'Keep neutral stack, stop tucking/rounding, and drive breath into sternum + rib cage expansion.',
      4,
      'Less tension, more subtle pressure away from floor.',
      'resolved'
    where not exists (
      select 1 from public.review_requests rr
      where rr.athlete_id = athlete_row.id
        and rr.exercise_id = ex_resp
        and rr.feedback_category = 'stack_breathing'
    )
    returning id into v_request_id;

    if v_request_id is not null then
      insert into public.review_request_videos (review_request_id, video_url, duration_seconds, position)
      select v_request_id, 'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba', 901, 1
      where not exists (
        select 1 from public.review_request_videos rrv
        where rrv.review_request_id = v_request_id and rrv.position = 1
      );
    end if;

    -- Request 2 varies by athlete to mirror transcript callouts.
    if idx = 1 then
      -- Marcus: front squat + rolling armbar mechanics.
      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_frontsquat,
        2,
        'Not sure if this front squat to box setup is correct.',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'front_squat_setup',
        'Use a real front-load (goblet/kettlebells), improve front-rack mechanics, and avoid empty-bar patterning.',
        3,
        'Need setup reset before progressing load.',
        'pending'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_frontsquat
          and rr.feedback_category = 'front_squat_setup'
      );

      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_rolling,
        3,
        'Unsure if this is rolling armbar or get-up pattern.',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'pattern_clarity',
        'Pick one movement pattern; keep planted foot glued if executing get-up.',
        3,
        'Separate drills instead of blending.',
        'in_review'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_rolling
          and rr.feedback_category = 'pattern_clarity'
      );
    elsif idx = 2 then
      -- Ryan: cable press shoulder position.
      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_cable_press,
        3,
        'Getting neck tension in cable press and unsure about shoulder position.',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'shoulder_stack',
        'Great improvement. Keep shoulder heads down (not squeezed back), lighten load slightly, and stop descent earlier.',
        4,
        'Elbows slightly forward/down; avoid chest-up shoulder-roll cue.',
        'resolved'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_cable_press
          and rr.feedback_category = 'shoulder_stack'
      );

      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_goblet_iso,
        3,
        'Can you review my goblet squat iso stance/ramp pressure?',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'stance_pressure',
        'This is much better than last week. Keep stance out of tight-rope and press away from ramp through foot.',
        4,
        'Mostly keep doing this with slight stance cleanup.',
        'pending'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_goblet_iso
          and rr.feedback_category = 'stance_pressure'
      );
    else
      -- Brian: goblet iso success + komodo crawl notes.
      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_goblet_iso,
        4,
        'Checking if my goblet squat iso still needs major edits.',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'iso_progress',
        'Big progress. Keep elbows slightly farther away and keep pushing away from ramp without arching.',
        5,
        'Very close to ideal; minor cue refinements only.',
        'resolved'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_goblet_iso
          and rr.feedback_category = 'iso_progress'
      );

      insert into public.review_requests (
        athlete_id, coach_id, exercise_id, confidence_score, notes,
        submission_video_url, feedback_category, feedback_text, feedback_score, quick_notes, status
      )
      select
        athlete_row.id,
        v_coach_id,
        ex_komodo,
        3,
        'Need help with pelvic leveling in crawl pattern.',
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'pelvis_leveling',
        'Level pelvis a little more and avoid right-side drift while keeping step rhythm.',
        4,
        'Coordination looks good; keep left-right balance.',
        'in_review'
      where not exists (
        select 1 from public.review_requests rr
        where rr.athlete_id = athlete_row.id
          and rr.exercise_id = ex_komodo
          and rr.feedback_category = 'pelvis_leveling'
      );
    end if;

    -- Attach common Loom video rows to any requests missing video position 1.
    insert into public.review_request_videos (review_request_id, video_url, duration_seconds, position)
    select rr.id, 'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba', 901, 1
    from public.review_requests rr
    where rr.athlete_id = athlete_row.id
      and not exists (
        select 1
        from public.review_request_videos rrv
        where rrv.review_request_id = rr.id and rrv.position = 1
      );

    -- One coach feedback Loom for this athlete, linked to resolved requests.
    select id into v_feedback_video_id
    from public.coach_feedback_videos
    where coach_id = v_coach_id
      and loom_url = 'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba'
      and transcript_summary like '%' || athlete_row.id::text || '%'
    limit 1;

    if v_feedback_video_id is null then
      insert into public.coach_feedback_videos (coach_id, loom_url, transcript_summary)
      values (
        v_coach_id,
        'https://www.loom.com/share/0331956db3034900b82ea0082d77d4ba',
        'Transcript-derived feedback seed for athlete ' || athlete_row.id::text || ': stack and breathing first, avoid shoulder-back squeeze, load appropriately, and keep movement-specific intent clear.'
      )
      returning id into v_feedback_video_id;
    end if;

    insert into public.feedback_video_resolutions (feedback_video_id, review_request_id)
    select v_feedback_video_id, rr.id
    from public.review_requests rr
    where rr.athlete_id = athlete_row.id
      and rr.status = 'resolved'
    on conflict do nothing;
  end loop;

  if idx = 0 then
    raise exception 'No athlete profiles found. Create athlete accounts first.';
  end if;
end $$;

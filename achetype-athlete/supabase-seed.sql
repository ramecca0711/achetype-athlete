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
  v_program_id uuid;
  v_day_id uuid;
  v_request_id uuid;
  v_pending_request_id uuid;
  v_resolved_request_id uuid;
  v_feedback_video_id uuid;
  ex_squat uuid;
  ex_deadbug uuid;
  ex_splitsquat uuid;
  athlete_rec record;
  idx int;
begin
  -- Pick first coach
  select id into v_coach_id
  from public.profiles
  where role = 'coach'
  order by created_at asc
  limit 1;

  if v_coach_id is null then
    raise exception 'No coach found. Create at least one coach account first.';
  end if;

  -- Ensure baseline exercises (no duplicates on reruns).
  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Goblet Squat',
    'Lower Body',
    'Brace, knees track over toes, full foot pressure',
    'Build squat pattern + trunk strength',
    'Quads, glutes, trunk',
    'Slow eccentric, stay tall',
    'Do not collapse chest'
  where not exists (
    select 1 from public.exercises e where lower(e.name) = lower('Goblet Squat')
  );

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Dead Bug',
    'Core',
    'Ribs down, low back neutral',
    'Anterior core control',
    'Deep core',
    'Exhale through reach',
    'Do not arch low back'
  where not exists (
    select 1 from public.exercises e where lower(e.name) = lower('Dead Bug')
  );

  insert into public.exercises (name, exercise_group, cues, purpose_impact, where_to_feel, dos_examples, donts_examples)
  select
    'Rear Foot Elevated Split Squat',
    'Lower Body',
    'Vertical shin, level pelvis',
    'Single-leg strength + balance',
    'Glute and quad',
    'Control bottom position',
    'Do not twist pelvis'
  where not exists (
    select 1 from public.exercises e where lower(e.name) = lower('Rear Foot Elevated Split Squat')
  );

  select id into ex_squat from public.exercises where name = 'Goblet Squat' limit 1;
  select id into ex_deadbug from public.exercises where name = 'Dead Bug' limit 1;
  select id into ex_splitsquat from public.exercises where name = 'Rear Foot Elevated Split Squat' limit 1;

  -- For every athlete, create relationship + onboarding/profile defaults + program/day/exercises
  idx := 0;
  for athlete_rec in
    select p.id, p.full_name
    from public.profiles p
    where p.role = 'athlete'
    order by p.created_at asc
  loop
    idx := idx + 1;

    -- Name cleanup for obvious dummy readability
    update public.profiles
    set
      full_name = case
        when coalesce(nullif(trim(full_name), ''), 'Member') in ('Member', '') then 'Dummy Athlete ' || idx
        else full_name
      end,
      onboarding_completed = true,
      posture_photos_required = false,
      training_experience = coalesce(training_experience, 'Intermediate'),
      weekly_training_days = coalesce(weekly_training_days, 4),
      goals = case when cardinality(goals) = 0 then array['Strength', 'Posture', 'Stability'] else goals end,
      injuries = coalesce(injuries, 'None reported'),
      imbalances = coalesce(imbalances, 'Mild right/left asymmetry notes'),
      intro_survey_notes = coalesce(intro_survey_notes, 'Seeded dummy profile'),
      updated_at = now()
    where id = athlete_rec.id;

    insert into public.athlete_relationships (athlete_id, coach_id)
    values (athlete_rec.id, v_coach_id)
    on conflict (athlete_id, coach_id) do nothing;

    -- Ensure posture photos exist
    insert into public.posture_photos (athlete_id, photo_slot, photo_url)
    values
      (athlete_rec.id, 'front', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800'),
      (athlete_rec.id, 'back', 'https://images.unsplash.com/photo-1571019613540-996a1f4f8f8f?w=800'),
      (athlete_rec.id, 'left', 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=800'),
      (athlete_rec.id, 'right', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800')
    on conflict (athlete_id, photo_slot) do nothing;

    -- Ensure one starter program
    select id into v_program_id
    from public.programs
    where athlete_id = athlete_rec.id
      and coach_id = v_coach_id
      and name = 'Starter Program'
    limit 1;

    if v_program_id is null then
      insert into public.programs (athlete_id, coach_id, name, summary)
      values (athlete_rec.id, v_coach_id, 'Starter Program', 'Seeded starter plan for UI testing.')
      returning id into v_program_id;
    end if;

    insert into public.program_days (program_id, day_index, title, notes)
    values (v_program_id, 1, 'Day 1 Foundation', 'Seeded day to populate athlete program page.')
    on conflict (program_id, day_index)
    do update set title = excluded.title, notes = excluded.notes
    returning id into v_day_id;

    -- Ensure exercises on day
    insert into public.program_day_exercises (
      program_day_id, exercise_id, position, set_count, rep_target, weight_target_lbs, time_target_seconds,
      focus, personal_notes, dos, donts, prescription
    )
    values
      (v_day_id, ex_squat, 1, 4, '8', 45, null, 'Brace + depth consistency', 'Control lowering', 'Tripod foot + tall chest', 'Do not cave knees', 'reps_weight'),
      (v_day_id, ex_deadbug, 2, 3, null, null, 45, 'Rib control', 'Slow tempo', 'Exhale through extension', 'No lumbar arch', 'time'),
      (v_day_id, ex_splitsquat, 3, 3, '6/side', 25, null, 'Single-leg balance', 'Keep pelvis square', 'Vertical torso', 'No valgus collapse', 'mixed')
    on conflict (program_day_id, position) do nothing;

    -- Seed one pending request
    insert into public.review_requests (
      athlete_id, coach_id, exercise_id, confidence_score, notes, submission_video_url,
      ts_top_seconds, ts_middle_seconds, ts_bottom_seconds,
      feedback_category, feedback_text, feedback_score, quick_notes, status
    )
    select
      athlete_rec.id, v_coach_id, ex_squat, 2,
      'Unsure about knee tracking and depth.',
      'https://www.loom.com/share/dummy-squat-' || replace(athlete_rec.id::text, '-', ''),
      2, 7, 11,
      'knee_tracking',
      null,
      null,
      null,
      'pending'
    where not exists (
      select 1
      from public.review_requests rr
      where rr.athlete_id = athlete_rec.id
        and rr.exercise_id = ex_squat
        and rr.status = 'pending'
        and rr.notes = 'Unsure about knee tracking and depth.'
    );

    -- Seed one resolved request
    insert into public.review_requests (
      athlete_id, coach_id, exercise_id, confidence_score, notes, submission_video_url,
      ts_top_seconds, ts_middle_seconds, ts_bottom_seconds,
      feedback_category, feedback_text, feedback_score, quick_notes, status
    )
    select
      athlete_rec.id, v_coach_id, ex_deadbug, 3,
      'Need feedback on breathing timing.',
      'https://www.loom.com/share/dummy-deadbug-' || replace(athlete_rec.id::text, '-', ''),
      1, 5, 9,
      'breathing',
      'Better rib position this week. Keep exhale long on each reach.',
      4,
      'Solid progress; keep tempo controlled.',
      'resolved'
    where not exists (
      select 1
      from public.review_requests rr
      where rr.athlete_id = athlete_rec.id
        and rr.exercise_id = ex_deadbug
        and rr.status = 'resolved'
        and rr.notes = 'Need feedback on breathing timing.'
    );

    select rr.id into v_pending_request_id
    from public.review_requests rr
    where rr.athlete_id = athlete_rec.id
      and rr.exercise_id = ex_squat
      and rr.status = 'pending'
    order by rr.created_at desc
    limit 1;

    select rr.id into v_resolved_request_id
    from public.review_requests rr
    where rr.athlete_id = athlete_rec.id
      and rr.exercise_id = ex_deadbug
      and rr.status = 'resolved'
    order by rr.created_at desc
    limit 1;

    -- Ensure request videos for each request
    for v_request_id in
      select rr.id
      from public.review_requests rr
      where rr.athlete_id = athlete_rec.id
    loop
      insert into public.review_request_videos (review_request_id, video_url, duration_seconds, position)
      select v_request_id, 'https://www.loom.com/share/dummy-video-a-' || replace(v_request_id::text, '-', ''), 95, 1
      where not exists (
        select 1
        from public.review_request_videos rrv
        where rrv.review_request_id = v_request_id
          and rrv.position = 1
      );

      insert into public.review_request_videos (review_request_id, video_url, duration_seconds, position)
      select v_request_id, 'https://www.loom.com/share/dummy-video-b-' || replace(v_request_id::text, '-', ''), 110, 2
      where not exists (
        select 1
        from public.review_request_videos rrv
        where rrv.review_request_id = v_request_id
          and rrv.position = 2
      );
    end loop;

    -- Ensure at least one feedback video linked to resolved requests
    v_feedback_video_id := null;

    select cfv.id into v_feedback_video_id
    from public.coach_feedback_videos cfv
    where cfv.coach_id = v_coach_id
      and cfv.loom_url = 'https://www.loom.com/share/dummy-feedback-' || replace(athlete_rec.id::text, '-', '')
    limit 1;

    if v_feedback_video_id is null then
      insert into public.coach_feedback_videos (coach_id, loom_url, transcript_summary)
      values (
      v_coach_id,
      'https://www.loom.com/share/dummy-feedback-' || replace(athlete_rec.id::text, '-', ''),
      'Auto-seeded summary: improved trunk control and breathing cadence.'
      )
      returning id into v_feedback_video_id;
    end if;

    if v_feedback_video_id is not null and v_resolved_request_id is not null then
      insert into public.feedback_video_resolutions (feedback_video_id, review_request_id)
      values (v_feedback_video_id, v_resolved_request_id)
      on conflict do nothing;
    end if;
  end loop;

  if idx = 0 then
    raise exception 'No athletes found. Create at least one athlete account first.';
  end if;

  -- Seed sample/reference content for exercise DB
  insert into public.exercise_reference_videos (
    exercise_id, coach_id, loom_url, audience, feedback_category, feedback_score, cue_notes,
    ts_top_seconds, ts_middle_seconds, ts_bottom_seconds
  )
  select
    ex_squat,
    v_coach_id,
    'https://www.loom.com/share/dummy-ref-squat',
    'all',
    'knee_tracking',
    4,
    'Watch foot pressure and rib position.',
    2, 7, 11
  where not exists (
    select 1
    from public.exercise_reference_videos ev
    where ev.coach_id = v_coach_id
      and ev.loom_url = 'https://www.loom.com/share/dummy-ref-squat'
  );

  insert into public.exercise_reference_videos (
    exercise_id, coach_id, loom_url, audience, feedback_category, feedback_score, cue_notes,
    ts_top_seconds, ts_middle_seconds, ts_bottom_seconds
  )
  select
    ex_deadbug,
    v_coach_id,
    'https://www.loom.com/share/dummy-ref-deadbug',
    'all',
    'breathing',
    5,
    'Exhale longer and keep pelvis neutral.',
    1, 5, 9
  where not exists (
    select 1
    from public.exercise_reference_videos ev
    where ev.coach_id = v_coach_id
      and ev.loom_url = 'https://www.loom.com/share/dummy-ref-deadbug'
  );

end $$;

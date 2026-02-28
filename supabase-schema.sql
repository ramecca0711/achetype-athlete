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

-- Role enum includes all requested personas.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('athlete', 'coach', 'admin');
  else
    alter type app_role add value if not exists 'athlete';
    alter type app_role add value if not exists 'coach';
    alter type app_role add value if not exists 'admin';
  end if;

  if not exists (select 1 from pg_type where typname = 'prescription_type') then
    create type prescription_type as enum ('reps_weight', 'time', 'mixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('pending_review', 'not_quite', 'almost_there', 'there');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default 'Member',
  role app_role not null default 'athlete',
  approval_status text not null default 'approved' check (approval_status in ('approved', 'pending', 'rejected')),
  member_since date not null default current_date,
  injuries text,
  imbalances text,
  goals text[] not null default '{}',
  archetype_ai text,
  archetype_final text,
  archetype_confidence numeric(4,2),
  shoulder_width numeric(8,2),
  hip_width numeric(8,2),
  archetype_notes text,
  archetype_approved_by uuid references public.profiles(id),
  archetype_approved_at timestamptz,
  onboarding_completed boolean not null default false,
  posture_photos_required boolean not null default true,
  training_experience text,
  weekly_training_days int,
  intro_survey_notes text,
  gender text,
  birth_date date,
  age int,
  height_inches numeric(5,2),
  weight_lbs numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists posture_photos_required boolean not null default true;
alter table public.profiles add column if not exists training_experience text;
alter table public.profiles add column if not exists weekly_training_days int;
alter table public.profiles add column if not exists intro_survey_notes text;
alter table public.profiles add column if not exists approval_status text not null default 'approved';
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists height_inches numeric(5,2);
alter table public.profiles add column if not exists weight_lbs numeric(6,2);
alter table public.profiles add column if not exists posture_feedback_loom_url text;
alter table public.profiles add column if not exists posture_feedback_insights text;

create table if not exists public.athlete_relationships (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  unique (athlete_id, coach_id)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  day_index int not null,
  title text not null,
  notes text,
  unique (program_id, day_index)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exercise_group text not null,
  cues text,
  dos_examples text,
  donts_examples text,
  purpose_impact text,
  where_to_feel text,
  sample_video_url text,
  gunther_video_url text,
  archetype_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists exercises_name_normalized_unique
on public.exercises ((lower(btrim(name))));

alter table public.exercises add column if not exists cues text;
alter table public.exercises add column if not exists dos_examples text;
alter table public.exercises add column if not exists donts_examples text;

create table if not exists public.program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null,
  set_count int,
  rep_target text,
  weight_target_lbs numeric(8,2),
  time_target_seconds int,
  focus text,
  personal_notes text,
  dos text,
  donts text,
  prescription prescription_type not null default 'reps_weight',
  unique (program_day_id, position)
);

create table if not exists public.exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  program_day_exercise_id uuid not null references public.program_day_exercises(id) on delete cascade,
  reps_completed int,
  weight_lbs numeric(8,2),
  time_seconds int,
  confidence_score int not null check (confidence_score between 1 and 5),
  athlete_note text,
  ai_note_suggestion text,
  athlete_approved_note boolean not null default false,
  loom_url text,
  status submission_status not null default 'pending_review',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  high_level_feedback text not null,
  detailed_feedback text,
  created_at timestamptz not null default now()
);

-- Notification scaffolding for in-app/email/SMS dispatch.
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  phone_e164 text,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  channel text not null check (channel in ('email', 'sms', 'in_app')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

-- Loom integration scaffolding for later sync.
create table if not exists public.loom_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete cascade,
  loom_url text not null,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loom_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.exercise_submissions(id) on delete cascade,
  loom_comment_id text not null,
  author_name text,
  comment_body text,
  timestamp_seconds int,
  created_at timestamptz not null default now(),
  unique (submission_id, loom_comment_id)
);

create table if not exists public.exercise_reference_videos (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  loom_url text not null,
  audience text not null default 'all' check (audience in ('male', 'female', 'all')),
  feedback_category text,
  feedback_score int check (feedback_score between 1 and 5),
  cue_notes text,
  ts_top_seconds int,
  ts_middle_seconds int,
  ts_bottom_seconds int,
  created_at timestamptz not null default now()
);

alter table public.exercise_reference_videos add column if not exists ts_top_seconds int;
alter table public.exercise_reference_videos add column if not exists ts_middle_seconds int;
alter table public.exercise_reference_videos add column if not exists ts_bottom_seconds int;

create table if not exists public.exercise_reference_video_assets (
  id uuid primary key default gen_random_uuid(),
  reference_video_id uuid not null references public.exercise_reference_videos(id) on delete cascade,
  video_url text not null,
  duration_seconds int,
  position int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_rep_photos (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  photo_position text not null check (photo_position in ('top', 'middle', 'bottom')),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  confidence_score int not null check (confidence_score between 1 and 5),
  notes text,
  submission_video_url text,
  ts_top_seconds int,
  ts_middle_seconds int,
  ts_bottom_seconds int,
  feedback_category text,
  feedback_text text,
  feedback_score int check (feedback_score between 1 and 5),
  quick_notes text,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_request_videos (
  id uuid primary key default gen_random_uuid(),
  review_request_id uuid not null references public.review_requests(id) on delete cascade,
  video_url text not null,
  duration_seconds int,
  position int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_feedback_videos (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  loom_url text not null,
  transcript_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_video_resolutions (
  id uuid primary key default gen_random_uuid(),
  feedback_video_id uuid not null references public.coach_feedback_videos(id) on delete cascade,
  review_request_id uuid not null references public.review_requests(id) on delete cascade,
  unique (feedback_video_id, review_request_id)
);

create table if not exists public.posture_photos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  photo_slot text not null check (photo_slot in ('front', 'back', 'left', 'right')),
  photo_url text not null,
  created_at timestamptz not null default now(),
  unique (athlete_id, photo_slot)
);

insert into storage.buckets (id, name, public)
values ('posture-photos', 'posture-photos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('review-videos', 'review-videos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('exercise-sample-videos', 'exercise-sample-videos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('program-imports', 'program-imports', true)
on conflict (id) do update set public = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at before update on public.programs for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.exercise_submissions;
create trigger submissions_set_updated_at before update on public.exercise_submissions for each row execute function public.set_updated_at();

drop trigger if exists review_requests_set_updated_at on public.review_requests;
create trigger review_requests_set_updated_at before update on public.review_requests for each row execute function public.set_updated_at();

drop trigger if exists loom_sync_jobs_set_updated_at on public.loom_sync_jobs;
create trigger loom_sync_jobs_set_updated_at before update on public.loom_sync_jobs for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  final_role app_role;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'athlete'));
  final_role := case
    when requested_role = 'coach' then 'coach'::app_role
    when requested_role = 'admin' then 'admin'::app_role
    else 'athlete'::app_role
  end;

  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;

  update public.profiles
  set
    role = final_role,
    approval_status = case
      when lower(coalesce(new.raw_user_meta_data ->> 'approval_status', '')) in ('approved', 'pending', 'rejected')
        then lower(new.raw_user_meta_data ->> 'approval_status')
      when final_role in ('coach'::app_role, 'admin'::app_role)
        then 'pending'
      else 'approved'
    end,
    gender = nullif(new.raw_user_meta_data ->> 'gender', ''),
    birth_date = case
      when (new.raw_user_meta_data ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$'
        then (new.raw_user_meta_data ->> 'birth_date')::date
      else null
    end,
    age = case
      when (new.raw_user_meta_data ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$'
        then date_part('year', age((new.raw_user_meta_data ->> 'birth_date')::date))::int
      when nullif(new.raw_user_meta_data ->> 'age', '') is not null
        then greatest(0, nullif(new.raw_user_meta_data ->> 'age', '')::int)
      else null
    end,
    height_inches = case
      when nullif(new.raw_user_meta_data ->> 'height_inches', '') is not null
        then nullif(new.raw_user_meta_data ->> 'height_inches', '')::numeric
      else null
    end,
    weight_lbs = case
      when nullif(new.raw_user_meta_data ->> 'weight_lbs', '') is not null
        then nullif(new.raw_user_meta_data ->> 'weight_lbs', '')::numeric
      else null
    end
  where id = new.id;

  if final_role = 'athlete'::app_role
     and nullif(new.raw_user_meta_data ->> 'coach_id', '') is not null
     and exists (
       select 1 from public.profiles cp
       where cp.id = (new.raw_user_meta_data ->> 'coach_id')::uuid
         and cp.role = 'coach'
     )
  then
    insert into public.athlete_relationships (athlete_id, coach_id)
    values (new.id, (new.raw_user_meta_data ->> 'coach_id')::uuid)
    on conflict (athlete_id, coach_id) do nothing;
  end if;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin(check_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

create or replace view public.coach_review_queue as
select
  s.id as submission_id,
  p.coach_id,
  s.athlete_id,
  e.name as exercise_name,
  s.status,
  s.confidence_score,
  s.submitted_at,
  extract(epoch from (now() - s.submitted_at)) / 3600 as hours_waiting,
  (6 - s.confidence_score) * 100
    + least(extract(epoch from (now() - s.submitted_at)) / 3600, 72) as priority_score
from public.exercise_submissions s
join public.program_day_exercises pde on pde.id = s.program_day_exercise_id
join public.program_days pd on pd.id = pde.program_day_id
join public.programs p on p.id = pd.program_id
join public.exercises e on e.id = pde.exercise_id
where s.submitted_at >= now() - interval '3 days'
  and s.status = 'pending_review';

alter table public.profiles enable row level security;
alter table public.athlete_relationships enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.exercises enable row level security;
alter table public.program_day_exercises enable row level security;
alter table public.exercise_submissions enable row level security;
alter table public.coach_feedback enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.loom_sync_jobs enable row level security;
alter table public.loom_comments enable row level security;
alter table public.posture_photos enable row level security;
alter table public.exercise_reference_videos enable row level security;
alter table public.exercise_rep_photos enable row level security;
alter table public.review_requests enable row level security;
alter table public.coach_feedback_videos enable row level security;
alter table public.feedback_video_resolutions enable row level security;
alter table public.review_request_videos enable row level security;
alter table public.exercise_reference_video_assets enable row level security;

drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles for select
using (
  role = 'coach'
  or
  auth.uid() = id
  or public.is_admin(auth.uid())
  or exists (
    select 1 from public.athlete_relationships ar
    where (ar.athlete_id = profiles.id and ar.coach_id = auth.uid())
       or (ar.coach_id = profiles.id and ar.athlete_id = auth.uid())
  )
);

drop policy if exists profiles_update on public.profiles;

create policy profiles_update on public.profiles for update
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.athlete_relationships ar
    where ar.athlete_id = profiles.id
      and ar.coach_id = auth.uid()
  )
)
with check (
  auth.uid() = id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.athlete_relationships ar
    where ar.athlete_id = profiles.id
      and ar.coach_id = auth.uid()
  )
);

drop policy if exists relationships_read on public.athlete_relationships;
drop policy if exists relationships_insert_admin on public.athlete_relationships;

create policy relationships_read on public.athlete_relationships for select
using (athlete_id = auth.uid() or coach_id = auth.uid() or public.is_admin(auth.uid()));

create policy relationships_insert_admin on public.athlete_relationships for insert
with check (public.is_admin(auth.uid()));

drop policy if exists programs_read on public.programs;

create policy programs_read on public.programs for select
using (athlete_id = auth.uid() or coach_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists days_read on public.program_days;

create policy days_read on public.program_days for select
using (
  exists (
    select 1 from public.programs p
    where p.id = program_days.program_id
      and (p.athlete_id = auth.uid() or p.coach_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists exercises_read on public.exercises;

create policy exercises_read on public.exercises for select using (auth.uid() is not null);

drop policy if exists exercises_update_coach_admin on public.exercises;

create policy exercises_update_coach_admin on public.exercises for update
using (
  public.is_admin(auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
)
with check (
  public.is_admin(auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
);

drop policy if exists exercises_insert_coach_admin on public.exercises;

create policy exercises_insert_coach_admin on public.exercises for insert
with check (
  public.is_admin(auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
);

drop policy if exists day_exercises_read on public.program_day_exercises;

create policy day_exercises_read on public.program_day_exercises for select
using (
  exists (
    select 1
    from public.program_days pd
    join public.programs p on p.id = pd.program_id
    where pd.id = program_day_exercises.program_day_id
      and (p.athlete_id = auth.uid() or p.coach_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists submissions_select on public.exercise_submissions;

create policy submissions_select on public.exercise_submissions for select
using (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.program_day_exercises pde
    join public.program_days pd on pd.id = pde.program_day_id
    join public.programs p on p.id = pd.program_id
    where pde.id = exercise_submissions.program_day_exercise_id
      and p.coach_id = auth.uid()
  )
);

drop policy if exists submissions_insert on public.exercise_submissions;

create policy submissions_insert on public.exercise_submissions for insert
with check (athlete_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists submissions_update on public.exercise_submissions;

create policy submissions_update on public.exercise_submissions for update
using (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.program_day_exercises pde
    join public.program_days pd on pd.id = pde.program_day_id
    join public.programs p on p.id = pd.program_id
    where pde.id = exercise_submissions.program_day_exercise_id
      and p.coach_id = auth.uid()
  )
);

drop policy if exists feedback_select on public.coach_feedback;

create policy feedback_select on public.coach_feedback for select
using (
  coach_id = auth.uid() or public.is_admin(auth.uid())
  or exists (select 1 from public.exercise_submissions s where s.id = coach_feedback.submission_id and s.athlete_id = auth.uid())
);

drop policy if exists feedback_insert on public.coach_feedback;

create policy feedback_insert on public.coach_feedback for insert
with check (coach_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists notification_prefs_select on public.notification_preferences;

create policy notification_prefs_select on public.notification_preferences for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists notification_prefs_update on public.notification_preferences;

create policy notification_prefs_update on public.notification_preferences for update
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists notification_events_select on public.notification_events;

create policy notification_events_select on public.notification_events for select
using (recipient_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists notification_events_insert on public.notification_events;

create policy notification_events_insert on public.notification_events for insert
with check (public.is_admin(auth.uid()));

drop policy if exists loom_sync_jobs_select on public.loom_sync_jobs;

create policy loom_sync_jobs_select on public.loom_sync_jobs for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.exercise_submissions s
    where s.id = loom_sync_jobs.submission_id
      and s.athlete_id = auth.uid()
  )
  or exists (
    select 1
    from public.exercise_submissions s
    join public.program_day_exercises pde on pde.id = s.program_day_exercise_id
    join public.program_days pd on pd.id = pde.program_day_id
    join public.programs p on p.id = pd.program_id
    where s.id = loom_sync_jobs.submission_id
      and p.coach_id = auth.uid()
  )
);

drop policy if exists loom_comments_select on public.loom_comments;

create policy loom_comments_select on public.loom_comments for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.exercise_submissions s
    where s.id = loom_comments.submission_id
      and s.athlete_id = auth.uid()
  )
  or exists (
    select 1
    from public.exercise_submissions s
    join public.program_day_exercises pde on pde.id = s.program_day_exercise_id
    join public.program_days pd on pd.id = pde.program_day_id
    join public.programs p on p.id = pd.program_id
    where s.id = loom_comments.submission_id
      and p.coach_id = auth.uid()
  )
);

drop policy if exists posture_photos_select on public.posture_photos;

create policy posture_photos_select on public.posture_photos for select
using (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.athlete_relationships ar
    where ar.athlete_id = posture_photos.athlete_id
      and ar.coach_id = auth.uid()
  )
);

drop policy if exists posture_photos_insert on public.posture_photos;

create policy posture_photos_insert on public.posture_photos for insert
with check (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists posture_photos_update on public.posture_photos;

create policy posture_photos_update on public.posture_photos for update
using (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists posture_photos_delete on public.posture_photos;

create policy posture_photos_delete on public.posture_photos for delete
using (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists ref_videos_select on public.exercise_reference_videos;

create policy ref_videos_select on public.exercise_reference_videos for select
using (auth.uid() is not null);

drop policy if exists ref_videos_insert_coach_admin on public.exercise_reference_videos;

create policy ref_videos_insert_coach_admin on public.exercise_reference_videos for insert
with check (
  coach_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists ref_videos_update_coach_admin on public.exercise_reference_videos;

create policy ref_videos_update_coach_admin on public.exercise_reference_videos for update
using (
  coach_id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  coach_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists ref_video_assets_select on public.exercise_reference_video_assets;

create policy ref_video_assets_select on public.exercise_reference_video_assets for select
using (auth.uid() is not null);

drop policy if exists ref_video_assets_insert on public.exercise_reference_video_assets;

create policy ref_video_assets_insert on public.exercise_reference_video_assets for insert
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.exercise_reference_videos ev
    where ev.id = exercise_reference_video_assets.reference_video_id
      and ev.coach_id = auth.uid()
  )
);

drop policy if exists rep_photos_select on public.exercise_rep_photos;

create policy rep_photos_select on public.exercise_rep_photos for select
using (auth.uid() is not null);

drop policy if exists rep_photos_insert_coach_admin on public.exercise_rep_photos;

create policy rep_photos_insert_coach_admin on public.exercise_rep_photos for insert
with check (
  public.is_admin(auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
);

drop policy if exists requests_select on public.review_requests;

create policy requests_select on public.review_requests for select
using (
  athlete_id = auth.uid()
  or coach_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists requests_insert_athlete on public.review_requests;

create policy requests_insert_athlete on public.review_requests for insert
with check (
  athlete_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists requests_update_related on public.review_requests;

create policy requests_update_related on public.review_requests for update
using (
  athlete_id = auth.uid()
  or coach_id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  athlete_id = auth.uid()
  or coach_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists request_videos_select on public.review_request_videos;

create policy request_videos_select on public.review_request_videos for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.review_requests rr
    where rr.id = review_request_videos.review_request_id
      and (rr.athlete_id = auth.uid() or rr.coach_id = auth.uid())
  )
);

drop policy if exists request_videos_insert on public.review_request_videos;

create policy request_videos_insert on public.review_request_videos for insert
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.review_requests rr
    where rr.id = review_request_videos.review_request_id
      and rr.athlete_id = auth.uid()
  )
);

drop policy if exists feedback_videos_select on public.coach_feedback_videos;

create policy feedback_videos_select on public.coach_feedback_videos for select
using (
  coach_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.feedback_video_resolutions fvr
    join public.review_requests rr on rr.id = fvr.review_request_id
    where fvr.feedback_video_id = coach_feedback_videos.id
      and rr.athlete_id = auth.uid()
  )
);

drop policy if exists feedback_videos_insert on public.coach_feedback_videos;

create policy feedback_videos_insert on public.coach_feedback_videos for insert
with check (
  coach_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists resolutions_select on public.feedback_video_resolutions;

create policy resolutions_select on public.feedback_video_resolutions for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.review_requests rr
    where rr.id = feedback_video_resolutions.review_request_id
      and (rr.athlete_id = auth.uid() or rr.coach_id = auth.uid())
  )
);

drop policy if exists resolutions_insert on public.feedback_video_resolutions;

create policy resolutions_insert on public.feedback_video_resolutions for insert
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.review_requests rr
    where rr.id = feedback_video_resolutions.review_request_id
      and rr.coach_id = auth.uid()
  )
);

drop policy if exists "posture_photos_read" on storage.objects;

create policy "posture_photos_read"
on storage.objects for select
using (bucket_id = 'posture-photos');

drop policy if exists "posture_photos_upload_own" on storage.objects;

create policy "posture_photos_upload_own"
on storage.objects for insert
with check (
  bucket_id = 'posture-photos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "posture_photos_update_own" on storage.objects;

create policy "posture_photos_update_own"
on storage.objects for update
using (
  bucket_id = 'posture-photos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'posture-photos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "posture_photos_delete_own" on storage.objects;

create policy "posture_photos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'posture-photos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "review_videos_read" on storage.objects;

create policy "review_videos_read"
on storage.objects for select
using (bucket_id = 'review-videos');

drop policy if exists "review_videos_upload_own" on storage.objects;

create policy "review_videos_upload_own"
on storage.objects for insert
with check (
  bucket_id = 'review-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "review_videos_update_own" on storage.objects;

create policy "review_videos_update_own"
on storage.objects for update
using (
  bucket_id = 'review-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'review-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "review_videos_delete_own" on storage.objects;

create policy "review_videos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'review-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "exercise_sample_videos_read" on storage.objects;

create policy "exercise_sample_videos_read"
on storage.objects for select
using (bucket_id = 'exercise-sample-videos');

drop policy if exists "exercise_sample_videos_upload_own" on storage.objects;

create policy "exercise_sample_videos_upload_own"
on storage.objects for insert
with check (
  bucket_id = 'exercise-sample-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "exercise_sample_videos_update_own" on storage.objects;

create policy "exercise_sample_videos_update_own"
on storage.objects for update
using (
  bucket_id = 'exercise-sample-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'exercise-sample-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "exercise_sample_videos_delete_own" on storage.objects;

create policy "exercise_sample_videos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'exercise-sample-videos'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "program_imports_read" on storage.objects;

create policy "program_imports_read"
on storage.objects for select
using (bucket_id = 'program-imports');

drop policy if exists "program_imports_upload_own" on storage.objects;

create policy "program_imports_upload_own"
on storage.objects for insert
with check (
  bucket_id = 'program-imports'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "program_imports_update_own" on storage.objects;

create policy "program_imports_update_own"
on storage.objects for update
using (
  bucket_id = 'program-imports'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'program-imports'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "program_imports_delete_own" on storage.objects;

create policy "program_imports_delete_own"
on storage.objects for delete
using (
  bucket_id = 'program-imports'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

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
alter table public.profiles add column if not exists posture_feedback_loom_url text;
alter table public.profiles add column if not exists posture_feedback_insights text;

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

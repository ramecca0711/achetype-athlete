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

alter table public.profiles
  add column if not exists share_feedback_publicly boolean not null default false;

create table if not exists public.public_review_board_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid references public.profiles(id) on delete set null,
  message_type text not null check (message_type in ('chat', 'request_submitted', 'loom_posted')),
  message_text text not null,
  request_id uuid references public.review_requests(id) on delete set null,
  loom_url text,
  reviewed_exercises text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.public_review_board_messages enable row level security;

drop policy if exists public_board_select on public.public_review_board_messages;
create policy public_board_select on public.public_review_board_messages for select
using (auth.uid() is not null);

drop policy if exists public_board_insert on public.public_review_board_messages;
create policy public_board_insert on public.public_review_board_messages for insert
with check (
  sender_id = auth.uid()
  or public.is_admin(auth.uid())
);

commit;

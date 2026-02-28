-- AUTO-DOC: File overview
-- Purpose: Supabase SQL migration/seed script for schema or test data.
-- Related pages/files:
-- `app/login/page.tsx`
-- `app/page.tsx`
-- `app/pending-approval/page.tsx`
-- `app/admin/page.tsx`
-- `lib/supabase/server.ts`
-- Note: Keep this script aligned with UI/server flows that read/write the same tables.

begin;

alter table public.profiles
  add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('approved', 'pending', 'rejected'));

update public.profiles
set approval_status = case
  when role in ('coach', 'admin') then coalesce(nullif(approval_status, ''), 'pending')
  else coalesce(nullif(approval_status, ''), 'approved')
end
where approval_status is null or approval_status = '';

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

commit;


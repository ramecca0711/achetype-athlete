-- AUTO-DOC: File overview
-- Purpose: Supabase SQL migration/seed script for schema or test data.
-- Related pages/files:
-- `app/admin/page.tsx`
-- `components/admin-delete-member-button.tsx`
-- `supabase-admin-delete-policy.sql`
-- Note: Keep this script aligned with UI/server flows that read/write the same tables.

begin;

create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot delete your own admin account';
  end if;

  delete from auth.users where id = target_user_id;
  return true;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

commit;


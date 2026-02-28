-- AUTO-DOC: File overview
-- Purpose: Supabase SQL migration/seed script for schema or test data.
-- Related pages/files:
-- `app/admin/page.tsx`
-- `components/admin-delete-member-button.tsx`
-- `lib/supabase/server.ts`
-- Note: Keep this script aligned with UI/server flows that read/write the same tables.

begin;

drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_delete_admin on public.profiles for delete
using (public.is_admin(auth.uid()));

commit;


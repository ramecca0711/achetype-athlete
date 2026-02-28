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

with ranked as (
  select
    e.id,
    lower(btrim(e.name)) as normalized_name,
    -- Prefer the most complete row as canonical.
    (
      (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
      (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
      (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
    ) as completeness,
    row_number() over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as rn,
    first_value(e.id) over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as keep_id
  from public.exercises e
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.program_day_exercises pde
set exercise_id = d.keep_id
from dupes d
where pde.exercise_id = d.duplicate_id;

with ranked as (
  select
    e.id,
    lower(btrim(e.name)) as normalized_name,
    row_number() over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as rn,
    first_value(e.id) over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as keep_id
  from public.exercises e
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.review_requests rr
set exercise_id = d.keep_id
from dupes d
where rr.exercise_id = d.duplicate_id;

with ranked as (
  select
    e.id,
    lower(btrim(e.name)) as normalized_name,
    row_number() over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as rn,
    first_value(e.id) over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as keep_id
  from public.exercises e
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.exercise_reference_videos erv
set exercise_id = d.keep_id
from dupes d
where erv.exercise_id = d.duplicate_id;

with ranked as (
  select
    e.id,
    lower(btrim(e.name)) as normalized_name,
    row_number() over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as rn,
    first_value(e.id) over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as keep_id
  from public.exercises e
),
dupes as (
  select id as duplicate_id, keep_id
  from ranked
  where rn > 1
)
update public.exercise_rep_photos erp
set exercise_id = d.keep_id
from dupes d
where erp.exercise_id = d.duplicate_id;

with ranked as (
  select
    e.id,
    lower(btrim(e.name)) as normalized_name,
    row_number() over (
      partition by lower(btrim(e.name))
      order by
        (
          (case when nullif(btrim(e.exercise_group), '') is not null and e.exercise_group <> 'Needs Setup' then 1 else 0 end) +
          (case when nullif(btrim(e.cues), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.purpose_impact), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.where_to_feel), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.dos_examples), '') is not null then 1 else 0 end) +
          (case when nullif(btrim(e.donts_examples), '') is not null then 1 else 0 end)
        ) desc,
        e.created_at asc,
        e.id asc
    ) as rn
  from public.exercises e
)
delete from public.exercises e
using ranked r
where e.id = r.id
  and r.rn > 1;

create unique index if not exists exercises_name_normalized_unique
on public.exercises ((lower(btrim(name))));

commit;

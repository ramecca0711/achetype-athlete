# Gunther Athlete Portal

Next.js + Supabase app for athlete programming, Loom submissions, coach feedback queue, and archetype tracking.

## Implemented MVP

- Auth with email/password
- Role-based routing: `athlete`, `coach`, `admin`
- Athlete onboarding survey at first login with optional posture photo URLs (flagged as needed when skipped)
- Athlete onboarding survey at first login with optional 4 photo uploads (front/back/left/right) from device Photos
- Athlete profile page to edit survey + posture photos later
- Athlete program view by day number
- Exercise cards with sets/reps/focus/notes/do/don't
- Exercise submissions with:
  - reps/weight/time (prescription-guided input fields)
  - confidence score `1-5` with phrases
  - athlete note + editable AI note + approval checkbox
  - Loom link
- Coach queue sorted by low confidence + wait time (3-day window)
- Coach program builder with selectors to create program/day and add exercises with prescription + measurement settings
- Coach actions:
  - update status (`there`, `almost_there`, `not_quite`, `pending_review`)
  - add high-level + detailed feedback
  - auto-create notification events for email/SMS/in-app
- Archetype workflow:
  - AI inference using shoulder vs hip width (`V`, `A`, `H`)
  - coach approval step
- Admin surface for role management + queue metrics

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres + Auth + RLS)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

3. Run SQL in Supabase SQL editor:

- `supabase-schema.sql`

4. In Supabase Auth settings:

- Enable Email provider
- Enable Email + Password
- Site URL: `http://localhost:3000`

5. Create your first account, then promote it to admin:

```sql
update public.profiles set role = 'admin' where email = 'your-email@example.com';
```

6. Start app:

```bash
npm run dev
```

## Routes

- `/login`
- `/onboarding`
- `/athlete`
- `/athlete/profile`
- `/athlete/day/[dayId]`
- `/coach/queue`
- `/coach/clients`
- `/coach/exercises`
- `/coach/review-log`
- `/coach/new-loom-upload`
- `/admin`
- `/analytics`
- `/dev/role` (dev helper)

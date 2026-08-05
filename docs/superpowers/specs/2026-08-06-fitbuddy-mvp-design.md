# FitBuddy MVP — Design Spec

Date: 2026-08-06

## Overview

Two-user (fixed, no signup) training analytics app for a boxer in a 15-week fight camp and his girlfriend, both training on a joint schedule at a commercial gym. Sits alongside their existing static HTML training-program card as a logging/analytics layer — does not replace it. Linked by a nullable `program_day_id` foreign key so the two can be joined later without a rebuild.

Two fixed profiles, no per-user login: **Daryl** and **Marga**. Access controlled by a single shared passcode gate, not individual auth.

## Tech stack

- Next.js 15, App Router, TypeScript
- Supabase (Postgres only, no Supabase Auth) via `@supabase/supabase-js`, service-role key, server-side only
- Tailwind CSS
- Recharts (all charts)
- date-fns (date math)
- web-push (Web Push / VAPID)
- Resend (transactional email)
- Vercel (hosting) + Vercel Cron (scheduled reminders)
- npm as package manager

## Architecture: route-boundary auth

No `auth.uid()`, no per-row Supabase Auth identity. Access control lives entirely in `middleware.ts`, which checks a signed httpOnly `session` cookie before allowing any request through (all routes except `/login` and the push-subscribe webhook). The Supabase anon key is never exposed; the browser never queries Supabase directly. Every DB read/write goes through server code (Server Actions / Route Handlers) holding the service-role key.

### Auth flow

1. `middleware.ts` — checks signed `session` cookie. Missing/invalid → redirect `/login`.
2. `/login` — passcode input → Route Handler compares against bcrypt hash in `APP_PASSCODE_HASH`. Match → sets signed `session` cookie → redirect `/select-profile`.
3. `/select-profile` — two buttons pulling display names from `profiles` table ("Daryl" / "Marga"). Selecting sets `profile_id` cookie → redirect `/today`.
4. All subsequent routes read `profile_id` cookie to scope queries. No further identity check.

## Data model

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hrmax int,
  protein_target_g int,
  deficit_kcal int,
  target_weight_kg numeric,
  push_subscription jsonb,
  email text
);

create table program_days (               -- schema seam, leave empty
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  block_number int,
  day_label text,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  date date not null,
  session_label text,
  program_day_id uuid references program_days(id),
  notes text
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text                          -- 'lift' / 'conditioning'
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  exercise_id uuid references exercises(id) not null,
  set_number int,
  reps int,
  weight_kg numeric
);

create table conditioning_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  modality text,
  metric_type text,
  value numeric,
  duration_sec int
);

create table weigh_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  date date not null,
  weight_kg numeric not null
);

create table adherence_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  date date not null,
  protein_hit boolean,
  deficit_hit boolean
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  date date not null,
  body_part text,
  value_cm numeric
);
```

### Seed data

| field | Daryl | Marga |
|---|---|---|
| hrmax | 197 | null (fill in later) |
| protein_target_g | 165 | 130 |
| deficit_kcal | 550 | 350 |
| target_weight_kg | 78.5 | 62.5 |

## In-scope MVP features

- Passcode gate + profile picker
- Manual set logging (exercise, reps, weight, per session)
- Manual conditioning logging (modality, metric type, value, duration)
- Weigh-ins
- Daily adherence check-in (protein hit / deficit hit, bool)
- Body measurements (glutes/legs/waist, cm)
- `/trends` analytics: weight vs. target trajectory, e1RM trend per lift (Epley), weekly volume (Σ reps × weight), adherence streak, conditioning trend per modality
- Web Push opt-in + service worker
- Email reminders via Resend

## Explicitly out of scope

No MyFitnessPal integration, no native food/macro logging, no camera/CV rep counting, no Redis/caching layer, no Supabase Auth/email-password/OAuth, no program_days content modeling. Anything not on the in-scope list requires asking before building.

## Design tokens

```css
--bg: #0D0D0F;
--surface: #141417;
--raise: #1B1B1F;
--line: #28282E;
--txt: #EDEBE7;
--dim: #8E8A83;
--faint: #5E5A55;
--acc: #FF6B1A;
--acc-dim: #B45318;
--ok: #5A8F6B;
--alert: #C1503F;
```

Fonts: IBM Plex Sans (UI/body), IBM Plex Mono (numeric data), via Google Fonts. Mobile-first, single column, bottom tab bar (Today / Log / Trends), one primary bottom-anchored action per screen, dark theme only.

## File structure

```
/app
  /login/page.tsx
  /select-profile/page.tsx
  /(app)/today/page.tsx
  /(app)/log/page.tsx
  /(app)/trends/page.tsx
  /(app)/settings/page.tsx
  /api/auth/route.ts
  /api/push/subscribe/route.ts
  /api/cron/reminders/route.ts
  layout.tsx
  middleware.ts
/lib
  supabase-server.ts
  auth.ts
  epley.ts
  dates.ts
/components
/supabase
  schema.sql
```

## Environment variables

User-supplied, never fabricated:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSCODE_HASH=
COOKIE_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
RESEND_API_KEY=
GEMINI_API_KEY=          # Phase 2 only
```

## Build order (MVP = steps 1-7)

1. Scaffold Next.js + Tailwind + Supabase client, run `schema.sql`.
2. Middleware + `/login` + `/select-profile` — confirm passcode gate works before building anything behind it.
3. `/today` — session label (free text), muscle-highlight placeholder, log CTA.
4. `/log` — set entry, conditioning entry, weigh-in, adherence toggle, measurement entry forms.
5. `/trends` — all five analytics views.
6. Push subscription flow + service worker + daily weigh-in reminder via cron.
7. Email reminder via Resend, same trigger logic as push.

Stop and ask before adding anything beyond step 7.

8. (Later, not MVP) Phase 2 AI insights — Gemini `gemini-2.5-flash-lite`, on-demand `/trends` button or weekly cron, `ai_insights` cache table, opt-in toggle in `/settings` (off by default) built before wiring the Gemini call, server-side only.

## Repo setup

Git initialized after scaffold + schema exist (first commit covers both). npm as package manager.

## Open items deferred to implementation time (not fabricated here)

- Supabase project URL/service-role key
- Actual passcode (for bcrypt hash) and cookie signing secret
- VAPID keypair (generated via `npx web-push generate-vapid-keys`)
- Resend API key
- Marga's hrmax (left null in seed, can be set later via `/settings` or direct DB edit)

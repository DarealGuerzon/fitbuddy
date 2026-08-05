# FitBuddy MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FitBuddy MVP — passcode-gated, two-profile training log + trends app (Next.js 15 / Supabase / Tailwind) per `docs/superpowers/specs/2026-08-06-fitbuddy-mvp-design.md`.

**Architecture:** Server-only Supabase access (service-role key, never in browser). Route-boundary auth via signed cookies checked in `middleware.ts` — no per-row identity. Pure calculation logic (Epley e1RM, weekly volume, adherence streak, conditioning trend, date bucketing) lives in `/lib` as testable functions with Vitest unit tests (TDD). Next.js Server Components/Server Actions for pages and forms are verified by running the dev server and exercising the flow in a browser — Vitest is impractical for full Server Action + Supabase round trips in this app, and unit tests without a real DB would just assert mocks. Every page-level task ends with a manual browser verification step, not a fake test.

**Tech Stack:** Next.js 15 (App Router, TS), Supabase (`@supabase/supabase-js`, service-role, server-only), Tailwind CSS, Recharts, date-fns, web-push, Resend, Vitest (unit tests for `/lib` only), npm, Vercel + Vercel Cron.

---

## Design decisions locked in during planning (not in original spec, needed to make it buildable)

- **`/log` <-> session relationship:** `/today`'s CTA creates a `sessions` row (`session_label`, `date=today`, `profile_id`) via a Server Action, then redirects to `/log?session=<id>`. Set/conditioning forms on `/log` attach to that `session_id`. Weigh-in, adherence, and measurement forms are profile+date scoped, not session-scoped — they render on `/log` regardless of whether a `session_id` is present.
- **`lib/types.ts`** (new, not in original file list): manual TS interfaces mirroring the 8 tables. Needed because we're not generating Supabase types for a 2-user MVP.
- **`lib/analytics.ts`** (new, not in original file list): pure aggregation functions consumed by `/trends` (weekly volume, e1RM trend, adherence streak, conditioning trend). Split from `dates.ts` because these operate on row arrays, not just date math.
- **Cron auth:** Vercel Cron doesn't carry the session cookie, so `/api/cron/reminders` is excluded from the middleware's session check and instead validates a `CRON_SECRET` bearer token inside the route handler. This adds one env var (`CRON_SECRET`) beyond the original spec's list — required for the cron endpoint to not be a public unauthenticated route.
- **bcrypt library:** `bcryptjs` (pure JS), not `bcrypt` (native bindings break on Vercel's serverless runtime without extra build config).

---

## Task 1: Scaffold Next.js + Tailwind + fonts + git init

**Files:**
- Create: whole project scaffold via `create-next-app`
- Create: `app/globals.css` (design tokens)
- Create: `.gitignore` (extend generated one with `.env*.local`)
- Create: `.env.local.example`

- [ ] **Step 1: Scaffold the app**

Run from `c:\Users\daryl_spiralytics\personal-projects\fitbuddy`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```

Answer prompts: keep defaults, no Turbopack prompt changes needed either way.

- [ ] **Step 2: Install remaining dependencies**

```bash
npm install @supabase/supabase-js bcryptjs web-push resend date-fns recharts
npm install -D vitest @types/bcryptjs @types/web-push
```

- [ ] **Step 3: Add design tokens to `app/globals.css`**

Replace the Tailwind base block at the top of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
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
}

body {
  background: var(--bg);
  color: var(--txt);
}
```

- [ ] **Step 4: Wire up IBM Plex fonts in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FitBuddy",
  description: "Training log and trends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

Add to `tailwind.config.ts` (or the Tailwind v4 CSS-based config if `create-next-app` scaffolded that way — check which was generated and use the matching form) the font family mapping:

```ts
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-sans)"],
      mono: ["var(--font-mono)"],
    },
  },
},
```

- [ ] **Step 5: Create `.env.local.example`**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSCODE_HASH=
COOKIE_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
RESEND_API_KEY=
CRON_SECRET=
GEMINI_API_KEY=
```

- [ ] **Step 6: Verify scaffold runs**

```bash
npm run dev
```

Expected: server starts on `localhost:3000`, default Next.js page loads with no console errors. Stop the server (Ctrl+C) after confirming.

- [ ] **Step 7: git init**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, fonts, deps"
```

(This commit is deferred to end of Task 2 per the earlier decision to include schema.sql — see Task 2 Step 5. Skip this step here and do it there instead.)

---

## Task 2: Supabase schema + server client + types

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/supabase-server.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
create extension if not exists "pgcrypto";

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

create table program_days (
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
  category text
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

insert into profiles (name, hrmax, protein_target_g, deficit_kcal, target_weight_kg)
values
  ('Daryl', 197, 165, 550, 78.5),
  ('Marga', null, 130, 350, 62.5);
```

- [ ] **Step 2: Run schema against Supabase (manual, user-driven)**

Tell the user to paste `supabase/schema.sql` into their Supabase project's SQL Editor and run it, or run via `supabase db push` if they have the CLI linked. This cannot be done without their project credentials — do not attempt to fabricate or guess a project URL.

- [ ] **Step 3: Write `lib/types.ts`**

```ts
export interface Profile {
  id: string;
  name: string;
  hrmax: number | null;
  protein_target_g: number | null;
  deficit_kcal: number | null;
  target_weight_kg: number | null;
  push_subscription: Record<string, unknown> | null;
  email: string | null;
}

export interface Session {
  id: string;
  profile_id: string;
  date: string;
  session_label: string | null;
  program_day_id: string | null;
  notes: string | null;
}

export interface Exercise {
  id: string;
  name: string;
  category: "lift" | "conditioning" | null;
}

export interface SetRow {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number | null;
  reps: number | null;
  weight_kg: number | null;
}

export interface ConditioningLog {
  id: string;
  session_id: string;
  modality: string | null;
  metric_type: string | null;
  value: number | null;
  duration_sec: number | null;
}

export interface WeighIn {
  id: string;
  profile_id: string;
  date: string;
  weight_kg: number;
}

export interface AdherenceCheckin {
  id: string;
  profile_id: string;
  date: string;
  protein_hit: boolean | null;
  deficit_hit: boolean | null;
}

export interface Measurement {
  id: string;
  profile_id: string;
  date: string;
  body_part: string | null;
  value_cm: number | null;
}
```

- [ ] **Step 4: Write `lib/supabase-server.ts`**

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
```

Install the `server-only` guard package:

```bash
npm install server-only
```

This makes any accidental client-side import of this file fail the build instead of leaking the service-role key.

- [ ] **Step 5: Commit scaffold + schema together**

```bash
git add -A
git commit -m "feat: add Supabase schema, server client, and shared types"
```

---

## Task 3: `lib/auth.ts` — passcode check + signed session cookie (TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`

Session token format: `base64(JSON.stringify({iat: <ms>})).<hmac-sha256-hex>`. Verified by recomputing the HMAC over the payload and comparing with `crypto.timingSafeEqual`, then checking `iat` is within a 30-day max age. Split into pure, testable functions (`createSessionToken`, `verifySessionToken`) separate from the Next.js cookie I/O (which needs `next/headers` and can't run outside a request context, so it isn't unit tested here — it's covered by the Task 5 browser verification).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionToken, verifySessionToken, verifyPasscode } from "./auth";
import bcrypt from "bcryptjs";

describe("session token", () => {
  beforeEach(() => {
    process.env.COOKIE_SECRET = "test-secret";
  });

  it("round-trips a freshly created token as valid", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken();
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken();
    process.env.COOKIE_SECRET = "different-secret";
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(verifySessionToken("not-a-real-token")).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("rejects an expired token", () => {
    const oldIat = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const token = createSessionToken(oldIat);
    expect(verifySessionToken(token)).toBe(false);
  });
});

describe("verifyPasscode", () => {
  beforeEach(() => {
    process.env.APP_PASSCODE_HASH = bcrypt.hashSync("correct-horse", 10);
  });

  it("accepts the correct passcode", async () => {
    expect(await verifyPasscode("correct-horse")).toBe(true);
  });

  it("rejects the wrong passcode", async () => {
    expect(await verifyPasscode("wrong-passcode")).toBe(false);
  });
});
```

- [ ] **Step 2: Add Vitest config and test script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run lib/auth.test.ts
```

Expected: FAIL — `lib/auth.ts` doesn't exist yet.

- [ ] **Step 4: Implement `lib/auth.ts`**

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) throw new Error("COOKIE_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(iat: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ iat })).toString("base64");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const { iat } = JSON.parse(Buffer.from(payload, "base64").toString());
    if (typeof iat !== "number") return false;
    return Date.now() - iat <= MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function verifyPasscode(plain: string): Promise<boolean> {
  const hash = process.env.APP_PASSCODE_HASH;
  if (!hash) throw new Error("APP_PASSCODE_HASH is not set");
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run lib/auth.test.ts
```

Expected: PASS, all 7 tests.

LEARN THIS: `timingSafeEqual` instead of `===` for comparing signatures — a naive string compare short-circuits on the first mismatched byte, which leaks timing information an attacker can use to guess the signature byte-by-byte. Constant-time comparison closes that side channel.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts vitest.config.ts package.json
git commit -m "feat: add passcode verification and signed session tokens"
```

---

## Task 4: `middleware.ts`

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Implement middleware**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;

  if (!token || !verifySessionToken(token)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/push/subscribe|api/cron).*)",
  ],
};
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000/today` in a browser. Expected: redirected to `/login` (no session cookie set yet — `/today` doesn't exist as a route until Task 8, so a 404-after-redirect-to-`/login` is fine here; what matters is the browser lands on `/login`, not `/today`). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add passcode session middleware guarding all app routes"
```

---

## Task 5: `/login` page + `/api/auth` route

**Files:**
- Create: `app/api/auth/route.ts`
- Create: `app/login/page.tsx`
- Create: `components/LoginForm.tsx`

- [ ] **Step 1: Implement `app/api/auth/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { passcode } = await request.json();

  if (typeof passcode !== "string" || !(await verifyPasscode(passcode))) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 2: Implement `components/LoginForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Incorrect passcode");
      return;
    }

    router.push("/select-profile");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
        autoFocus
      />
      {error && <p className="text-[var(--alert)] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium disabled:opacity-50"
      >
        {submitting ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implement `app/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-xl font-medium">FitBuddy</h1>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Set a real `APP_PASSCODE_HASH` in `.env.local` for local testing:

```bash
node -e "console.log(require('bcryptjs').hashSync('testpass123', 10))"
```

Copy the output into `.env.local` as `APP_PASSCODE_HASH=...`, and set `COOKIE_SECRET=dev-secret-value`.

```bash
npm run dev
```

Visit `/login`, enter `testpass123`. Expected: redirected to `/select-profile` (404 is fine, page doesn't exist until Task 6 — confirm the URL bar shows `/select-profile` and a `session` cookie is set in DevTools -> Application -> Cookies). Enter a wrong passcode first and confirm the inline error shows. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth app/login components/LoginForm.tsx
git commit -m "feat: add /login page and passcode verification route"
```

---

## Task 6: `/select-profile` page

**Files:**
- Create: `app/select-profile/page.tsx`
- Create: `app/select-profile/actions.ts`

- [ ] **Step 1: Implement the Server Action**

```ts
// app/select-profile/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function selectProfile(profileId: string) {
  const cookieStore = await cookies();
  cookieStore.set("profile_id", profileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  redirect("/today");
}
```

- [ ] **Step 2: Implement the page**

```tsx
// app/select-profile/page.tsx
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";
import { selectProfile } from "./actions";

export default async function SelectProfilePage() {
  const supabase = getSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .returns<Pick<Profile, "id" | "name">[]>();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-medium mb-2">Who's training?</h1>
      {(profiles ?? []).map((profile) => (
        <form key={profile.id} action={selectProfile.bind(null, profile.id)}>
          <button
            type="submit"
            className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-8 py-4 text-lg w-64"
          >
            {profile.name}
          </button>
        </form>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Log in via `/login`, land on `/select-profile`, confirm "Daryl" and "Marga" buttons render (requires schema + seed already applied per Task 2 Step 2). Click one, confirm `profile_id` cookie is set and browser redirects to `/today` (404 fine until Task 8). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/select-profile
git commit -m "feat: add /select-profile page and profile cookie action"
```

---

## Task 7: App shell — `(app)` layout + bottom tab bar

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/TabBar.tsx`

- [ ] **Step 1: Implement `components/TabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/log", label: "Log" },
  { href: "/trends", label: "Trends" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--line)] flex">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center py-4 text-sm ${
              active ? "text-[var(--acc)]" : "text-[var(--dim)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Implement `app/(app)/layout.tsx`**

```tsx
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      {children}
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/layout.tsx" components/TabBar.tsx
git commit -m "feat: add app shell with bottom tab bar"
```

---

## Task 8: `/today` page

**Files:**
- Create: `app/(app)/today/page.tsx`
- Create: `app/(app)/today/actions.ts`

- [ ] **Step 1: Implement the Server Action**

```ts
// app/(app)/today/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function startSession(formData: FormData) {
  const sessionLabel = String(formData.get("session_label") ?? "").trim();
  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;

  if (!profileId) redirect("/select-profile");

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      profile_id: profileId,
      date: new Date().toISOString().slice(0, 10),
      session_label: sessionLabel || null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create session");

  redirect(`/log?session=${data.id}`);
}
```

- [ ] **Step 2: Implement the page**

```tsx
// app/(app)/today/page.tsx
import { startSession } from "./actions";

export default function TodayPage() {
  return (
    <main className="flex flex-col gap-8 px-4 pt-8">
      <h1 className="text-xl font-medium">Today</h1>

      <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-6 text-[var(--dim)] text-sm">
        Muscle highlight — coming soon
      </div>

      <form action={startSession} className="flex flex-col gap-3">
        <input
          name="session_label"
          placeholder="Session label (e.g. Mon lower)"
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
        />
        <button
          type="submit"
          className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium"
        >
          Start logging
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Go through `/login` -> `/select-profile` -> `/today`. Enter a session label, click "Start logging". Expected: a new row appears in the `sessions` table (check Supabase table editor), browser lands on `/log?session=<uuid>` (404 fine until Task 10). Confirm bottom tab bar renders with Today/Log/Trends and Today is highlighted. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/today"
git commit -m "feat: add /today page with session creation"
```

---

## Task 9: `lib/epley.ts` — e1RM calculation (TDD)

**Files:**
- Create: `lib/epley.ts`
- Test: `lib/epley.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/epley.test.ts
import { describe, it, expect } from "vitest";
import { estimate1RM } from "./epley";

describe("estimate1RM", () => {
  it("returns the weight itself for a 1-rep set", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("applies the Epley formula for multi-rep sets", () => {
    // Epley: weight * (1 + reps / 30)
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1);
  });

  it("returns 0 for a 0-weight set", () => {
    expect(estimate1RM(0, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/epley.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/epley.ts`**

```ts
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
```

LEARN THIS: Epley formula estimates a one-rep max from a higher-rep set — useful because testing an actual 1RM is fatiguing/risky, but it's an approximation that drifts more the further reps get from ~1-10. Good enough for a trend line, not for programming max-effort singles.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/epley.test.ts
```

Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/epley.ts lib/epley.test.ts
git commit -m "feat: add Epley e1RM calculation"
```

---

## Task 10: `/log` page shell + set entry form

**Files:**
- Create: `app/(app)/log/page.tsx`
- Create: `app/(app)/log/actions.ts`
- Create: `components/SetEntryForm.tsx`

- [ ] **Step 1: Implement the Server Action**

```ts
// app/(app)/log/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function logSet(formData: FormData) {
  const sessionId = String(formData.get("session_id"));
  const exerciseName = String(formData.get("exercise_name") ?? "").trim();
  const reps = Number(formData.get("reps"));
  const weightKg = Number(formData.get("weight_kg"));

  if (!sessionId || !exerciseName || !reps || Number.isNaN(weightKg)) {
    throw new Error("Missing required set fields");
  }

  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("name", exerciseName)
    .maybeSingle();

  let exerciseId = existing?.id as string | undefined;

  if (!exerciseId) {
    const { data: created, error: createError } = await supabase
      .from("exercises")
      .insert({ name: exerciseName, category: "lift" })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Failed to create exercise");
    exerciseId = created.id;
  }

  const { count } = await supabase
    .from("sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  const { error } = await supabase.from("sets").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    set_number: (count ?? 0) + 1,
    reps,
    weight_kg: weightKg,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}
```

- [ ] **Step 2: Implement `components/SetEntryForm.tsx`**

```tsx
"use client";

import { logSet } from "@/app/(app)/log/actions";

export function SetEntryForm({ sessionId }: { sessionId: string }) {
  return (
    <form action={logSet} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Log a set</h2>
      <input type="hidden" name="session_id" value={sessionId} />
      <input
        name="exercise_name"
        placeholder="Exercise (e.g. Back squat)"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      />
      <div className="flex gap-3">
        <input
          name="reps"
          type="number"
          placeholder="Reps"
          required
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
        <input
          name="weight_kg"
          type="number"
          step="0.5"
          placeholder="Weight (kg)"
          required
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
      </div>
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Add set
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implement `app/(app)/log/page.tsx`**

```tsx
import { SetEntryForm } from "@/components/SetEntryForm";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Log</h1>
      {session ? (
        <SetEntryForm sessionId={session} />
      ) : (
        <p className="text-[var(--dim)] text-sm">
          Start a session from Today to log sets.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

Go through the full flow to `/log?session=<uuid>` (from Task 8). Submit a set (e.g. "Back squat", 5 reps, 100kg). Expected: no error thrown, `sets` table has a new row with `set_number=1`, `exercises` table has a new "Back squat" row. Submit a second set for the same exercise/session — expected `set_number=2`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/log" components/SetEntryForm.tsx
git commit -m "feat: add /log page with set entry form"
```

---

## Task 11: Conditioning entry form

**Files:**
- Modify: `app/(app)/log/actions.ts`
- Create: `components/ConditioningEntryForm.tsx`
- Modify: `app/(app)/log/page.tsx`

- [ ] **Step 1: Add `logConditioning` action**

Append to `app/(app)/log/actions.ts`:

```ts
export async function logConditioning(formData: FormData) {
  const sessionId = String(formData.get("session_id"));
  const modality = String(formData.get("modality") ?? "").trim();
  const metricType = String(formData.get("metric_type") ?? "").trim();
  const value = Number(formData.get("value"));
  const durationSec = Number(formData.get("duration_sec"));

  if (!sessionId || !modality || !metricType || Number.isNaN(value)) {
    throw new Error("Missing required conditioning fields");
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("conditioning_logs").insert({
    session_id: sessionId,
    modality,
    metric_type: metricType,
    value,
    duration_sec: Number.isNaN(durationSec) ? null : durationSec,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}
```

- [ ] **Step 2: Implement `components/ConditioningEntryForm.tsx`**

```tsx
"use client";

import { logConditioning } from "@/app/(app)/log/actions";

const MODALITIES = ["assault_bike", "erg", "bag"];

export function ConditioningEntryForm({ sessionId }: { sessionId: string }) {
  return (
    <form action={logConditioning} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Log conditioning</h2>
      <input type="hidden" name="session_id" value={sessionId} />
      <select
        name="modality"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      >
        {MODALITIES.map((m) => (
          <option key={m} value={m}>
            {m.replace("_", " ")}
          </option>
        ))}
      </select>
      <input
        name="metric_type"
        placeholder="Metric (e.g. watts_avg, hr_avg)"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      />
      <div className="flex gap-3">
        <input
          name="value"
          type="number"
          step="0.1"
          placeholder="Value"
          required
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
        <input
          name="duration_sec"
          type="number"
          placeholder="Duration (sec)"
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
      </div>
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Add conditioning
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add to `/log` page**

Update `app/(app)/log/page.tsx`:

```tsx
import { SetEntryForm } from "@/components/SetEntryForm";
import { ConditioningEntryForm } from "@/components/ConditioningEntryForm";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Log</h1>
      {session ? (
        <>
          <SetEntryForm sessionId={session} />
          <ConditioningEntryForm sessionId={session} />
        </>
      ) : (
        <p className="text-[var(--dim)] text-sm">
          Start a session from Today to log sets.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

`npm run dev`, navigate to `/log?session=<uuid>`, submit a conditioning entry (assault_bike, watts_avg, 250, 600). Confirm row appears in `conditioning_logs`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/log"
git commit -m "feat: add conditioning entry form to /log"
```

---

## Task 12: Weigh-in form

**Files:**
- Modify: `app/(app)/log/actions.ts`
- Create: `components/WeighInForm.tsx`
- Modify: `app/(app)/log/page.tsx`

- [ ] **Step 1: Add `logWeighIn` action**

Append to `app/(app)/log/actions.ts`:

```ts
import { cookies } from "next/headers";

export async function logWeighIn(formData: FormData) {
  const weightKg = Number(formData.get("weight_kg"));
  if (Number.isNaN(weightKg)) throw new Error("Weight is required");

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("weigh_ins").insert({
    profile_id: profileId,
    date: new Date().toISOString().slice(0, 10),
    weight_kg: weightKg,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}
```

- [ ] **Step 2: Implement `components/WeighInForm.tsx`**

```tsx
"use client";

import { logWeighIn } from "@/app/(app)/log/actions";

export function WeighInForm() {
  return (
    <form action={logWeighIn} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Weigh-in</h2>
      <input
        name="weight_kg"
        type="number"
        step="0.1"
        placeholder="Weight (kg)"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono"
      />
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Log weight
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add to `/log` page (always visible, not session-gated)**

Update `app/(app)/log/page.tsx`:

```tsx
import { SetEntryForm } from "@/components/SetEntryForm";
import { ConditioningEntryForm } from "@/components/ConditioningEntryForm";
import { WeighInForm } from "@/components/WeighInForm";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Log</h1>
      {session ? (
        <>
          <SetEntryForm sessionId={session} />
          <ConditioningEntryForm sessionId={session} />
        </>
      ) : (
        <p className="text-[var(--dim)] text-sm">
          Start a session from Today to log sets.
        </p>
      )}
      <WeighInForm />
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

`npm run dev`, visit `/log` with and without `?session=`, confirm the weigh-in form always renders and submitting inserts into `weigh_ins` scoped to the cookie's `profile_id`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/log"
git commit -m "feat: add weigh-in form to /log"
```

---

## Task 13: Adherence check-in toggle

**Files:**
- Modify: `app/(app)/log/actions.ts`
- Create: `components/AdherenceToggle.tsx`
- Modify: `app/(app)/log/page.tsx`

- [ ] **Step 1: Add `logAdherence` action**

Append to `app/(app)/log/actions.ts`:

```ts
export async function logAdherence(formData: FormData) {
  const proteinHit = formData.get("protein_hit") === "on";
  const deficitHit = formData.get("deficit_hit") === "on";

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const today = new Date().toISOString().slice(0, 10);
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("adherence_checkins")
    .select("id")
    .eq("profile_id", profileId)
    .eq("date", today)
    .maybeSingle();

  const payload = { protein_hit: proteinHit, deficit_hit: deficitHit };

  const { error } = existing
    ? await supabase.from("adherence_checkins").update(payload).eq("id", existing.id)
    : await supabase.from("adherence_checkins").insert({ profile_id: profileId, date: today, ...payload });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}
```

- [ ] **Step 2: Implement `components/AdherenceToggle.tsx`**

```tsx
"use client";

import { logAdherence } from "@/app/(app)/log/actions";

export function AdherenceToggle() {
  return (
    <form action={logAdherence} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Today&apos;s adherence</h2>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="protein_hit" className="w-5 h-5" />
        Protein target hit
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="deficit_hit" className="w-5 h-5" />
        Deficit hit
      </label>
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Save
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add to `/log` page**

Add `import { AdherenceToggle } from "@/components/AdherenceToggle";` and render `<AdherenceToggle />` under `<WeighInForm />` in `app/(app)/log/page.tsx`.

- [ ] **Step 4: Manual verification**

`npm run dev`, visit `/log`, check both boxes, submit. Confirm one row in `adherence_checkins` for today's date. Submit again with different checkbox state — confirm the existing row is updated (still one row for today), not duplicated. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/log"
git commit -m "feat: add daily adherence toggle to /log"
```

---

## Task 14: Measurement entry form

**Files:**
- Modify: `app/(app)/log/actions.ts`
- Create: `components/MeasurementForm.tsx`
- Modify: `app/(app)/log/page.tsx`

- [ ] **Step 1: Add `logMeasurement` action**

Append to `app/(app)/log/actions.ts`:

```ts
export async function logMeasurement(formData: FormData) {
  const bodyPart = String(formData.get("body_part") ?? "").trim();
  const valueCm = Number(formData.get("value_cm"));

  if (!bodyPart || Number.isNaN(valueCm)) throw new Error("Missing measurement fields");

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("measurements").insert({
    profile_id: profileId,
    date: new Date().toISOString().slice(0, 10),
    body_part: bodyPart,
    value_cm: valueCm,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}
```

- [ ] **Step 2: Implement `components/MeasurementForm.tsx`**

```tsx
"use client";

import { logMeasurement } from "@/app/(app)/log/actions";

const BODY_PARTS = ["glutes", "legs", "waist"];

export function MeasurementForm() {
  return (
    <form action={logMeasurement} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Measurement</h2>
      <select
        name="body_part"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      >
        {BODY_PARTS.map((part) => (
          <option key={part} value={part}>
            {part}
          </option>
        ))}
      </select>
      <input
        name="value_cm"
        type="number"
        step="0.1"
        placeholder="cm"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono"
      />
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Save measurement
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add to `/log` page**

Add `import { MeasurementForm } from "@/components/MeasurementForm";` and render `<MeasurementForm />` at the bottom of `app/(app)/log/page.tsx`.

- [ ] **Step 4: Manual verification**

`npm run dev`, visit `/log`, submit a measurement (waist, 82.5). Confirm row in `measurements`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/log"
git commit -m "feat: add body measurement form to /log"
```

---

## Task 15: `lib/analytics.ts` — trend aggregation functions (TDD)

**Files:**
- Create: `lib/analytics.ts`
- Test: `lib/analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/analytics.test.ts
import { describe, it, expect } from "vitest";
import {
  computeWeeklyVolume,
  computeE1RMTrend,
  computeAdherenceStreak,
  computeConditioningTrend,
} from "./analytics";
import type { SetRow, AdherenceCheckin, ConditioningLog } from "./types";

const set = (overrides: Partial<SetRow> & { session_id: string }): SetRow => ({
  id: crypto.randomUUID(),
  exercise_id: "ex-1",
  set_number: 1,
  reps: 5,
  weight_kg: 100,
  ...overrides,
});

describe("computeWeeklyVolume", () => {
  it("sums reps * weight per set within a date-keyed bucket", () => {
    const sessionsById = { s1: "2026-08-03", s2: "2026-08-10" }; // two different Mondays
    const sets = [
      set({ session_id: "s1", reps: 5, weight_kg: 100 }),
      set({ session_id: "s1", reps: 5, weight_kg: 100 }),
      set({ session_id: "s2", reps: 10, weight_kg: 50 }),
    ];
    const result = computeWeeklyVolume(sets, sessionsById);
    expect(result).toEqual([
      { weekStart: "2026-08-03", volume: 1000 },
      { weekStart: "2026-08-10", volume: 500 },
    ]);
  });

  it("returns an empty array for no sets", () => {
    expect(computeWeeklyVolume([], {})).toEqual([]);
  });
});

describe("computeE1RMTrend", () => {
  it("returns one point per session date with the max e1RM that day", () => {
    const sessionsById = { s1: "2026-08-03" };
    const sets = [
      set({ session_id: "s1", exercise_id: "squat", reps: 5, weight_kg: 100 }),
      set({ session_id: "s1", exercise_id: "squat", reps: 1, weight_kg: 110 }),
      set({ session_id: "s1", exercise_id: "bench", reps: 5, weight_kg: 60 }),
    ];
    const result = computeE1RMTrend(sets, sessionsById, "squat");
    expect(result).toEqual([{ date: "2026-08-03", e1rm: 116.66666666666667 }]);
  });
});

describe("computeAdherenceStreak", () => {
  const checkin = (date: string, protein: boolean, deficit: boolean): AdherenceCheckin => ({
    id: crypto.randomUUID(),
    profile_id: "p1",
    date,
    protein_hit: protein,
    deficit_hit: deficit,
  });

  it("counts consecutive days up to today where both targets were hit", () => {
    const checkins = [
      checkin("2026-08-04", true, true),
      checkin("2026-08-05", true, true),
      checkin("2026-08-06", true, true),
    ];
    expect(computeAdherenceStreak(checkins, "2026-08-06")).toBe(3);
  });

  it("stops the streak at the first miss going backwards", () => {
    const checkins = [
      checkin("2026-08-04", true, false),
      checkin("2026-08-05", true, true),
      checkin("2026-08-06", true, true),
    ];
    expect(computeAdherenceStreak(checkins, "2026-08-06")).toBe(2);
  });

  it("returns 0 when today has no check-in", () => {
    expect(computeAdherenceStreak([], "2026-08-06")).toBe(0);
  });
});

describe("computeConditioningTrend", () => {
  it("filters by modality and metric, sorted by date", () => {
    const sessionsById = { s1: "2026-08-05", s2: "2026-08-03" };
    const logs: ConditioningLog[] = [
      { id: "1", session_id: "s1", modality: "assault_bike", metric_type: "watts_avg", value: 220, duration_sec: 600 },
      { id: "2", session_id: "s2", modality: "assault_bike", metric_type: "watts_avg", value: 200, duration_sec: 600 },
      { id: "3", session_id: "s2", modality: "erg", metric_type: "watts_avg", value: 180, duration_sec: 600 },
    ];
    const result = computeConditioningTrend(logs, sessionsById, "assault_bike", "watts_avg");
    expect(result).toEqual([
      { date: "2026-08-03", value: 200 },
      { date: "2026-08-05", value: 220 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/analytics.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/analytics.ts`**

```ts
import { estimate1RM } from "./epley";
import type { SetRow, AdherenceCheckin, ConditioningLog } from "./types";

function getWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function computeWeeklyVolume(
  sets: SetRow[],
  sessionDateById: Record<string, string>
): { weekStart: string; volume: number }[] {
  const totals = new Map<string, number>();

  for (const set of sets) {
    const sessionDate = sessionDateById[set.session_id];
    if (!sessionDate || set.reps == null || set.weight_kg == null) continue;
    const weekStart = getWeekStart(sessionDate);
    totals.set(weekStart, (totals.get(weekStart) ?? 0) + set.reps * set.weight_kg);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, volume]) => ({ weekStart, volume }));
}

export function computeE1RMTrend(
  sets: SetRow[],
  sessionDateById: Record<string, string>,
  exerciseId: string
): { date: string; e1rm: number }[] {
  const maxByDate = new Map<string, number>();

  for (const set of sets) {
    if (set.exercise_id !== exerciseId) continue;
    const sessionDate = sessionDateById[set.session_id];
    if (!sessionDate || set.reps == null || set.weight_kg == null) continue;
    const e1rm = estimate1RM(set.weight_kg, set.reps);
    maxByDate.set(sessionDate, Math.max(maxByDate.get(sessionDate) ?? 0, e1rm));
  }

  return [...maxByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e1rm]) => ({ date, e1rm }));
}

export function computeAdherenceStreak(
  checkins: AdherenceCheckin[],
  todayStr: string
): number {
  const byDate = new Map(checkins.map((c) => [c.date, c]));
  let streak = 0;
  const cursor = new Date(`${todayStr}T00:00:00Z`);

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const checkin = byDate.get(dateStr);
    if (!checkin || !checkin.protein_hit || !checkin.deficit_hit) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export function computeConditioningTrend(
  logs: ConditioningLog[],
  sessionDateById: Record<string, string>,
  modality: string,
  metricType: string
): { date: string; value: number }[] {
  return logs
    .filter((log) => log.modality === modality && log.metric_type === metricType)
    .map((log) => ({
      date: sessionDateById[log.session_id],
      value: log.value ?? 0,
    }))
    .filter((point): point is { date: string; value: number } => Boolean(point.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/analytics.test.ts
```

Expected: PASS, all 8 tests.

LEARN THIS: these are pure functions that take plain data in and return plain data out — no Supabase, no `fetch`. That's why they're unit-testable in milliseconds without a database. The `/trends` page (Task 16) is the only place that fetches rows and hands them to these functions; keeping the boundary there is what makes the split worth it.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts lib/analytics.test.ts
git commit -m "feat: add pure trend aggregation functions for weekly volume, e1RM, adherence streak, conditioning"
```

---

## Task 16: `/trends` page — all five analytics views

**Files:**
- Create: `app/(app)/trends/page.tsx`
- Create: `components/charts/WeightTrendChart.tsx`
- Create: `components/charts/E1RMTrendChart.tsx`
- Create: `components/charts/WeeklyVolumeChart.tsx`
- Create: `components/charts/ConditioningTrendChart.tsx`
- Create: `components/AdherenceStreakCard.tsx`

- [ ] **Step 1: Implement `components/charts/WeightTrendChart.tsx`**

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function WeightTrendChart({
  data,
  targetWeightKg,
}: {
  data: { date: string; weight_kg: number }[];
  targetWeightKg: number | null;
}) {
  const chartData = data.map((d) => ({ ...d, target: targetWeightKg }));

  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">Weight vs. target</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="weight_kg" stroke="var(--acc)" dot={false} strokeWidth={2} />
          {targetWeightKg != null && (
            <Line type="monotone" dataKey="target" stroke="var(--faint)" dot={false} strokeDasharray="4 4" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/charts/E1RMTrendChart.tsx`**

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function E1RMTrendChart({
  data,
  exerciseName,
}: {
  data: { date: string; e1rm: number }[];
  exerciseName: string;
}) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">{exerciseName} — est. 1RM</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="e1rm" stroke="var(--acc)" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/charts/WeeklyVolumeChart.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function WeeklyVolumeChart({ data }: { data: { weekStart: string; volume: number }[] }) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">Weekly volume (reps x kg)</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="weekStart" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Bar dataKey="volume" fill="var(--acc)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/charts/ConditioningTrendChart.tsx`**

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ConditioningTrendChart({
  data,
  modality,
  metricType,
}: {
  data: { date: string; value: number }[];
  modality: string;
  metricType: string;
}) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">
        {modality.replace("_", " ")} — {metricType}
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="value" stroke="var(--acc)" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Implement `components/AdherenceStreakCard.tsx`**

```tsx
export function AdherenceStreakCard({ streak }: { streak: number }) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4 flex items-center justify-between">
      <h2 className="font-medium">Adherence streak</h2>
      <span className="font-mono text-2xl text-[var(--ok)]">{streak}d</span>
    </div>
  );
}
```

- [ ] **Step 6: Implement `app/(app)/trends/page.tsx`**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  computeWeeklyVolume,
  computeE1RMTrend,
  computeAdherenceStreak,
  computeConditioningTrend,
} from "@/lib/analytics";
import { WeightTrendChart } from "@/components/charts/WeightTrendChart";
import { E1RMTrendChart } from "@/components/charts/E1RMTrendChart";
import { WeeklyVolumeChart } from "@/components/charts/WeeklyVolumeChart";
import { ConditioningTrendChart } from "@/components/charts/ConditioningTrendChart";
import { AdherenceStreakCard } from "@/components/AdherenceStreakCard";
import type { Profile, SetRow, ConditioningLog, WeighIn, AdherenceCheckin, Exercise } from "@/lib/types";

export default async function TrendsPage() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) redirect("/select-profile");

  const supabase = getSupabaseServerClient();

  const [{ data: profile }, { data: weighIns }, { data: checkins }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).single<Profile>(),
    supabase.from("weigh_ins").select("*").eq("profile_id", profileId).order("date").returns<WeighIn[]>(),
    supabase.from("adherence_checkins").select("*").eq("profile_id", profileId).returns<AdherenceCheckin[]>(),
    supabase.from("sessions").select("id, date").eq("profile_id", profileId).returns<{ id: string; date: string }[]>(),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const sessionDateById = Object.fromEntries((sessions ?? []).map((s) => [s.id, s.date]));

  const [{ data: sets }, { data: conditioningLogs }, { data: exercises }] = await Promise.all([
    sessionIds.length
      ? supabase.from("sets").select("*").in("session_id", sessionIds).returns<SetRow[]>()
      : Promise.resolve({ data: [] as SetRow[] }),
    sessionIds.length
      ? supabase.from("conditioning_logs").select("*").in("session_id", sessionIds).returns<ConditioningLog[]>()
      : Promise.resolve({ data: [] as ConditioningLog[] }),
    supabase.from("exercises").select("*").eq("category", "lift").returns<Exercise[]>(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const streak = computeAdherenceStreak(checkins ?? [], today);
  const weeklyVolume = computeWeeklyVolume(sets ?? [], sessionDateById);

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Trends</h1>

      <WeightTrendChart
        data={(weighIns ?? []).map((w) => ({ date: w.date, weight_kg: w.weight_kg }))}
        targetWeightKg={profile?.target_weight_kg ?? null}
      />

      <AdherenceStreakCard streak={streak} />

      <WeeklyVolumeChart data={weeklyVolume} />

      {(exercises ?? []).map((exercise) => {
        const trend = computeE1RMTrend(sets ?? [], sessionDateById, exercise.id);
        if (trend.length === 0) return null;
        return <E1RMTrendChart key={exercise.id} data={trend} exerciseName={exercise.name} />;
      })}

      {["assault_bike", "erg", "bag"].flatMap((modality) => {
        const metricTypes = new Set(
          (conditioningLogs ?? [])
            .filter((log) => log.modality === modality)
            .map((log) => log.metric_type)
            .filter((m): m is string => Boolean(m))
        );
        return [...metricTypes].map((metricType) => {
          const trend = computeConditioningTrend(conditioningLogs ?? [], sessionDateById, modality, metricType);
          if (trend.length === 0) return null;
          return (
            <ConditioningTrendChart
              key={`${modality}-${metricType}`}
              data={trend}
              modality={modality}
              metricType={metricType}
            />
          );
        });
      })}
    </main>
  );
}
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

With the set, conditioning, weigh-in, and adherence data logged in Tasks 10-13, visit `/trends`. Expected: weight chart renders with the logged weigh-in point and a flat target line; adherence streak shows the correct count; weekly volume bar shows the logged set's reps x weight; the e1RM chart for the logged exercise renders; the conditioning trend chart for the logged modality/metric renders. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/trends" components/charts components/AdherenceStreakCard.tsx
git commit -m "feat: add /trends page with all five analytics views"
```

---

## Task 17: `/settings` page + Web Push subscribe flow

**Files:**
- Create: `public/sw.js`
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/(app)/settings/page.tsx`
- Create: `components/PushSubscribeButton.tsx`

- [ ] **Step 1: Implement `public/sw.js`**

```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "FitBuddy", {
      body: data.body || "",
      icon: "/icon.png",
    })
  );
});
```

- [ ] **Step 2: Implement `app/api/push/subscribe/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "No profile selected" }, { status: 401 });
  }

  const subscription = await request.json();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: subscription })
    .eq("id", profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

Note: this route is excluded from the middleware's session check (per Task 4's matcher) per the spec's instruction that it's one of the two routes reachable pre-auth. It still requires the `profile_id` cookie here, which is set post-login, so an unauthenticated caller can't actually subscribe — but double check with the user before relying on this as the only guard if the threat model changes.

- [ ] **Step 3: Implement `components/PushSubscribeButton.tsx`**

```tsx
"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushSubscribeButton({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<"idle" | "subscribing" | "done" | "error">("idle");

  async function subscribe() {
    setStatus("subscribing");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "subscribing" || status === "done"}
      className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium disabled:opacity-50"
    >
      {status === "done" ? "Notifications enabled" : "Enable notifications"}
    </button>
  );
}
```

- [ ] **Step 4: Implement `app/(app)/settings/page.tsx`**

```tsx
import { PushSubscribeButton } from "@/components/PushSubscribeButton";

export default function SettingsPage() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Settings</h1>
      {vapidPublicKey ? (
        <PushSubscribeButton vapidPublicKey={vapidPublicKey} />
      ) : (
        <p className="text-[var(--dim)] text-sm">Push not configured yet.</p>
      )}
    </main>
  );
}
```

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to `.env.local.example` (the client needs the public key; the `NEXT_PUBLIC_` prefix is what exposes it to the browser — the private key stays server-only under the existing `VAPID_PRIVATE_KEY`).

DEVOPS NOTE: in production this needs a real VAPID keypair generated once (`npx web-push generate-vapid-keys`) and stored as Vercel env vars — `VAPID_PUBLIC_KEY`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value, two names for server/client) and `VAPID_PRIVATE_KEY`. Regenerating the keypair invalidates all existing push subscriptions — users would need to re-subscribe.

- [ ] **Step 5: Manual verification**

Generate a real VAPID keypair, set `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` in `.env.local`. `npm run dev`, visit `/settings`, click "Enable notifications", accept the browser permission prompt. Expected: button changes to "Notifications enabled", `profiles.push_subscription` for the current profile has a JSON subscription object. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js app/api/push app/(app)/settings components/PushSubscribeButton.tsx .env.local.example
git commit -m "feat: add push subscription flow and /settings page"
```

---

## Task 18: Daily weigh-in reminder cron (push)

**Files:**
- Create: `lib/push.ts`
- Create: `app/api/cron/reminders/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Implement `lib/push.ts`**

```ts
import "server-only";
import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails("mailto:daryl@spiralytics.com", publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string }
) {
  ensureConfigured();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
```

- [ ] **Step 2: Implement `app/api/cron/reminders/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push";
import type { Profile } from "@/lib/types";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: profiles } = await supabase.from("profiles").select("*").returns<Profile[]>();
  const { data: weighInsToday } = await supabase
    .from("weigh_ins")
    .select("profile_id")
    .eq("date", today);

  const weighedInIds = new Set((weighInsToday ?? []).map((w) => w.profile_id));
  const missing = (profiles ?? []).filter((p) => !weighedInIds.has(p.id) && p.push_subscription);

  const results = await Promise.allSettled(
    missing.map((profile) =>
      sendPushNotification(profile.push_subscription as never, {
        title: "FitBuddy",
        body: "No weigh-in logged today yet.",
      })
    )
  );

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    notified: missing.length,
    failures: results.filter((r) => r.status === "rejected").length,
  });
}
```

- [ ] **Step 3: Implement `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 19 * * *"
    }
  ]
}
```

Vercel Cron sends its own auth automatically when `CRON_SECRET` is set as an env var and the request matches Vercel's cron invocation — but since this route is invoked with a custom `Authorization` header, the user must additionally set `CRON_SECRET` in Vercel's env vars for the header check above to work. Note this explicitly for the user rather than assuming it's already configured.

DEVOPS NOTE: `0 19 * * *` is a UTC cron expression (7pm UTC daily). Confirm with the user what local evening time they actually want reminders sent at, and convert to UTC accordingly — this is a guess pending their confirmation, not a fabricated final value.

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

With `CRON_SECRET=test-secret` in `.env.local` and at least one profile having a `push_subscription` set from Task 17:

```bash
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/reminders
```

Expected: JSON response with `checked`/`notified`/`failures` counts, and (if that profile hasn't weighed in today) a browser push notification appears. Also confirm `curl http://localhost:3000/api/cron/reminders` (no auth header) returns 401. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add lib/push.ts app/api/cron vercel.json
git commit -m "feat: add daily weigh-in reminder cron with push notifications"
```

---

## Task 19: Email reminder via Resend

**Files:**
- Create: `lib/email.ts`
- Modify: `app/api/cron/reminders/route.ts`

- [ ] **Step 1: Implement `lib/email.ts`**

```ts
import "server-only";
import { Resend } from "resend";

export async function sendReminderEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "FitBuddy <reminders@fitbuddy.app>",
    to,
    subject,
    text: body,
  });
}
```

Note the `from` address needs a domain verified in the user's Resend account — flag this to the user rather than assuming `fitbuddy.app` is real; they'll need to swap in their verified sending domain.

- [ ] **Step 2: Extend the cron route to also email**

Modify `app/api/cron/reminders/route.ts` — add the import and extend the `missing` handling:

```ts
import { sendReminderEmail } from "@/lib/email";
```

Replace the `missing` filter and results block with:

```ts
  const missing = (profiles ?? []).filter((p) => !weighedInIds.has(p.id));

  const pushResults = await Promise.allSettled(
    missing
      .filter((p) => p.push_subscription)
      .map((profile) =>
        sendPushNotification(profile.push_subscription as never, {
          title: "FitBuddy",
          body: "No weigh-in logged today yet.",
        })
      )
  );

  const emailResults = await Promise.allSettled(
    missing
      .filter((p) => p.email)
      .map((profile) =>
        sendReminderEmail(
          profile.email as string,
          "FitBuddy reminder",
          "No weigh-in logged today yet."
        )
      )
  );

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    notified: missing.length,
    pushFailures: pushResults.filter((r) => r.status === "rejected").length,
    emailFailures: emailResults.filter((r) => r.status === "rejected").length,
  });
```

- [ ] **Step 3: Manual verification**

Set `RESEND_API_KEY` in `.env.local` and an `email` value on at least one seeded profile (via Supabase table editor). `npm run dev`, run the same `curl` command from Task 18 Step 4. Expected: response includes `emailFailures: 0`, and the target inbox receives the reminder email (check Resend's dashboard logs if the inbox is slow). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add lib/email.ts app/api/cron/reminders/route.ts
git commit -m "feat: add email reminders via Resend to the cron route"
```

---

## Plan self-review notes

- **Spec coverage:** all 8 in-scope MVP bullets map to a task — passcode gate (3-5), profile picker (6), set logging (10), conditioning logging (11), weigh-ins (12), adherence (13), measurements (14), trends 5-views (15-16), push (17-18), email (19). Build order steps 1-7 map to Tasks 1-2 (step 1), 3-6 (step 2), 8 (step 3), 10-14 (step 4), 15-16 (step 5), 17-18 (step 6), 19 (step 7).
- **Deferred, not fabricated:** actual Supabase project, real passcode, VAPID keypair, Resend domain/API key, `CRON_SECRET` value, exact reminder send time, Marga's hrmax — all flagged inline at the task that needs them, none invented.
- **Type consistency checked:** `SetRow`/`ConditioningLog`/`WeighIn`/`AdherenceCheckin`/`Measurement`/`Profile`/`Exercise`/`Session` field names match `schema.sql` exactly across Tasks 2, 10-16, 18-19.
- **Out-of-scope guard:** no task touches MFP, CV rep counting, Redis, Supabase Auth, or `program_days` content — consistent with the spec's explicit exclusions. Phase 2 AI insights (`ai_insights` table, Gemini call, opt-in toggle) is intentionally not a task here — it's step 8 in the spec, gated on the MVP being live with real data first.

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
  name text not null unique,
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
  deficit_hit boolean,
  unique (profile_id, date)
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

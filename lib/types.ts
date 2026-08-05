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

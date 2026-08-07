"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseRequiredNumber, parseOptionalNumber } from "@/lib/form";

export async function logSet(formData: FormData) {
  const sessionId = String(formData.get("session_id"));
  const exerciseName = String(formData.get("exercise_name") ?? "").trim();
  const reps = parseRequiredNumber(formData, "reps");
  const weightKg = Number(formData.get("weight_kg"));

  if (!sessionId || !exerciseName || Number.isNaN(reps) || Number.isNaN(weightKg)) {
    throw new Error("Missing required set fields");
  }

  const supabase = getSupabaseServerClient();

  const { data: exercise, error: exerciseError } = await supabase
    .from("exercises")
    .upsert({ name: exerciseName, category: "lift" }, { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();

  if (exerciseError || !exercise) throw new Error(exerciseError?.message ?? "Failed to resolve exercise");

  const exerciseId = exercise.id;

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

export async function logWeighIn(formData: FormData) {
  const weightKg = parseRequiredNumber(formData, "weight_kg");
  if (Number.isNaN(weightKg)) throw new Error("Weight is required");

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const localDateRaw = String(formData.get("local_date") ?? "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(localDateRaw)
    ? localDateRaw
    : new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("weigh_ins").insert({
    profile_id: profileId,
    date,
    weight_kg: weightKg,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}

export async function logConditioning(formData: FormData) {
  const sessionId = String(formData.get("session_id"));
  const modality = String(formData.get("modality") ?? "").trim();
  const metricType = String(formData.get("metric_type") ?? "").trim();
  const value = parseRequiredNumber(formData, "value");
  const durationSec = parseOptionalNumber(formData, "duration_sec");

  if (!sessionId || !modality || !metricType || Number.isNaN(value)) {
    throw new Error("Missing required conditioning fields");
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("conditioning_logs").insert({
    session_id: sessionId,
    modality,
    metric_type: metricType,
    value,
    duration_sec: durationSec,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}

export async function logMeasurement(formData: FormData) {
  const bodyPart = String(formData.get("body_part") ?? "").trim();
  const valueCm = parseRequiredNumber(formData, "value_cm");

  if (!bodyPart || Number.isNaN(valueCm)) throw new Error("Missing measurement fields");

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const localDateRaw = String(formData.get("local_date") ?? "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(localDateRaw)
    ? localDateRaw
    : new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("measurements").insert({
    profile_id: profileId,
    date,
    body_part: bodyPart,
    value_cm: valueCm,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}

export async function logAdherence(formData: FormData) {
  const proteinHit = formData.get("protein_hit") === "on";
  const deficitHit = formData.get("deficit_hit") === "on";

  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) throw new Error("No profile selected");

  const localDateRaw = String(formData.get("local_date") ?? "");
  const today = /^\d{4}-\d{2}-\d{2}$/.test(localDateRaw)
    ? localDateRaw
    : new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("adherence_checkins")
    .upsert(
      { profile_id: profileId, date: today, protein_hit: proteinHit, deficit_hit: deficitHit },
      { onConflict: "profile_id,date" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/log");
}

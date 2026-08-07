"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function logSet(formData: FormData) {
  const sessionId = String(formData.get("session_id"));
  const exerciseName = String(formData.get("exercise_name") ?? "").trim();
  const reps = Number(formData.get("reps"));
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

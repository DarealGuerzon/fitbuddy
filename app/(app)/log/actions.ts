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

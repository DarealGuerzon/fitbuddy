"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getLocalDate } from "@/lib/form";

export async function startSession(formData: FormData) {
  const sessionLabel = String(formData.get("session_label") ?? "").trim();
  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;

  if (!profileId) redirect("/select-profile");

  const date = getLocalDate(formData);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      profile_id: profileId,
      date,
      session_label: sessionLabel || null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create session");

  redirect(`/log?session=${data.id}`);
}

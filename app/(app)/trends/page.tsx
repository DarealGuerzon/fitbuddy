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

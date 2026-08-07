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

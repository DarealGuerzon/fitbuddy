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

  it("buckets a mid-week session date to that week's Monday", () => {
    // 2026-08-05 is a Wednesday; its week's Monday is 2026-08-03.
    const sessionsById = { s1: "2026-08-05" };
    const sets = [set({ session_id: "s1", reps: 5, weight_kg: 100 })];
    expect(computeWeeklyVolume(sets, sessionsById)).toEqual([
      { weekStart: "2026-08-03", volume: 500 },
    ]);
  });

  it("buckets a Sunday session date to the preceding Monday", () => {
    // 2026-08-09 is a Sunday; its week's Monday is 2026-08-03.
    const sessionsById = { s1: "2026-08-09" };
    const sets = [set({ session_id: "s1", reps: 5, weight_kg: 100 })];
    expect(computeWeeklyVolume(sets, sessionsById)).toEqual([
      { weekStart: "2026-08-03", volume: 500 },
    ]);
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

  it("returns one point per date across multiple session dates, sorted ascending", () => {
    const sessionsById = { s1: "2026-08-10", s2: "2026-08-03" };
    const sets = [
      set({ session_id: "s1", exercise_id: "squat", reps: 5, weight_kg: 120 }),
      set({ session_id: "s2", exercise_id: "squat", reps: 5, weight_kg: 100 }),
    ];
    const result = computeE1RMTrend(sets, sessionsById, "squat");
    expect(result).toEqual([
      { date: "2026-08-03", e1rm: 116.66666666666667 },
      { date: "2026-08-10", e1rm: 140 },
    ]);
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

  it("excludes logs with a null value instead of faking a zero data point", () => {
    const sessionsById = { s1: "2026-08-05", s2: "2026-08-03" };
    const logs: ConditioningLog[] = [
      { id: "1", session_id: "s1", modality: "assault_bike", metric_type: "watts_avg", value: 220, duration_sec: 600 },
      { id: "2", session_id: "s2", modality: "assault_bike", metric_type: "watts_avg", value: null, duration_sec: 600 },
    ];
    const result = computeConditioningTrend(logs, sessionsById, "assault_bike", "watts_avg");
    expect(result).toEqual([{ date: "2026-08-05", value: 220 }]);
  });
});

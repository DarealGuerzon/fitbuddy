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

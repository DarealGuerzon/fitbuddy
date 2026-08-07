"use client";

import { logConditioning } from "@/app/(app)/log/actions";

const MODALITIES = ["assault_bike", "erg", "bag"];

export function ConditioningEntryForm({ sessionId }: { sessionId: string }) {
  return (
    <form action={logConditioning} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Log conditioning</h2>
      <input type="hidden" name="session_id" value={sessionId} />
      <select
        name="modality"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      >
        {MODALITIES.map((m) => (
          <option key={m} value={m}>
            {m.replace("_", " ")}
          </option>
        ))}
      </select>
      <input
        name="metric_type"
        placeholder="Metric (e.g. watts_avg, hr_avg)"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      />
      <div className="flex gap-3">
        <input
          name="value"
          type="number"
          step="0.1"
          placeholder="Value"
          required
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
        <input
          name="duration_sec"
          type="number"
          placeholder="Duration (sec)"
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono w-1/2"
        />
      </div>
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Add conditioning
      </button>
    </form>
  );
}

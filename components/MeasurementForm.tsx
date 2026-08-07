"use client";

import { LocalDateField } from "@/components/LocalDateField";
import { logMeasurement } from "@/app/(app)/log/actions";

const BODY_PARTS = ["glutes", "legs", "waist"];

export function MeasurementForm() {
  return (
    <form action={logMeasurement} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Measurement</h2>
      <LocalDateField />
      <select
        name="body_part"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
      >
        {BODY_PARTS.map((part) => (
          <option key={part} value={part}>
            {part}
          </option>
        ))}
      </select>
      <input
        name="value_cm"
        type="number"
        step="0.1"
        placeholder="cm"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono"
      />
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Save measurement
      </button>
    </form>
  );
}

"use client";

import { LocalDateField } from "@/components/LocalDateField";
import { logWeighIn } from "@/app/(app)/log/actions";

export function WeighInForm() {
  return (
    <form action={logWeighIn} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Weigh-in</h2>
      <LocalDateField />
      <input
        name="weight_kg"
        type="number"
        step="0.1"
        placeholder="Weight (kg)"
        required
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)] font-mono"
      />
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Log weight
      </button>
    </form>
  );
}

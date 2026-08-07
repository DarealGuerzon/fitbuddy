"use client";

import { LocalDateField } from "@/components/LocalDateField";
import { logAdherence } from "@/app/(app)/log/actions";

export function AdherenceToggle() {
  return (
    <form action={logAdherence} className="flex flex-col gap-3 bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium">Today&apos;s adherence</h2>
      <LocalDateField />
      <label className="flex items-center gap-3">
        <input type="checkbox" name="protein_hit" className="w-5 h-5" />
        Protein target hit
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="deficit_hit" className="w-5 h-5" />
        Deficit hit
      </label>
      <button type="submit" className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium">
        Save
      </button>
    </form>
  );
}

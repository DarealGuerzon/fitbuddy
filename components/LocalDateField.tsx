"use client";

export function LocalDateField({ name = "local_date" }: { name?: string }) {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return <input type="hidden" name={name} value={localDate} />;
}

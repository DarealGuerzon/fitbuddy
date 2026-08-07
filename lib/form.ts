export function parseRequiredNumber(formData: FormData, field: string): number {
  const raw = formData.get(field);
  if (raw === null || raw === "") return NaN;
  return Number(raw);
}

export function parseOptionalNumber(formData: FormData, field: string): number | null {
  const raw = formData.get(field);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

export function getLocalDate(formData: FormData): string {
  const raw = String(formData.get("local_date") ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

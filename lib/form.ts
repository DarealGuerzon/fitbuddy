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

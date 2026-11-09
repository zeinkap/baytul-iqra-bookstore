/** How a book's age range reads to a customer: "4-7" -> "Ages 4-7"; wording like "All ages" is kept as it is. Null when there is none. */
export function ageLabel(ageRange: string | null | undefined): string | null {
  const text = ageRange?.trim();
  if (!text) return null;
  return /^\d/.test(text) ? `Ages ${text}` : text;
}

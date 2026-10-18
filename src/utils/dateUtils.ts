/**
 * Returns the current local date as YYYY-MM-DD string.
 * Avoids the UTC timezone mismatch that toISOString().slice(0,10) causes.
 */
export function getLocalDateString(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

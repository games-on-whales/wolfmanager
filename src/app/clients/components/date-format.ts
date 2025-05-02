// Utility for deterministic date formatting (UTC, ISO-like, no locale)
export function formatDateTimeUTC(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "N/A";
  try {
    const date = new Date(dateInput);
    // YYYY-MM-DD HH:mm:ss UTC
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')} ${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')}:${String(date.getUTCSeconds()).padStart(2,'0')} UTC`;
  } catch {
    return "Invalid Date";
  }
}

/**
 * "Today" in the BUSINESS time zone as MMDDYY, e.g. 2026-11-08 -> "110826".
 * Used by customer codes (CUS1108260001) and receipts (RC1108260001), so the
 * date matches the shop's calendar even when the server runs in UTC.
 */
export function todayMMDDYY(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}${get('day')}${get('year')}`;
}

/** Next code after `last` for this prefix: ("CUS110826", "CUS1108260007") -> "CUS1108260008". null = daily limit reached. */
export function nextDailyCode(prefix: string, last: string | null | undefined, digits: number): string | null {
  const number = last ? Number(last.slice(prefix.length)) + 1 : 1;
  if (!Number.isFinite(number) || number >= 10 ** digits) return null;
  return `${prefix}${String(number).padStart(digits, '0')}`;
}

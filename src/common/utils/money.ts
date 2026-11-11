/**
 * Money is NUMERIC(14,2) in Postgres. The driver returns it as a string
 * ("8000.00") so no precision is lost. Arithmetic is done in integer CENTS
 * (exact; max 99,999,999,999,999 cents < Number.MAX_SAFE_INTEGER), never in
 * floating point, where 0.1 + 0.2 !== 0.3.
 */
export type Cents = number;

export const MAX_MONEY = 999_999_999_999.99;

export function toCents(value: string | number): Cents {
  if (typeof value === 'number') return Math.round(value * 100);
  const text = value.trim();
  const negative = text.startsWith('-');
  const [int, frac = ''] = text.replace(/^[-+]/, '').split('.');
  const cents = Number(int || '0') * 100 + Number((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

/** 123456 -> "1234.56" (what we write to the database). */
export function fromCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** "8000.00" -> 8000 (the API returns JSON numbers, like the FastAPI version). */
export function moneyToNumber(value: string | number | null | undefined): number {
  return value == null ? 0 : toCents(value) / 100;
}

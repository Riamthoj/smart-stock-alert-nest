import { describe, expect, it } from 'vitest';
import { nextDailyCode, todayMMDDYY } from './daily-code.js';
import { fromCents, moneyToNumber, toCents } from './money.js';
import { sentFields, withoutNulls } from './objects.js';
import { likePattern } from './search.js';
import { uuidv7 } from './uuid7.js';

describe('money (exact integer cents)', () => {
  it('parses numbers and decimal strings', () => {
    expect(toCents(8000.25)).toBe(800025);
    expect(toCents('8000.25')).toBe(800025);
    expect(toCents('8000')).toBe(800000);
    expect(toCents('0.5')).toBe(50);
    expect(toCents('-12.34')).toBe(-1234);
  });

  it('avoids floating point drift', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe('0.30');
  });

  it('formats for the database and the API', () => {
    expect(fromCents(123456)).toBe('1234.56');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(-1234)).toBe('-12.34');
    expect(moneyToNumber('8000.00')).toBe(8000);
    expect(moneyToNumber(null)).toBe(0);
  });
});

describe('daily codes', () => {
  it('uses the business time zone, not the server one', () => {
    const utcEvening = new Date('2026-11-08T20:00:00Z'); // already Nov 9 in Vientiane (UTC+7)
    expect(todayMMDDYY('UTC', utcEvening)).toBe('110826');
    expect(todayMMDDYY('Asia/Vientiane', utcEvening)).toBe('110926');
  });

  it('increments the zero-padded counter and stops at the limit', () => {
    expect(nextDailyCode('RC110826', null, 4)).toBe('RC1108260001');
    expect(nextDailyCode('RC110826', 'RC1108260041', 4)).toBe('RC1108260042');
    expect(nextDailyCode('RC110826', 'RC1108269999', 4)).toBeNull();
  });
});

describe('uuidv7', () => {
  it('is a valid, time-ordered v7 UUID', async () => {
    const a = uuidv7();
    await new Promise((r) => setTimeout(r, 2));
    const b = uuidv7();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe('PATCH helpers', () => {
  it('keeps only sent fields, null included', () => {
    expect(sentFields({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it('drops nulls for NOT NULL columns only', () => {
    expect(withoutNulls({ name: null, image: null }, ['name'])).toEqual({ image: null });
  });
});

describe('search', () => {
  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { notFound } from '../errors/app-error.js';
import { LO_MESSAGES } from './catalog.lo.js';
import { requestLanguage, translate } from './i18n.js';
import { Message, msg, term } from './message.js';

const req = (query: Record<string, string> = {}, acceptLanguage?: string) => ({
  query,
  headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
});

describe('msg templates', () => {
  it('keep the template and params apart, English via toString', () => {
    const m = msg`Phone '${'+856 20'}' is already registered`;
    expect(m.template).toBe("Phone '{0}' is already registered");
    expect(String(m)).toBe("Phone '+856 20' is already registered");
  });
});

describe('translate', () => {
  it('translates templates and lets Lao reorder the parameters', () => {
    expect(translate(notFound('Product', 'p1').i18n, 'lo')).toBe('ບໍ່ພົບສິນຄ້າ p1');
    expect(translate(notFound('Product', 'p1').i18n, 'en')).toBe('Product p1 not found');
  });

  it('translates nested messages, but never user data', () => {
    const rate = msg`${new Message('Too many login attempts')}. Try again in ${42} seconds`;
    expect(translate(rate, 'lo')).toBe('ພະຍາຍາມເຂົ້າສູ່ລະບົບຫຼາຍເກີນໄປ. ກະລຸນາລອງໃໝ່ໃນອີກ 42 ວິນາທີ');
    // a product literally named "Sale" stays "Sale"; only term('Sale') is translated
    expect(translate(msg`Product '${'Sale'}' belongs to a different store`, 'lo')).toContain("'Sale'");
    expect(translate(msg`${term('Sale')} ${'x'} not found`, 'lo')).toBe('ບໍ່ພົບການຂາຍ x');
  });

  it('falls back to English for unknown messages', () => {
    expect(translate('Some brand new error', 'lo')).toBe('Some brand new error');
  });
});

describe('requestLanguage', () => {
  it('?lang= wins, then Accept-Language (by q), then the default', () => {
    expect(requestLanguage(req({ lang: 'lo' }, 'en'), 'en')).toBe('lo');
    expect(requestLanguage(req({}, 'lo-LA,en;q=0.8'), 'en')).toBe('lo');
    expect(requestLanguage(req({}, 'fr,en;q=0.5,lo;q=0.9'), 'en')).toBe('lo');
    expect(requestLanguage(req({}, 'fr'), 'lo')).toBe('lo');
    expect(requestLanguage(req({ lang: 'xx' }), 'en')).toBe('en');
  });
});

describe('Lao catalog coverage', () => {
  /** Every error message written in src/ must have a Lao translation. */
  it('translates every message thrown in the code', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.includes(join('common', 'i18n'))) {
          files.push(path);
        }
      }
    };
    walk(join(process.cwd(), 'src'));

    const used = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // msg`...${x}...`  -> template with {0}, {1}
      for (const m of src.matchAll(/msg`([^`]*)`/g)) {
        let i = 0;
        used.add(m[1].replace(/\$\{[^}]*\}/g, () => `{${i++}}`));
      }
      // new XxxError('plain message')
      for (const m of src.matchAll(/new [A-Za-z]+Error\(\s*'([^']+)'/g)) used.add(m[1]);
    }
    used.delete('...'); // doc comment example
    const missing = [...used].filter((t) => !(t in LO_MESSAGES));
    expect(missing).toEqual([]);
  });
});

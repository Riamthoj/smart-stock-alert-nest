import type { Request } from 'express';
import { LO_MESSAGES, LO_NOUNS } from './catalog.lo.js';
import { fill, Message, Term } from './message.js';

export const LANGUAGES = ['en', 'lo'] as const;
export type Language = (typeof LANGUAGES)[number];

const CATALOGS: Record<Language, { messages: Record<string, string>; nouns: Record<string, string> }> = {
  en: { messages: {}, nouns: {} },
  lo: { messages: LO_MESSAGES, nouns: LO_NOUNS },
};

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/**
 * The language of a request, first match wins:
 *   1. ?lang=lo                      (explicit, easy to test in a browser)
 *   2. Accept-Language: lo-LA,en;q=0.8  (what apps / browsers send)
 *   3. the server default (DEFAULT_LANGUAGE)
 */
export function requestLanguage(req: Pick<Request, 'query' | 'headers'>, fallback: Language): Language {
  const query = String(req.query?.lang ?? '').toLowerCase();
  if (isLanguage(query)) return query;

  const header = String(req.headers?.['accept-language'] ?? '');
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.find((x) => isLanguage(x.lang))?.lang as Language | undefined ?? fallback;
}

/** Translate a message (Message or plain English string). Unknown -> English. */
export function translate(message: Message | string, lang: Language): string {
  const { messages, nouns } = CATALOGS[lang];
  if (typeof message === 'string') return messages[message] ?? message;
  // Only Terms and nested Messages are translated; user data stays untouched.
  const params = message.params.map((p) =>
    p instanceof Message ? translate(p, lang) : p instanceof Term ? (nouns[p.word] ?? p.word) : String(p),
  );
  return fill(messages[message.template] ?? message.template, params);
}

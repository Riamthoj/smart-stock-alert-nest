/**
 * A translatable message: an English TEMPLATE + its parameters, kept apart so
 * a translation can put the parameters wherever its grammar needs them.
 *
 *   throw new NotFoundError(msg`Store ${id} not found`);
 *     template: "Store {0} not found"   params: [id]
 *     en: "Store 01a1... not found"     lo: "ບໍ່ພົບຮ້ານ 01a1..."
 *
 * Same idea as gettext: the English template IS the translation key, so code
 * stays readable and a missing translation simply falls back to English.
 */
export class Message {
  constructor(
    readonly template: string,
    readonly params: readonly unknown[] = [],
  ) {}

  /** English text. */
  toString(): string {
    return fill(this.template, this.params.map(String));
  }
}

/**
 * A record name used as a parameter ("Product", "Store"...). Only Terms and
 * nested Messages are translated; any other parameter (a username, a product
 * name typed by a user) is shown exactly as given.
 */
export class Term {
  constructor(readonly word: string) {}

  toString(): string {
    return this.word;
  }
}

export const term = (word: string) => new Term(word);

/** Tagged template: msg`Phone '${phone}' is already registered`. */
export function msg(strings: TemplateStringsArray, ...params: unknown[]): Message {
  const template = strings.reduce((acc, part, i) => acc + part + (i < params.length ? `{${i}}` : ''), '');
  return new Message(template, params);
}

/** "{0} of {1}" + ["a", "b"] -> "a of b". */
export function fill(template: string, params: readonly string[]): string {
  return template.replace(/\{(\d+)\}/g, (whole, i: string) => params[Number(i)] ?? whole);
}

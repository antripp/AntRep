/** Tiny text helpers shared by the screens. */

/** `plural(1, "exercise")` → "1 exercise"; `plural(3, "exercise")` → "3 exercises". */
export function plural(count: number, word: string, suffix = "s"): string {
  return `${count} ${word}${count === 1 ? "" : suffix}`;
}

/** Compact kilogram figure: 1250 → "1.3k". */
export function compactKg(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

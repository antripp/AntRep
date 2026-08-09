/**
 * RPE — Rate of Perceived Exertion, on the reps-in-reserve scale.
 *
 * The number alone means little to anyone who hasn't had it explained, so
 * everywhere RPE is shown or entered it comes with what it actually means:
 * RPE 8 is "2 reps left in the tank", not an abstract 8-out-of-10.
 *
 * Half steps are the point — the difference between 7.5 and 8 is exactly the
 * judgement a coach is asking for — so the scale is defined on 0.5s.
 */

export const RPE_MIN = 5;
export const RPE_MAX = 10;
export const RPE_STEP = 0.5;

/** Reps left in reserve at each whole point of the scale. */
const MEANINGS: Record<string, string> = {
  "10": "Maximal — no reps left",
  "9.5": "Maybe half a rep left",
  "9": "1 rep left",
  "8.5": "1–2 reps left",
  "8": "2 reps left",
  "7.5": "2–3 reps left",
  "7": "3 reps left",
  "6.5": "3–4 reps left",
  "6": "4 reps left",
  "5.5": "4–6 reps left",
  "5": "Warm-up effort",
};

/** "2 reps left" — what this RPE is asking for. */
export function rpeMeaning(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) return "Not rated";
  const key = String(Math.round(value * 2) / 2);
  return MEANINGS[key] ?? (value > 10 ? MEANINGS["10"] : MEANINGS["5"]);
}

/** A one-word read on how hard the set was, for chips and summaries. */
export function rpeTone(value: number | null | undefined): "easy" | "moderate" | "hard" | "maximal" | null {
  if (value === null || value === undefined || value <= 0) return null;
  if (value >= 9.5) return "maximal";
  if (value >= 8) return "hard";
  if (value >= 6.5) return "moderate";
  return "easy";
}

/** Colour for a tone, so effort reads at a glance without being alarming. */
export function rpeColor(value: number | null | undefined): string {
  switch (rpeTone(value)) {
    case "maximal":
      return "var(--color-danger)";
    case "hard":
      return "#f5883b";
    case "moderate":
      return "var(--color-done)";
    case "easy":
      return "var(--t-muted)";
    default:
      return "var(--t-muted)";
  }
}

/** Snap to the nearest half point and keep it on the scale. */
export function clampRpe(value: number): number {
  const snapped = Math.round(value * 2) / 2;
  return Math.min(RPE_MAX, Math.max(RPE_MIN, snapped));
}

/** "7.5" not "7.500000001"; "8" not "8.0". */
export function formatRpe(value: number): string {
  return String(Math.round(value * 2) / 2);
}

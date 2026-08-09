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

export const RPE_MIN = 0;
export const RPE_MAX = 10;
export const RPE_STEP = 0.5;

/**
 * What each half-point asks for.
 *
 * The reps-in-reserve scale is only defined from about 5 up — below that "how
 * many more could you have done" stops being a useful question — so the bottom
 * half is described by effort instead. The whole 0–10 range is offered because
 * people do log easy work, and a scale that refuses to record a warm-up just
 * gets left blank.
 */
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
  "5": "Half effort — plenty left",
  "4.5": "Light",
  "4": "Light",
  "3.5": "Easy",
  "3": "Easy",
  "2.5": "Very easy",
  "2": "Very easy",
  "1.5": "Barely any effort",
  "1": "Barely any effort",
  "0.5": "Almost nothing",
  "0": "No effort",
};

/**
 * "2 reps left" — what this RPE is asking for.
 *
 * Only null/undefined mean unrated. 0 is a real reading now that the scale
 * starts there, so it must not be confused with "nothing recorded".
 */
export function rpeMeaning(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not rated";
  const key = String(Math.round(value * 2) / 2);
  return MEANINGS[key] ?? (value > 10 ? MEANINGS["10"] : MEANINGS["0"]);
}

/** A one-word read on how hard the set was, for chips and summaries. */
export function rpeTone(value: number | null | undefined): "easy" | "moderate" | "hard" | "maximal" | null {
  if (value === null || value === undefined) return null;
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

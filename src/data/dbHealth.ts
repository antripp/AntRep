/**
 * Database faults, surfaced instead of swallowed.
 *
 * Every Supabase call used to be written `const { data } = await …`, dropping
 * the error on the floor. A failed read then looked like "no data" and a failed
 * write looked like a success — so a database missing a migration presented as
 * silent data loss: sets stayed on screen while the card was open and were gone
 * on the next load.
 *
 * Reads degrade (report, return empty) so a screen still renders. Writes throw,
 * because the one thing the app must never do is tell someone their work is
 * saved when it isn't.
 */

export interface DbFault {
  /** Which call failed, e.g. "save session". */
  context: string;
  code: string;
  message: string;
  /** The database is behind the app — a migration hasn't been applied. */
  schemaOutdated: boolean;
  at: number;
}

interface ErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Did this fail because the database is missing a column or table the app
 * expects? 42703/42P01 are Postgres' own codes; PGRST204/205 are PostgREST
 * failing to find them in its schema cache.
 */
export function isSchemaOutdated(error: ErrorLike | null | undefined): boolean {
  const code = error?.code;
  return code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205";
}

export class DbWriteError extends Error {
  readonly code: string;
  readonly schemaOutdated: boolean;

  constructor(context: string, error: ErrorLike) {
    super(
      isSchemaOutdated(error)
        ? `Couldn't ${context} — this database is missing an update the app needs.`
        : `Couldn't ${context} — ${error.message ?? "the database rejected it"}.`,
    );
    this.name = "DbWriteError";
    this.code = error.code ?? "unknown";
    this.schemaOutdated = isSchemaOutdated(error);
  }
}

let fault: DbFault | null = null;
const listeners = new Set<() => void>();

export function recordFault(context: string, error: ErrorLike): DbFault {
  const next: DbFault = {
    context,
    code: error.code ?? "unknown",
    message: error.message ?? "Unknown database error",
    schemaOutdated: isSchemaOutdated(error),
    at: Date.now(),
  };
  // Always shout in the console — the banner is a summary, this is the detail
  // whoever is debugging actually needs.
  console.error(`[db] ${context} failed (${next.code})`, error);
  fault = next;
  for (const listener of listeners) listener();
  return next;
}

export function currentFault(): DbFault | null {
  return fault;
}

export function clearFault(): void {
  if (!fault) return;
  fault = null;
  for (const listener of listeners) listener();
}

export function subscribeToFaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

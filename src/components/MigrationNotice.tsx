import type { PostgrestError } from "@supabase/supabase-js";
import { Card } from "./ui";

/** True when a query failed because the DB is missing a newer column/table. */
export function isSchemaOutdated(error: PostgrestError | null): boolean {
  // 42703/42P01: Postgres undefined column/table.
  // PGRST204/PGRST205: PostgREST can't find the column/table in its schema cache.
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.code === "PGRST204" ||
    error?.code === "PGRST205"
  );
}

/** Shown instead of broken content when the database schema is outdated. */
export function MigrationNotice() {
  return (
    <Card className="border-gold">
      <h2 className="mb-1 font-black">Database update needed</h2>
      <p className="text-sm font-semibold text-muted">
        This version of AntRep needs new database tables or columns. Apply the latest
        database setup in your Supabase project → SQL Editor, then reload this page.
      </p>
    </Card>
  );
}

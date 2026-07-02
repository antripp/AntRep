import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True once .env holds real Supabase credentials. */
export const isConfigured = Boolean(url && anonKey);

/**
 * The anon key is a public, browser-safe key by design — every table is
 * protected by Row-Level Security in supabase/schema.sql. The service_role
 * key must never appear anywhere in this repo.
 */
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder",
);

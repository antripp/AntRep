-- ============================================================
-- 007 — Invite codes from a cryptographic source
--
-- Run once in Supabase → SQL Editor, after 001–006.
--
-- `generate_invite_code` used Postgres `random()`, which is a fast PRNG for
-- statistics, not a secret generator: it is seeded per session and its output
-- is predictable from earlier draws. Invite codes are bearer tokens — anyone
-- holding one is linked to that coach — so they need real entropy.
--
-- pgcrypto's gen_random_bytes is a CSPRNG. The alphabet is 32 characters and
-- a byte is 0–255, so `% 32` divides evenly and stays unbiased.
--
-- Nothing else changes: same length, same alphabet, same format, same hashing
-- and 30-minute expiry. Codes already issued keep working.
-- ============================================================

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- No I, O, 0 or 1: these get read aloud and typed by hand.
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  raw text := '';
  i int;
begin
  bytes := extensions.gen_random_bytes(6);
  for i in 1..6 loop
    raw := raw || substr(chars, 1 + (get_byte(bytes, i - 1) % 32), 1);
  end loop;
  return substr(raw, 1, 3) || '-' || substr(raw, 4, 3);
end;
$$;

comment on function public.generate_invite_code() is
  'Six characters from a 32-character alphabet via pgcrypto (2^30 keyspace), '
  'hashed with the app_config pepper before storage and expiring in 30 minutes.';

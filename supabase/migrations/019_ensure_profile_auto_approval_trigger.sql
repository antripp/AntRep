-- ============================================================
-- 019 — Ensure verified signups are not blocked by approval
--
-- Migration 006 replaced the legacy approval function, but some deployed
-- schemas only bound `protect_profile_fields` to UPDATE. In those databases
-- the INSERT branch never runs and a user's first role created through
-- `enable_role` keeps `approved_at = null`.
--
-- Keep the identity-protection trigger unchanged and add an explicit,
-- idempotent BEFORE INSERT trigger for the auto-approval policy.
-- ============================================================

drop trigger if exists profiles_auto_approve on public.profiles;

create trigger profiles_auto_approve
before insert on public.profiles
for each row
execute function public.auto_approve_admin_profile();

comment on trigger profiles_auto_approve on public.profiles is
  'Email verification is the signup gate; every new role profile is approved on insert.';

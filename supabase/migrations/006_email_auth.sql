-- ============================================================
-- 006 — Email verification replaces admin approval
--
-- Run once in Supabase → SQL Editor, after 001–005.
--
-- Nothing is deleted. Every existing account keeps its profiles, plans,
-- sessions and logs, and keeps working the moment this lands.
--
-- What changes
--   * new profiles are approved on creation — the admin queue is gone
--   * `approved_at` stays and stays filled, so every RLS policy that reads
--     it keeps working without a single policy rewrite
--   * accounts that exist today are grandfathered: they are not asked to
--     verify before they can carry on training
--   * admin identity (app_config.admin_user_id, is_admin, check_is_admin)
--     is untouched
--
-- Email verification itself lives in Supabase Auth (auth.users.email_confirmed_at),
-- not here. This migration only records who is exempt from it.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Grandfathering flag
--    Existing rows: false — they trained here before verification existed
--    and must not be locked out. New rows: true.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists requires_email_verification boolean not null default true;

-- Everyone who already exists is exempt. Runs before the default applies to
-- anyone new, so it can never catch a genuinely new signup.
update public.profiles
  set requires_email_verification = false
  where created_at < now();

-- ------------------------------------------------------------
-- 2. Approve everything, past and future
-- ------------------------------------------------------------
update public.profiles
  set approved_at = coalesce(approved_at, now())
  where approved_at is null;

-- Was: approve only the admin's own profiles. Now: approve every profile on
-- insert, so `approved_at is not null` stays true across all the RLS helpers
-- (owns_any_profile, can_read_segment, and friends) with no policy churn.
create or replace function public.auto_approve_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.approved_at := coalesce(new.approved_at, now());
  return new;
end;
$$;

comment on function public.auto_approve_admin_profile() is
  'Approves every profile on insert. Approval is no longer a gate — email '
  'verification in Supabase Auth is. Kept under the old name so the existing '
  'trigger binding does not need recreating.';

-- The insert branch used to blank `approved_at` for anyone who was not the
-- admin, which is what made the queue exist. Drop that clause; the rest of the
-- guard (clients still cannot rewrite user_id or role) is unchanged.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      new.user_id := old.user_id;
    end if;
    if new.role is distinct from old.role then
      new.role := old.role;
    end if;
    if new.approved_at is distinct from old.approved_at then
      -- Only the internal approve path may move this.
      if current_setting('app.internal_approve', true) is distinct from '1' then
        new.approved_at := old.approved_at;
      end if;
    end if;
  elsif tg_op = 'INSERT' then
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Retire the approval queue
--    `check_is_admin` stays: admin identity is still a real thing, it just
--    no longer has a queue to work through.
-- ------------------------------------------------------------
drop function if exists public.list_pending_profiles();
drop function if exists public.approve_profile(uuid);
drop function if exists public.reject_profile(uuid);

-- ------------------------------------------------------------
-- 4. Let a profile record that its email has been verified.
--    auth.users is the source of truth; this mirror is what the app reads
--    when it needs to know without a round trip to the auth schema.
-- ------------------------------------------------------------
create or replace function public.mark_email_verified()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed timestamptz;
begin
  select email_confirmed_at into confirmed
    from auth.users where id = auth.uid();

  if confirmed is null then
    return false;
  end if;

  update public.profiles
    set requires_email_verification = false
    where user_id = auth.uid() and requires_email_verification;

  return true;
end;
$$;

revoke all on function public.mark_email_verified() from public, anon;
grant execute on function public.mark_email_verified() to authenticated;

comment on function public.mark_email_verified() is
  'Clears the verification requirement once Supabase Auth reports the address '
  'confirmed. Returns false if it is not confirmed yet.';

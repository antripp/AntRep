/**
 * The database talking back.
 *
 * Sits above every screen so a failed save can never pass for a successful one.
 * The migration case gets its own wording because it is the one a user can
 * actually fix, and because its symptom — work that stays on screen and is gone
 * on reload — otherwise looks like the app losing data at random.
 */

import { useSyncExternalStore } from "react";
import { clearFault, currentFault, subscribeToFaults } from "../../data/dbHealth";
import { Icon } from "../../ui/kit";

export function DbFaultBanner() {
  const fault = useSyncExternalStore(subscribeToFaults, currentFault, () => null);
  if (!fault) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-40 border-b border-danger/40 px-4 py-2.5"
      style={{ background: "color-mix(in srgb, var(--color-danger) 14%, var(--t-bg))" }}
    >
      <div className="mx-auto flex max-w-3xl items-start gap-2.5">
        <Icon.alert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          {fault.schemaOutdated ? (
            <>
              <p className="text-sm font-black text-ink">This database needs an update</p>
              <p className="text-xs font-semibold leading-snug text-muted">
                AntRep couldn't {fault.context} — the database is missing columns this version
                expects, so nothing you log here is being saved. Run the pending files in{" "}
                <code className="font-black">supabase/migrations/</code> in your Supabase SQL editor,
                then reload.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-ink">Couldn't {fault.context}</p>
              <p className="text-xs font-semibold leading-snug text-muted">
                {fault.message} — your last change may not have been saved.
              </p>
            </>
          )}
        </div>
        <button
          onClick={clearFault}
          aria-label="Dismiss"
          className="shrink-0 text-muted transition active:text-ink"
        >
          <Icon.close className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

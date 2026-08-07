/**
 * The one filter every Progress tab honours: which plan are we looking at?
 *
 * Scoping happens once, here, so the Overview charts, the Plans tables and the
 * Exercises list can never disagree about what "this plan" means.
 */

import { useMemo, useState } from "react";
import type { PlanBundle, Session, SetLog } from "../../data/types";

export interface ProgressScope {
  scope: string;
  setScope: (id: string) => void;
  /** Plans the athlete has actually trained against, newest session first. */
  scopePlans: PlanBundle[];
  /** The selected plan, or null for "Overall". */
  activeBundle: PlanBundle | null;
  sessions: Session[];
  logs: SetLog[];
}

export function useProgressScope({
  sessions: allSessions,
  logs: allLogs,
  plans,
}: {
  sessions: Session[];
  logs: SetLog[];
  plans: PlanBundle[];
}): ProgressScope {
  const [scope, setScope] = useState("all");

  const scopePlans = useMemo(() => {
    const latest = new Map<string, string>();
    for (const session of allSessions) {
      if (!session.plan_id) continue;
      const current = latest.get(session.plan_id);
      if (!current || session.date > current) latest.set(session.plan_id, session.date);
    }
    return plans
      .filter((bundle) => latest.has(bundle.plan.id))
      .sort((a, b) => (latest.get(b.plan.id) ?? "").localeCompare(latest.get(a.plan.id) ?? ""));
  }, [plans, allSessions]);

  const activeBundle = scopePlans.find((b) => b.plan.id === scope) ?? null;

  const sessions = useMemo(
    () =>
      activeBundle ? allSessions.filter((s) => s.plan_id === activeBundle.plan.id) : allSessions,
    [allSessions, activeBundle],
  );

  const logs = useMemo(() => {
    if (!activeBundle) return allLogs;
    const ids = new Set(sessions.map((s) => s.id));
    return allLogs.filter((l) => ids.has(l.session_id));
  }, [allLogs, sessions, activeBundle]);

  return { scope, setScope, scopePlans, activeBundle, sessions, logs };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_LABELS, type Plan, type PlanAssignment, parseLocalDate } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { isSchemaOutdated, MigrationNotice } from "../../components/MigrationNotice";
import { Avatar, Button, Card, EmptyState, Segmented, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import type { LinkedAthlete } from "./CoachApp";
import AthletesPage from "./AthletesPage";
import PlanBoard from "./PlanBoard";

/**
 * The coach's workspace: a Notion-style table of every plan (switchable
 * to the athlete roster). Opening a row lands in the Trello-style board.
 */
export default function PlansPage({
  athletes,
  onAthletesChanged,
  onOpenSessions,
}: {
  athletes: LinkedAthlete[];
  onAthletesChanged: () => Promise<void> | void;
  onOpenSessions: (athleteId: string) => void;
}) {
  const { profile } = useAuth();
  const [view, setView] = useState<"plans" | "athletes">("plans");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assignments, setAssignments] = useState<PlanAssignment[]>([]);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [schemaOld, setSchemaOld] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!profile) return;
      if (!silent) setLoading(true);
      try {
        const { data: planRows, error: planErr } = await supabase
          .from("plans")
          .select("*")
          .eq("trainer_id", profile.id)
          .eq("is_active", true)
          .order("created_at");
        const ps = (planRows as Plan[]) ?? [];
        setPlans(ps);
        const { data: aRows, error } = await (ps.length > 0
          ? supabase.from("plan_assignments").select("*").in("plan_id", ps.map((p) => p.id))
          : supabase.from("plan_assignments").select("*").limit(1)); // probe pre-003 DBs
        setSchemaOld(isSchemaOutdated(error) || isSchemaOutdated(planErr));
        setErrorMsg(planErr?.message ?? error?.message ?? null);
        setAssignments(ps.length > 0 ? ((aRows as PlanAssignment[]) ?? []) : []);
      } finally {
        setLoading(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    load();
  }, [load]);
  useRealtime("coach-plans", ["plans", "plan_assignments"], () => load(true));

  async function createPlan() {
    if (!profile || creating) return;
    setCreating(true);
    setErrorMsg(null);
    const { data: p, error } = await supabase
      .from("plans")
      .insert({ trainer_id: profile.id, name: "New plan" })
      .select()
      .single();
    if (error || !p) {
      setErrorMsg(error?.message ?? "Couldn't create the plan — try again.");
      setSchemaOld((old) => old || isSchemaOutdated(error));
    } else {
      const { error: dayErr } = await supabase.from("plan_days").insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          plan_id: (p as Plan).id,
          week_index: 1,
          weekday,
          title: "Rest",
          day_type: "rest",
        })),
      );
      if (dayErr) setErrorMsg(dayErr.message);
      await load(true);
      setOpenPlanId((p as Plan).id);
    }
    setCreating(false);
  }

  if (loading) return <Spinner />;
  if (schemaOld) {
    return (
      <>
        <h1 className="mb-3 text-2xl font-black">Plans</h1>
        <MigrationNotice />
      </>
    );
  }

  const openPlan = plans.find((p) => p.id === openPlanId);
  if (openPlan) {
    return (
      <PlanBoard
        plan={openPlan}
        athletes={athletes}
        assignments={assignments.filter((a) => a.plan_id === openPlan.id)}
        onBack={() => {
          setOpenPlanId(null);
          load(true);
        }}
        onChanged={() => load(true)}
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-black">{view === "plans" ? "Plans" : "Athletes"}</h1>
        <div className="w-44">
          <Segmented
            options={[
              { key: "plans", label: "Plans" },
              { key: "athletes", label: "Athletes" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>

      {view === "athletes" ? (
        <AthletesPage athletes={athletes} onChanged={onAthletesChanged} onSelect={onOpenSessions} />
      ) : (
        <div className="flex flex-col gap-3">
          {plans.length === 0 ? (
            <Card>
              <EmptyState
                title="No plans yet"
                subtitle="Create a plan once and assign it to as many athletes as you like — each can start on their own date."
              />
            </Card>
          ) : (
            <Card className="p-0">
              {/* header row (md+) */}
              <div className="hidden grid-cols-[1fr_5rem_7rem_8rem_2rem] items-center gap-2 border-b-2 border-line px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-muted md:grid">
                <span>Plan</span>
                <span>Weeks</span>
                <span>Starts</span>
                <span>Athletes</span>
                <span />
              </div>
              {plans.map((p, i) => {
                const planAthletes = assignments
                  .filter((a) => a.plan_id === p.id)
                  .map((a) => athletes.find((x) => x.athlete.id === a.athlete_id))
                  .filter(Boolean) as LinkedAthlete[];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOpenPlanId(p.id)}
                    className={`grid w-full grid-cols-[1fr_2rem] items-center gap-2 px-4 py-3 text-left transition hover:bg-inset md:grid-cols-[1fr_5rem_7rem_8rem_2rem] ${
                      i > 0 ? "border-t-2 border-line" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{p.name}</p>
                      <p className="text-xs font-semibold text-muted md:hidden">
                        {p.weeks} wk · starts {startLabel(p.start_date)} ·{" "}
                        {planAthletes.length === 0 ? "unassigned" : `${planAthletes.length} athlete${planAthletes.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <span className="hidden text-sm font-bold text-muted md:block">{p.weeks}</span>
                    <span className="hidden text-sm font-bold text-muted md:block">{startLabel(p.start_date)}</span>
                    <span className="hidden md:flex md:-space-x-2">
                      {planAthletes.slice(0, 4).map(({ athlete }) => (
                        <span key={athlete.id} className="rounded-xl ring-2 ring-surface">
                          <Avatar name={athlete.display_name} avatar={athlete.avatar} size="sm" />
                        </span>
                      ))}
                      {planAthletes.length === 0 && <span className="text-xs font-bold text-muted">—</span>}
                      {planAthletes.length > 4 && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-inset text-xs font-black text-muted ring-2 ring-surface">
                          +{planAthletes.length - 4}
                        </span>
                      )}
                    </span>
                    <span className="text-right font-black text-muted">›</span>
                  </button>
                );
              })}
            </Card>
          )}
          {errorMsg && (
            <Card className="border-danger/40">
              <p className="text-sm font-bold text-danger">Something went wrong: {errorMsg}</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                If this mentions "infinite recursion", apply the latest database setup in the Supabase SQL editor.
              </p>
            </Card>
          )}
          <Button onClick={createPlan} disabled={creating}>
            + New plan
          </Button>
        </div>
      )}
    </>
  );
}

function startLabel(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = parseLocalDate(dateStr);
  return `${WEEKDAY_LABELS[(d.getDay() === 0 ? 7 : d.getDay()) - 1]} ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

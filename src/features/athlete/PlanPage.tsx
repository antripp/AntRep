import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DAY_TYPE_COLORS,
  WEEKDAY_LABELS,
  activeAthletePlans,
  isoWeekday,
  planWeekIndex,
  type AthletePlan,
  type PlanDay,
  type PlanExercise,
} from "../../lib/types";
import { fetchAthletePlans } from "../../lib/athletePlans";
import { useRealtime } from "../../lib/useRealtime";
import { MigrationNotice } from "../../components/MigrationNotice";
import WeekBoard from "../../components/WeekBoard";
import { Card, Chip, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { exerciseSubtitle } from "./TodayPage";

/**
 * The athlete's full programme as a Trello-style board: week pills on
 * top, days as columns (single-day swipe view on phones). Read-only.
 */
export default function PlanPage({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AthletePlan[]>([]);
  const [coachNames, setCoachNames] = useState<Map<string, string>>(new Map());
  const [days, setDays] = useState<PlanDay[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [schemaOld, setSchemaOld] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!profile) return;
      if (!silent) setLoading(true);
      try {
        const result = await fetchAthletePlans(profile.id);
        setSchemaOld(result.schemaOld);
        setPlans(result.plans);
        setCoachNames(result.coachNames);
        const active = activeAthletePlans(result.plans, new Date());
        const defaultPlanId = active[0]?.plan.id ?? result.plans[0]?.plan.id ?? null;
        setSelectedPlanId((cur) =>
          cur && result.plans.some((ap) => ap.plan.id === cur) ? cur : defaultPlanId,
        );
        if (result.plans.length > 0) {
          const { data: dayRows } = await supabase
            .from("plan_days")
            .select("*")
            .in("plan_id", result.plans.map((ap) => ap.plan.id))
            .order("weekday");
          const allDays = (dayRows as PlanDay[]) ?? [];
          setDays(allDays);
          if (allDays.length > 0) {
            const { data: exRows } = await supabase
              .from("plan_exercises")
              .select("*")
              .in("plan_day_id", allDays.map((d) => d.id))
              .order("sort_order");
            setExercises((exRows as PlanExercise[]) ?? []);
          } else {
            setExercises([]);
          }
        } else {
          setDays([]);
          setExercises([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    load();
  }, [load]);
  useRealtime("athlete-plan", ["plans", "plan_days", "plan_exercises", "plan_assignments", "coach_links"], () =>
    load(true),
  );

  if (loading) return <Spinner />;

  if (schemaOld) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-black">Your plan</h1>
        <MigrationNotice />
      </>
    );
  }

  if (plans.length === 0) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-black">Your plan</h1>
        <Card>
          <EmptyState mascot title="No plan yet" subtitle="Link with your coach in Settings and the full programme lands here." />
        </Card>
      </>
    );
  }

  const ap = plans.find((x) => x.plan.id === selectedPlanId) ?? plans[0];
  const plan = ap.plan;
  const currentWeek = planWeekIndex(plan, new Date(), ap.start);
  const week = selectedWeek ?? currentWeek;
  const weekDays = days.filter((d) => d.plan_id === plan.id && (d.week_index ?? 1) === week);

  return (
    <>
      {!embedded && <h1 className="mb-3 text-2xl font-black">Your plan</h1>}

      {plans.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {plans.map((x) => (
            <button
              key={x.plan.id}
              onClick={() => {
                setSelectedPlanId(x.plan.id);
                setSelectedWeek(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                x.plan.id === plan.id ? "bg-accent text-white" : "border-2 border-line bg-surface text-muted"
              }`}
            >
              {x.plan.name} · {coachNames.get(x.plan.trainer_id) ?? "Coach"}
            </button>
          ))}
        </div>
      )}

      <Card className="mb-3">
        <p className="font-extrabold">{plan.name}</p>
        <p className="text-xs font-semibold text-muted">
          by {coachNames.get(plan.trainer_id) ?? "your coach"} · {plan.weeks} week{plan.weeks === 1 ? "" : "s"} · starts{" "}
          {ap.start}
          {plan.weeks > 1 && ` · you're in week ${currentWeek}`}
        </p>
      </Card>

      {plan.weeks > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`shrink-0 rounded-2xl border-2 px-3 py-1.5 text-xs font-extrabold ${
                w === week
                  ? "border-accent-deep bg-accent text-white"
                  : w === currentWeek
                    ? "border-accent bg-surface text-accent"
                    : "border-line bg-surface text-muted"
              }`}
            >
              W{w}
            </button>
          ))}
        </div>
      )}

      <WeekBoard
        highlightWeekday={week === currentWeek ? isoWeekday(new Date()) : null}
        renderDay={(wd) => {
          const day = weekDays.find((d) => d.weekday === wd);
          const dayExercises = day ? exercises.filter((e) => e.plan_day_id === day.id) : [];
          return (
            <>
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-muted">{WEEKDAY_LABELS[wd - 1]}</span>
                  <Chip label={day?.day_type ?? "rest"} color={DAY_TYPE_COLORS[day?.day_type ?? "rest"]} />
                </div>
                <p className="mt-1 truncate text-sm font-extrabold">{day?.title || "Rest"}</p>
              </Card>
              {dayExercises.map((ex) => (
                <Card key={ex.id} className="p-3">
                  <p className="text-sm font-extrabold">{ex.name}</p>
                  <p className="text-xs font-semibold text-muted">{exerciseSubtitle(ex)}</p>
                  {ex.trainer_notes && <p className="mt-0.5 text-xs font-semibold text-accent">💬 {ex.trainer_notes}</p>}
                </Card>
              ))}
              {day && dayExercises.length === 0 && day.day_type !== "rest" && (
                <p className="px-2 text-xs font-semibold text-muted">Nothing planned.</p>
              )}
            </>
          );
        }}
      />
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DAY_TYPES,
  DAY_TYPE_COLORS,
  WEEKDAY_LABELS,
  isoWeekday,
  planWeekIndex,
  type DayType,
  type Plan,
  type PlanAssignment,
  type PlanDay,
  type PlanExercise,
} from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import WeekBoard from "../../components/WeekBoard";
import { Avatar, Button, Card, Chip, Icons, Modal, Select, Spinner, TextInput } from "../../components/ui";
import type { LinkedAthlete } from "./CoachApp";
import ExerciseForm from "./ExerciseForm";
import PasteGrid from "./PasteGrid";
import { syncProgramForAthletePlan } from "../../lib/planSync";

/**
 * Trello-style plan editor: week blocks as pills, days as board columns
 * (single-day swipe view on phones). The plan itself carries the overall
 * timeline; each assigned athlete can override their start date.
 */
export default function PlanBoard({
  plan: initial,
  athletes,
  assignments: initialAssignments,
  onBack,
  onChanged,
}: {
  plan: Plan;
  athletes: LinkedAthlete[];
  assignments: PlanAssignment[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(initial);
  const [assignments, setAssignments] = useState<PlanAssignment[]>(initialAssignments);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(1);
  const [editing, setEditing] = useState<{ dayId: string; exercise: PlanExercise | null } | null>(null);
  const [pasteDayId, setPasteDayId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [busyWeek, setBusyWeek] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data: planRow }, { data: d }, { data: aRows }] = await Promise.all([
          supabase.from("plans").select("*").eq("id", initial.id).maybeSingle(),
          supabase.from("plan_days").select("*").eq("plan_id", initial.id).order("week_index").order("weekday"),
          supabase.from("plan_assignments").select("*").eq("plan_id", initial.id),
        ]);
        if (planRow) setPlan(planRow as Plan);
        const dayRows = (d as PlanDay[]) ?? [];
        setDays(dayRows);
        setAssignments((aRows as PlanAssignment[]) ?? []);
        if (dayRows.length > 0) {
          const { data: ex } = await supabase
            .from("plan_exercises")
            .select("*")
            .in("plan_day_id", dayRows.map((day) => day.id))
            .order("sort_order");
          setExercises((ex as PlanExercise[]) ?? []);
        } else {
          setExercises([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [initial.id],
  );

  useEffect(() => {
    load();
  }, [load]);
  useRealtime(`plan-board-${initial.id}`, ["plans", "plan_days", "plan_exercises", "plan_assignments"], () =>
    load(true),
  );

  async function updatePlan(patch: Partial<Plan>) {
    setPlan((p) => ({ ...p, ...patch }));
    await supabase.from("plans").update(patch).eq("id", plan.id);
    onChanged();
  }

  async function archivePlan() {
    if (!confirm(`Delete "${plan.name}"? Assigned athletes lose this plan (their logged sessions stay).`)) return;
    await supabase.from("plans").delete().eq("id", plan.id);
    onChanged();
    onBack();
  }

  /** Add a week block, copying days + exercises from the last week. */
  async function addWeek() {
    if (plan.weeks >= 104 || busyWeek) return;
    setBusyWeek(true);
    const newIndex = plan.weeks + 1;
    const template = days.filter((d) => d.week_index === plan.weeks);
    const inserts = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const src = template.find((d) => d.weekday === weekday);
      return {
        plan_id: plan.id,
        week_index: newIndex,
        weekday,
        title: src?.title ?? "Rest",
        day_type: src?.day_type ?? "rest",
      };
    });
    const { data: newDays } = await supabase.from("plan_days").insert(inserts).select();
    if (newDays) {
      const exInserts: Omit<PlanExercise, "id">[] = [];
      for (const nd of newDays as PlanDay[]) {
        const src = template.find((d) => d.weekday === nd.weekday);
        if (!src) continue;
        for (const ex of exercises.filter((e) => e.plan_day_id === src.id)) {
          const { id: _id, ...rest } = ex;
          exInserts.push({ ...rest, plan_day_id: nd.id });
        }
      }
      if (exInserts.length > 0) await supabase.from("plan_exercises").insert(exInserts);
    }
    await supabase.from("plans").update({ weeks: newIndex }).eq("id", plan.id);
    setWeek(newIndex);
    await load(true);
    setBusyWeek(false);
  }

  async function removeLastWeek() {
    if (plan.weeks <= 1 || busyWeek) return;
    if (!confirm(`Remove week ${plan.weeks} and everything in it?`)) return;
    setBusyWeek(true);
    await supabase.from("plan_days").delete().eq("plan_id", plan.id).eq("week_index", plan.weeks);
    await supabase.from("plans").update({ weeks: plan.weeks - 1 }).eq("id", plan.id);
    setWeek((w) => Math.min(w, plan.weeks - 1));
    await load(true);
    setBusyWeek(false);
  }

  async function updateDay(day: PlanDay, patch: Partial<PlanDay>) {
    setDays((cur) => cur.map((d) => (d.id === day.id ? { ...d, ...patch } : d)));
    await supabase.from("plan_days").update(patch).eq("id", day.id);
  }

  async function deleteExercise(id: string) {
    setExercises((cur) => cur.filter((e) => e.id !== id));
    await supabase.from("plan_exercises").delete().eq("id", id);
  }

  if (loading) return <Spinner />;

  const currentWeek = planWeekIndex(plan, new Date());
  const weekDays = days.filter((d) => (d.week_index ?? 1) === week);
  const editingDay = editing ? weekDays.find((d) => d.id === editing.dayId) : null;
  const assignedAthletes = assignments
    .map((a) => ({ assignment: a, linked: athletes.find((x) => x.athlete.id === a.athlete_id) }))
    .filter((x) => x.linked);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="back to plans">
          ‹ Plans
        </Button>
        <TextInput
          className="flex-1 text-base font-black"
          value={plan.name}
          onChange={(e) => setPlan({ ...plan, name: e.target.value })}
          onBlur={(e) => updatePlan({ name: e.target.value.trim() || "Training plan" })}
        />
        <Button variant="danger" onClick={archivePlan} aria-label="delete plan" className="px-3">
          {Icons.delete}
        </Button>
      </div>

      <Card className="mb-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-extrabold text-muted">
            Overall start
            <input
              type="date"
              className="mt-1 block rounded-xl border-2 border-line bg-inset px-2 py-1.5 text-sm font-bold text-ink outline-none focus:border-accent"
              value={plan.start_date}
              onChange={(e) => updatePlan({ start_date: e.target.value })}
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-extrabold text-muted">Athletes on this plan</p>
            <div className="flex items-center gap-1">
              <span className="flex -space-x-2">
                {assignedAthletes.slice(0, 5).map(({ linked }) => (
                  <span key={linked!.athlete.id} className="rounded-xl ring-2 ring-surface">
                    <Avatar name={linked!.athlete.display_name} avatar={linked!.athlete.avatar} size="sm" />
                  </span>
                ))}
              </span>
              <Button variant="secondary" className="ml-1 px-3 py-1 text-xs" onClick={() => setManageOpen(true)}>
                {assignedAthletes.length === 0 ? "Assign athletes" : "Manage"}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">
          {plan.weeks} week{plan.weeks === 1 ? "" : "s"}, cycling · overall timeline is in week {currentWeek} · athletes
          with their own start date follow their own week
        </p>
      </Card>

      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            onClick={() => setWeek(w)}
            className={`shrink-0 rounded-2xl border-2 px-3 py-1.5 text-xs font-extrabold transition ${
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
        {plan.weeks < 104 && (
          <button
            onClick={addWeek}
            disabled={busyWeek}
            title="Add a week (copies the last week so you can tweak the progression)"
            className="shrink-0 rounded-2xl border-2 border-dashed border-line bg-surface px-3 py-1.5 text-xs font-extrabold text-accent disabled:opacity-40"
          >
            + Week
          </button>
        )}
        {plan.weeks > 1 && (
          <button
            onClick={removeLastWeek}
            disabled={busyWeek}
            className="shrink-0 rounded-2xl px-2 py-1.5 text-xs font-extrabold text-danger"
          >
            − last
          </button>
        )}
      </div>

      <WeekBoard
        highlightWeekday={week === currentWeek ? isoWeekday(new Date()) : null}
        renderDay={(wd) => {
          const day = weekDays.find((d) => d.weekday === wd);
          if (!day) return <Card>Missing day</Card>;
          const dayExercises = exercises.filter((e) => e.plan_day_id === day.id);
          return (
            <>
              <Card className="p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-muted">
                    {WEEKDAY_LABELS[wd - 1]}
                  </span>
                  <Chip label={day.day_type} color={DAY_TYPE_COLORS[day.day_type]} />
                </div>
                <TextInput
                  className="mb-1"
                  value={day.title}
                  placeholder="Day title"
                  onChange={(e) => setDays((cur) => cur.map((d) => (d.id === day.id ? { ...d, title: e.target.value } : d)))}
                  onBlur={(e) => updateDay(day, { title: e.target.value })}
                />
                <Select
                  className="w-full"
                  value={day.day_type}
                  onChange={(v) => updateDay(day, { day_type: v as DayType })}
                  options={DAY_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </Card>

              {dayExercises.map((ex) => (
                <Card key={ex.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setEditing({ dayId: day.id, exercise: ex })}
                    >
                      <p className="truncate text-sm font-extrabold">{ex.name}</p>
                      <p className="text-xs font-semibold text-muted">{summarize(ex)}</p>
                      {ex.trainer_notes && <p className="truncate text-xs font-semibold text-accent">💬 {ex.trainer_notes}</p>}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExercise(ex.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-danger hover:bg-inset"
                      aria-label={`delete ${ex.name}`}
                    >
                      {Icons.delete}
                    </button>
                  </div>
                </Card>
              ))}

              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  className="flex-1 px-2 py-1.5 text-xs"
                  onClick={() => setEditing({ dayId: day.id, exercise: null })}
                >
                  + Exercise
                </Button>
                <Button variant="secondary" className="flex-1 px-2 py-1.5 text-xs" onClick={() => setPasteDayId(day.id)}>
                  <span className="inline-flex items-center gap-1">
                    {Icons.import}
                    Import
                  </span>
                </Button>
              </div>
            </>
          );
        }}
      />

      {editing && editingDay && (
        <Modal
          title={`${editing.exercise ? "Edit" : "Add"} exercise — ${WEEKDAY_LABELS[editingDay.weekday - 1]} W${week}`}
          onClose={() => setEditing(null)}
        >
          <ExerciseForm
            dayId={editing.dayId}
            exercise={editing.exercise}
            nextSortOrder={exercises.filter((e) => e.plan_day_id === editing.dayId).length}
            onDone={async () => {
              setEditing(null);
              await load(true);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {pasteDayId && (
        <PasteGrid
          dayId={pasteDayId}
          nextSortOrder={exercises.filter((e) => e.plan_day_id === pasteDayId).length}
          onDone={async () => {
            setPasteDayId(null);
            await load(true);
          }}
          onCancel={() => setPasteDayId(null)}
        />
      )}

      {manageOpen && (
        <ManageAthletesModal
          plan={plan}
          athletes={athletes}
          assignments={assignments}
          onClose={() => setManageOpen(false)}
          onChanged={async () => {
            await load(true);
            onChanged();
          }}
        />
      )}
    </>
  );
}

/**
 * Assign/unassign athletes and set per-athlete timelines. An empty start
 * date means "follow the plan's overall start".
 */
function ManageAthletesModal({
  plan,
  athletes,
  assignments,
  onClose,
  onChanged,
}: {
  plan: Plan;
  athletes: LinkedAthlete[];
  assignments: PlanAssignment[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(athleteId: string, assigned: PlanAssignment | undefined) {
    setBusy(athleteId);
    if (assigned) {
      await supabase.from("plan_assignments").delete().eq("id", assigned.id);
    } else {
      await supabase.from("plan_assignments").insert({ plan_id: plan.id, athlete_id: athleteId });
      await syncProgramForAthletePlan(plan.trainer_id, athleteId, plan, null);
    }
    await onChanged();
    setBusy(null);
  }

  async function setStart(assignment: PlanAssignment, value: string) {
    await supabase
      .from("plan_assignments")
      .update({ start_date: value || null })
      .eq("id", assignment.id);
    const athleteId = assignment.athlete_id;
    await syncProgramForAthletePlan(plan.trainer_id, athleteId, plan, value || null);
    await onChanged();
  }

  return (
    <Modal title="Athletes on this plan" onClose={onClose}>
      <p className="mb-3 text-xs font-semibold text-muted">
        Each athlete follows the plan's overall start ({plan.start_date}) unless you give them their own start date.
      </p>
      {athletes.length === 0 && <p className="text-sm font-bold text-muted">Link athletes first (Athletes view).</p>}
      <div className="flex flex-col gap-2">
        {athletes.map(({ athlete }) => {
          const assigned = assignments.find((a) => a.athlete_id === athlete.id);
          return (
            <div key={athlete.id} className="rounded-xl bg-inset p-3">
              <div className="flex items-center gap-3">
                <Avatar name={athlete.display_name} avatar={athlete.avatar} size="sm" />
                <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{athlete.display_name}</p>
                <Button
                  variant={assigned ? "danger" : "primary"}
                  className="px-3 py-1 text-xs"
                  disabled={busy === athlete.id}
                  onClick={() => toggle(athlete.id, assigned)}
                >
                  {assigned ? "Remove" : "Assign"}
                </Button>
              </div>
              {assigned && (
                <label className="mt-2 flex items-center gap-2 text-xs font-extrabold text-muted">
                  Own start
                  <input
                    type="date"
                    className="rounded-xl border-2 border-line bg-surface px-2 py-1 text-xs font-bold text-ink outline-none focus:border-accent"
                    value={assigned.start_date ?? ""}
                    onChange={(e) => setStart(assigned, e.target.value)}
                  />
                  {assigned.start_date ? (
                    <button type="button" className="font-black text-danger" onClick={() => setStart(assigned, "")}>
                      reset
                    </button>
                  ) : (
                    <span className="font-semibold">(= overall)</span>
                  )}
                </label>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function summarize(ex: PlanExercise): string {
  if (ex.log_type === "cardio") return "Cardio";
  if (ex.set_details?.length) {
    return ex.set_details.map((d) => `${d.reps}${d.weight_kg > 0 ? `@${d.weight_kg}` : ""}`).join(" / ");
  }
  return `${ex.target_sets} × ${ex.target_reps}${ex.target_weight_kg > 0 ? ` @ ${ex.target_weight_kg} kg` : ""}${
    ex.rest_sec > 0 ? ` · rest ${ex.rest_sec}s` : ""
  }`;
}

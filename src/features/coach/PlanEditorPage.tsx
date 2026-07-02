import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DAY_TYPES,
  DAY_TYPE_COLORS,
  WEEKDAY_LABELS,
  type DayType,
  type Plan,
  type PlanDay,
  type PlanExercise,
} from "../../lib/types";
import { Button, Card, Chip, EmptyState, Spinner, TextInput } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { AthletePicker, type LinkedAthlete } from "./CoachApp";
import ExerciseForm from "./ExerciseForm";
import PasteGrid from "./PasteGrid";

export default function PlanEditorPage({
  athletes,
  selectedId,
  onSelectAthlete,
}: {
  athletes: LinkedAthlete[];
  selectedId: string | null;
  onSelectAthlete: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [editing, setEditing] = useState<{ dayId: string; exercise: PlanExercise | null } | null>(null);
  const [pasteDayId, setPasteDayId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: plans } = await supabase
      .from("plans")
      .select("*")
      .eq("athlete_id", selectedId)
      .eq("is_active", true)
      .limit(1);
    const p = (plans?.[0] as Plan) ?? null;
    setPlan(p);
    if (p) {
      const { data: d } = await supabase.from("plan_days").select("*").eq("plan_id", p.id).order("weekday");
      const dayRows = (d as PlanDay[]) ?? [];
      setDays(dayRows);
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
    } else {
      setDays([]);
      setExercises([]);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createPlan() {
    if (!profile || !selectedId) return;
    const { data: p } = await supabase
      .from("plans")
      .insert({ trainer_id: profile.id, athlete_id: selectedId, name: "Training plan" })
      .select()
      .single();
    if (p) {
      // Seed all 7 weekdays as rest so the coach fills in training days.
      await supabase.from("plan_days").insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          plan_id: p.id,
          weekday,
          title: "Rest",
          day_type: "rest",
        })),
      );
      await load();
    }
  }

  async function updateDay(day: PlanDay, patch: Partial<PlanDay>) {
    await supabase.from("plan_days").update(patch).eq("id", day.id);
    setDays(days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)));
  }

  async function deleteExercise(id: string) {
    await supabase.from("plan_exercises").delete().eq("id", id);
    setExercises(exercises.filter((e) => e.id !== id));
  }

  if (athletes.length === 0) {
    return (
      <Card>
        <EmptyState title="Link an athlete first" subtitle="Create an invite code on the Athletes tab." />
      </Card>
    );
  }
  if (loading) return <Spinner />;

  return (
    <>
      <h1 className="mb-3 text-2xl font-black">Plan builder</h1>
      <AthletePicker athletes={athletes} selectedId={selectedId} onSelect={onSelectAthlete} />

      {!plan ? (
        <Card className="flex items-center justify-between">
          <p className="text-sm font-bold">No plan yet for this athlete.</p>
          <Button onClick={createPlan}>Create plan</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => {
            const dayExercises = exercises.filter((e) => e.plan_day_id === day.id);
            return (
              <Card key={day.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-10 text-sm font-black text-chip">{WEEKDAY_LABELS[day.weekday - 1]}</span>
                  <TextInput
                    className="flex-1"
                    value={day.title}
                    placeholder="Day title (e.g. Push day)"
                    onChange={(e) => setDays(days.map((d) => (d.id === day.id ? { ...d, title: e.target.value } : d)))}
                    onBlur={(e) => updateDay(day, { title: e.target.value })}
                  />
                  <select
                    className="rounded-xl border border-mint/60 bg-white px-2 py-2 text-xs font-extrabold"
                    value={day.day_type}
                    onChange={(e) => updateDay(day, { day_type: e.target.value as DayType })}
                  >
                    {DAY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Chip label={day.day_type} color={DAY_TYPE_COLORS[day.day_type]} />
                </div>

                {dayExercises.map((ex) => (
                  <div key={ex.id} className="mb-1 flex items-center gap-2 rounded-xl bg-mint-pale/50 px-3 py-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setEditing({ dayId: day.id, exercise: ex })}
                    >
                      <p className="truncate text-sm font-extrabold">{ex.name}</p>
                      <p className="text-xs font-semibold text-chip">
                        {ex.log_type === "cardio"
                          ? "Cardio"
                          : `${ex.target_sets} × ${ex.target_reps}${ex.target_weight_kg > 0 ? ` @ ${ex.target_weight_kg} kg` : ""}`}
                        {ex.rest_sec > 0 && ` · rest ${ex.rest_sec}s`}
                        {ex.trainer_notes && ` · ${ex.trainer_notes}`}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExercise(ex.id)}
                      className="text-xs font-extrabold text-red-400"
                      aria-label={`delete ${ex.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {editing?.dayId === day.id ? (
                  <ExerciseForm
                    dayId={day.id}
                    exercise={editing.exercise}
                    nextSortOrder={dayExercises.length}
                    onDone={async () => {
                      setEditing(null);
                      await load();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" onClick={() => setEditing({ dayId: day.id, exercise: null })}>
                      + Exercise
                    </Button>
                    <Button variant="ghost" onClick={() => setPasteDayId(day.id)}>
                      📋 Paste from Excel
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {pasteDayId && (
        <PasteGrid
          dayId={pasteDayId}
          nextSortOrder={exercises.filter((e) => e.plan_day_id === pasteDayId).length}
          onDone={async () => {
            setPasteDayId(null);
            await load();
          }}
          onCancel={() => setPasteDayId(null)}
        />
      )}
    </>
  );
}

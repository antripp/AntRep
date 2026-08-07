import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { syncProgramFromPlan } from "../../lib/planSync";
import type { AthletePlan, ProgressionExercise } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";

const SAMPLE_EXERCISES = [
  "Leg press",
  "Leg extension",
  "Lat pulldown",
  "Seated rows",
  "Inc chest press",
  "DB chest press",
];

export default function ProgressionExerciseEditor({
  coachLinkId,
  exercises,
  onChanged,
  activePlan,
}: {
  coachLinkId: string;
  exercises: ProgressionExercise[];
  onChanged: () => void;
  activePlan?: AthletePlan | null;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(exerciseName: string) {
    const trimmed = exerciseName.trim();
    if (!trimmed || exercises.some((e) => e.exercise_name.toLowerCase() === trimmed.toLowerCase())) return;
    setBusy(true);
    await supabase.from("progression_exercises").insert({
      coach_link_id: coachLinkId,
      exercise_name: trimmed,
      sort_order: exercises.length,
    });
    setName("");
    onChanged();
    setBusy(false);
  }

  async function remove(id: string) {
    await supabase.from("progression_exercises").delete().eq("id", id);
    onChanged();
  }

  async function move(id: string, dir: -1 | 1) {
    const i = exercises.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= exercises.length) return;
    const a = exercises[i];
    const b = exercises[j];
    await Promise.all([
      supabase.from("progression_exercises").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("progression_exercises").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    onChanged();
  }

  async function syncFromPlan() {
    if (!activePlan) return;
    setBusy(true);
    await syncProgramFromPlan(coachLinkId, activePlan.plan, activePlan.assignment.start_date);
    onChanged();
    setBusy(false);
  }

  return (
    <Card>
      <h3 className="mb-2 font-black">Progression exercises</h3>
      <p className="mb-3 text-xs font-semibold text-muted">Key lifts to track week over week.</p>

      {activePlan && (
        <Button variant="secondary" className="mb-3 w-full text-xs" onClick={syncFromPlan} disabled={busy}>
          Sync from plan ({activePlan.plan.name})
        </Button>
      )}

      {exercises.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {exercises.map((ex, i) => (
            <li key={ex.id} className="flex items-center gap-2 rounded-xl bg-inset px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{ex.exercise_name}</span>
              <button type="button" className="text-xs font-extrabold text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(ex.id, -1)}>↑</button>
              <button type="button" className="text-xs font-extrabold text-muted disabled:opacity-30" disabled={i === exercises.length - 1} onClick={() => move(ex.id, 1)}>↓</button>
              <button type="button" className="text-xs font-extrabold text-danger" onClick={() => remove(ex.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <TextInput
          className="flex-1"
          placeholder="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(name)}
        />
        <Button onClick={() => add(name)} disabled={busy || !name.trim()}>Add</Button>
      </div>

      {exercises.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_EXERCISES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border-2 border-line bg-surface px-3 py-1 text-xs font-extrabold text-muted transition hover:bg-inset"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

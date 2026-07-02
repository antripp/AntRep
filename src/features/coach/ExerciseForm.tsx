import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { LogType, PlanExercise } from "../../lib/types";
import { Button, TextInput } from "../../components/ui";

const LOG_TYPES: LogType[] = ["strength", "cardio", "timed"];

/** Inline create/edit form for one plan exercise. */
export default function ExerciseForm({
  dayId,
  exercise,
  nextSortOrder,
  onDone,
  onCancel,
}: {
  dayId: string;
  exercise: PlanExercise | null;
  nextSortOrder: number;
  onDone: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? "");
  const [logType, setLogType] = useState<LogType>(exercise?.log_type ?? "strength");
  const [sets, setSets] = useState(exercise?.target_sets ?? 3);
  const [reps, setReps] = useState(exercise?.target_reps ?? 10);
  const [weight, setWeight] = useState(exercise?.target_weight_kg ?? 0);
  const [rest, setRest] = useState(exercise?.rest_sec ?? 0);
  const [notes, setNotes] = useState(exercise?.trainer_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const row = {
      plan_day_id: dayId,
      name: name.trim(),
      log_type: logType,
      target_sets: sets,
      target_reps: reps,
      target_weight_kg: weight,
      rest_sec: rest,
      trainer_notes: notes.trim(),
    };
    if (exercise) {
      await supabase.from("plan_exercises").update(row).eq("id", exercise.id);
    } else {
      await supabase.from("plan_exercises").insert({ ...row, sort_order: nextSortOrder });
    }
    setBusy(false);
    await onDone();
  }

  return (
    <div className="mt-2 rounded-xl border-2 border-mint-pale p-3">
      <div className="flex flex-col gap-2">
        <TextInput placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-mint/60 bg-white px-2 py-2 text-xs font-extrabold"
            value={logType}
            onChange={(e) => setLogType(e.target.value as LogType)}
          >
            {LOG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {logType === "strength" && (
            <>
              <NumberField label="Sets" value={sets} onChange={setSets} />
              <NumberField label="Reps" value={reps} onChange={setReps} />
              <NumberField label="kg" value={weight} onChange={setWeight} step={0.5} />
            </>
          )}
          <NumberField label="Rest s" value={rest} onChange={setRest} step={15} />
        </div>
        <TextInput
          placeholder="Note for the athlete (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || !name.trim()}>
            {exercise ? "Save" : "Add"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-extrabold text-chip">
      {label}
      <input
        type="number"
        step={step}
        className="w-16 rounded-xl border border-mint/60 bg-white px-2 py-2 text-center text-sm font-extrabold text-ink outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

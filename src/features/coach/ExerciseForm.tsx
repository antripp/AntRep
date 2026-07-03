import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CustomField, LogType, PlanExercise, SetDetail } from "../../lib/types";
import { Button, NumInput, Select, TextInput } from "../../components/ui";

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
  const [breakdown, setBreakdown] = useState<SetDetail[]>(exercise?.set_details ?? []);
  const [fields, setFields] = useState<CustomField[]>(exercise?.custom_fields ?? []);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"number" | "text">("number");
  const [busy, setBusy] = useState(false);

  const useBreakdown = breakdown.length > 0;

  function toggleBreakdown() {
    if (useBreakdown) setBreakdown([]);
    else setBreakdown(Array.from({ length: Math.max(1, sets) }, () => ({ reps, weight_kg: weight })));
  }

  function resizeBreakdown(nextSets: number) {
    setSets(nextSets);
    if (!useBreakdown) return;
    setBreakdown((cur) => {
      const next = [...cur];
      while (next.length < nextSets) next.push(next[next.length - 1] ?? { reps, weight_kg: weight });
      return next.slice(0, Math.max(1, nextSets));
    });
  }

  function addField() {
    const label = newFieldLabel.trim();
    if (!label) return;
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!key || fields.some((f) => f.key === key)) return;
    setFields([...fields, { key, label, type: newFieldType }]);
    setNewFieldLabel("");
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const row = {
      plan_day_id: dayId,
      name: name.trim(),
      log_type: logType,
      target_sets: useBreakdown ? breakdown.length : sets,
      target_reps: reps,
      target_weight_kg: weight,
      rest_sec: rest,
      trainer_notes: notes.trim(),
      set_details: logType === "strength" ? breakdown : [],
      custom_fields: fields,
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
    <div className="mt-2 rounded-xl border-2 border-line p-3">
      <div className="flex flex-col gap-2">
        <TextInput placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={logType}
            onChange={setLogType}
            options={LOG_TYPES.map((t) => ({ value: t, label: t }))}
          />
          {logType === "strength" && (
            <>
              <NumberField label="Sets" value={useBreakdown ? breakdown.length : sets} onChange={resizeBreakdown} />
              {!useBreakdown && (
                <>
                  <NumberField label="Reps" value={reps} onChange={setReps} />
                  <NumberField label="kg" value={weight} onChange={setWeight} step={0.5} />
                </>
              )}
            </>
          )}
          <NumberField label="Rest s" value={rest} onChange={setRest} step={15} />
        </div>

        {logType === "strength" && (
          <label className="flex items-center gap-2 text-xs font-bold text-muted">
            <input type="checkbox" checked={useBreakdown} onChange={toggleBreakdown} />
            Different reps/weight per set (e.g. warm-up sets, drop sets)
          </label>
        )}

        {useBreakdown && logType === "strength" && (
          <div className="flex flex-col gap-1 rounded-xl bg-inset p-2">
            {breakdown.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 text-xs font-black text-muted">Set {i + 1}</span>
                <NumberField
                  label="reps"
                  value={d.reps}
                  onChange={(v) => setBreakdown(breakdown.map((x, j) => (j === i ? { ...x, reps: v } : x)))}
                />
                <NumberField
                  label="kg"
                  value={d.weight_kg}
                  step={0.5}
                  onChange={(v) => setBreakdown(breakdown.map((x, j) => (j === i ? { ...x, weight_kg: v } : x)))}
                />
              </div>
            ))}
          </div>
        )}

        <TextInput placeholder="Note for the athlete (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {/* Exercise-scoped custom fields — the athlete sees these when logging this exercise. */}
        <details className="rounded-xl bg-inset p-2" open={fields.length > 0}>
          <summary className="cursor-pointer text-xs font-extrabold text-muted">
            Custom data fields for this exercise ({fields.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between rounded-lg bg-surface px-2 py-1">
                <span className="text-xs font-bold">
                  {f.label} <span className="text-muted">({f.type})</span>
                </span>
                <button
                  type="button"
                  className="text-xs font-extrabold text-danger"
                  onClick={() => setFields(fields.filter((x) => x.key !== f.key))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="mt-1 flex gap-2">
              <TextInput
                placeholder="e.g. Incline %"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
              />
              <Select
                value={newFieldType}
                onChange={setNewFieldType}
                options={[
                  { value: "number", label: "number" },
                  { value: "text", label: "text" },
                ]}
              />
              <Button variant="secondary" onClick={addField} disabled={!newFieldLabel.trim()}>
                Add
              </Button>
            </div>
          </div>
        </details>

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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-extrabold text-muted">
      {label}
      <NumInput
        className="w-16 rounded-xl border-2 border-line bg-inset px-2 py-2 text-center text-sm font-extrabold text-ink outline-none focus:border-accent"
        value={value}
        onCommit={onChange}
      />
    </label>
  );
}

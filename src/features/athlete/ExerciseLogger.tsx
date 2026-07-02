import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CustomField, PlanExercise, Session, SetLog } from "../../lib/types";
import { Button, Stepper, TextInput } from "../../components/ui";

/**
 * Inline set logger for one exercise. Strength shows weight/reps steppers,
 * cardio shows distance/duration, timed shows duration — plus any
 * coach-defined custom fields. Every "Log set" writes straight to Supabase.
 */
export default function ExerciseLogger({
  session,
  exercise,
  logs,
  customFields,
  onChanged,
}: {
  session: Session;
  exercise: PlanExercise;
  logs: SetLog[];
  customFields: CustomField[];
  onChanged: () => Promise<void> | void;
}) {
  const last = logs[logs.length - 1];
  const [weight, setWeight] = useState<number>(last?.weight_kg ?? exercise.target_weight_kg ?? 0);
  const [reps, setReps] = useState<number>(last?.reps ?? exercise.target_reps ?? 10);
  const [distanceKm, setDistanceKm] = useState<number>(last?.distance_km ?? 0);
  const [durationMin, setDurationMin] = useState<number>(last ? Math.round((last.duration_sec ?? 0) / 60) : 0);
  const [rpe, setRpe] = useState<number>(last?.rpe ?? 0);
  const [extra, setExtra] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextIndex = (logs[logs.length - 1]?.set_index ?? 0) + 1;
  const isCardio = exercise.log_type === "cardio";
  const isTimed = exercise.log_type === "timed";

  async function logSet() {
    setBusy(true);
    setError(null);
    const row = {
      session_id: session.id,
      plan_exercise_id: exercise.id,
      exercise_name: exercise.name,
      set_index: nextIndex,
      weight_kg: isCardio || isTimed ? null : weight,
      reps: isCardio || isTimed ? null : reps,
      rpe: rpe > 0 ? rpe : null,
      distance_km: isCardio && distanceKm > 0 ? distanceKm : null,
      duration_sec: (isCardio || isTimed) && durationMin > 0 ? durationMin * 60 : null,
      extra,
    };
    const { error: err } = await supabase.from("set_logs").insert(row);
    if (err) setError(err.message);
    else await onChanged();
    setBusy(false);
  }

  async function removeSet(id: string) {
    await supabase.from("set_logs").delete().eq("id", id);
    await onChanged();
  }

  return (
    <div className="mt-3 border-t border-mint-pale pt-3">
      {logs.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-xl bg-mint-pale/60 px-3 py-1.5">
              <span className="text-sm font-bold">
                Set {l.set_index} ·{" "}
                {isCardio
                  ? `${l.distance_km ?? 0} km · ${Math.round((l.duration_sec ?? 0) / 60)} min`
                  : isTimed
                    ? `${Math.round((l.duration_sec ?? 0) / 60)} min`
                    : `${l.weight_kg ?? 0} kg × ${l.reps ?? 0}`}
                {l.rpe ? ` · RPE ${l.rpe}` : ""}
              </span>
              <button
                type="button"
                onClick={() => removeSet(l.id)}
                className="text-xs font-extrabold text-red-400"
                aria-label={`delete set ${l.set_index}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {!isCardio && !isTimed && (
          <>
            <LabeledControl label="Weight">
              <Stepper value={weight} onChange={setWeight} step={2.5} suffix="kg" decimals={1} />
            </LabeledControl>
            <LabeledControl label="Reps">
              <Stepper value={reps} onChange={setReps} />
            </LabeledControl>
          </>
        )}
        {isCardio && (
          <LabeledControl label="Distance">
            <Stepper value={distanceKm} onChange={setDistanceKm} step={0.5} suffix="km" decimals={1} />
          </LabeledControl>
        )}
        {(isCardio || isTimed) && (
          <LabeledControl label="Duration">
            <Stepper value={durationMin} onChange={setDurationMin} suffix="min" />
          </LabeledControl>
        )}
        <LabeledControl label="RPE (optional)">
          <Stepper value={rpe} onChange={(v) => setRpe(Math.min(10, v))} />
        </LabeledControl>
        {customFields.map((f) => (
          <LabeledControl key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label}>
            <TextInput
              type={f.type === "number" ? "number" : "text"}
              className="w-28"
              value={String(extra[f.key] ?? "")}
              onChange={(e) =>
                setExtra({
                  ...extra,
                  [f.key]: f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                })
              }
            />
          </LabeledControl>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
      <Button className="mt-3 w-full" onClick={logSet} disabled={busy}>
        {busy ? "…" : `Log set ${nextIndex}`}
      </Button>
    </div>
  );
}

function LabeledControl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-chip">{label}</p>
      {children}
    </div>
  );
}

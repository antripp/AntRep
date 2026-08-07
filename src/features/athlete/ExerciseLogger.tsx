import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  setTarget,
  type CustomField,
  type LogType,
  type PlanExercise,
  type Session,
  type SetLog,
} from "../../lib/types";
import { Button, Modal, Stepper, TextInput } from "../../components/ui";

/**
 * Inline set logger for one exercise (planned or athlete's own).
 * Writes are optimistic-feeling: each insert returns the row and the
 * parent merges it into state — no page reload, realtime keeps other
 * devices in sync.
 */
export default function ExerciseLogger({
  session,
  name,
  logType,
  planExercise = null,
  logs,
  customFields,
  onSaved,
  onDeleted,
}: {
  session: Session;
  name: string;
  logType: LogType;
  planExercise?: PlanExercise | null;
  logs: SetLog[];
  customFields: CustomField[];
  onSaved: (row: SetLog) => void;
  onDeleted: (id: string) => void;
}) {
  const last = logs[logs.length - 1];
  const nextIndex = (last?.set_index ?? 0) + 1;
  const isCardio = logType === "cardio";
  const isTimed = logType === "timed";

  // Suggested values follow the coach's per-set breakdown (if any), else
  // the last logged set, else the exercise target. Overrides reset after
  // each logged set so set 2 picks up its own prescription.
  const prescribed = planExercise ? setTarget(planExercise, nextIndex) : null;
  const hasBreakdown = (planExercise?.set_details?.length ?? 0) > 0;
  const suggestedWeight = hasBreakdown ? prescribed!.weight_kg : (last?.weight_kg ?? prescribed?.weight_kg ?? 0);
  const suggestedReps = hasBreakdown ? prescribed!.reps : (last?.reps ?? prescribed?.reps ?? 10);

  const [weightOverride, setWeightOverride] = useState<number | null>(null);
  const [repsOverride, setRepsOverride] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(last?.distance_km ?? 0);
  const [durationMin, setDurationMin] = useState<number>(last ? Math.round((last.duration_sec ?? 0) / 60) : 0);
  const [rpe, setRpe] = useState<number>(0);
  const [pain, setPain] = useState<number>(0);
  const [setNote, setSetNote] = useState("");
  const [calories, setCalories] = useState<number>(0);
  const [extra, setExtra] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRpeHelp, setShowRpeHelp] = useState(false);

  const weight = weightOverride ?? suggestedWeight;
  const reps = repsOverride ?? suggestedReps;

  async function logSet() {
    setBusy(true);
    setError(null);
    const row = {
      session_id: session.id,
      plan_exercise_id: planExercise?.id ?? null,
      exercise_name: name,
      set_index: nextIndex,
      weight_kg: isCardio || isTimed ? null : weight,
      reps: isCardio || isTimed ? null : reps,
      rpe: rpe > 0 ? rpe : null,
      pain: pain > 0 ? pain : null,
      note: setNote.trim(),
      distance_km: isCardio && distanceKm > 0 ? distanceKm : null,
      duration_sec: (isCardio || isTimed) && durationMin > 0 ? durationMin * 60 : null,
      calories: calories > 0 ? calories : null,
      extra,
    };
    const { data, error: err } = await supabase.from("set_logs").insert(row).select().single();
    if (err || !data) {
      setError(err?.message ?? "Couldn't save the set — try again.");
    } else {
      onSaved(data as SetLog);
      // Next set follows its own prescription again.
      setWeightOverride(null);
      setRepsOverride(null);
      setRpe(0);
      setPain(0);
      setSetNote("");
      setCalories(0);
      setExtra({});
    }
    setBusy(false);
  }

  async function removeSet(id: string) {
    onDeleted(id); // optimistic — realtime will reconcile if this fails
    await supabase.from("set_logs").delete().eq("id", id);
  }

  return (
    <div className="mt-3 border-t-2 border-line pt-3">
      {logs.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-xl bg-inset px-3 py-1.5">
              <span className="text-sm font-bold">
                Set {l.set_index} ·{" "}
                {isCardio
                  ? `${l.distance_km ?? 0} km · ${Math.round((l.duration_sec ?? 0) / 60)} min`
                  : isTimed
                    ? `${Math.round((l.duration_sec ?? 0) / 60)} min`
                    : `${l.weight_kg ?? 0} kg × ${l.reps ?? 0}`}
                {l.rpe ? ` · RPE ${l.rpe}` : ""}
                {l.pain ? ` · Pain ${l.pain}` : ""}
                {l.note ? ` · "${l.note}"` : ""}
                {l.calories ? ` · ${l.calories} kcal` : ""}
              </span>
              <button
                type="button"
                onClick={() => removeSet(l.id)}
                className="text-xs font-extrabold text-danger"
                aria-label={`delete set ${l.set_index}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasBreakdown && nextIndex <= (planExercise?.set_details.length ?? 0) && (
        <p className="mb-2 text-xs font-bold text-accent">
          Coach's set {nextIndex}: {prescribed!.reps} reps
          {prescribed!.weight_kg > 0 ? ` @ ${prescribed!.weight_kg} kg` : ""}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {!isCardio && !isTimed && (
          <>
            <LabeledControl label="Weight">
              <Stepper value={weight} onChange={setWeightOverride} step={2.5} suffix="kg" decimals={1} />
            </LabeledControl>
            <LabeledControl label="Reps">
              <Stepper value={reps} onChange={setRepsOverride} />
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
        <LabeledControl
          label={
            <>
              RPE{" "}
              <button
                type="button"
                onClick={() => setShowRpeHelp(true)}
                aria-label="what is RPE?"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[10px] font-black text-accent"
              >
                ?
              </button>
            </>
          }
        >
          <Stepper value={rpe} onChange={(v) => setRpe(Math.min(10, v))} />
        </LabeledControl>
        <LabeledControl label="kcal (optional)">
          <Stepper value={calories} onChange={setCalories} step={10} />
        </LabeledControl>
        {!isCardio && !isTimed && (
          <LabeledControl label="Pain (0–10)">
            <Stepper value={pain} onChange={(v) => setPain(Math.min(10, v))} />
          </LabeledControl>
        )}
        <LabeledControl label="Set note">
          <TextInput
            className="w-40"
            placeholder="Optional"
            value={setNote}
            onChange={(e) => setSetNote(e.target.value)}
          />
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

      {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
      <Button className="mt-3 w-full" onClick={logSet} disabled={busy}>
        {busy ? "…" : `Log set ${nextIndex}`}
      </Button>

      {showRpeHelp && <RpeHelp onClose={() => setShowRpeHelp(false)} />}
    </div>
  );
}

/** Plain-language RPE explainer so athletes log what the coach expects. */
function RpeHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["1–3", "Warm-up easy. You could chat through the whole set."],
    ["4–5", "Comfortable work. Plenty of reps left in the tank."],
    ["6–7", "Challenging but controlled. ~3 clean reps left."],
    ["8", "Hard. You had about 2 reps left."],
    ["9", "Very hard. Maybe 1 rep left."],
    ["10", "Max effort. Nothing left — form was on the edge."],
  ];
  return (
    <Modal title="What's RPE?" onClose={onClose}>
      <p className="mb-3 text-sm font-semibold text-muted">
        RPE (Rate of Perceived Exertion) tells your coach how hard a set{" "}
        <em>felt</em>, from 1–10. Log it after your last rep — it's how your
        coach knows whether to bump the weight next week.
      </p>
      <div className="flex flex-col gap-1">
        {rows.map(([score, text]) => (
          <div key={score} className="flex items-start gap-3 rounded-xl bg-inset px-3 py-2">
            <span className="w-9 shrink-0 text-sm font-black text-accent">{score}</span>
            <span className="text-xs font-semibold">{text}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">
        Calories are optional too — if your watch or app tracked them, add them
        per exercise or for the whole session on the summary screen.
      </p>
    </Modal>
  );
}

function LabeledControl({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

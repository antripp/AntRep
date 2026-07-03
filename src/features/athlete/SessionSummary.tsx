import { useState } from "react";
import type { CustomField, PlanExercise, Session, SetLog } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";

/** Post-workout completion summary (no progression analytics by design). */
export default function SessionSummary({
  session,
  exercises,
  logs,
  customFields,
  onReopen,
  onSaveCalories,
}: {
  session: Session;
  exercises: PlanExercise[];
  logs: SetLog[];
  customFields: CustomField[];
  onReopen?: () => void;
  onSaveCalories?: (calories: number | null) => void;
}) {
  const byExercise = new Map<string, SetLog[]>();
  for (const l of logs) {
    const arr = byExercise.get(l.exercise_name) ?? [];
    arr.push(l);
    byExercise.set(l.exercise_name, arr);
  }
  for (const arr of byExercise.values()) arr.sort((a, b) => a.set_index - b.set_index);

  // Own sessions have no plan; treat every logged exercise as "done".
  const exerciseNames = exercises.length > 0 ? exercises.map((e) => e.name) : [...byExercise.keys()];
  const doneExercises =
    exercises.length > 0
      ? exercises.filter((ex) => (byExercise.get(ex.name)?.length ?? 0) >= ex.target_sets).length
      : byExercise.size;
  const totalVolume = logs.reduce((acc, l) => acc + (l.weight_kg ?? 0) * (l.reps ?? 0), 0);
  const totalDistance = logs.reduce((acc, l) => acc + (l.distance_km ?? 0), 0);
  const loggedCalories = logs.reduce((acc, l) => acc + (l.calories ?? 0), 0);
  const durationMin =
    session.ended_at != null
      ? Math.max(1, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000))
      : null;

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-done-deep bg-done text-white">
        <div className="flex items-center gap-4">
          <img src="/mascots/athlete-mascot.png" alt="" className="h-16 w-16" />
          <div>
            <p className="text-lg font-black">Session complete! 🎉</p>
            <p className="text-sm font-bold opacity-90">
              {doneExercises}/{exerciseNames.length} exercises · {logs.length} sets
              {durationMin != null && ` · ${durationMin} min`}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total volume" value={`${Math.round(totalVolume)} kg`} />
        {totalDistance > 0 ? (
          <Stat label="Distance" value={`${totalDistance.toFixed(1)} km`} />
        ) : (
          <Stat label="Sets logged" value={String(logs.length)} />
        )}
      </div>

      {onSaveCalories && (
        <CaloriesCard
          initial={session.calories}
          perExercise={loggedCalories}
          onSave={onSaveCalories}
        />
      )}

      <Card>
        <h2 className="mb-2 font-black">What you logged</h2>
        <div className="flex flex-col gap-2">
          {exerciseNames.map((exName) => {
            const planned = exercises.find((e) => e.name === exName);
            const sets = byExercise.get(exName) ?? [];
            return (
              <div key={exName} className="rounded-xl bg-inset px-3 py-2">
                <p className="text-sm font-extrabold">{exName}</p>
                {sets.length === 0 ? (
                  <p className="text-xs font-semibold text-muted">Skipped</p>
                ) : (
                  <p className="text-xs font-semibold text-muted">
                    {sets
                      .map((l) =>
                        planned?.log_type === "cardio" || l.distance_km != null
                          ? `${l.distance_km ?? 0} km / ${Math.round((l.duration_sec ?? 0) / 60)} min`
                          : planned?.log_type === "timed" || (l.duration_sec != null && l.weight_kg == null)
                            ? `${Math.round((l.duration_sec ?? 0) / 60)} min`
                            : `${l.weight_kg ?? 0}×${l.reps ?? 0}`,
                      )
                      .join(" · ")}
                    {customFields
                      .filter((f) => sets.some((l) => l.extra?.[f.key] != null && l.extra[f.key] !== ""))
                      .map((f) => ` · ${f.label}: ${sets.map((l) => l.extra?.[f.key] ?? "–").join("/")}`)
                      .join("")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {onReopen && (
        <Button variant="secondary" onClick={onReopen}>
          Reopen session
        </Button>
      )}
    </div>
  );
}

/** Optional whole-session calories (e.g. from a watch). */
function CaloriesCard({
  initial,
  perExercise,
  onSave,
}: {
  initial: number | null;
  perExercise: number;
  onSave: (calories: number | null) => void;
}) {
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Calories (optional)</p>
          <p className="mb-2 text-xs font-semibold text-muted">
            {perExercise > 0
              ? `You logged ${perExercise} kcal across exercises — add a session total if you tracked one.`
              : "Tracked it on a watch or app? Add the session total for your coach."}
          </p>
          <TextInput
            type="number"
            inputMode="numeric"
            placeholder="e.g. 450"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            onSave(value.trim() === "" ? null : Math.max(0, Math.round(Number(value) || 0)));
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? "✓" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
    </Card>
  );
}

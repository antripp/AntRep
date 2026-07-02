import type { CustomField, PlanExercise, Session, SetLog } from "../../lib/types";
import { Button, Card } from "../../components/ui";

/** Post-workout completion summary (no progression analytics by design). */
export default function SessionSummary({
  session,
  exercises,
  logs,
  customFields,
  onReopen,
}: {
  session: Session;
  exercises: PlanExercise[];
  logs: SetLog[];
  customFields: CustomField[];
  onReopen?: () => void;
}) {
  const byExercise = new Map<string, SetLog[]>();
  for (const l of logs) {
    const arr = byExercise.get(l.exercise_name) ?? [];
    arr.push(l);
    byExercise.set(l.exercise_name, arr);
  }
  for (const arr of byExercise.values()) arr.sort((a, b) => a.set_index - b.set_index);

  const doneExercises = exercises.filter(
    (ex) => (byExercise.get(ex.name)?.length ?? 0) >= ex.target_sets,
  ).length;
  const totalVolume = logs.reduce((acc, l) => acc + (l.weight_kg ?? 0) * (l.reps ?? 0), 0);
  const totalDistance = logs.reduce((acc, l) => acc + (l.distance_km ?? 0), 0);
  const durationMin =
    session.ended_at != null
      ? Math.max(
          1,
          Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000),
        )
      : null;

  return (
    <div className="flex flex-col gap-3">
      <Card className="bg-done text-white">
        <div className="flex items-center gap-4">
          <img src="/mascots/athlete-mascot.png" alt="" className="h-16 w-16" />
          <div>
            <p className="text-lg font-black">Session complete! 🎉</p>
            <p className="text-sm font-bold opacity-90">
              {doneExercises}/{exercises.length} exercises · {logs.length} sets
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

      <Card>
        <h2 className="mb-2 font-black">What you logged</h2>
        <div className="flex flex-col gap-2">
          {exercises.map((ex) => {
            const sets = byExercise.get(ex.name) ?? [];
            return (
              <div key={ex.id} className="rounded-xl bg-mint-pale/50 px-3 py-2">
                <p className="text-sm font-extrabold">{ex.name}</p>
                {sets.length === 0 ? (
                  <p className="text-xs font-semibold text-chip">Skipped</p>
                ) : (
                  <p className="text-xs font-semibold text-chip">
                    {sets
                      .map((l) =>
                        ex.log_type === "cardio"
                          ? `${l.distance_km ?? 0} km / ${Math.round((l.duration_sec ?? 0) / 60)} min`
                          : ex.log_type === "timed"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs font-extrabold uppercase tracking-wide text-chip">{label}</p>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DAY_TYPE_COLORS,
  isoWeekday,
  localDateString,
  type CustomField,
  type PlanDay,
  type PlanExercise,
  type Session,
  type SetLog,
} from "../../lib/types";
import { Button, Card, CheckCircle, Chip, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import ExerciseLogger from "./ExerciseLogger";
import SessionSummary from "./SessionSummary";

export default function TodayPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [openExercise, setOpenExercise] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const dateStr = localDateString(today);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Coach's custom logging fields (readable via RLS when actively linked).
    const { data: settings } = await supabase.from("coach_settings").select("custom_fields");
    setCustomFields((settings?.[0]?.custom_fields as CustomField[]) ?? []);

    const { data: plans } = await supabase
      .from("plans")
      .select("id")
      .eq("athlete_id", profile.id)
      .eq("is_active", true)
      .limit(1);
    setHasPlan(Boolean(plans && plans.length > 0));

    let day: PlanDay | null = null;
    if (plans && plans.length > 0) {
      const { data: days } = await supabase
        .from("plan_days")
        .select("*")
        .eq("plan_id", plans[0].id)
        .eq("weekday", isoWeekday(today))
        .order("sort_order")
        .limit(1);
      day = (days?.[0] as PlanDay) ?? null;
    }
    setPlanDay(day);

    if (day) {
      const { data: exs } = await supabase
        .from("plan_exercises")
        .select("*")
        .eq("plan_day_id", day.id)
        .order("sort_order");
      setExercises((exs as PlanExercise[]) ?? []);
    } else {
      setExercises([]);
    }

    // Today's session (if started).
    let query = supabase.from("sessions").select("*").eq("athlete_id", profile.id).eq("date", dateStr);
    query = day ? query.eq("plan_day_id", day.id) : query.is("plan_day_id", null);
    const { data: sessions } = await query.limit(1);
    const s = (sessions?.[0] as Session) ?? null;
    setSession(s);

    if (s) {
      const { data: logRows } = await supabase.from("set_logs").select("*").eq("session_id", s.id);
      setLogs((logRows as SetLog[]) ?? []);
    } else {
      setLogs([]);
    }
    setLoading(false);
  }, [profile, dateStr, today]);

  useEffect(() => {
    load();
  }, [load]);

  async function startSession() {
    if (!profile) return;
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        athlete_id: profile.id,
        plan_day_id: planDay?.id ?? null,
        day_title: planDay?.title || "Workout",
        date: dateStr,
      })
      .select()
      .single();
    if (!error) setSession(data as Session);
  }

  async function finishSession() {
    if (!session) return;
    const { data } = await supabase
      .from("sessions")
      .update({ status: "complete", ended_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single();
    if (data) setSession(data as Session);
  }

  async function reopenSession() {
    if (!session) return;
    const { data } = await supabase
      .from("sessions")
      .update({ status: "in_progress", ended_at: null })
      .eq("id", session.id)
      .select()
      .single();
    if (data) setSession(data as Session);
  }

  const logsByExercise = useMemo(() => {
    const map = new Map<string, SetLog[]>();
    for (const l of logs) {
      const arr = map.get(l.exercise_name) ?? [];
      arr.push(l);
      map.set(l.exercise_name, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.set_index - b.set_index);
    return map;
  }, [logs]);

  const doneCount = exercises.filter(
    (ex) => (logsByExercise.get(ex.name)?.length ?? 0) >= ex.target_sets,
  ).length;

  if (loading) return <Spinner />;

  const heading = (
    <header className="mb-4">
      <p className="text-sm font-bold text-ink/60">
        {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black">{planDay?.title || "Today"}</h1>
        {planDay && <Chip label={planDay.day_type} color={DAY_TYPE_COLORS[planDay.day_type]} />}
      </div>
    </header>
  );

  if (!hasPlan) {
    return (
      <>
        {heading}
        <Card>
          <EmptyState
            mascot
            title="No plan yet"
            subtitle="Ask your coach for an invite code and link up in Settings — your plan will show up here."
          />
        </Card>
      </>
    );
  }

  if (!planDay || planDay.day_type === "rest" || exercises.length === 0) {
    return (
      <>
        {heading}
        <Card>
          <EmptyState
            mascot
            title={planDay?.day_type === "rest" ? "Rest day" : "Nothing scheduled today"}
            subtitle={
              planDay?.day_type === "rest"
                ? "Recovery is training too. See you tomorrow!"
                : "Check the Week tab to see what's coming up."
            }
          />
        </Card>
      </>
    );
  }

  if (session?.status === "complete") {
    return (
      <>
        {heading}
        <SessionSummary
          session={session}
          exercises={exercises}
          logs={logs}
          customFields={customFields}
          onReopen={reopenSession}
        />
      </>
    );
  }

  return (
    <>
      {heading}

      {!session ? (
        <Card className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-extrabold">
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"} planned
            </p>
            <p className="text-xs font-semibold text-chip">Tap start when you're at the gym.</p>
          </div>
          <Button onClick={startSession}>Start workout</Button>
        </Card>
      ) : (
        <Card className="mb-4 flex items-center justify-between">
          <p className="text-sm font-extrabold">
            {doneCount}/{exercises.length} done
          </p>
          <Button variant={doneCount === exercises.length ? "primary" : "secondary"} onClick={finishSession}>
            Finish session
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {exercises.map((ex) => {
          const exLogs = logsByExercise.get(ex.name) ?? [];
          const done = exLogs.length >= ex.target_sets;
          const open = openExercise === ex.id;
          return (
            <Card key={ex.id} className={done ? "ring-2 ring-done/60" : ""}>
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => setOpenExercise(open ? null : ex.id)}
                disabled={!session}
              >
                <CheckCircle done={done} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{ex.name}</p>
                  <p className="text-xs font-semibold text-chip">
                    {ex.log_type === "cardio"
                      ? "Cardio"
                      : `${ex.target_sets} × ${ex.target_reps}${ex.target_weight_kg > 0 ? ` @ ${ex.target_weight_kg} kg` : ""}`}
                    {ex.rest_sec > 0 && ` · rest ${ex.rest_sec}s`}
                  </p>
                  {ex.trainer_notes && (
                    <p className="mt-0.5 text-xs font-semibold text-mint-deep">💬 {ex.trainer_notes}</p>
                  )}
                </div>
                <span className="text-xs font-extrabold text-chip">
                  {exLogs.length}/{ex.target_sets}
                </span>
              </button>
              {open && session && (
                <ExerciseLogger
                  session={session}
                  exercise={ex}
                  logs={exLogs}
                  customFields={customFields}
                  onChanged={load}
                />
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

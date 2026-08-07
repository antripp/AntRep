import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  activeAthletePlans,
  DAY_TYPE_COLORS,
  isoWeekday,
  localDateString,
  planWeekIndex,
  type CustomField,
  type LogType,
  type Plan,
  type PlanDay,
  type PlanExercise,
  type Session,
  type SetLog,
} from "../../lib/types";
import { fetchAthletePlans } from "../../lib/athletePlans";
import { dailyQuote } from "../../lib/quotes";
import { useRealtime } from "../../lib/useRealtime";
import { MigrationNotice } from "../../components/MigrationNotice";
import { Button, Card, CheckCircle, Chip, EmptyState, Modal, Segmented, Spinner, TextInput } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import ExerciseLogger from "./ExerciseLogger";
import SessionSummary from "./SessionSummary";

/** One coach's slice of today: their plan day + exercises. */
interface Segment {
  plan: Plan;
  coachName: string;
  day: PlanDay;
  exercises: PlanExercise[];
  coachFields: CustomField[];
}

export default function TodayPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasPlans, setHasPlans] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [ownExercises, setOwnExercises] = useState<Record<string, { name: string; logType: LogType }[]>>({});
  const [schemaOld, setSchemaOld] = useState(false);

  const today = useMemo(() => new Date(), []);
  const dateStr = localDateString(today);
  const weekday = isoWeekday(today);

  const load = useCallback(
    async (silent = false) => {
      if (!profile) return;
      if (!silent) setLoading(true);
      try {
      const [{ plans: allPlans, coachNames, schemaOld: outdated }, { data: settingsRows }] = await Promise.all([
        fetchAthletePlans(profile.id),
        supabase.from("coach_settings").select("trainer_id, custom_fields"),
      ]);
      setSchemaOld(outdated);
      setHasPlans(allPlans.length > 0);
      // Auto-switch: per coach, the newest-starting assigned plan applies today.
      const active = activeAthletePlans(allPlans, today);
      const fieldsByTrainer = new Map<string, CustomField[]>(
        ((settingsRows as { trainer_id: string; custom_fields: CustomField[] }[]) ?? []).map((s) => [
          s.trainer_id,
          s.custom_fields ?? [],
        ]),
      );

      // Today's day for each active plan, honouring the athlete's own timeline.
      let dayRows: PlanDay[] = [];
      if (active.length > 0) {
        const { data } = await supabase
          .from("plan_days")
          .select("*")
          .in("plan_id", active.map((ap) => ap.plan.id))
          .eq("weekday", weekday);
        dayRows = (data as PlanDay[]) ?? [];
      }
      const todaysDays = active
        .map((ap) => ({
          plan: ap.plan,
          day:
            dayRows.find(
              (d) => d.plan_id === ap.plan.id && (d.week_index ?? 1) === planWeekIndex(ap.plan, today, ap.start),
            ) ?? null,
        }))
        .filter((x): x is { plan: Plan; day: PlanDay } => x.day !== null);

      let exercises: PlanExercise[] = [];
      if (todaysDays.length > 0) {
        const { data } = await supabase
          .from("plan_exercises")
          .select("*")
          .in("plan_day_id", todaysDays.map((x) => x.day.id))
          .order("sort_order");
        exercises = (data as PlanExercise[]) ?? [];
      }

      setSegments(
        todaysDays.map(({ plan, day }) => ({
          plan,
          day,
          coachName: coachNames.get(plan.trainer_id) ?? "Coach",
          exercises: exercises.filter((e) => e.plan_day_id === day.id),
          coachFields: fieldsByTrainer.get(plan.trainer_id) ?? [],
        })),
      );

      const { data: sessionRows } = await supabase
        .from("sessions")
        .select("*")
        .eq("athlete_id", profile.id)
        .eq("date", dateStr)
        .order("started_at");
      const todaySessions = (sessionRows as Session[]) ?? [];
      setSessions(todaySessions);

      if (todaySessions.length > 0) {
        const { data: logRows } = await supabase
          .from("set_logs")
          .select("*")
          .in("session_id", todaySessions.map((s) => s.id));
        setLogs((logRows as SetLog[]) ?? []);
      } else {
        setLogs([]);
      }
      } finally {
        setLoading(false);
      }
    },
    [profile, dateStr, weekday, today],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live sync — silent refetch, no spinner, no page reload.
  useRealtime(
    "athlete-today",
    ["sessions", "set_logs", "plans", "plan_days", "plan_exercises", "plan_assignments", "coach_links", "coach_settings"],
    () => load(true),
  );

  const logsBySession = useMemo(() => {
    const map = new Map<string, SetLog[]>();
    for (const l of logs) {
      const arr = map.get(l.session_id) ?? [];
      arr.push(l);
      map.set(l.session_id, arr);
    }
    return map;
  }, [logs]);

  function mergeLog(row: SetLog) {
    setLogs((prev) => (prev.some((l) => l.id === row.id) ? prev : [...prev, row]));
  }
  function dropLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }
  function mergeSession(row: Session) {
    setSessions((prev) => {
      const i = prev.findIndex((s) => s.id === row.id);
      if (i === -1) return [...prev, row];
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }

  async function startSession(segment: Segment | null, title?: string) {
    if (!profile) return;
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        athlete_id: profile.id,
        plan_day_id: segment?.day.id ?? null,
        day_title: segment?.day.title || title || "My workout",
        date: dateStr,
      })
      .select()
      .single();
    if (!error && data) mergeSession(data as Session);
  }

  async function setSessionStatus(session: Session, status: "in_progress" | "complete") {
    const { data } = await supabase
      .from("sessions")
      .update({ status, ended_at: status === "complete" ? new Date().toISOString() : null })
      .eq("id", session.id)
      .select()
      .single();
    if (data) mergeSession(data as Session);
  }

  async function saveCalories(session: Session, calories: number | null) {
    const { data } = await supabase.from("sessions").update({ calories }).eq("id", session.id).select().single();
    if (data) mergeSession(data as Session);
  }

  async function saveAthleteNotes(session: Session, notes: string) {
    const { data } = await supabase
      .from("sessions")
      .update({ athlete_notes: notes })
      .eq("id", session.id)
      .select()
      .single();
    if (data) mergeSession(data as Session);
  }

  if (loading) return <Spinner />;

  const customSessions = sessions.filter((s) => s.plan_day_id === null);

  return (
    <>
      {!embedded && (
        <header className="mb-6">
          <p className="text-sm font-bold text-muted">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-black">
            {greeting(today.getHours())}, {profile?.display_name || "athlete"}
          </h1>
          <p className="font-quote mt-3 border-l-2 border-accent/60 pl-3 text-base italic leading-snug text-ink/75">
            {dailyQuote(dateStr + (profile?.id ?? ""))}
          </p>
        </header>
      )}

      {schemaOld && (
        <div className="mb-4">
          <MigrationNotice />
        </div>
      )}

      {!hasPlans && segments.length === 0 && customSessions.length === 0 && (
        <Card className="mb-3">
          <EmptyState
            title="No plan yet"
            subtitle="Ask your coach for an invite code and link up in Settings — or start your own session below."
          />
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {segments.map((segment) => (
          <SegmentBlock
            key={segment.day.id}
            segment={segment}
            session={sessions.find((s) => s.plan_day_id === segment.day.id) ?? null}
            logs={logsBySession}
            openExercise={openExercise}
            onToggleExercise={(id) => setOpenExercise((cur) => (cur === id ? null : id))}
            onStart={() => startSession(segment)}
            onFinish={(s) => setSessionStatus(s, "complete")}
            onReopen={(s) => setSessionStatus(s, "in_progress")}
            onSaveCalories={saveCalories}
            onSaveNotes={saveAthleteNotes}
            onLogSaved={mergeLog}
            onLogDeleted={dropLog}
            showCoach={segments.length > 1}
          />
        ))}

        {customSessions.map((s) => (
          <OwnSessionBlock
            key={s.id}
            session={s}
            logs={logsBySession.get(s.id) ?? []}
            extraExercises={ownExercises[s.id] ?? []}
            onAddExercise={(name, logType) =>
              setOwnExercises((prev) => ({ ...prev, [s.id]: [...(prev[s.id] ?? []), { name, logType }] }))
            }
            openExercise={openExercise}
            onToggleExercise={(id) => setOpenExercise((cur) => (cur === id ? null : id))}
            onFinish={() => setSessionStatus(s, "complete")}
            onReopen={() => setSessionStatus(s, "in_progress")}
            onSaveCalories={(cal) => saveCalories(s, cal)}
            onSaveNotes={(notes) => saveAthleteNotes(s, notes)}
            onLogSaved={mergeLog}
            onLogDeleted={dropLog}
          />
        ))}

        <Button variant="secondary" onClick={() => setNewSessionOpen(true)}>
          + Start your own session
        </Button>
      </div>

      {newSessionOpen && (
        <NewSessionModal
          onClose={() => setNewSessionOpen(false)}
          onCreate={async (title) => {
            await startSession(null, title);
            setNewSessionOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ---------- planned segment (one per linked coach) ---------- */

function SegmentBlock({
  segment,
  session,
  logs,
  openExercise,
  onToggleExercise,
  onStart,
  onFinish,
  onReopen,
  onSaveCalories,
  onSaveNotes,
  onLogSaved,
  onLogDeleted,
  showCoach,
}: {
  segment: Segment;
  session: Session | null;
  logs: Map<string, SetLog[]>;
  openExercise: string | null;
  onToggleExercise: (id: string) => void;
  onStart: () => void;
  onFinish: (s: Session) => void;
  onReopen: (s: Session) => void;
  onSaveCalories: (s: Session, cal: number | null) => void;
  onSaveNotes: (s: Session, notes: string) => void;
  onLogSaved: (row: SetLog) => void;
  onLogDeleted: (id: string) => void;
  showCoach: boolean;
}) {
  const { day, exercises } = segment;
  const sessionLogs = session ? (logs.get(session.id) ?? []) : [];
  const logsByExercise = groupByExercise(sessionLogs);
  const doneCount = exercises.filter((ex) => (logsByExercise.get(ex.name)?.length ?? 0) >= ex.target_sets).length;

  const header = (
    <div className="mb-2 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        {showCoach && <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{segment.coachName}</p>}
        <h2 className="truncate text-lg font-black">{day.title || "Today"}</h2>
      </div>
      <Chip label={day.day_type} color={DAY_TYPE_COLORS[day.day_type]} />
    </div>
  );

  if (day.day_type === "rest" || exercises.length === 0) {
    return (
      <section>
        {header}
        <Card>
          <EmptyState
            title={day.day_type === "rest" ? "Rest day" : "Nothing planned"}
            subtitle={day.day_type === "rest" ? "Recovery is training too. See you tomorrow!" : "Check the Plan tab for what's coming up."}
          />
        </Card>
      </section>
    );
  }

  if (session?.status === "complete") {
    return (
      <section>
        {header}
        <SessionSummary
          session={session}
          exercises={exercises}
          logs={sessionLogs}
          customFields={segment.coachFields}
          onReopen={() => onReopen(session)}
          onSaveCalories={(cal) => onSaveCalories(session, cal)}
          onSaveNotes={(notes) => onSaveNotes(session, notes)}
        />
      </section>
    );
  }

  return (
    <section>
      {header}
      {!session ? (
        <Card className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-extrabold">
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"} planned
            </p>
            <p className="text-xs font-semibold text-muted">Tap start when you're at the gym.</p>
          </div>
          <Button onClick={onStart}>Start</Button>
        </Card>
      ) : (
        <Card className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">
            {doneCount}/{exercises.length} done
          </p>
          <Button variant={doneCount === exercises.length ? "primary" : "secondary"} onClick={() => onFinish(session)}>
            Finish
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {exercises.map((ex) => {
          const exLogs = logsByExercise.get(ex.name) ?? [];
          const done = exLogs.length >= ex.target_sets;
          const open = openExercise === ex.id;
          const mergedFields = [...segment.coachFields, ...(ex.custom_fields ?? [])];
          return (
            <Card key={ex.id} className={done ? "border-done/70" : ""}>
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left"
                onClick={() => onToggleExercise(ex.id)}
                disabled={!session}
              >
                <CheckCircle done={done} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{ex.name}</p>
                  <p className="text-xs font-semibold text-muted">{exerciseSubtitle(ex)}</p>
                  {ex.trainer_notes && <p className="mt-0.5 text-xs font-semibold text-accent">💬 {ex.trainer_notes}</p>}
                </div>
                <span className="text-xs font-extrabold text-muted">
                  {exLogs.length}/{ex.target_sets}
                </span>
              </button>
              {open && session && (
                <ExerciseLogger
                  session={session}
                  name={ex.name}
                  logType={ex.log_type}
                  planExercise={ex}
                  logs={exLogs}
                  customFields={mergedFields}
                  onSaved={onLogSaved}
                  onDeleted={onLogDeleted}
                />
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- athlete's own (unplanned) session ---------- */

function OwnSessionBlock({
  session,
  logs,
  extraExercises,
  onAddExercise,
  openExercise,
  onToggleExercise,
  onFinish,
  onReopen,
  onSaveCalories,
  onSaveNotes,
  onLogSaved,
  onLogDeleted,
}: {
  session: Session;
  logs: SetLog[];
  extraExercises: { name: string; logType: LogType }[];
  onAddExercise: (name: string, logType: LogType) => void;
  openExercise: string | null;
  onToggleExercise: (id: string) => void;
  onFinish: () => void;
  onReopen: () => void;
  onSaveCalories: (cal: number | null) => void;
  onSaveNotes: (notes: string) => void;
  onLogSaved: (row: SetLog) => void;
  onLogDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [logType, setLogType] = useState<LogType>("strength");

  const logsByExercise = groupByExercise(logs);
  // Exercises exist once logged, plus ones just added locally.
  const items: { name: string; logType: LogType }[] = [];
  for (const [exName, exLogs] of logsByExercise) {
    const t: LogType = exLogs.some((l) => l.distance_km != null)
      ? "cardio"
      : exLogs.some((l) => l.duration_sec != null && l.weight_kg == null)
        ? "timed"
        : "strength";
    items.push({ name: exName, logType: t });
  }
  for (const e of extraExercises) if (!items.some((i) => i.name === e.name)) items.push(e);

  if (session.status === "complete") {
    return (
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-black">{session.day_title}</h2>
          <Chip label="own session" color="#5b7fd6" />
        </div>
        <SessionSummary
          session={session}
          exercises={[]}
          logs={logs}
          customFields={[]}
          onReopen={onReopen}
          onSaveCalories={onSaveCalories}
          onSaveNotes={onSaveNotes}
        />
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-black">{session.day_title}</h2>
        <Chip label="own session" color="#5b7fd6" />
      </div>

      <Card className="mb-3 flex items-center justify-between">
        <p className="text-sm font-extrabold">
          {logs.length} set{logs.length === 1 ? "" : "s"} logged
        </p>
        <Button variant="secondary" onClick={onFinish}>
          Finish
        </Button>
      </Card>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const exLogs = logsByExercise.get(item.name) ?? [];
          const key = `${session.id}:${item.name}`;
          const open = openExercise === key;
          return (
            <Card key={key}>
              <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => onToggleExercise(key)}>
                <CheckCircle done={exLogs.length > 0} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{item.name}</p>
                  <p className="text-xs font-semibold text-muted">
                    {exLogs.length} set{exLogs.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
              {open && (
                <ExerciseLogger
                  session={session}
                  name={item.name}
                  logType={item.logType}
                  logs={exLogs}
                  customFields={[]}
                  onSaved={onLogSaved}
                  onDeleted={onLogDeleted}
                />
              )}
            </Card>
          );
        })}

        <Card>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Add an exercise</p>
          <div className="flex flex-col gap-2">
            <TextInput placeholder="e.g. Incline bench" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Segmented
                  options={[
                    { key: "strength", label: "Strength" },
                    { key: "cardio", label: "Cardio" },
                    { key: "timed", label: "Timed" },
                  ]}
                  value={logType}
                  onChange={(v) => setLogType(v as LogType)}
                />
              </div>
              <Button
                disabled={!name.trim()}
                onClick={() => {
                  onAddExercise(name.trim(), logType);
                  setName("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function NewSessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <Modal title="Your own session" onClose={onClose}>
      <p className="mb-3 text-sm font-semibold text-muted">
        Log anything outside your coach's plan — it shows up in your history (and your coach can see it too).
      </p>
      <TextInput placeholder="Session name (e.g. Extra cardio)" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <Button className="mt-3 w-full" disabled={!title.trim()} onClick={() => onCreate(title.trim())}>
        Start session
      </Button>
    </Modal>
  );
}

/* ---------- helpers ---------- */

function greeting(hour: number): string {
  if (hour < 5) return "Late night grind";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Night owl mode";
}

function groupByExercise(logs: SetLog[]): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  for (const l of logs) {
    const arr = map.get(l.exercise_name) ?? [];
    arr.push(l);
    map.set(l.exercise_name, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.set_index - b.set_index);
  return map;
}

export function exerciseSubtitle(ex: PlanExercise): string {
  if (ex.log_type === "cardio") return "Cardio";
  if (ex.set_details?.length) {
    const parts = ex.set_details.map((d) => `${d.reps}${d.weight_kg > 0 ? `@${d.weight_kg}kg` : ""}`);
    return `${ex.set_details.length} sets: ${parts.join(" · ")}${ex.rest_sec > 0 ? ` · rest ${ex.rest_sec}s` : ""}`;
  }
  return `${ex.target_sets} × ${ex.target_reps}${ex.target_weight_kg > 0 ? ` @ ${ex.target_weight_kg} kg` : ""}${
    ex.rest_sec > 0 ? ` · rest ${ex.rest_sec}s` : ""
  }`;
}

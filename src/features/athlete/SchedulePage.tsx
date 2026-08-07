import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  activeAthletePlans,
  DAY_TYPE_COLORS,
  isoWeekday,
  localDateString,
  parseLocalDate,
  planWeekIndex,
  WEEKDAY_LABELS,
  type AthletePlan,
  type PlanDay,
  type PlanExercise,
  type Session,
} from "../../lib/types";
import { fetchAthletePlans } from "../../lib/athletePlans";
import { useRealtime } from "../../lib/useRealtime";
import { MigrationNotice } from "../../components/MigrationNotice";
import { Card, Chip, EmptyState, Modal, Segmented, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { exerciseSubtitle } from "./TodayPage";

type ViewKey = "day" | "week" | "month" | "3mo";

/** One plan's slice of a given calendar date. */
interface DaySegment {
  ap: AthletePlan;
  day: PlanDay;
}

/**
 * The athlete's schedule: an interactive timeline over every assigned
 * plan (merged automatically), viewable per day, week, month or quarter.
 * Any date can be tapped to see exactly what's planned.
 */
export default function SchedulePage({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AthletePlan[]>([]);
  const [coachNames, setCoachNames] = useState<Map<string, string>>(new Map());
  const [days, setDays] = useState<PlanDay[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [schemaOld, setSchemaOld] = useState(false);
  const [view, setView] = useState<ViewKey>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!profile) return;
      if (!silent) setLoading(true);
      try {
        const result = await fetchAthletePlans(profile.id);
        setSchemaOld(result.schemaOld);
        setPlans(result.plans);
        setCoachNames(result.coachNames);
        if (result.plans.length > 0) {
          const { data: dayRows } = await supabase
            .from("plan_days")
            .select("*")
            .in("plan_id", result.plans.map((ap) => ap.plan.id));
          const allDays = (dayRows as PlanDay[]) ?? [];
          setDays(allDays);
          if (allDays.length > 0) {
            const { data: exRows } = await supabase
              .from("plan_exercises")
              .select("*")
              .in("plan_day_id", allDays.map((d) => d.id))
              .order("sort_order");
            setExercises((exRows as PlanExercise[]) ?? []);
          }
        } else {
          setDays([]);
          setExercises([]);
        }
        // Session marks for the last ~3 months (future has none anyway).
        const since = new Date();
        since.setDate(since.getDate() - 92);
        const { data: sess } = await supabase
          .from("sessions")
          .select("*")
          .eq("athlete_id", profile.id)
          .gte("date", localDateString(since));
        setSessions((sess as Session[]) ?? []);
      } finally {
        setLoading(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    load();
  }, [load]);
  useRealtime("athlete-schedule", ["sessions", "plans", "plan_days", "plan_exercises", "plan_assignments"], () =>
    load(true),
  );

  /** All plan segments that apply on a calendar date (auto-merged). */
  const segmentsFor = useCallback(
    (date: Date): DaySegment[] => {
      const active = activeAthletePlans(plans, date);
      const wd = isoWeekday(date);
      const out: DaySegment[] = [];
      for (const ap of active) {
        const wk = planWeekIndex(ap.plan, date, ap.start);
        const day = days.find((d) => d.plan_id === ap.plan.id && (d.week_index ?? 1) === wk && d.weekday === wd);
        if (day) out.push({ ap, day });
      }
      return out;
    },
    [plans, days],
  );

  const todayStr = localDateString(new Date());

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return map;
  }, [sessions]);

  if (loading) return <Spinner />;

  if (schemaOld) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-black">Schedule</h1>
        <MigrationNotice />
      </>
    );
  }

  function shift(dir: -1 | 1) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else if (view === "month") next.setMonth(next.getMonth() + dir);
    else next.setMonth(next.getMonth() + dir * 3);
    setAnchor(next);
  }

  const rangeLabel = (() => {
    if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" });
    if (view === "week") {
      const monday = mondayOf(anchor);
      const sunday = addDays(monday, 6);
      return `${monday.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
    }
    if (view === "month") return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const end = new Date(anchor);
    end.setMonth(end.getMonth() + 2);
    return `${anchor.toLocaleDateString(undefined, { month: "short" })} – ${end.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
  })();

  return (
    <>
      {!embedded && <h1 className="mb-3 text-2xl font-black">Schedule</h1>}

      <div className="mb-3">
        <Segmented
          options={[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
            { key: "3mo", label: "3 mo" },
          ]}
          value={view}
          onChange={(v) => setView(v as ViewKey)}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <NavBtn onClick={() => shift(-1)}>‹</NavBtn>
        <button type="button" className="text-sm font-black" onClick={() => setAnchor(new Date())} title="Jump to today">
          {rangeLabel}
        </button>
        <NavBtn onClick={() => shift(1)}>›</NavBtn>
      </div>

      {plans.length === 0 ? (
        <Card>
          <EmptyState mascot title="No plan yet" subtitle="Once a coach assigns you a plan, your schedule fills up here." />
        </Card>
      ) : (
        <>
          {view === "day" && (
            <DayDetail
              date={anchor}
              segments={segmentsFor(anchor)}
              exercises={exercises}
              coachNames={coachNames}
              sessions={sessionsByDate.get(localDateString(anchor)) ?? []}
              multiCoach={plans.length > 1}
            />
          )}

          {view === "week" && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i)).map((date) => {
                const dateStr = localDateString(date);
                const segs = segmentsFor(date).filter((s) => s.day.day_type !== "rest");
                const daySessions = sessionsByDate.get(dateStr) ?? [];
                return (
                  <Card
                    key={dateStr}
                    className={`cursor-pointer transition hover:bg-inset ${dateStr === todayStr ? "border-accent" : ""}`}
                  >
                    <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setDetailDate(dateStr)}>
                      <div className={`w-11 shrink-0 text-center ${dateStr === todayStr ? "text-accent" : "text-muted"}`}>
                        <p className="text-xs font-black">{WEEKDAY_LABELS[isoWeekday(date) - 1]}</p>
                        <p className="text-lg font-black">{date.getDate()}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {segs.length === 0 ? (
                          <p className="text-sm font-extrabold text-muted">Rest</p>
                        ) : (
                          segs.map((s) => (
                            <p key={s.day.id} className="truncate text-sm font-extrabold">
                              {s.day.title || "Training"}
                              {plans.length > 1 && (
                                <span className="font-semibold text-muted"> · {coachNames.get(s.ap.plan.trainer_id)}</span>
                              )}
                            </p>
                          ))
                        )}
                        {daySessions.some((s) => s.status === "complete") && (
                          <p className="text-xs font-bold text-done-deep">✓ trained</p>
                        )}
                      </div>
                      <span className="flex gap-1">
                        {segs.slice(0, 3).map((s) => (
                          <span
                            key={s.day.id}
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: DAY_TYPE_COLORS[s.day.day_type] }}
                          />
                        ))}
                      </span>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <MonthGrid
              year={anchor.getFullYear()}
              month={anchor.getMonth()}
              segmentsFor={segmentsFor}
              sessionsByDate={sessionsByDate}
              todayStr={todayStr}
              onPick={setDetailDate}
            />
          )}

          {view === "3mo" && (
            <div className="flex flex-col gap-4">
              {[0, 1, 2].map((offset) => {
                const m = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
                return (
                  <div key={offset}>
                    <p className="mb-1 text-sm font-black">{m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                    <MonthGrid
                      year={m.getFullYear()}
                      month={m.getMonth()}
                      segmentsFor={segmentsFor}
                      sessionsByDate={sessionsByDate}
                      todayStr={todayStr}
                      onPick={setDetailDate}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {detailDate && (
        <Modal
          title={parseLocalDate(detailDate).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          onClose={() => setDetailDate(null)}
        >
          <DayDetail
            date={parseLocalDate(detailDate)}
            segments={segmentsFor(parseLocalDate(detailDate))}
            exercises={exercises}
            coachNames={coachNames}
            sessions={sessionsByDate.get(detailDate) ?? []}
            multiCoach={plans.length > 1}
          />
        </Modal>
      )}
    </>
  );
}

/* ---------- pieces ---------- */

/** What's planned on one date — every plan segment, fully expanded. */
function DayDetail({
  segments,
  exercises,
  coachNames,
  sessions,
  multiCoach,
}: {
  date: Date;
  segments: DaySegment[];
  exercises: PlanExercise[];
  coachNames: Map<string, string>;
  sessions: Session[];
  multiCoach: boolean;
}) {
  const trainingSegs = segments.filter((s) => s.day.day_type !== "rest");
  const ownSessions = sessions.filter((s) => s.plan_day_id === null);
  if (trainingSegs.length === 0 && ownSessions.length === 0) {
    return (
      <Card>
        <EmptyState title="Rest day" subtitle="Nothing planned — recovery counts too." />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {trainingSegs.map(({ ap, day }) => {
        const dayExercises = exercises.filter((e) => e.plan_day_id === day.id);
        const session = sessions.find((s) => s.plan_day_id === day.id);
        return (
          <Card key={day.id}>
            <div className="mb-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {multiCoach && (
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                    {coachNames.get(ap.plan.trainer_id) ?? "Coach"} · {ap.plan.name}
                  </p>
                )}
                <p className="truncate font-extrabold">{day.title || "Training"}</p>
              </div>
              <Chip label={day.day_type} color={DAY_TYPE_COLORS[day.day_type]} />
            </div>
            {session?.status === "complete" && <p className="mb-2 text-xs font-bold text-done-deep">✓ Completed</p>}
            {session?.status === "in_progress" && <p className="mb-2 text-xs font-bold text-gold">In progress…</p>}
            <div className="flex flex-col gap-1">
              {dayExercises.map((ex) => (
                <div key={ex.id} className="rounded-xl bg-inset px-3 py-2">
                  <p className="text-sm font-extrabold">{ex.name}</p>
                  <p className="text-xs font-semibold text-muted">{exerciseSubtitle(ex)}</p>
                </div>
              ))}
              {dayExercises.length === 0 && <p className="text-xs font-semibold text-muted">No exercises listed.</p>}
            </div>
          </Card>
        );
      })}
      {ownSessions.map((s) => (
        <Card key={s.id}>
          <p className="font-extrabold">{s.day_title}</p>
          <p className="text-xs font-semibold text-muted">
            Own session {s.status === "complete" ? "· ✓ completed" : "· in progress"}
          </p>
        </Card>
      ))}
    </div>
  );
}

/** Calendar month with coloured plan dots; every day is clickable. */
function MonthGrid({
  year,
  month,
  segmentsFor,
  sessionsByDate,
  todayStr,
  onPick,
  compact = false,
}: {
  year: number;
  month: number;
  segmentsFor: (d: Date) => DaySegment[];
  sessionsByDate: Map<string, Session[]>;
  todayStr: string;
  onPick: (dateStr: string) => void;
  compact?: boolean;
}) {
  const first = new Date(year, month, 1);
  const startPad = isoWeekday(first) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((l) => (
          <span key={l} className="py-1 text-center text-[10px] font-black uppercase text-muted">
            {compact ? l[0] : l}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;
          const dateStr = localDateString(date);
          const segs = segmentsFor(date).filter((s) => s.day.day_type !== "rest");
          const trained = (sessionsByDate.get(dateStr) ?? []).some((s) => s.status === "complete");
          const isToday = dateStr === todayStr;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onPick(dateStr)}
              className={`flex flex-col items-center rounded-lg py-1 transition hover:bg-inset ${
                isToday ? "bg-accent-soft font-black text-accent" : ""
              } ${compact ? "min-h-8" : "min-h-11"}`}
            >
              <span className={`text-xs ${isToday ? "font-black" : "font-bold"}`}>{date.getDate()}</span>
              <span className="mt-0.5 flex gap-0.5">
                {trained ? (
                  <span className="text-[9px] font-black leading-none text-done-deep">✓</span>
                ) : (
                  segs.slice(0, compact ? 2 : 3).map((s) => (
                    <span
                      key={s.day.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: DAY_TYPE_COLORS[s.day.day_type] }}
                    />
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-b-4 border-line bg-surface font-black text-accent active:translate-y-[2px] active:border-b-2"
    >
      {children}
    </button>
  );
}

function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - (isoWeekday(out) - 1));
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

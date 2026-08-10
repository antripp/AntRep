/**
 * Home — the iOS Today screen: greeting, streak, goals, and the day's plan with
 * inline logging, a live workout timer, the skipped-day makeup safeguard, extra
 * exercises outside the plan, and back-dating for sessions you forgot to log.
 */

import { useEffect, useMemo, useState } from "react";
import { dailyQuote } from "../../lib/quotes";
import { catalogEntry, categoryFor, inferLogType } from "../../data/catalog";
import { extraAsExercise } from "../../data/factories";
import { type ExtraExercise, type PlanExercise, type Session } from "../../data/types";
import {
  addDays,
  formatDuration,
  formatLongDate,
  formatShortDate,
  greeting,
  isoWeekday,
  localDate,
  parseDate,
  weekdayLabel,
} from "../../domain/dates";
import {
  canResumeTimer,
  canStartTimer,
  elapsedSeconds,
  isLive,
  loggingSlots,
  progressFor,
  visibleExercises,
} from "../../domain/logging";
import {
  makeupCandidates,
  offScheduleSegments,
  scheduledSegmentIds,
  type MakeupCandidate,
} from "../../domain/makeup";
import { dayForDate, resolveSegments, slotLabel, typeIcon, type ResolvedSegment } from "../../domain/plan";
import { loggedSessionIds, nameKey } from "../../domain/logging";
import { plural } from "../../domain/text";
import {
  ActionDialog,
  Button,
  Card,
  Countdown,
  EmptyState,
  Field,
  Icon,
  IconTile,
  Pill,
  ProgressRing,
  ScreenTitle,
  SectionHeader,
  Sheet,
  TextField,
} from "../../ui/kit";
import { ExercisePicker, type ExercisePickerSetup } from "../plans/PlanEditor";
import { useWorkspace } from "../workspace";
import { ExerciseLogCard } from "./ExerciseLogCard";

export default function HomeScreen({ onGoPlans }: { onGoPlans: () => void }) {
  const {
    profile,
    bundles,
    planViews,
    allBundles,
    sessions,
    logs,
    sessionForSegment,
    ensureSession,
    startTimer,
    presets,
    freeSession,
    addExtraExercise,
    removeExtraExercise,
    ensureFreeSession,
    showToast,
  } = useWorkspace();

  const today = new Date();
  const todayStr = localDate(today);
  const [date, setDate] = useState(today);
  const dateStr = localDate(date);
  const isToday = dateStr === todayStr;

  const [startDialog, setStartDialog] = useState<ResolvedSegment | null>(null);
  const [pendingStart, setPendingStart] = useState<ResolvedSegment | null>(null);
  const [showMakeup, setShowMakeup] = useState(false);
  const [showExtraPicker, setShowExtraPicker] = useState(false);
  const [countdown, setCountdown] = useState(false);

  /** Plans that had already started on the selected date — nothing schedules the past. */
  const plansInEffect = useMemo(
    () => planViews.filter((p) => p.start <= dateStr),
    [planViews, dateStr],
  );

  const daySegments = useMemo(() => {
    const out: ResolvedSegment[] = [];
    for (const { bundle, start } of plansInEffect) {
      const day = dayForDate(bundle, date, start);
      if (day) out.push(...resolveSegments(bundle, day));
    }
    return out;
  }, [plansInEffect, date]);

  /** Work logged that day outside its schedule: a makeup, or a plan since changed. */
  const offSchedule = useMemo(
    () => offScheduleSegments(allBundles, sessions, date, scheduledSegmentIds(plansInEffect, date)),
    [allBundles, sessions, date, plansInEffect],
  );

  // Pass the plan views, not bare bundles: a cycle counts its days off the
  // start date that applies to this athlete, which may be an assignment override.
  const candidates = useMemo(
    () => (isToday ? makeupCandidates(planViews, sessions, today, loggedSessionIds(logs)) : []),
    [planViews, sessions, logs, today, isToday],
  );

  const liveSession = useMemo(
    () => sessions.find((s) => s.date === todayStr && isLive(s)),
    [sessions, todayStr],
  );

  const extraSession = freeSession(dateStr);

  /** Dates with something logged — the quick list in the date search. */
  const trainedDates = useMemo(
    () => [...new Set(sessions.map((s) => s.date))].sort((a, b) => b.localeCompare(a)),
    [sessions],
  );

  const plannedTotal = daySegments.reduce(
    (t, s) => t + progressFor(s, date, sessionForSegment(s, dateStr)).total,
    0,
  );

  async function beginWorkout(segment: ResolvedSegment) {
    setPendingStart(segment);
    setCountdown(true);
  }

  async function finishCountdown() {
    setCountdown(false);
    try {
      if (pendingStart) await startTimer(pendingStart);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't start that workout.");
    }
    setPendingStart(null);
  }

  async function addExtra(name: string, librarySetup?: ExercisePickerSetup) {
    // Your own library wins, so an exercise always logs the way you set it up.
    const saved = presets.find((p) => nameKey(p.name) === nameKey(name));
    const preset = catalogEntry(name);
    const extra: ExtraExercise = {
      name: saved?.name ?? name,
      log_type: saved?.log_type ?? librarySetup?.log_type ?? preset?.logType ?? inferLogType(name),
      category: saved?.category ?? librarySetup?.category ?? preset?.category ?? categoryFor(name),
      target_sets: saved?.target_sets ?? librarySetup?.target_sets ?? preset?.sets,
      target_reps: saved?.target_reps ?? librarySetup?.target_reps ?? preset?.reps,
      custom_fields: saved?.custom_fields ?? librarySetup?.custom_fields ?? [],
    };
    try {
      await addExtraExercise(extra, dateStr);
      setShowExtraPicker(false);
      showToast(`${name} added to ${isToday ? "today" : formatLongDate(date)}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Couldn't add ${name}.`);
    }
  }

  const dayTitle =
    daySegments[0]?.day.title ||
    daySegments[0]?.title ||
    (plansInEffect.length === 0 ? "No plan scheduled" : "Rest day");

  return (
    <>
      <ScreenTitle
        date={formatLongDate(today)}
        title={greeting(profile.display_name, today)}
        quote={dailyQuote(todayStr)}
      />

      {/* Streak, level and the weekly tiles now live on Progress → Overview.
          Home stays about the one question it should answer: what am I doing
          today, and how do I start it? */}

      {liveSession && isToday && (
        <LiveWorkoutPanel session={liveSession} segments={[...daySegments, ...offSchedule]} />
      )}

      {/* Day switcher — log a past day you missed */}
      <DateSwitcher date={date} onChange={setDate} trainedDates={trainedDates} />

      {!isToday && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-3 py-2">
          <Icon.calendarClock className="h-4 w-4 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-xs font-bold text-ink">
            Logging {weekdayLabel(isoWeekday(date))}, {formatLongDate(date)}
            <span className="font-semibold text-muted"> — saved as a late log</span>
          </p>
          <button className="shrink-0 text-xs font-black text-accent" onClick={() => setDate(new Date())}>
            Back to today
          </button>
        </div>
      )}

      {/* The day's plan */}
      <div className="mt-4 flex items-center gap-3">
        <IconTile
          emoji={typeIcon(daySegments[0]?.dayType ?? "rest", daySegments[0]?.day.icon_name)}
          tint={daySegments[0]?.color ?? "var(--t-muted)"}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-black text-ink">{dayTitle}</h2>
          <p className="text-xs font-bold text-muted">
            {weekdayLabel(isoWeekday(date))} · {formatLongDate(date)}
            {isToday && " · today"} · {plural(plannedTotal, "exercise")}
          </p>
        </div>
        {candidates.length > 0 && !liveSession && (
          <Button size="sm" variant="secondary" onClick={() => setShowMakeup(true)}>
            <Icon.calendarClock className="h-4 w-4" /> Another day
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {daySegments.length === 0 && offSchedule.length === 0 && (
          <EmptyState
            title={
              bundles.length === 0
                ? "No plan yet"
                : plansInEffect.length === 0
                  ? "No plan ran on this day"
                  : "Rest day"
            }
            subtitle={
              bundles.length === 0
                ? "Build your own plan or sync one from your coach — or just log an exercise below."
                : plansInEffect.length === 0
                  ? "Your plan hadn't started yet. You can still log whatever you did — it counts toward your history."
                  : "Nothing scheduled. You can still log extra work, or train another day's workout."
            }
            action={
              bundles.length === 0 ? (
                <Button onClick={onGoPlans}>Go to plans</Button>
              ) : candidates.length > 0 ? (
                <Button onClick={() => setShowMakeup(true)}>Train another day</Button>
              ) : undefined
            }
          />
        )}

        {daySegments.map((segment) => (
          <SegmentBlock
            key={segment.id}
            segment={segment}
            date={date}
            onStart={() => setStartDialog(segment)}
            liveSessionId={liveSession?.id}
            allowTimer={isToday}
          />
        ))}

        {offSchedule.length > 0 && (
          <>
            <SectionHeader
              title={isToday ? "Moved to today" : "Also logged this day"}
              icon={<Icon.calendarClock className="h-4 w-4" />}
            />
            {offSchedule.map((segment) => (
              <SegmentBlock
                key={segment.id}
                segment={segment}
                date={date}
                onStart={() => setStartDialog(segment)}
                liveSessionId={liveSession?.id}
                allowTimer={isToday}
                makeup
              />
            ))}
          </>
        )}

        {/* Anything logged outside the plan */}
        <section className="ui-extra-work rounded-card border border-dashed border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <Icon.plus className="h-4 w-4 text-muted" />
            <h3 className="flex-1 text-sm font-black text-ink">
              Extra work
              <span className="ml-1 font-bold text-muted">
                · {weekdayLabel(isoWeekday(date), true)} {formatShortDate(dateStr)}
              </span>
            </h3>
            <Button size="sm" variant="secondary" onClick={() => setShowExtraPicker(true)}>
              Log an exercise
            </Button>
          </div>

          {extraSession && extraSession.extra_exercises.length > 0 ? (
            <div className="space-y-2">
              {extraSession.extra_exercises.map((extra, index) => {
                const exercise: PlanExercise = extraAsExercise(extra, extraSession.id, index);
                return (
                  <ExerciseLogCard
                    key={exercise.id}
                    exercise={exercise}
                    session={extraSession}
                    editable
                    tint="var(--t-accent)"
                    onNeedSession={() => ensureFreeSession(dateStr)}
                    onRemove={() => removeExtraExercise(extraSession, extra.name)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs font-semibold text-muted">
              Anything beyond the plan — a class, a swim, an extra lift — lands here and counts toward
              your totals. Works on past days too, so you can fill in what you never logged.
            </p>
          )}
        </section>
      </div>

      <ActionDialog
        open={Boolean(startDialog)}
        title="Start workout?"
        message="We'll run a timer while you log. Your coach sees the session when it's shared."
        onClose={() => setStartDialog(null)}
        actions={[
          {
            label: "Start workout",
            tone: "primary",
            onClick: () => startDialog && beginWorkout(startDialog),
          },
          ...(candidates.length > 0
            ? [{ label: "Start another day's workout…", onClick: () => setShowMakeup(true) }]
            : []),
          {
            label: "Just log without a timer",
            onClick: () => {
              if (!startDialog) return;
              ensureSession(startDialog, dateStr).catch((error) =>
                showToast(error instanceof Error ? error.message : "Couldn't start that session."),
              );
            },
          },
        ]}
      />

      <MakeupSheet
        open={showMakeup}
        candidates={candidates}
        onClose={() => setShowMakeup(false)}
        onPick={(candidate) => {
          setShowMakeup(false);
          beginWorkout(candidate.segment);
        }}
      />

      {showExtraPicker && (
        <ExercisePicker
          onPick={addExtra}
          onClose={() => setShowExtraPicker(false)}
          library={presets}
        />
      )}

      {countdown && <Countdown onDone={finishCountdown} />}
    </>
  );
}

// ------------------------------------------------------------------

/**
 * Back-date the logger: arrows for the day before/after, or search straight to a
 * date — by picker, by typing it, or from the days you've already trained.
 */
function DateSwitcher({
  date,
  onChange,
  trainedDates,
}: {
  date: Date;
  onChange: (d: Date) => void;
  trainedDates: string[];
}) {
  const [open, setOpen] = useState(false);
  const todayStr = localDate();
  const isToday = localDate(date) === todayStr;

  return (
    <>
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        <button
          aria-label="Previous day"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:text-ink"
          onClick={() => onChange(addDays(date, -1))}
        >
          <Icon.back className="h-4 w-4" />
        </button>

        <button
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1.5"
          onClick={() => setOpen(true)}
          aria-label="Search by date"
        >
          <Icon.search className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-sm font-black text-ink">
            {isToday ? "Today" : `${weekdayLabel(isoWeekday(date), true)} ${formatLongDate(date)}`}
          </span>
        </button>

        {!isToday && (
          <button
            className="shrink-0 rounded-full px-3 py-1 text-xs font-black text-accent"
            onClick={() => onChange(new Date())}
          >
            Today
          </button>
        )}

        <button
          aria-label="Next day"
          disabled={isToday}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted active:text-ink disabled:opacity-30"
          onClick={() => onChange(addDays(date, 1))}
        >
          <Icon.chevron className="h-4 w-4" />
        </button>
      </div>

      <DateSearchSheet
        open={open}
        date={date}
        trainedDates={trainedDates}
        onClose={() => setOpen(false)}
        onPick={(d) => {
          onChange(d);
          setOpen(false);
        }}
      />
    </>
  );
}

function DateSearchSheet({
  open,
  date,
  trainedDates,
  onPick,
  onClose,
}: {
  open: boolean;
  date: Date;
  trainedDates: string[];
  onPick: (d: Date) => void;
  onClose: () => void;
}) {
  const todayStr = localDate();
  const [value, setValue] = useState(localDate(date));

  useEffect(() => {
    if (open) setValue(localDate(date));
  }, [open, date]);

  const quick = [
    { label: "Today", date: new Date() },
    { label: "Yesterday", date: addDays(new Date(), -1) },
    { label: "2 days ago", date: addDays(new Date(), -2) },
    { label: "A week ago", date: addDays(new Date(), -7) },
  ];

  const recent = trainedDates.filter((d) => d <= todayStr).slice(0, 8);

  return (
    <Sheet open={open} onClose={onClose} title="Go to a date">
      <Field label="Pick a date" hint="Anything up to today — past days save as a late log">
        <div className="flex gap-2">
          <TextField
            type="date"
            value={value}
            max={todayStr}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button disabled={!value || value > todayStr} onClick={() => onPick(parseDate(value))}>
            Go
          </Button>
        </div>
      </Field>

      <SectionHeader title="Jump to" />
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={() => onPick(q.date)}
            className="rounded-full border border-line bg-inset px-3 py-1.5 text-xs font-black text-ink"
          >
            {q.label}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <SectionHeader title="Days you trained" />
          <div className="flex flex-wrap gap-1.5">
            {recent.map((d) => (
              <button
                key={d}
                onClick={() => onPick(parseDate(d))}
                className="rounded-full border border-line bg-inset px-3 py-1.5 text-xs font-black text-ink"
              >
                {weekdayLabel(isoWeekday(parseDate(d)), true)} {formatShortDate(d)}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------

function SegmentBlock({
  segment,
  date,
  onStart,
  liveSessionId,
  allowTimer,
  makeup,
}: {
  segment: ResolvedSegment;
  date: Date;
  onStart: () => void;
  liveSessionId?: string;
  allowTimer: boolean;
  makeup?: boolean;
}) {
  const { sessionForSegment, ensureSession, resumeTimer, showToast } = useWorkspace();
  const dateStr = localDate(date);
  const session = sessionForSegment(segment, dateStr);
  const progress = progressFor(segment, date, session);
  const slots = loggingSlots(visibleExercises(segment, date));
  const [picked, setPicked] = useState<Record<string, string>>({});

  const canStart = allowTimer && !liveSessionId && canStartTimer(session);
  const canResume = allowTimer && !liveSessionId && canResumeTimer(session);

  return (
    <section
      className="ui-segment-block rounded-card border p-3"
      style={{ borderColor: `${segment.color}38`, background: "color-mix(in srgb, var(--t-surface) 55%, transparent)" }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-black text-ink">{segment.title}</h3>
            {makeup && <Pill tint={segment.color}>{slotLabel(segment.plan, segment.slot, true)}</Pill>}
            {segment.day.is_optional && <Pill tint="var(--t-muted)">Optional</Pill>}
          </div>
          <p className="text-xs font-bold text-muted">
            <span className="uppercase">
              {progress.completed}/{progress.total} · {segment.dayType}
            </span>
            <span className="text-muted/80"> · {weekdayLabel(isoWeekday(date), true)} {formatShortDate(dateStr)}</span>
          </p>
        </div>

        {progress.total > 0 && (
          <ProgressRing ratio={progress.ratio} size={44} stroke={6} color={segment.color} />
        )}

        {canResume ? (
          <Button size="sm" tint={segment.color} onClick={() => session && resumeTimer(session)}>
            Resume
          </Button>
        ) : canStart ? (
          <Button size="sm" tint={segment.color} onClick={onStart}>
            Start now
          </Button>
        ) : !allowTimer && !session ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              ensureSession(segment, dateStr).catch((error) =>
                showToast(error instanceof Error ? error.message : "Couldn't start that session."),
              )
            }
          >
            Log this
          </Button>
        ) : null}
      </div>

      {progress.isComplete && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: `${segment.color}1f` }}>
          <Icon.trophy className="h-4 w-4" style={{ color: segment.color }} />
          <p className="text-xs font-black text-ink">Session complete — nice work.</p>
        </div>
      )}

      <div className="space-y-2">
        {slots.map((slot) => {
          const chosenId = picked[slot[0].alternate_group_id || slot[0].id];
          const exercise: PlanExercise = slot.find((e) => e.id === chosenId) ?? slot[0];
          return (
            <ExerciseLogCard
              key={exercise.id}
              exercise={exercise}
              segment={segment}
              session={session}
              editable
              alternates={slot.length > 1 ? slot : undefined}
              onPickAlternate={(alt) =>
                setPicked((p) => ({ ...p, [slot[0].alternate_group_id || slot[0].id]: alt.id }))
              }
              onNeedSession={() => ensureSession(segment, dateStr)}
            />
          );
        })}
        {slots.length === 0 && (
          <p className="rounded-2xl bg-inset px-3 py-4 text-center text-sm font-semibold text-muted">
            No exercises in this block yet.
          </p>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------

function LiveWorkoutPanel({ session, segments }: { session: Session; segments: ResolvedSegment[] }) {
  const { pauseTimer, resumeTimer, endTimer } = useWorkspace();
  const [, force] = useState(0);
  const segment = segments.find(
    (s) => (session.plan_segment_id ? s.segmentId === session.plan_segment_id : s.dayId === session.plan_day_id),
  );

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const live = isLive(session);
  const tint = segment?.color ?? "var(--t-accent)";

  return (
    <Card className="mb-3" tint={tint}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">
            {live ? "Workout running" : "Workout paused"}
          </p>
          <p className="text-3xl font-black tabular-nums text-ink">
            {formatDuration(elapsedSeconds(session))}
          </p>
          <p className="truncate text-xs font-bold text-muted">{session.day_title}</p>
        </div>
        {live ? (
          <Button size="sm" variant="secondary" onClick={() => pauseTimer(session)}>
            <Icon.pause className="h-4 w-4" /> Pause
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => resumeTimer(session)}>
            <Icon.play className="h-4 w-4" /> Resume
          </Button>
        )}
        <Button size="sm" tint={tint} onClick={() => endTimer(session)}>
          <Icon.stop className="h-4 w-4" /> End
        </Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------

function MakeupSheet({
  open,
  candidates,
  onClose,
  onPick,
}: {
  open: boolean;
  candidates: MakeupCandidate[];
  onClose: () => void;
  onPick: (c: MakeupCandidate) => void;
}) {
  const missed = candidates.filter((c) => c.isMissed);
  const rest = candidates.filter((c) => !c.isMissed);

  return (
    <Sheet open={open} onClose={onClose} title="Start another day">
      <p className="mb-3 text-xs font-semibold leading-snug text-muted">
        Trains that day's workout today. It's logged on today's date and keeps its own name in history —
        your plan schedule stays as it is.
      </p>

      {candidates.length === 0 && (
        <p className="py-6 text-center text-sm font-semibold text-muted">No other days in your plan.</p>
      )}

      {[
        { title: "Not logged on their day", items: missed },
        { title: "Already trained on their day", items: rest },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-muted">{group.title}</p>
            <div className="space-y-2">
              {group.items.map((c) => (
                <button
                  key={`${c.bundle.plan.id}-${c.day.id}`}
                  disabled={!c.canStartToday}
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-inset p-3 text-left disabled:opacity-45"
                >
                  <IconTile emoji={typeIcon(c.day.day_type, c.day.icon_name)} tint={c.segment.color} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{c.day.title}</p>
                    <p className="truncate text-[11px] font-bold text-muted">
                      {slotLabel(c.bundle.plan, c.segment.slot)} · {c.relativeLabel}
                      {c.exerciseCount > 0 && ` · ${plural(c.exerciseCount, "exercise")}`}
                    </p>
                  </div>
                  {c.isTrainedToday ? (
                    <Pill tint="var(--t-accent)">Started</Pill>
                  ) : (
                    <Icon.play className="h-5 w-5" style={{ color: c.segment.color }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
    </Sheet>
  );
}

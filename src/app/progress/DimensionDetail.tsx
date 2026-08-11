import { useMemo, useState } from "react";
import { categoryFor } from "../../data/catalog";
import type { ExerciseCategory, PlanBundle, ProgressGoal, Session, SetLog } from "../../data/types";
import {
  buildDimensionReport,
  type DimensionReport,
  type EffortFilter,
  type ExerciseEvidence,
} from "../../domain/progressionDetail";
import { buildTrainingIntelligence, type DimensionKey } from "../../domain/trainingIntelligence";
import { addDays, formatShortDate, localDate } from "../../domain/dates";
import type { DayGroup } from "../../domain/dayTrends";
import { setHasData } from "../../domain/logging";
import { analyseConsistency, type ProgressPlanRun } from "../../domain/consistency";
import { AngularRadarChart, BarChart, LineChart, type Point } from "../../ui/charts";
import {
  Card,
  Icon,
  IconButton,
  IconTile,
  Pill,
  SectionHeader,
  Sheet,
  StatTile,
} from "../../ui/kit";
import { analyticsColor, CATEGORY_COLORS } from "./palette";
import { GoalProgressCard, ProgressGoalEditor, type GoalContextOption } from "./ProgressGoalEditor";

const RANGES = [
  { weeks: 4, label: "4w" },
  { weeks: 8, label: "8w" },
  { weeks: 12, label: "12w" },
  { weeks: 26, label: "6m" },
] as const;

const CATEGORIES: { value: ExerciseCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
];

const EFFORTS: { value: EffortFilter; label: string }[] = [
  { value: "all", label: "All effort" },
  { value: "manageable", label: "Manageable (8/10 or lower)" },
  { value: "high", label: "Very hard (8.5/10+)" },
];

const BREAKDOWNS = [
  { value: "trend", label: "Overall" },
  { value: "plans", label: "Plans" },
  { value: "days", label: "Planned days" },
  { value: "sessions", label: "Sessions" },
  { value: "exercises", label: "Exercises" },
] as const;

type BreakdownView = (typeof BREAKDOWNS)[number]["value"];

export function DimensionDetail({
  dimensionKey,
  sessions,
  logs,
  weeklyGoal,
  onBack,
  onOpenExercise,
  onOpenSession,
  plans,
  dayGroups,
  onOpenPlan,
  onOpenDay,
  planRuns,
  athleteId,
  viewerId,
  goals = [],
  onSaveGoal,
  onDeleteGoal,
}: {
  dimensionKey: DimensionKey;
  sessions: Session[];
  logs: SetLog[];
  weeklyGoal: number;
  onBack: () => void;
  onOpenExercise: (key: string) => void;
  onOpenSession: (id: string) => void;
  plans: PlanBundle[];
  dayGroups: DayGroup[];
  onOpenPlan: (id: string) => void;
  onOpenDay: (key: string) => void;
  planRuns: ProgressPlanRun[];
  athleteId?: string;
  viewerId?: string;
  goals?: ProgressGoal[];
  onSaveGoal?: (goal: ProgressGoal) => Promise<void>;
  onDeleteGoal?: (id: string) => Promise<void>;
}) {
  const [weeks, setWeeks] = useState(8);
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [effort, setEffort] = useState<EffortFilter>("all");
  const [showMethod, setShowMethod] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownView>("trend");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ProgressGoal | null>(null);
  const report = useMemo(
    () => buildDimensionReport({ key: dimensionKey, sessions, logs, weeklyGoal, weeks, category, effort }),
    [dimensionKey, sessions, logs, weeklyGoal, weeks, category, effort],
  );
  const tint = analyticsColor(dimensionKey, category);
  const contextScores = useMemo(
    () => buildContextScores({ dimensionKey, sessions, logs, plans, dayGroups, planRuns, weeklyGoal, weeks, category, effort }),
    [dimensionKey, sessions, logs, plans, dayGroups, planRuns, weeklyGoal, weeks, category, effort],
  );
  const consistency = useMemo(
    () => analyseConsistency(sessions, logs, weeklyGoal, planRuns, new Date(), weeks),
    [sessions, logs, weeklyGoal, planRuns, weeks],
  );
  const planContextScores = dimensionKey === "consistency"
    ? consistency.planScores.map((item) => ({ ...item, subtitle: `${item.completed} of ${item.planned} required days`, status: consistencyStatus(item.score) }))
    : contextScores.plans;
  const dayContextScores = dimensionKey === "consistency"
    ? consistency.dayScores.map((item) => ({ ...item, subtitle: `${item.completed} of ${item.planned} scheduled appearances`, status: consistencyStatus(item.score) }))
    : contextScores.days;
  const goalContexts = useMemo<GoalContextOption[]>(() => [
    { scopeType: "overall", key: null, label: "Overall strength" },
    ...plans.map((bundle) => ({ scopeType: "plan" as const, key: bundle.plan.id, label: `Plan · ${bundle.plan.name}` })),
    ...dayGroups.map((group) => ({ scopeType: "day" as const, key: group.key, label: `Planned day · ${group.title}` })),
    ...sessions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((session) => ({ scopeType: "session" as const, key: session.id, label: `Session · ${formatShortDate(session.date)} ${session.day_title || "Workout"}` })),
    ...report.exercises.map((exercise) => ({ scopeType: "exercise" as const, key: exercise.key, label: `Exercise · ${exercise.name}` })),
  ], [plans, dayGroups, sessions, report.exercises]);
  const strengthGoals = goals.filter((goal) => goal.metric === "strength" && goal.status === "active");

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back to Progress" onClick={onBack}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <IconTile emoji={report.dimension.emoji} tint={tint} size={38} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-ink">{report.dimension.label}</h1>
          <p className="text-xs font-bold text-muted">
            {report.analysedSessions} sessions · {report.dimension.confidence.toLowerCase()} confidence
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMethod(true)}
          className="flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-black text-ink"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">i</span>
          Assessed
        </button>
        {dimensionKey === "strength" && athleteId && viewerId && onSaveGoal && (
          <button
            type="button"
            onClick={() => { setEditingGoal(null); setGoalOpen(true); }}
            className="flex h-9 shrink-0 items-center rounded-full bg-accent px-3 text-xs font-black text-white"
          >
            Set goal
          </button>
        )}
      </div>

      <FilterBar
        weeks={weeks}
        category={category}
        effort={effort}
        tint={tint}
        onWeeks={setWeeks}
        onCategory={setCategory}
        onEffort={setEffort}
      />

      <div className="-mx-1 mb-3 overflow-x-auto px-1 pb-1" aria-label="Break down metric by">
        <div className="flex w-max min-w-full gap-1 rounded-2xl bg-inset p-1">
          {BREAKDOWNS.map((option) => (
            <ChoiceChip
              key={option.value}
              selected={breakdown === option.value}
              label={option.label}
              color={tint}
              onClick={() => setBreakdown(option.value)}
            />
          ))}
        </div>
      </div>

      <Card className="mb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tint={tint}>{report.dimension.status}</Pill>
              <span className="text-[11px] font-black text-muted">Score {report.dimension.score}/100</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[15px] font-black leading-snug text-ink">{report.takeaway}</p>
            {dimensionKey === "strength" && (
              <p className="mt-1 text-[11px] font-semibold text-muted">
                {strengthBand(report.dimension.score)} · compared with your own training history
              </p>
            )}
            <button type="button" onClick={() => setShowInsight(true)} className="mt-2 text-[11px] font-black" style={{ color: tint }}>
              Why this matters →
            </button>
          </div>
          <ScoreDial score={report.dimension.score} color={tint} />
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {report.stats.map((stat) => <StatTile key={stat.label} label={stat.label} value={stat.value} />)}
      </div>

      {breakdown === "trend" && (
        <>
          <PrimaryTrend keyName={dimensionKey} report={report} tint={tint} weeklyGoal={weeklyGoal} />
          <DimensionCharts keyName={dimensionKey} report={report} tint={tint} />
          <OverallInsight report={report} tint={tint} onOpenMethod={() => setShowMethod(true)} />
        </>
      )}

      {breakdown === "plans" && (
        <ContextScoreList
          title="Metric by plan"
          items={planContextScores}
          tint={tint}
          empty="No plan-linked sessions match these filters."
          onOpen={(id) => id !== "free" && onOpenPlan(id)}
        />
      )}

      {breakdown === "days" && (
        <ContextScoreList
          title="Metric by grouped planned day"
          items={dayContextScores}
          tint={tint}
          empty="No repeated planned days match these filters."
          onOpen={onOpenDay}
        />
      )}

      {breakdown === "exercises" && report.exercises.length > 0 && (
        <>
          <SectionHeader title="Exercise evidence" />
          <label className="mb-2 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
            <Icon.search className="h-4 w-4 text-muted" />
            <input
              value={exerciseQuery}
              onChange={(event) => setExerciseQuery(event.target.value)}
              placeholder="Filter exercises"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:text-muted"
            />
          </label>
          <Card className="!p-0">
            {report.exercises
              .filter((exercise) => exercise.name.toLowerCase().includes(exerciseQuery.trim().toLowerCase()))
              .slice(0, 20)
              .map((exercise, index) => (
              <button
                key={exercise.key}
                onClick={() => onOpenExercise(exercise.key)}
                className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-0"
              >
                <span className="w-5 shrink-0 text-[10px] font-black text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-ink">{exercise.name}</p>
                  <p className="truncate text-[11px] font-semibold text-muted">{exercise.detail}</p>
                </div>
                <EvidenceValue exercise={exercise} dimensionKey={dimensionKey} />
                <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
              </button>
            ))}
          </Card>
        </>
      )}

      {breakdown === "sessions" && report.sessions.length > 0 && (
        <>
          <SectionHeader title="Evidence log" />
          <div className="space-y-1.5">
            {report.sessions.slice(0, 8).map((session) => (
              <button
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left"
              >
                <div className="w-12 shrink-0">
                  <p className="text-xs font-black text-ink">{formatShortDate(session.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-ink">{session.title}</p>
                  <p className="truncate text-[11px] font-semibold text-muted">{session.detail}</p>
                </div>
                <span className="shrink-0 text-xs font-black" style={{ color: tint }}>
                  {formatEvidence(session.value, session.unit)}
                </span>
                <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </>
      )}

      {dimensionKey === "strength" && strengthGoals.length > 0 && (
        <>
          <SectionHeader title="Strength goals" />
          <div className="space-y-2">
            {strengthGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                current={goalCurrentValue(goal, report.dimension.score, contextScores, report)}
                color={tint}
                onEdit={onSaveGoal ? () => { setEditingGoal(goal); setGoalOpen(true); } : undefined}
              />
            ))}
          </div>
        </>
      )}

      <Sheet open={showMethod} onClose={() => setShowMethod(false)} title={report.method.title}>
        <p className="text-sm font-semibold leading-snug text-muted">{report.method.summary}</p>
        <MethodBlock title="Inputs" items={report.method.inputs} />
        <div className="mt-4 rounded-2xl bg-inset p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted">Calculation</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-ink">{report.method.formula}</p>
        </div>
        {dimensionKey === "strength" && (
          <div className="mt-4 rounded-2xl border border-line px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">What your score means</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
              {strengthBand(report.dimension.score)}. This is a progress score based on your own earlier workouts—not a ranking against other people. More comparable sessions make it more reliable.
            </p>
          </div>
        )}
        <MethodBlock title="Interpretation" items={report.method.thresholds} />
        <div className="mt-4 rounded-2xl border border-line px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted">Use with context</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">{report.method.caution}</p>
        </div>
      </Sheet>

      <Sheet open={showInsight} onClose={() => setShowInsight(false)} title={`${report.dimension.label} insight`}>
        <Pill tint={tint}>{report.dimension.status}</Pill>
        <p className="mt-4 text-base font-black leading-snug text-ink">{report.takeaway}</p>
        <div className="mt-4 rounded-2xl bg-inset p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted">Reflection</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">{report.reflection}</p>
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-muted">Interpret carefully</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">{report.method.caution}</p>
      </Sheet>

      {dimensionKey === "strength" && athleteId && viewerId && onSaveGoal && (
        <ProgressGoalEditor
          open={goalOpen}
          goal={editingGoal}
          athleteId={athleteId}
          viewerId={viewerId}
          contexts={goalContexts}
          defaultTargetType="score"
          suggestedTargetValue={Math.min(100, Math.max(70, report.dimension.score + 10))}
          metric="strength"
          onClose={() => setGoalOpen(false)}
          onSave={onSaveGoal}
          onDelete={onDeleteGoal}
        />
      )}
    </>
  );
}

function FilterBar({
  weeks,
  category,
  effort,
  tint,
  onWeeks,
  onCategory,
  onEffort,
}: {
  weeks: number;
  category: ExerciseCategory | "all";
  effort: EffortFilter;
  tint: string;
  onWeeks: (value: number) => void;
  onCategory: (value: ExerciseCategory | "all") => void;
  onEffort: (value: EffortFilter) => void;
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-line bg-inset p-0.5">
          {RANGES.map((range) => (
            <button
              key={range.weeks}
              type="button"
              onClick={() => onWeeks(range.weeks)}
              aria-pressed={weeks === range.weeks}
              className={`h-8 rounded-full px-2.5 text-[11px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${weeks === range.weeks ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Effort filter"
          value={effort}
          onChange={(event) => onEffort(event.target.value as EffortFilter)}
          className="ml-auto h-9 min-w-0 max-w-[170px] rounded-full border border-line bg-surface px-2.5 text-[11px] font-black text-ink outline-none focus:border-accent"
        >
          {EFFORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" aria-label="Exercise category">
        {CATEGORIES.map((option) => (
          <ChoiceChip
            key={option.value}
            selected={category === option.value}
            label={option.label}
            color={option.value === "all" ? tint : CATEGORY_COLORS[option.value]}
            onClick={() => onCategory(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceChip({
  selected,
  label,
  color,
  onClick,
}: {
  selected: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97] ${
        selected ? "shadow-sm" : "border-line bg-surface text-muted hover:border-ink/20 hover:text-ink"
      }`}
      style={selected ? {
        color,
        background: `color-mix(in srgb, ${color} 12%, var(--t-surface))`,
        borderColor: `color-mix(in srgb, ${color} 45%, var(--t-line))`,
      } : undefined}
    >
      {selected && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {label}
    </button>
  );
}

function OverallInsight({
  report,
  tint,
  onOpenMethod,
}: {
  report: DimensionReport;
  tint: string;
  onOpenMethod: () => void;
}) {
  return (
    <>
      <SectionHeader
        title="Overall insight"
        action={(
          <button type="button" onClick={onOpenMethod} className="text-[11px] font-black" style={{ color: tint }}>
            How it works
          </button>
        )}
      />
      <Card>
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm"
            style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, var(--t-inset))` }}
            aria-hidden="true"
          >
            ✦
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-snug text-ink">{report.reflection}</p>
            <p className="mt-2 text-[11px] font-bold text-muted">
              Based on {report.analysedSessions} session{report.analysedSessions === 1 ? "" : "s"} · {report.dimension.confidence} confidence
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

function PrimaryTrend({
  keyName,
  report,
  tint,
  weeklyGoal,
}: {
  keyName: DimensionKey;
  report: DimensionReport;
  tint: string;
  weeklyGoal: number;
}) {
  const config: Record<DimensionKey, {
    title: string;
    value: (week: DimensionReport["weeks"][number]) => number | null;
    detail: (week: DimensionReport["weeks"][number]) => string;
    format: (value: number) => string;
  }> = {
    strength: {
      title: "Adjusted output trend",
      value: (week) => week.performance || null,
      detail: (week) => `${round(week.performance, 1)} output · ${week.sets} sets`,
      format: (value) => round(value, 1).toString(),
    },
    endurance: {
      title: "Later-set strength trend",
      value: (week) => week.sets > 1 ? week.retention : null,
      detail: (week) => `${Math.round(week.retention)}% of first-set performance kept · ${week.sets} sets`,
      format: (value) => `${Math.round(value)}%`,
    },
    consistency: {
      title: "Training rhythm trend",
      value: (week) => week.sessions,
      detail: (week) => `${week.sessions} of ${weeklyGoal} target days · ${week.sets} sets`,
      format: (value) => `${Math.round(value)} days`,
    },
    capacity: {
      title: "Manageable workload trend",
      value: (week) => week.sets ? week.qualitySets / week.sets * 100 : null,
      detail: (week) => `${week.qualitySets} of ${week.sets} sets felt manageable`,
      format: (value) => `${Math.round(value)}%`,
    },
    recovery: {
      title: "Effort trend",
      value: (week) => week.avgRpe,
      detail: (week) => week.avgRpe === null ? "No effort scores recorded" : `Average effort ${round(week.avgRpe, 1)}/10 · ${week.sets} sets`,
      format: (value) => `${round(value, 1)}/10`,
    },
    stability: {
      title: "Output baseline trend",
      value: (week) => week.performance || null,
      detail: (week) => `${round(week.performance, 1)} mean output · ${week.sessions} sessions`,
      format: (value) => round(value, 1).toString(),
    },
  };
  const selected = config[keyName];
  const data = report.weeks.flatMap((week) => {
    const value = selected.value(week);
    return value === null ? [] : [{ label: week.label, value, detail: selected.detail(week) }];
  });
  return (
    <>
      <SectionHeader title={selected.title} />
      <Card className="overflow-hidden">
        <LineChart data={data} color={tint} height={190} format={selected.format} emptyMessage="More comparable weeks are needed for this trend." />
      </Card>
    </>
  );
}

function DimensionCharts({
  keyName,
  report,
  tint,
}: {
  keyName: DimensionKey;
  report: DimensionReport;
  tint: string;
}) {
  const weekly = (value: (week: DimensionReport["weeks"][number]) => number, detail: (week: DimensionReport["weeks"][number]) => string): Point[] =>
    report.weeks.map((week) => ({ label: week.label, value: value(week), detail: detail(week) }));

  if (keyName === "endurance") {
    return (
      <>
        <SectionHeader title="Muscle work × later-set strength" />
        <Card>
          <AngularRadarChart
            data={report.muscles.map((muscle) => ({
              label: muscle.label,
              value: muscle.load,
              detail: `${muscle.label} · ${Math.round(muscle.share * 100)}% of analysed work${muscle.retention === null ? "" : ` · ${Math.round(muscle.retention * 100)}% of first-set performance kept`}`,
              color: CATEGORY_COLORS[muscle.category],
            }))}
            color={tint}
          />
          <p className="mt-1 text-center text-[10px] font-semibold text-muted">The farther a point sits from the centre, the more work that muscle group received. Tap a point for details.</p>
        </Card>
        <SectionHeader title="Later-set strength by muscle group" />
        <Card>
          <HorizontalBars
            data={report.muscles.map((muscle) => ({ label: muscle.label, value: (muscle.retention ?? 0) * 100, color: CATEGORY_COLORS[muscle.category] }))}
            max={110}
            format={(value) => `${Math.round(value)}%`}
            reference={90}
          />
        </Card>
      </>
    );
  }

  if (keyName === "consistency") {
    return (
      <>
        <SectionHeader title="Exposure map" />
        <Card>
          <WeekPulse weeks={report.weeks} tint={tint} />
        </Card>
      </>
    );
  }

  if (keyName === "capacity") {
    return (
      <>
        <SectionHeader title="Productive workload" />
        <Card>
          <BarChart data={weekly((week) => week.sets, (week) => `${week.sets} sets · ${week.qualitySets} felt manageable`)} color={tint} />
        </Card>
        <SectionHeader title="Total lifting work and work rate" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Card>
            <LineChart data={weekly((week) => week.volume, (week) => `${Math.round(week.volume).toLocaleString()} kg`)} color={tint} format={(value) => `${Math.round(value).toLocaleString()} kg`} />
          </Card>
          <Card>
            <LineChart
              data={weekly((week) => week.density, (week) => `${round(week.density, 1)} sets per minute`)}
              color={`color-mix(in srgb, ${tint} 72%, var(--t-ink))`}
              format={(value) => `${round(value, 1)}/min`}
            />
          </Card>
        </div>
      </>
    );
  }

  if (keyName === "recovery") {
    return (
      <>
        <SectionHeader title="Performance versus baseline" />
        <Card>
          <DivergingBars data={report.exercises.slice(0, 12).map((exercise) => ({ label: exercise.name, value: exercise.primary }))} />
          <p className="mt-2 text-[10px] font-semibold text-muted">Recent two exposures versus the prior four. Below −4% counts as suppressed.</p>
        </Card>
      </>
    );
  }

  if (keyName === "stability") {
    return (
      <>
        <SectionHeader title="Baseline repeatability" />
        <Card>
          <HorizontalBars
            data={report.exercises.slice(0, 12).map((exercise) => ({ label: exercise.name, value: exercise.stability, color: exercise.stability >= 80 ? "var(--color-done)" : exercise.stability < 60 ? "var(--color-danger)" : tint }))}
            max={100}
            format={(value) => `${Math.round(value)}`}
            reference={80}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionHeader title="Exercise contribution" />
      <Card>
        <HorizontalBars
          data={report.exercises.slice(0, 10).map((exercise) => ({ label: exercise.name, value: exercise.primary, color: tint }))}
          format={(value) => `${round(value, 1)} kg`}
        />
      </Card>
    </>
  );
}

function ScoreDial({ score, color }: { score: number; color: string }) {
  const size = 60;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = radius * Math.PI * 2;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative h-[60px] w-[60px] shrink-0">
      <svg width={size} height={size} className="-rotate-90" aria-label={`Score ${score} out of 100`} role="img">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--t-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-black text-ink">{score}</span>
    </div>
  );
}

function HorizontalBars({
  data,
  max,
  format,
  reference,
}: {
  data: { label: string; value: number; color: string }[];
  max?: number;
  format: (value: number) => string;
  reference?: number;
}) {
  const ceiling = max ?? Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="truncate text-[11px] font-bold text-muted">{item.label}</span>
            <span className="shrink-0 text-xs font-black text-ink">{format(item.value)}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-inset">
            {reference !== undefined && <span className="absolute inset-y-[-2px] w-px bg-ink/30" style={{ left: `${Math.min(100, reference / ceiling * 100)}%` }} />}
            <div className="h-full rounded-full" style={{ width: `${Math.max(1, Math.min(100, item.value / ceiling * 100))}%`, background: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DivergingBars({ data }: { data: { label: string; value: number }[] }) {
  const ceiling = Math.max(5, ...data.map((item) => Math.abs(item.value)));
  return (
    <div className="space-y-2">
      {data.map((item) => {
        const width = Math.min(50, Math.abs(item.value) / ceiling * 50);
        return (
          <div key={item.label} className="grid grid-cols-[minmax(90px,1fr)_2fr_44px] items-center gap-2">
            <span className="truncate text-[11px] font-bold text-muted">{item.label}</span>
            <div className="relative h-1.5 rounded-full bg-inset">
              <span className="absolute inset-y-[-2px] left-1/2 w-px bg-ink/30" />
              <span
                className="absolute h-full rounded-full"
                style={{
                  width: `${width}%`,
                  left: item.value >= 0 ? "50%" : `${50 - width}%`,
                  background: item.value >= 0 ? "var(--color-done)" : "var(--color-danger)",
                }}
              />
            </div>
            <span className="text-right text-xs font-black" style={{ color: item.value >= 0 ? "var(--color-done)" : "var(--color-danger)" }}>
              {item.value > 0 ? "+" : ""}{Math.round(item.value)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeekPulse({ weeks, tint }: { weeks: DimensionReport["weeks"]; tint: string }) {
  const max = Math.max(1, ...weeks.map((week) => week.sessions));
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {weeks.map((week) => (
        <div key={week.weekStart} className="text-center">
          <div
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black text-ink"
            style={{ background: `color-mix(in srgb, ${tint} ${Math.round(12 + week.sessions / max * 60)}%, var(--t-inset))` }}
          >
            {week.sessions}
          </div>
          <p className="mt-1 truncate text-[9px] font-bold text-muted">{week.label}</p>
        </div>
      ))}
    </div>
  );
}

function EvidenceValue({ exercise, dimensionKey }: { exercise: ExerciseEvidence; dimensionKey: DimensionKey }) {
  const value = dimensionKey === "endurance" ? (exercise.retention === null ? "—" : `${Math.round(exercise.primary)}%`)
    : dimensionKey === "recovery" ? `${exercise.primary > 0 ? "+" : ""}${Math.round(exercise.primary)}%`
      : dimensionKey === "stability" ? `${Math.round(exercise.stability)}`
        : dimensionKey === "strength" ? `${round(exercise.primary, 1)} kg`
          : `${exercise.sessions}`;
  return <span className="shrink-0 text-xs font-black text-ink">{value}</span>;
}

interface ContextScore {
  id: string;
  label: string;
  subtitle: string;
  score: number;
  status: string;
}

function consistencyStatus(score: number): string {
  return score >= 85 ? "Very dependable" : score >= 65 ? "Mostly regular" : score >= 40 ? "Still building" : "Needs a steadier rhythm";
}

function goalCurrentValue(
  goal: ProgressGoal,
  overallScore: number,
  contexts: { plans: ContextScore[]; days: ContextScore[] },
  report: DimensionReport,
): number {
  if (goal.scope_type === "plan") return contexts.plans.find((item) => item.id === goal.scope_key)?.score ?? overallScore;
  if (goal.scope_type === "day") return contexts.days.find((item) => item.id === goal.scope_key)?.score ?? overallScore;
  if (goal.scope_type === "exercise") return report.exercises.find((item) => item.key === goal.scope_key)?.primary ?? 0;
  return overallScore;
}

function ContextScoreList({
  title,
  items,
  tint,
  empty,
  onOpen,
}: {
  title: string;
  items: ContextScore[];
  tint: string;
  empty: string;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <Card><p className="py-5 text-center text-sm font-semibold text-muted">{empty}</p></Card>
      ) : (
        <Card className="!p-0">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] font-black text-ink">{item.label}</p>
                  <span className="text-xs font-black" style={{ color: tint }}>{item.score}/100</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{item.subtitle} · {item.status}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-inset">
                  <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: tint }} />
                </div>
              </div>
              <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
            </button>
          ))}
        </Card>
      )}
    </>
  );
}

function buildContextScores({
  dimensionKey,
  sessions,
  logs,
  plans,
  dayGroups,
  planRuns,
  weeklyGoal,
  weeks,
  category,
  effort,
}: {
  dimensionKey: DimensionKey;
  sessions: Session[];
  logs: SetLog[];
  plans: PlanBundle[];
  dayGroups: DayGroup[];
  planRuns: ProgressPlanRun[];
  weeklyGoal: number;
  weeks: number;
  category: ExerciseCategory | "all";
  effort: EffortFilter;
}): { plans: ContextScore[]; days: ContextScore[] } {
  const today = new Date();
  const upper = localDate(today);
  const lower = localDate(addDays(today, -weeks * 7));
  const datedSessions = sessions.filter((session) => session.date >= lower && session.date <= upper);
  const datedIds = new Set(datedSessions.map((session) => session.id));
  const filteredLogs = logs.filter((log) => {
    if (!datedIds.has(log.session_id) || !setHasData(log)) return false;
    if (category !== "all" && categoryFor(log.exercise_name) !== category) return false;
    if (effort === "manageable" && log.rpe !== null && log.rpe > 8) return false;
    if (effort === "high" && (log.rpe === null || log.rpe < 8.5)) return false;
    return true;
  });
  const constrained = category !== "all" || effort !== "all";
  const evidenceIds = new Set(filteredLogs.map((log) => log.session_id));
  const eligibleSessions = constrained
    ? datedSessions.filter((session) => evidenceIds.has(session.id))
    : datedSessions;
  const eligibleIds = new Set(eligibleSessions.map((session) => session.id));
  const planNames = new Map(plans.map((bundle) => [bundle.plan.id, bundle.plan.name] as const));

  const score = (id: string, label: string, contextSessions: Session[]): ContextScore | null => {
    if (contextSessions.length === 0) return null;
    const ids = new Set(contextSessions.map((session) => session.id));
    const contextLogs = filteredLogs.filter((log) => ids.has(log.session_id));
    const contextRuns = planRuns.filter((run) => contextSessions.some((session) => session.plan_id === run.bundle.plan.id));
    const dimension = buildTrainingIntelligence(contextSessions, contextLogs, weeklyGoal, today, { planRuns: contextRuns })
      .dimensions.find((item) => item.key === dimensionKey);
    if (!dimension) return null;
    return {
      id,
      label,
      subtitle: `${contextSessions.length} session${contextSessions.length === 1 ? "" : "s"}`,
      score: dimension.score,
      status: dimension.status,
    };
  };

  const sessionsByPlan = new Map<string, Session[]>();
  for (const session of eligibleSessions) {
    const id = session.plan_id ?? "free";
    sessionsByPlan.set(id, [...(sessionsByPlan.get(id) ?? []), session]);
  }
  const planScores = [...sessionsByPlan.entries()]
    .flatMap(([id, contextSessions]) => {
      const item = score(id, id === "free" ? "Free work" : (planNames.get(id) ?? "Plan"), contextSessions);
      return item ? [item] : [];
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const dayScores = dayGroups
    .flatMap((group) => {
      const contextSessions = group.sessions.map((entry) => entry.session).filter((session) => eligibleIds.has(session.id));
      const item = score(group.key, group.title, contextSessions);
      return item ? [item] : [];
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return { plans: planScores, days: dayScores };
}

function MethodBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-xs font-semibold text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEvidence(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "% retained" || unit === "% kept") return `${Math.round(value)}%`;
  if (unit === "avg RPE" || unit === "average effort") return value ? `${round(value, 1)}/10` : "—";
  return `${round(value, 1)} ${unit}`;
}

function strengthBand(score: number): string {
  if (score >= 85) return "Exceptional upward momentum";
  if (score >= 70) return "Strong upward trend";
  if (score >= 55) return "Improving steadily";
  if (score >= 40) return "Holding your recent level";
  return "Establishing a reliable baseline";
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

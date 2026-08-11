import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { writeBatchLog } from "../../data/batchLogWriter";
import { makeSet } from "../../data/factories";
import type { PlanBundle, SetLog } from "../../data/types";
import { buildBatchExerciseRows, initialBatchSetCount } from "../../domain/batchLog";
import { addDays, formatShortDate, localDate, parseDate } from "../../domain/dates";
import { setHasData, targetForSet } from "../../domain/logging";
import { plural } from "../../domain/text";
import { Button, Icon, IconButton, Pill } from "../../ui/kit";

export interface BatchPlanOption {
  bundle: PlanBundle;
  start: string;
  end?: string | null;
}

function numberValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function initialDates(option: BatchPlanOption | undefined): { start: string; end: string } {
  const today = localDate();
  if (!option) return { start: today, end: today };
  const end = option.end && option.end < today ? option.end : today;
  const recent = localDate(addDays(parseDate(end), -27));
  return { start: option.start > recent ? option.start : recent, end };
}

/** A spreadsheet-like editor over concrete scheduled occurrences of a plan. */
export function BatchLogPage({
  onBack,
  athleteId,
  athleteName,
  plans,
  sessions,
  logs,
  initialDate,
  initialPlanId,
  onSaved,
  onToast,
}: {
  onBack: () => void;
  athleteId: string;
  athleteName?: string;
  plans: BatchPlanOption[];
  sessions: Parameters<typeof buildBatchExerciseRows>[0]["sessions"];
  logs: Parameters<typeof buildBatchExerciseRows>[0]["logs"];
  /** Opens directly on one historical/today occurrence when supplied. */
  initialDate?: string;
  initialPlanId?: string | null;
  onSaved: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [planIndex, setPlanIndex] = useState(0);
  const [range, setRange] = useState(() => initialDates(plans[0]));
  const [drafts, setDrafts] = useState<Record<string, SetLog[]>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dayFilter, setDayFilter] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [floatingGroupKey, setFloatingGroupKey] = useState<string | null>(null);
  const groupElements = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const requested = initialPlanId
      ? plans.findIndex((plan) => plan.bundle.plan.id === initialPlanId)
      : -1;
    const index = requested >= 0 ? requested : 0;
    setPlanIndex(index);
    const selected = plans[index];
    if (initialDate && selected) {
      const end = selected.end && selected.end < initialDate ? selected.end : initialDate;
      const date = end < selected.start ? selected.start : end;
      setRange({ start: date, end: date });
    } else {
      setRange(initialDates(selected));
    }
  }, [initialDate, initialPlanId]);

  const option = plans[planIndex];
  const rows = useMemo(
    () =>
      option
        ? buildBatchExerciseRows({
            bundle: option.bundle,
            start: range.start,
            end: range.end,
            startOverride: option.start,
            sessions,
            logs,
          })
        : [],
    [option, range.start, range.end, sessions, logs],
  );

  useEffect(() => {
    const next: Record<string, SetLog[]> = {};
    for (const row of rows) {
      const count = initialBatchSetCount(row.exercise, row.sets);
      next[row.key] = Array.from({ length: count }, (_, index) => {
        const stored = row.sets[index];
        return stored ?? makeSet(row.session?.id ?? "", row.exercise.name, index + 1, {
          plan_exercise_id: row.exercise.id,
        });
      });
    }
    setDrafts(next);
    // A batch can contain weeks of work. Keep the workspace scannable on
    // entry even when some exercises already have data; day and exercise
    // controls reveal only what the user asks to edit.
    setExpanded(new Set());
    setDirty(new Set());
    setError(null);
  }, [rows]);

  const plannedDays = useMemo(() => {
    const unique = new Map<string, string>();
    for (const row of rows) {
      const label = row.segment.day.title || row.segment.title;
      unique.set(label.toLocaleLowerCase(), label);
    }
    return [...unique.entries()].map(([id, label]) => ({ id, label }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = exerciseFilter.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const plannedDay = (row.segment.day.title || row.segment.title).toLocaleLowerCase();
      if (dayFilter && plannedDay !== dayFilter) return false;
      if (!query) return true;
      return [row.exercise.name, row.segment.title, row.segment.day.title]
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [rows, dayFilter, exerciseFilter]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { key: string; date: string; title: string; rows: typeof filteredRows }>();
    for (const row of filteredRows) {
      const title = row.segment.day.title || row.segment.title;
      const key = `${row.date}:${title.toLocaleLowerCase()}`;
      const existing = groups.get(key);
      if (existing) existing.rows.push(row);
      else groups.set(key, { key, date: row.date, title, rows: [row] });
    }
    return [...groups.values()];
  }, [filteredRows]);

  useEffect(() => {
    let frame = 0;
    const updateFloatingGroup = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let active: string | null = null;
        for (const group of groupedRows) {
          const element = groupElements.current[group.key];
          if (!element) continue;
          if (element.getBoundingClientRect().top <= 40) active = group.key;
          else break;
        }
        setFloatingGroupKey((current) => (current === active ? current : active));
      });
    };
    updateFloatingGroup();
    window.addEventListener("scroll", updateFloatingGroup, { passive: true });
    window.addEventListener("resize", updateFloatingGroup);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateFloatingGroup);
      window.removeEventListener("resize", updateFloatingGroup);
    };
  }, [groupedRows]);

  const allVisibleExpanded = filteredRows.length > 0 && filteredRows.every((row) => expanded.has(row.key));
  const floatingGroup = floatingGroupKey
    ? groupedRows.find((group) => group.key === floatingGroupKey)
    : undefined;

  useEffect(() => {
    if (dirty.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.size]);

  function leave() {
    if (dirty.size > 0 && !window.confirm("Discard your unsaved batch log changes?")) return;
    onBack();
  }

  function choosePlan(index: number) {
    setPlanIndex(index);
    setRange(initialDates(plans[index]));
    setDayFilter("");
    setExerciseFilter("");
  }

  function toggleRow(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    setExpanded((current) => {
      const next = new Set(current);
      for (const row of filteredRows) {
        if (allVisibleExpanded) next.delete(row.key);
        else next.add(row.key);
      }
      return next;
    });
  }

  function toggleDayGroup(groupRows: typeof filteredRows) {
    const allOpen = groupRows.every((row) => expanded.has(row.key));
    setExpanded((current) => {
      const next = new Set(current);
      for (const row of groupRows) {
        if (allOpen) next.delete(row.key);
        else next.add(row.key);
      }
      return next;
    });
  }

  function changeSet(key: string, index: number, patch: Partial<SetLog>) {
    setDrafts((current) => ({
      ...current,
      [key]: (current[key] ?? []).map((set, i) => (i === index ? { ...set, ...patch } : set)),
    }));
    setDirty((current) => new Set(current).add(key));
  }

  function changeExtra(key: string, index: number, field: string, value: string | number) {
    const current = drafts[key]?.[index];
    changeSet(key, index, { extra: { ...(current?.extra ?? {}), [field]: value } });
  }

  function addSet(key: string, exerciseName: string, exerciseId: string, sessionId = "") {
    setDrafts((current) => {
      const existing = current[key] ?? [];
      return {
        ...current,
        [key]: [
          ...existing,
          makeSet(sessionId, exerciseName, existing.length + 1, { plan_exercise_id: exerciseId }),
        ],
      };
    });
    setDirty((current) => new Set(current).add(key));
  }

  function removeSet(
    key: string,
    index: number,
    exerciseName: string,
    exerciseId: string,
    sessionId = "",
  ) {
    setDrafts((current) => {
      const remaining = (current[key] ?? []).filter((_, rowIndex) => rowIndex !== index);
      return {
        ...current,
        [key]: remaining.length > 0
          ? remaining
          : [makeSet(sessionId, exerciseName, 1, { plan_exercise_id: exerciseId })],
      };
    });
    setDirty((current) => new Set(current).add(key));
  }

  async function save() {
    if (!option || dirty.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const changed = rows
        .filter((row) => dirty.has(row.key))
        .map((row) => ({ ...row, sets: drafts[row.key] ?? [] }));
      const result = await writeBatchLog({ athleteId, bundle: option.bundle, changes: changed });
      await onSaved();
      setDirty(new Set());
      onToast(`Saved ${plural(result.sets, "set")} across ${plural(result.sessions, "session")}`);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save the batch log.");
    } finally {
      setSaving(false);
    }
  }

  const loggedSets = Object.values(drafts).reduce(
    (total, sets) => total + sets.filter(setHasData).length,
    0,
  );
  const maxEnd = option?.end && option.end < localDate() ? option.end : localDate();

  return (
    <div className="ui-batch-log-page pb-24">
      <header className="mb-5 flex items-center gap-3">
        <IconButton label="Back" onClick={leave}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-accent">Batch logging</p>
          <h1 className="truncate text-2xl font-black text-ink">
            {athleteName ? `Log for ${athleteName}` : "Batch log a plan"}
          </h1>
          <p className="text-xs font-semibold text-muted">Scheduled sessions and existing exercise data in one workspace.</p>
        </div>
      </header>

      {plans.length === 0 || !option ? (
        <p className="py-8 text-center text-sm font-semibold text-muted">
          There is no active plan to log yet.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold leading-relaxed text-muted">
            Planned rows stay blank until you enter a value. Saving the same date again updates its
            existing sets; it does not add another copy.
          </p>
          {athleteName && (
            <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
              Every saved session belongs to {athleteName}'s athlete profile. Your coach account is
              only the authorized editor.
            </p>
          )}

          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p>}

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[10px] font-black uppercase tracking-wide text-muted">
              Plan
              <select
                value={planIndex}
                onChange={(event) => choosePlan(Number(event.target.value))}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink"
              >
                {plans.map((plan, index) => (
                  <option key={plan.bundle.plan.id} value={index}>{plan.bundle.plan.name}</option>
                ))}
              </select>
            </label>
            <DateInput
              label="From"
              value={range.start}
              min={option.start}
              max={range.end}
              onChange={(start) => setRange((current) => ({ ...current, start }))}
            />
            <DateInput
              label="Through"
              value={range.end}
              min={range.start}
              max={maxEnd}
              onChange={(end) => setRange((current) => ({ ...current, end }))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const today = maxEnd;
                const date = today < option.start ? option.start : today;
                setRange({ start: date, end: date });
              }}
              className="rounded-full border border-line bg-inset px-3 py-1 text-[11px] font-black text-ink"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const start = localDate(addDays(parseDate(maxEnd), -6));
                setRange({ start: start < option.start ? option.start : start, end: maxEnd });
              }}
              className="rounded-full border border-line bg-inset px-3 py-1 text-[11px] font-black text-ink"
            >
              Last 7 days
            </button>
            <button
              type="button"
              onClick={() => setRange(initialDates(option))}
              className="rounded-full border border-line bg-inset px-3 py-1 text-[11px] font-black text-ink"
            >
              Last 4 weeks
            </button>
            <Pill tint="var(--t-accent)">{plural(rows.length, "scheduled exercise")}</Pill>
            <Pill tint="var(--color-done)">{plural(loggedSets, "filled set")}</Pill>
            <Pill tint="var(--t-muted)">maximum 366 days at once</Pill>
          </div>

          <div className="ui-batch-log-filters grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
            <label className="text-[10px] font-black uppercase tracking-wide text-muted">
              Planned day
              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-inset px-3 text-sm font-bold normal-case text-ink"
              >
                <option value="">All planned days</option>
                {plannedDays.map((day) => (
                  <option key={day.id} value={day.id}>{day.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-wide text-muted">
              Exercise
              <span className="relative mt-1 block">
                <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={exerciseFilter}
                  onChange={(event) => setExerciseFilter(event.target.value)}
                  placeholder="Search exercise name"
                  className="h-10 w-full rounded-xl border border-line bg-inset pl-9 pr-3 text-sm font-bold normal-case text-ink placeholder:text-muted/70"
                />
              </span>
            </label>
            <div className="flex gap-2 sm:justify-end">
              {(dayFilter || exerciseFilter) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDayFilter("");
                    setExerciseFilter("");
                  }}
                >
                  Clear
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={toggleAllVisible} disabled={filteredRows.length === 0}>
                {allVisibleExpanded ? "Collapse all" : "Expand all"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill tint="var(--t-accent)">{plural(filteredRows.length, "matching exercise")}</Pill>
            <span className="text-[11px] font-semibold text-muted">Select an exercise row to view or log its sets.</span>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl bg-inset px-3 py-8 text-center text-sm font-semibold text-muted">
              No exercises are scheduled in this range.
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-2xl bg-inset px-3 py-8 text-center text-sm font-semibold text-muted">
              No scheduled exercises match these filters.
            </p>
          ) : (
            <div className="relative">
              <div className="ui-batch-floating-anchor sticky top-2 z-50 h-0">
                {floatingGroup && (
                  <button
                    type="button"
                    aria-expanded={floatingGroup.rows.every((row) => expanded.has(row.key))}
                    aria-label={`Pinned day: ${floatingGroup.rows.every((row) => expanded.has(row.key)) ? "collapse" : "expand"} every exercise for ${floatingGroup.title} on ${formatShortDate(floatingGroup.date)}`}
                    onClick={() => toggleDayGroup(floatingGroup.rows)}
                    className="ui-batch-floating-day flex w-full items-center gap-2 rounded-2xl border border-line px-2.5 py-2 text-left"
                  >
                    <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">
                      {formatShortDate(floatingGroup.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-ink">{floatingGroup.title}</span>
                    <span className="shrink-0 text-[9px] font-bold text-muted">{plural(floatingGroup.rows.length, "exercise")}</span>
                    <Icon.chevron
                      className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${floatingGroup.rows.every((row) => expanded.has(row.key)) ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
              </div>
              <div className="ui-batch-log-grid overflow-x-auto rounded-2xl border border-line">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="sticky top-0 z-20 bg-surface">
                  <tr className="border-b border-line text-[10px] font-black uppercase tracking-wide text-muted">
                    <th className="sticky left-0 z-30 bg-surface px-3 py-2">Set details</th>
                    <th className="px-2 py-2">Set</th>
                    <th className="px-2 py-2">Load</th>
                    <th className="px-2 py-2">Reps</th>
                    <th className="px-2 py-2">Distance</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Incline</th>
                    <th className="px-2 py-2">Pace</th>
                    <th className="px-2 py-2">Custom / note</th>
                    <th className="px-2 py-2">Effort (0–10)</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((group) => {
                    const allGroupExpanded = group.rows.every((row) => expanded.has(row.key));
                    const groupLoggedSets = group.rows.reduce(
                      (total, row) => total + (drafts[row.key] ?? []).filter(setHasData).length,
                      0,
                    );
                    const groupTotalSets = group.rows.reduce(
                      (total, row) => total + (drafts[row.key] ?? []).length,
                      0,
                    );
                    const groupChanged = group.rows.some((row) => dirty.has(row.key));
                    const groupProgress = groupTotalSets > 0
                      ? Math.round((groupLoggedSets / groupTotalSets) * 100)
                      : 0;
                    const date = parseDate(group.date);
                    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
                    const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
                    const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
                    return (
                      <Fragment key={group.key}>
                        <tr
                          ref={(element) => { groupElements.current[group.key] = element; }}
                          className="ui-batch-day-group border-b border-line"
                        >
                          <td colSpan={11} className="p-2">
                            <button
                              type="button"
                              aria-expanded={allGroupExpanded}
                              aria-label={`${allGroupExpanded ? "Collapse" : "Expand"} every exercise for ${group.title} on ${formatShortDate(group.date)}`}
                              onClick={() => toggleDayGroup(group.rows)}
                              className="ui-batch-day-card flex items-center gap-3 rounded-2xl border border-line px-2.5 py-2 text-left"
                            >
                              <span className="ui-batch-date-chip grid h-12 w-12 shrink-0 place-items-center rounded-xl border px-1 py-1 text-center">
                                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-accent">{weekday}</span>
                                <span className="text-[17px] font-black leading-none text-ink">{day}</span>
                                <span className="text-[8px] font-black uppercase tracking-wide text-muted">{month}</span>
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-black text-ink">{group.title}</span>
                                <span className="mt-1 flex min-w-0 items-center gap-1.5">
                                  <span className="ui-batch-plan-chip inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-muted">
                                    <Icon.plan className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{option.bundle.plan.name}</span>
                                  </span>
                                  <span className="shrink-0 text-[10px] font-bold text-muted">
                                    {plural(group.rows.length, "exercise")}
                                  </span>
                                </span>
                              </span>
                              <span className="ui-batch-group-progress w-[4.4rem] shrink-0">
                                <span className="flex items-center justify-between text-[9px] font-black text-muted">
                                  <span>{groupLoggedSets}/{groupTotalSets}</span>
                                  <span>{groupProgress}%</span>
                                </span>
                                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line">
                                  <span
                                    className="block h-full rounded-full bg-accent transition-[width]"
                                    style={{ width: `${groupProgress}%` }}
                                  />
                                </span>
                                {groupChanged && <span className="mt-1 block text-right text-[8px] font-black uppercase text-accent">Edited</span>}
                              </span>
                              <span className="ui-batch-group-chevron grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted">
                                <Icon.chevron
                                  className={`h-3.5 w-3.5 transition-transform ${allGroupExpanded ? "rotate-90" : ""}`}
                                />
                              </span>
                            </button>
                          </td>
                        </tr>

                        {group.rows.map((row) => {
                          const sets = drafts[row.key] ?? [];
                          const open = expanded.has(row.key);
                          const completedSets = sets.filter(setHasData).length;
                          const supportsLoad = row.exercise.log_type === "strength" || row.exercise.log_type === "bodyweight";
                          const supportsReps = supportsLoad || row.exercise.log_type === "interval";
                          const supportsDistance = row.exercise.log_type === "cardio";
                          const supportsDuration = row.exercise.log_type === "cardio" || row.exercise.log_type === "timed" || row.exercise.log_type === "interval";
                          const supportsCardioDetail = row.exercise.log_type === "cardio";
                          return (
                            <Fragment key={row.key}>
                        <tr className="ui-batch-exercise-parent border-b border-line">
                          <td colSpan={11} className="p-0">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${open ? "Collapse" : "Expand"} ${row.exercise.name} on ${formatShortDate(row.date)}`}
                              onClick={() => toggleRow(row.key)}
                              className="flex w-full items-center gap-3 px-3 py-3 text-left"
                            >
                              <Icon.chevron
                                className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
                              />
                              <div className="w-52 min-w-0 shrink-0 sm:w-72">
                                <p className="truncate text-sm font-black text-ink">{row.exercise.name}</p>
                                <p className="truncate text-[11px] font-bold text-muted">
                                  {formatShortDate(row.date)} · {row.segment.day.title || row.segment.title}
                                  {row.segment.title !== row.segment.day.title && ` · ${row.segment.title}`}
                                </p>
                              </div>
                              {dirty.has(row.key) && <Pill tint="var(--t-accent)">Changed</Pill>}
                              <span className="shrink-0 text-[11px] font-black text-muted">
                                {completedSets}/{sets.length} sets logged
                              </span>
                            </button>
                          </td>
                        </tr>

                        {open && sets.map((set, index) => {
                          const target = targetForSet(row.exercise, index + 1);
                          const performed = setHasData(set);
                          return (
                            <tr key={`${row.key}:${set.id}:${index}`} className="ui-batch-set-row border-b border-line/70">
                              <td className="sticky left-0 z-10 bg-surface px-3 py-2 align-middle">
                                <div className="flex w-40 items-center gap-2 pl-7">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: performed ? "var(--color-done)" : "var(--t-line)" }}
                                  />
                                  <span className="text-[11px] font-black text-muted">
                                    {performed ? "Logged set" : "Planned set"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-xs font-black text-muted">{index + 1}</td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.weight_kg}
                                  placeholder={supportsLoad ? (target.weight === null ? "—" : String(target.weight)) : "N/A"}
                                  disabled={!supportsLoad}
                                  onChange={(value) => changeSet(row.key, index, { weight_kg: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.reps}
                                  placeholder={supportsReps ? (target.reps === null ? "—" : String(target.reps)) : "N/A"}
                                  disabled={!supportsReps}
                                  onChange={(value) => changeSet(row.key, index, { reps: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.distance_km}
                                  placeholder={supportsDistance ? "km" : "N/A"}
                                  disabled={!supportsDistance}
                                  onChange={(value) => changeSet(row.key, index, { distance_km: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.duration_sec}
                                  placeholder={supportsDuration ? "sec" : "N/A"}
                                  disabled={!supportsDuration}
                                  onChange={(value) => changeSet(row.key, index, { duration_sec: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.incline_percent}
                                  placeholder={supportsCardioDetail ? "%" : "N/A"}
                                  disabled={!supportsCardioDetail}
                                  onChange={(value) => changeSet(row.key, index, { incline_percent: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.pace_sec_per_km}
                                  placeholder={supportsCardioDetail ? "sec/km" : "N/A"}
                                  disabled={!supportsCardioDetail}
                                  onChange={(value) => changeSet(row.key, index, { pace_sec_per_km: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex min-w-48 flex-wrap gap-1.5">
                                  {row.exercise.custom_fields.map((field) => (
                                    <label key={field.key} className="text-[9px] font-black uppercase text-muted">
                                      {field.label}{field.unit ? ` (${field.unit})` : ""}
                                      {field.type === "number" ? (
                                        <GridNumber
                                          value={numberValue(String(set.extra?.[field.key] ?? ""))}
                                          placeholder="—"
                                          onChange={(value) => changeExtra(row.key, index, field.key, value ?? "")}
                                        />
                                      ) : (
                                        <input
                                          value={String(set.extra?.[field.key] ?? "")}
                                          onChange={(event) => changeExtra(row.key, index, field.key, event.target.value)}
                                          className="block h-9 w-24 rounded-lg border border-line bg-inset px-2 text-xs font-bold normal-case text-ink"
                                        />
                                      )}
                                    </label>
                                  ))}
                                  <label className="text-[9px] font-black uppercase text-muted">
                                    Note
                                    <input
                                      value={set.note}
                                      onChange={(event) => changeSet(row.key, index, { note: event.target.value })}
                                      className="block h-9 w-28 rounded-lg border border-line bg-inset px-2 text-xs font-bold normal-case text-ink"
                                    />
                                  </label>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <GridNumber
                                  value={set.rpe}
                                  placeholder={target.rpe === null ? "—" : String(target.rpe)}
                                  max={10}
                                  onChange={(value) => changeSet(row.key, index, { rpe: value })}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSet(
                                        row.key,
                                        index,
                                        row.exercise.name,
                                        row.exercise.id,
                                        row.session?.id,
                                      )
                                    }
                                    aria-label={`Remove set ${index + 1} from ${row.exercise.name}`}
                                    className="rounded-lg p-1.5 text-muted active:text-danger"
                                  >
                                    <Icon.trash className="h-3.5 w-3.5" />
                                  </button>
                                  {index === sets.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => addSet(row.key, row.exercise.name, row.exercise.id, row.session?.id)}
                                      className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-line px-2 py-1.5 text-[10px] font-black text-muted"
                                    >
                                      <Icon.plus className="h-3 w-3" /> Set
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ui-batch-log-save sticky bottom-3 z-40 mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <p className="min-w-0 flex-1 text-xs font-bold text-muted">
          {dirty.size === 0 ? "No unsaved changes" : `${plural(dirty.size, "exercise")} changed`}
        </p>
        <Button variant="secondary" onClick={leave}>Back</Button>
        <Button onClick={save} disabled={saving || dirty.size === 0}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function DateInput({ label, value, min, max, onChange }: { label: string; value: string; min: string; max: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wide text-muted">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onInput={(event) => onChange(event.currentTarget.value)}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink"
      />
    </label>
  );
}

function GridNumber({ value, placeholder, disabled, max, onChange }: { value: number | null; placeholder: string; disabled?: boolean; max?: number; onChange: (value: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step="any"
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(numberValue(event.target.value))}
      className="h-9 w-20 rounded-lg border border-line bg-inset px-2 text-xs font-bold text-ink placeholder:text-muted/60 disabled:opacity-35"
    />
  );
}

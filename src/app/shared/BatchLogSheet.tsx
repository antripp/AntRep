import { useEffect, useMemo, useState } from "react";
import { writeBatchLog } from "../../data/batchLogWriter";
import { makeSet } from "../../data/factories";
import type { PlanBundle, SetLog } from "../../data/types";
import { buildBatchExerciseRows, initialBatchSetCount } from "../../domain/batchLog";
import { addDays, formatShortDate, localDate, parseDate } from "../../domain/dates";
import { setHasData, targetForSet } from "../../domain/logging";
import { plural } from "../../domain/text";
import { Button, Icon, Pill, Sheet } from "../../ui/kit";

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
export function BatchLogSheet({
  open,
  onClose,
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
  open: boolean;
  onClose: () => void;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, initialDate, initialPlanId]);

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
    if (!open) return;
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
    setDirty(new Set());
    setError(null);
  }, [open, rows]);

  function choosePlan(index: number) {
    setPlanIndex(index);
    setRange(initialDates(plans[index]));
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
      onClose();
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
    <Sheet
      open={open}
      onClose={onClose}
      title={athleteName ? `Log for ${athleteName}` : "Batch log a plan"}
      wide
      footer={
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs font-bold text-muted">
            {dirty.size === 0 ? "No unsaved changes" : `${plural(dirty.size, "exercise")} changed`}
          </p>
          <Button onClick={save} disabled={saving || dirty.size === 0}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
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

          {rows.length === 0 ? (
            <p className="rounded-2xl bg-inset px-3 py-8 text-center text-sm font-semibold text-muted">
              No exercises are scheduled in this range.
            </p>
          ) : (
            <div className="max-h-[58vh] overflow-auto rounded-2xl border border-line">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="sticky top-0 z-20 bg-surface">
                  <tr className="border-b border-line text-[10px] font-black uppercase tracking-wide text-muted">
                    <th className="sticky left-0 z-30 bg-surface px-3 py-2">Date / exercise</th>
                    <th className="px-2 py-2">Set</th>
                    <th className="px-2 py-2">Load</th>
                    <th className="px-2 py-2">Reps</th>
                    <th className="px-2 py-2">Distance</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Incline</th>
                    <th className="px-2 py-2">Pace</th>
                    <th className="px-2 py-2">Custom / note</th>
                    <th className="px-2 py-2">RPE</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((row) => {
                    const sets = drafts[row.key] ?? [];
                    return sets.map((set, index) => {
                      const target = targetForSet(row.exercise, index + 1);
                      const first = index === 0;
                      return (
                        <tr key={`${row.key}:${set.id}:${index}`} className="border-b border-line/70">
                          <td className="sticky left-0 z-10 bg-surface px-3 py-2 align-top">
                            {first ? (
                              <div className="w-48">
                                <p className="text-xs font-black text-ink">
                                  {formatShortDate(row.date)} · {row.exercise.name}
                                </p>
                                <p className="truncate text-[10px] font-bold text-muted">{row.segment.title}</p>
                              </div>
                            ) : <span className="sr-only">{row.exercise.name}</span>}
                          </td>
                          <td className="px-2 py-2 text-xs font-black text-muted">{index + 1}</td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.weight_kg}
                              placeholder={target.weight === null ? "—" : String(target.weight)}
                              onChange={(value) => changeSet(row.key, index, { weight_kg: value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.reps}
                              placeholder={target.reps === null ? "—" : String(target.reps)}
                              onChange={(value) => changeSet(row.key, index, { reps: value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.distance_km}
                              placeholder="km"
                              onChange={(value) => changeSet(row.key, index, { distance_km: value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.duration_sec}
                              placeholder="sec"
                              onChange={(value) => changeSet(row.key, index, { duration_sec: value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.incline_percent}
                              placeholder="%"
                              onChange={(value) => changeSet(row.key, index, { incline_percent: value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <GridNumber
                              value={set.pace_sec_per_km}
                              placeholder="sec/km"
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
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DateInput({ label, value, min, max, onChange }: { label: string; value: string; min: string; max: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wide text-muted">
      {label}
      <input type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink" />
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

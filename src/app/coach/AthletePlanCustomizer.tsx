import { useEffect, useMemo, useState } from "react";
import { api } from "../../data";
import { newId } from "../../data/factories";
import type { PlanAssignment, PlanAssignmentRemark, PlanBundle, PlanDay, PlanExercise, Session, SetDetail } from "../../data/types";
import { applyAssignmentOverrides, workloadDiff } from "../../domain/assignmentPlan";
import { addDays, formatShortDate, localDate, parseDate } from "../../domain/dates";
import { prescriptionLabel } from "../../domain/logging";
import {
  isCyclePlan,
  planDurationDays,
  planSlots,
  resolveSegments,
  slotIndex,
  slotLabel,
  typeColor,
  typeIcon,
} from "../../domain/plan";
import { remarkPeriodCount, remarkPeriodNoun } from "../../domain/planRemarks";
import { newTimelineImpacts } from "../../domain/timelineSafety";
import { Button, Card, Field, Icon, IconButton, NumberField, Pill, SectionHeader, Sheet, Toggle } from "../../ui/kit";
import { DayBoard } from "../plans/DayBoard";

/** Coach-only assignment editor: dates + workload, never the shared template. */
export function AthletePlanCustomizer({
  open,
  athleteName,
  template,
  assignment,
  coachId,
  remarks,
  loggedSessions,
  onClose,
  onSaved,
  onToast,
}: {
  open: boolean;
  athleteName: string;
  template: PlanBundle;
  assignment: PlanAssignment;
  coachId: string;
  remarks: PlanAssignmentRemark[];
  loggedSessions: Session[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const effective = useMemo(
    () => applyAssignmentOverrides(template, assignment),
    [template, assignment],
  );
  const [draft, setDraft] = useState<PlanBundle>(() => structuredClone(effective));
  const [start, setStart] = useState(assignment.start_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const assignmentRemarks = useMemo(
    () => remarks.filter((remark) => remark.assignment_id === assignment.id),
    [remarks, assignment.id],
  );
  const initialRemarkDraft = useMemo(
    () => Object.fromEntries(assignmentRemarks.map((remark) => [remarkKey(remark), remark.note])),
    [assignmentRemarks],
  );
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>(initialRemarkDraft);
  const [remarkWeek, setRemarkWeek] = useState(1);
  const [editingDay, setEditingDay] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(structuredClone(effective));
    setStart(assignment.start_date ?? "");
    setError(null);
    setAcknowledged(false);
    setRemarkDraft(initialRemarkDraft);
    setRemarkWeek(1);
    setEditingDay(null);
  }, [open, effective, assignment.start_date, assignment.end_date, initialRemarkDraft]);

  const end = start
    ? localDate(addDays(parseDate(start), planDurationDays(template.plan) - 1))
    : "";

  function updateExercise(id: string, patch: Partial<PlanExercise>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, ...patch } : exercise,
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.setAssignmentDates(assignment.id, {
        start_date: start || null,
        end_date: end || null,
      });
      await api.setAssignmentExerciseOverrides(assignment.id, workloadDiff(template, draft));
      const keys = new Set([
        ...assignmentRemarks.map((remark) => remarkKey(remark)),
        ...Object.keys(remarkDraft),
      ]);
      await Promise.all(
        [...keys].map(async (key) => {
          const existing = assignmentRemarks.find((remark) => remarkKey(remark) === key);
          const note = (remarkDraft[key] ?? "").trim();
          if (!note) {
            if (existing) await api.deleteAssignmentRemark(existing.id);
            return;
          }
          if (existing?.note === note) return;
          const target = parseRemarkKey(key);
          await api.saveAssignmentRemark({
            id: existing?.id ?? newId(),
            assignment_id: assignment.id,
            coach_id: coachId,
            scope: target.scope,
            week_index: target.weekIndex,
            plan_exercise_id: target.exerciseId,
            note,
            created_at: existing?.created_at,
          });
        }),
      );
      await onSaved();
      onToast(`${template.plan.name} customized for ${athleteName}`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save this athlete's plan.");
    } finally {
      setSaving(false);
    }
  }

  const overrideCount = Object.keys(workloadDiff(template, draft)).length;
  const dateImpacts = newTimelineImpacts({
    before: template,
    after: template,
    sessions: loggedSessions,
    beforeStart: assignment.start_date,
    afterStart: start || null,
    beforeEnd: assignment.end_date,
    afterEnd: end || null,
  });

  const cycle = isCyclePlan(template.plan);
  const outlineWeek = template.plan.repeat_mode === "auto" ? 1 : remarkWeek;
  const slots = planSlots(template.plan, outlineWeek);
  const slotDays = useMemo(() => {
    const pool = draft.days.filter(
      (day) =>
        (cycle ? day.cycle_day !== null : day.cycle_day === null) &&
        day.week_index === outlineWeek,
    );
    return slots.map(
      (slot) => pool.find((day) => slotIndex(template.plan, day) === slot) ?? null,
    );
  }, [cycle, draft.days, outlineWeek, slots, template.plan]);
  const editing = draft.days.find((day) => day.id === editingDay) ?? null;

  if (!open) return null;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={onClose}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-ink">{template.plan.name}</h1>
          <p className="truncate text-xs font-bold text-muted">Assigned plan · {athleteName}</p>
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || (dateImpacts.length > 0 && !acknowledged)}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p>}

      <Card className="mb-3" tint="var(--t-accent)">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-accent/10 p-2 text-accent">
            <Icon.edit className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Customize the outline for {athleteName}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
              The base plan keeps its days, exercises, and generic notes. Changes here apply only
              to this athlete's dates, workload, and performance guidance.
            </p>
          </div>
          <Pill tint="var(--t-accent)">Athlete layer</Pill>
        </div>
      </Card>

      {dateImpacts.length > 0 && (
        <Card className="mb-3" tint="var(--color-gold)">
          <p className="text-sm font-black text-ink">
            {dateImpacts.length} existing session{dateImpacts.length === 1 ? "" : "s"} will no longer match this schedule
          </p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
            Logged work on {dateImpacts.slice(0, 4).map(({ session }) => session.date).join(", ")}
            {dateImpacts.length > 4 ? ` and ${dateImpacts.length - 4} more` : ""} stays on its
            performed date and will not be moved or deleted.
          </p>
          <Button className="mt-3" size="sm" variant={acknowledged ? "secondary" : "primary"} onClick={() => setAcknowledged((value) => !value)}>
            {acknowledged ? "Safety confirmed" : "Preserve those logs and allow save"}
          </Button>
        </Card>
      )}

      <Card className="mb-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <DateOverride label="Athlete start" value={start} placeholder="Choose a start date" onChange={(value) => { setStart(value); setAcknowledged(false); }} />
          <div className="rounded-xl bg-inset px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted">Automatic end</p>
            <p className="mt-1 text-sm font-black text-ink">{end ? formatShortDate(end) : "Set after choosing a start"}</p>
            <p className="mt-1 text-[10px] font-semibold text-muted">{planDurationDays(template.plan)} inclusive days · outline duration unchanged</p>
          </div>
        </div>
      </Card>

      <Card className="mb-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">Plan notes</p>
            <p className="text-xs font-semibold text-muted">Generic outline first, then this athlete's focus.</p>
          </div>
          <Pill>Base + athlete</Pill>
        </div>
        <div className="mb-3 rounded-xl bg-inset px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted">Generic outline note</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-ink">
            {template.plan.notes || "No generic plan note has been added to this outline."}
          </p>
        </div>
        <Field label={`Additional guidance for ${athleteName}`}>
          <RemarkArea
            value={remarkDraft["plan::"] ?? ""}
            placeholder="Overall focus based on this athlete's performance"
            onChange={(value) => setRemarkDraft((current) => ({ ...current, "plan::": value }))}
          />
        </Field>
      </Card>

      <SectionHeader title="Progress block" />
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: remarkPeriodCount(template.plan) }, (_, index) => index + 1).map((period) => (
          <button
            key={period}
            onClick={() => { setRemarkWeek(period); setEditingDay(null); }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
              period === remarkWeek ? "bg-accent text-white" : "border border-line bg-surface text-muted"
            }`}
          >
            {remarkPeriodNoun(template.plan)} {period}
          </button>
        ))}
      </div>

      <Card className="mb-3" tint="var(--t-accent)">
        <Field label={`${remarkPeriodNoun(template.plan)} ${remarkWeek} guidance`}>
          <RemarkArea
            value={remarkDraft[`week:${remarkWeek}:`] ?? ""}
            placeholder="What should progress, stay consistent, or be watched in this block?"
            onChange={(value) => setRemarkDraft((current) => ({
              ...current,
              [`week:${remarkWeek}:`]: value,
            }))}
          />
        </Field>
      </Card>

      <SectionHeader title={cycle ? `${remarkPeriodNoun(template.plan)} ${remarkWeek} schedule` : "Week schedule"} />
      <DayBoard
        label="Assigned plan days"
        columns={slotDays.map((day, index) => {
          const slot = slots[index];
          const exercises = day ? resolveSegments(draft, day).flatMap((segment) => segment.exercises) : [];
          return {
            key: String(slot),
            chip: slotLabel(template.plan, slot, true),
            empty: exercises.length === 0,
            content: (
              <AssignmentDayColumn
                plan={template.plan}
                day={day}
                slot={slot}
                exercises={exercises}
                onOpen={() => day && setEditingDay(day.id)}
              />
            ),
          };
        })}
      />

      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ink">
              {overrideCount === 0 ? "Using the outline workload" : `${overrideCount} customized exercise${overrideCount === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs font-semibold text-muted">Generic notes remain part of the base outline.</p>
          </div>
          <Button onClick={save} disabled={saving || (dateImpacts.length > 0 && !acknowledged)}>
            {saving ? "Saving…" : "Save athlete plan"}
          </Button>
        </div>
      </Card>

      {editing && (
        <AssignmentDayEditor
          athleteName={athleteName}
          plan={template}
          draft={draft}
          day={editing}
          period={remarkWeek}
          remarkDraft={remarkDraft}
          onRemarkChange={(key, value) => setRemarkDraft((current) => ({ ...current, [key]: value }))}
          onExerciseChange={updateExercise}
          onClose={() => setEditingDay(null)}
        />
      )}
    </>
  );
}

function AssignmentDayColumn({
  plan,
  day,
  slot,
  exercises,
  onOpen,
}: {
  plan: PlanBundle["plan"];
  day: PlanDay | null;
  slot: number;
  exercises: PlanExercise[];
  onOpen: () => void;
}) {
  const type = day?.day_type ?? "rest";
  const tint = typeColor(type, day?.color_hex);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!day}
      className="flex min-h-56 w-full flex-col rounded-card border border-line bg-surface p-3 text-left transition active:scale-[0.99] disabled:opacity-70"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ background: `${tint}20` }}>
          {typeIcon(type, day?.icon_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-ink">{day?.title || "Rest"}</p>
          <p className="text-[11px] font-bold text-muted">{slotLabel(plan, slot, true)}</p>
        </div>
        {day && <Icon.chevron className="h-4 w-4 text-muted" />}
      </div>
      <div className="w-full space-y-1.5">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="rounded-xl bg-inset px-2.5 py-2">
            <p className="truncate text-xs font-bold text-ink">{exercise.name}</p>
            <p className="text-[10px] font-semibold text-muted">{prescriptionLabel(exercise)}</p>
          </div>
        ))}
        {exercises.length === 0 && (
          <p className="rounded-xl bg-inset px-3 py-5 text-center text-xs font-semibold text-muted">Rest / no exercises</p>
        )}
      </div>
      {day && exercises.length > 0 && <p className="mt-auto pt-3 text-[11px] font-black text-accent">Customize this day</p>}
    </button>
  );
}

function AssignmentDayEditor({
  athleteName,
  plan,
  draft,
  day,
  period,
  remarkDraft,
  onRemarkChange,
  onExerciseChange,
  onClose,
}: {
  athleteName: string;
  plan: PlanBundle;
  draft: PlanBundle;
  day: PlanDay;
  period: number;
  remarkDraft: Record<string, string>;
  onRemarkChange: (key: string, value: string) => void;
  onExerciseChange: (id: string, patch: Partial<PlanExercise>) => void;
  onClose: () => void;
}) {
  const exercises = resolveSegments(draft, day).flatMap((segment) => segment.exercises);
  return (
    <Sheet open onClose={onClose} title={`${day.title} · ${athleteName}`} wide>
      <div className="space-y-3">
        <Card tint="var(--t-accent)">
          <p className="text-xs font-black text-ink">Outline stays shared</p>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted">
            Exercise names and day structure come from the base plan. Workload and {remarkPeriodNoun(plan.plan).toLowerCase()} {period} notes below apply only to {athleteName}.
          </p>
        </Card>
        {exercises.map((exercise) => {
          const base = plan.exercises.find((item) => item.id === exercise.id) ?? exercise;
          const changed = JSON.stringify(workloadDiff(
            { ...plan, exercises: [base] },
            { ...draft, exercises: [exercise] },
          )) !== "{}";
          return (
            <Card key={exercise.id} tint={changed ? "var(--t-accent)" : undefined}>
              <div className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-ink">{exercise.name}</p>
                  <p className="text-[11px] font-bold text-muted">Outline: {prescriptionLabel(base)}</p>
                </div>
                {changed && <Pill tint="var(--t-accent)">Customized</Pill>}
                {changed && <Button size="sm" variant="secondary" onClick={() => onExerciseChange(exercise.id, base)}>Reset</Button>}
              </div>

              {base.trainer_notes && (
                <div className="mb-3 rounded-xl bg-inset px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-muted">Generic exercise note</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-ink">{base.trainer_notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Field label="Sets"><NumberField value={exercise.target_sets} min={0} max={20} onChange={(value) => onExerciseChange(exercise.id, { target_sets: value ?? 0 })} /></Field>
                <Field label="Reps"><NumberField value={exercise.target_reps} min={0} max={500} onChange={(value) => onExerciseChange(exercise.id, { target_reps: value ?? 0 })} /></Field>
                <Field label="Load"><NumberField value={exercise.target_weight_kg} min={0} step={2.5} suffix="kg" onChange={(value) => onExerciseChange(exercise.id, { target_weight_kg: value ?? 0 })} /></Field>
                <Field label="Rest"><NumberField value={exercise.rest_sec} min={0} step={15} suffix="sec" onChange={(value) => onExerciseChange(exercise.id, { rest_sec: value ?? 0 })} /></Field>
                <Field label="Target effort (0–10)"><NumberField value={exercise.rpe_target || null} min={0} max={10} step={0.5} onChange={(value) => onExerciseChange(exercise.id, { rpe_target: value ?? 0 })} /></Field>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink">Required exercise</p>
                  <p className="text-[10px] font-semibold text-muted">Counts toward session completion</p>
                </div>
                <Toggle label="Required exercise" checked={exercise.is_mandatory} onChange={(value) => onExerciseChange(exercise.id, { is_mandatory: value })} />
              </div>

              <div className="mt-3">
                <Field label={`Additional ${remarkPeriodNoun(plan.plan).toLowerCase()} ${period} note for ${athleteName}`}>
                  <RemarkArea
                    value={remarkDraft[`exercise:${period}:${exercise.id}`] ?? ""}
                    placeholder={`Performance cue or progression note for ${exercise.name}`}
                    onChange={(value) => onRemarkChange(`exercise:${period}:${exercise.id}`, value)}
                  />
                </Field>
              </div>

              <SetBreakdown exercise={exercise} onChange={(set_details) => onExerciseChange(exercise.id, { set_details })} />
            </Card>
          );
        })}
      </div>
    </Sheet>
  );
}

function remarkKey(remark: PlanAssignmentRemark): string {
  if (remark.scope === "plan") return "plan::";
  return `${remark.scope}:${remark.week_index ?? 1}:${remark.plan_exercise_id ?? ""}`;
}

function parseRemarkKey(key: string): {
  scope: PlanAssignmentRemark["scope"];
  weekIndex: number | null;
  exerciseId: string | null;
} {
  const [scope, week, exerciseId] = key.split(":");
  return {
    scope: scope as PlanAssignmentRemark["scope"],
    weekIndex: scope === "plan" ? null : Math.max(1, Number(week) || 1),
    exerciseId: scope === "exercise" ? exerciseId || null : null,
  };
}

function RemarkArea({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink outline-none placeholder:text-muted/70 focus:border-accent"
    />
  );
}

function DateOverride({ label, value, placeholder, min, onChange }: { label: string; value: string; placeholder: string; min?: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wide text-muted">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        onInput={(event) => onChange(event.currentTarget.value)}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink"
      />
      <span className="mt-1 block normal-case font-semibold">Blank uses {placeholder}</span>
    </label>
  );
}

function SetBreakdown({ exercise, onChange }: { exercise: PlanExercise; onChange: (details: SetDetail[]) => void }) {
  const details = exercise.set_details ?? [];
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-black text-ink">Per-set workload</p>
        {details.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => onChange([])}>Use simple targets</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onChange(Array.from({ length: Math.max(1, exercise.target_sets) }, () => ({ reps: exercise.target_reps, weight_kg: exercise.target_weight_kg, rpe: exercise.rpe_target || undefined })))}>
            Customize each set
          </Button>
        )}
      </div>
      {details.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {details.map((detail, index) => (
            <div key={index} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-end gap-2 rounded-xl bg-inset p-2">
              <span className="pb-2 text-xs font-black text-muted">{index + 1}</span>
              <Field label="Reps"><NumberField value={detail.reps} min={0} onChange={(value) => onChange(details.map((item, i) => i === index ? { ...item, reps: value ?? 0 } : item))} /></Field>
              <Field label="Load"><NumberField value={detail.weight_kg} min={0} step={2.5} suffix="kg" onChange={(value) => onChange(details.map((item, i) => i === index ? { ...item, weight_kg: value ?? 0 } : item))} /></Field>
              <Field label="Target effort (0–10)"><NumberField value={detail.rpe ?? null} min={0} max={10} step={0.5} onChange={(value) => onChange(details.map((item, i) => i === index ? { ...item, rpe: value ?? undefined } : item))} /></Field>
              <button className="pb-2 text-xs font-black text-danger" onClick={() => onChange(details.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => onChange([...details, details.at(-1) ?? { reps: exercise.target_reps, weight_kg: exercise.target_weight_kg }])}>+ Add set</Button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../../data";
import type { PlanAssignment, PlanBundle, PlanExercise, Session, SetDetail } from "../../data/types";
import { applyAssignmentOverrides, workloadDiff } from "../../domain/assignmentPlan";
import { prescriptionLabel } from "../../domain/logging";
import { newTimelineImpacts } from "../../domain/timelineSafety";
import { Button, Card, Field, NumberField, Pill, Sheet, TextField, Toggle } from "../../ui/kit";

/** Coach-only assignment editor: dates + workload, never the shared template. */
export function AthletePlanCustomizer({
  open,
  athleteName,
  template,
  assignment,
  loggedSessions,
  onClose,
  onSaved,
  onToast,
}: {
  open: boolean;
  athleteName: string;
  template: PlanBundle;
  assignment: PlanAssignment;
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
  const [end, setEnd] = useState(assignment.end_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(structuredClone(effective));
    setStart(assignment.start_date ?? "");
    setEnd(assignment.end_date ?? "");
    setError(null);
    setAcknowledged(false);
  }, [open, effective, assignment.start_date, assignment.end_date]);

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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Customize for ${athleteName}`}
      wide
      footer={
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs font-bold text-muted">
            {overrideCount === 0 ? "Using the shared workload" : `${overrideCount} customized exercises`}
          </p>
          <Button onClick={save} disabled={saving || (dateImpacts.length > 0 && !acknowledged)}>{saving ? "Saving…" : "Save customization"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs font-semibold leading-relaxed text-muted">
          The shared <b>{template.plan.name}</b> template is unchanged. Blank dates inherit the
          template; only workload differences below are stored for this athlete.
        </p>
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p>}

        {dateImpacts.length > 0 && (
          <Card tint="var(--color-gold)">
            <p className="text-sm font-black text-ink">
              {dateImpacts.length} existing session{dateImpacts.length === 1 ? "" : "s"} will no longer match this schedule
            </p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted">
              Logged work on {dateImpacts.slice(0, 4).map(({ session }) => session.date).join(", ")}
              {dateImpacts.length > 4 ? ` and ${dateImpacts.length - 4} more` : ""} will remain
              on its performed dates. It will not move, overwrite another date, or be deleted.
            </p>
            <Button className="mt-3" size="sm" variant={acknowledged ? "secondary" : "primary"} onClick={() => setAcknowledged((value) => !value)}>
              {acknowledged ? "Safety confirmed" : "I understand — preserve those logs"}
            </Button>
          </Card>
        )}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <DateOverride label="Custom start" value={start} placeholder={template.plan.start_date} onChange={(value) => { setStart(value); setAcknowledged(false); }} />
            <DateOverride label="Custom end" value={end} placeholder={template.plan.end_date ?? "No end date"} min={start || template.plan.start_date} onChange={(value) => { setEnd(value); setAcknowledged(false); }} />
          </div>
        </Card>

        <div className="space-y-3">
          {draft.exercises.map((exercise) => {
            const base = template.exercises.find((item) => item.id === exercise.id)!;
            const changed = JSON.stringify(workloadDiff(
              { ...template, exercises: [base] },
              { ...draft, exercises: [exercise] },
            )) !== "{}";
            return (
              <Card key={exercise.id} tint={changed ? "var(--t-accent)" : undefined}>
                <div className="mb-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-ink">{exercise.name}</p>
                    <p className="text-[11px] font-bold text-muted">Template: {prescriptionLabel(base)}</p>
                  </div>
                  {changed && <Pill tint="var(--t-accent)">Customized</Pill>}
                  {changed && (
                    <Button size="sm" variant="secondary" onClick={() => updateExercise(exercise.id, base)}>
                      Reset
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Field label="Sets"><NumberField value={exercise.target_sets} min={0} max={20} onChange={(value) => updateExercise(exercise.id, { target_sets: value ?? 0 })} /></Field>
                  <Field label="Reps"><NumberField value={exercise.target_reps} min={0} max={500} onChange={(value) => updateExercise(exercise.id, { target_reps: value ?? 0 })} /></Field>
                  <Field label="Load"><NumberField value={exercise.target_weight_kg} min={0} step={2.5} suffix="kg" onChange={(value) => updateExercise(exercise.id, { target_weight_kg: value ?? 0 })} /></Field>
                  <Field label="Rest"><NumberField value={exercise.rest_sec} min={0} step={15} suffix="sec" onChange={(value) => updateExercise(exercise.id, { rest_sec: value ?? 0 })} /></Field>
                  <Field label="RPE"><NumberField value={exercise.rpe_target || null} min={0} max={10} step={0.5} onChange={(value) => updateExercise(exercise.id, { rpe_target: value ?? 0 })} /></Field>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-ink">Required exercise</p>
                    <p className="text-[10px] font-semibold text-muted">Counts toward session completion</p>
                  </div>
                  <Toggle label="Required exercise" checked={exercise.is_mandatory} onChange={(value) => updateExercise(exercise.id, { is_mandatory: value })} />
                </div>

                <div className="mt-3">
                  <Field label="Athlete-specific note">
                    <TextField value={exercise.trainer_notes} onChange={(event) => updateExercise(exercise.id, { trainer_notes: event.target.value })} />
                  </Field>
                </div>

                <SetBreakdown exercise={exercise} onChange={(set_details) => updateExercise(exercise.id, { set_details })} />
              </Card>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

function DateOverride({ label, value, placeholder, min, onChange }: { label: string; value: string; placeholder: string; min?: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wide text-muted">
      {label}
      <input type="date" value={value} min={min} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink" />
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
              <Field label="RPE"><NumberField value={detail.rpe ?? null} min={0} max={10} step={0.5} onChange={(value) => onChange(details.map((item, i) => i === index ? { ...item, rpe: value ?? undefined } : item))} /></Field>
              <button className="pb-2 text-xs font-black text-danger" onClick={() => onChange(details.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => onChange([...details, details.at(-1) ?? { reps: exercise.target_reps, weight_kg: exercise.target_weight_kg }])}>+ Add set</Button>
        </div>
      )}
    </div>
  );
}

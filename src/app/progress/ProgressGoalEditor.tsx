import { useEffect, useState } from "react";
import type { ProgressGoal, ProgressGoalScope, ProgressGoalTarget } from "../../data/types";
import { newId } from "../../data/factories";
import { addDays, formatShortDate, localDate } from "../../domain/dates";
import { Button, Card, Field, NumberField, Pill, Sheet, TextField } from "../../ui/kit";

export interface GoalContextOption {
  scopeType: ProgressGoalScope;
  key: string | null;
  label: string;
}

export function ProgressGoalEditor({
  open,
  goal,
  athleteId,
  viewerId,
  contexts,
  defaultContext,
  defaultTargetType,
  suggestedTargetValue,
  metric,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  goal?: ProgressGoal | null;
  athleteId: string;
  viewerId: string;
  contexts: GoalContextOption[];
  defaultContext?: GoalContextOption;
  defaultTargetType?: ProgressGoalTarget;
  suggestedTargetValue?: number;
  metric: ProgressGoal["metric"];
  onClose: () => void;
  onSave: (goal: ProgressGoal) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const initial = goal
    ? contexts.find((context) => context.scopeType === goal.scope_type && context.key === goal.scope_key)
    : defaultContext ?? contexts[0];
  const [contextIndex, setContextIndex] = useState(Math.max(0, initial ? contexts.indexOf(initial) : 0));
  const fallbackTargetType = defaultTargetType ?? (metric === "exercise_pr" ? "weight" : "score");
  const fallbackTargetValue = suggestedTargetValue ?? (metric === "exercise_pr" ? 50 : 70);
  const [targetType, setTargetType] = useState<ProgressGoalTarget>(goal?.target_type ?? fallbackTargetType);
  const [targetValue, setTargetValue] = useState(goal?.target_value ?? fallbackTargetValue);
  const [deadline, setDeadline] = useState(goal?.deadline ?? localDate(addDays(new Date(), 84)));
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const selected = goal
      ? contexts.findIndex((context) => context.scopeType === goal.scope_type && context.key === goal.scope_key)
      : defaultContext ? contexts.indexOf(defaultContext) : 0;
    setContextIndex(Math.max(0, selected));
    setTargetType(goal?.target_type ?? fallbackTargetType);
    setTargetValue(goal?.target_value ?? fallbackTargetValue);
    setDeadline(goal?.deadline ?? localDate(addDays(new Date(), 84)));
    setNotes(goal?.notes ?? "");
  // Opening (or switching the edited goal) is the reset boundary. Context
  // arrays can be freshly derived by a parent and should not reset input on
  // every render while the athlete is typing.
  }, [open, goal?.id, metric, fallbackTargetType, fallbackTargetValue]);

  if (!open || contexts.length === 0) return null;
  const context = contexts[Math.min(contextIndex, contexts.length - 1)];
  const exerciseTarget = context.scopeType === "exercise";
  const targetOptions: { value: ProgressGoalTarget; label: string }[] = exerciseTarget
    ? [
        { value: "weight", label: "Heaviest working weight" },
        { value: "reps", label: "Most good reps" },
        { value: "estimated_max", label: "Estimated max lift" },
      ]
    : [{ value: "score", label: "Strength score" }];
  const selectedTarget = targetOptions.some((option) => option.value === targetType) ? targetType : targetOptions[0].value;
  const unit = selectedTarget === "score" ? "/100" : selectedTarget === "reps" ? "reps" : "kg";

  return (
    <Sheet open onClose={onClose} title={goal ? "Edit goal" : metric === "exercise_pr" ? "Set a personal record goal" : "Set a strength goal"}>
      <div className="space-y-4">
        <Field label="Goal applies to">
          <select
            value={contextIndex}
            onChange={(event) => {
              const index = Number(event.target.value);
              setContextIndex(index);
              setTargetType(contexts[index]?.scopeType === "exercise" ? "weight" : "score");
            }}
            className="h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none"
          >
            {contexts.map((option, index) => (
              <option key={`${option.scopeType}:${option.key ?? "all"}`} value={index}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label="What do you want to reach?">
          <select
            value={selectedTarget}
            onChange={(event) => setTargetType(event.target.value as ProgressGoalTarget)}
            className="h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none"
          >
            {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target">
            <NumberField
              value={targetValue}
              min={1}
              max={selectedTarget === "score" ? 100 : 1000}
              step={selectedTarget === "reps" ? 1 : 0.5}
              suffix={unit}
              onChange={(value) => setTargetValue(value ?? 1)}
            />
          </Field>
          <Field label="Target date">
            <TextField type="date" value={deadline} min={localDate()} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        </div>

        <Field label="Why this matters (optional)">
          <TextField value={notes} placeholder="A simple reminder for you or your coach" onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="rounded-2xl bg-inset p-3 text-xs font-semibold leading-relaxed text-muted">
          Estimated max lift is calculated from normal multi-rep sets—you do not need to attempt a risky one-rep maximum.
        </div>
      </div>

      <Button
        full
        className="mt-5"
        disabled={saving || targetValue <= 0}
        onClick={async () => {
          setSaving(true);
          await onSave({
            id: goal?.id ?? newId(),
            athlete_id: athleteId,
            set_by_profile_id: goal?.set_by_profile_id ?? viewerId,
            scope_type: context.scopeType,
            scope_key: context.key,
            scope_label: context.label,
            metric,
            target_type: selectedTarget,
            target_value: targetValue,
            unit,
            deadline: deadline || null,
            notes,
            status: goal?.status ?? "active",
            created_at: goal?.created_at,
            updated_at: goal?.updated_at,
          });
          setSaving(false);
          onClose();
        }}
      >
        {saving ? "Saving…" : "Save goal"}
      </Button>
      {goal && onDelete && (
        <Button full variant="danger" className="mt-2" onClick={async () => { await onDelete(goal.id); onClose(); }}>
          Remove goal
        </Button>
      )}
    </Sheet>
  );
}

export function GoalProgressCard({
  goal,
  current,
  color,
  onEdit,
}: {
  goal: ProgressGoal;
  current: number;
  color: string;
  onEdit?: () => void;
}) {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, goal.target_value)));
  const unit = goal.target_type === "score" ? "/100" : goal.target_type === "reps" ? " reps" : " kg";
  const label = goal.target_type === "estimated_max" ? "estimated max lift"
    : goal.target_type === "weight" ? "working weight"
      : goal.target_type === "reps" ? "good reps" : "strength score";
  return (
    <Card onClick={onEdit}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-ink">{goal.scope_label}</p>
          <p className="text-[11px] font-semibold text-muted">{label}{goal.deadline ? ` · by ${formatShortDate(goal.deadline)}` : ""}</p>
        </div>
        <Pill tint={color}>Now {Math.round(current * 10) / 10}{unit} · Goal {goal.target_value}{unit}</Pill>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-inset">
        <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <p className="mt-2 text-[11px] font-bold text-muted">
        {ratio >= 1 ? "Goal reached — set a new challenge when ready." : `${Math.round(ratio * 100)}% of the way there`}
      </p>
    </Card>
  );
}

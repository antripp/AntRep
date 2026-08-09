/** Read-only plan structure — every week, day, block and exercise as prescribed. */

import { useMemo, useState } from "react";
import { DAY_TYPE_LABELS, type PlanBundle, type PlanDay } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import { loggingSlots } from "../../domain/logging";
import {
  isCyclePlan,
  planSlots,
  resolveSegments,
  slotIndex,
  slotLabel,
  typeColor,
  typeIcon,
} from "../../domain/plan";
import { plural } from "../../domain/text";
import { Button, Card, Icon, IconButton, IconTile, Pill, SectionHeader } from "../../ui/kit";

export function PlanDetail({
  bundle,
  subtitle,
  onClose,
  onEdit,
  footer,
}: {
  bundle: PlanBundle;
  subtitle?: string;
  onClose: () => void;
  onEdit?: () => void;
  footer?: React.ReactNode;
}) {
  const [week, setWeek] = useState(1);
  const cycle = isCyclePlan(bundle.plan);
  // A cycle has no week blocks: all of its days are one pass through the split.
  // Walk the slots rather than the rows, so a day nobody has filled in yet
  // still shows as the rest day it is instead of going missing.
  const slots = useMemo(() => {
    const pool = bundle.days.filter((d) =>
      cycle ? d.cycle_day !== null : d.cycle_day === null && d.week_index === week,
    );
    return planSlots(bundle.plan).map((slot) => ({
      slot,
      day: pool.find((d) => slotIndex(bundle.plan, d) === slot) ?? null,
    }));
  }, [bundle.days, bundle.plan, cycle, week]);

  const weekExercises = slots.reduce(
    (total, { day }) =>
      day ? total + resolveSegments(bundle, day).reduce((t, s) => t + s.exercises.length, 0) : total,
    0,
  );
  const trainingDays = slots.filter(({ day }) => day && day.day_type !== "rest").length;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={onClose}>
          <Icon.back className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-ink">{bundle.plan.name}</h1>
          <p className="truncate text-xs font-bold text-muted">
            {subtitle ??
              `${
                cycle
                  ? `${bundle.plan.cycle_length}-day split`
                  : plural(bundle.plan.weeks, "week")
              } · ${plural(bundle.exercises.length, "exercise")}`}
          </p>
        </div>
        {onEdit && (
          <Button size="sm" onClick={onEdit}>
            <Icon.edit className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      <Card className="mb-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Detail label="Starts" value={formatShortDate(bundle.plan.start_date)} />
          {cycle ? (
            <Detail label="Split length" value={`${bundle.plan.cycle_length} days`} />
          ) : (
            <Detail label="Week blocks" value={String(bundle.plan.weeks)} />
          )}
          <Detail label="Training days" value={String(trainingDays)} />
          <Detail label={cycle ? "Exercises / split" : "Exercises / week"} value={String(weekExercises)} />
          <Detail label="Status" value={bundle.plan.is_active ? "Active" : "Inactive"} />
        </div>
        {bundle.plan.notes && (
          <p className="mt-3 rounded-2xl bg-inset px-3 py-2 text-xs font-semibold text-muted">
            {bundle.plan.notes}
          </p>
        )}
      </Card>

      {!cycle && bundle.plan.weeks > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: bundle.plan.weeks }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                w === week ? "bg-accent text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              Week {w}
            </button>
          ))}
        </div>
      )}

      <SectionHeader
        title={
          cycle
            ? `The ${bundle.plan.cycle_length}-day split`
            : bundle.plan.weeks > 1
              ? `Week ${week}`
              : "The week"
        }
      />
      <div className="space-y-3">
        {slots.map(({ slot, day }) =>
          day ? (
            <DayCard key={day.id} bundle={bundle} day={day} />
          ) : (
            <EmptySlotCard key={`slot-${slot}`} plan={bundle.plan} slot={slot} />
          ),
        )}
      </div>

      {footer && <div className="mt-6">{footer}</div>}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-black text-ink">{value}</p>
    </div>
  );
}

/** A slot of the plan nobody has set up yet — a rest day by default. */
function EmptySlotCard({ plan, slot }: { plan: PlanBundle["plan"]; slot: number }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile emoji={typeIcon("rest")} tint={typeColor("rest")} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-ink">
            {slotLabel(plan, slot)} · {DAY_TYPE_LABELS.rest}
          </p>
          <p className="truncate text-xs font-bold text-muted">Nothing scheduled yet</p>
        </div>
      </div>
    </Card>
  );
}

function DayCard({ bundle, day }: { bundle: PlanBundle; day: PlanDay }) {
  const segments = resolveSegments(bundle, day);
  const tint = typeColor(day.day_type, day.color_hex);
  const total = segments.reduce((t, s) => t + s.exercises.length, 0);

  return (
    <Card tint={tint}>
      <div className="flex items-center gap-3">
        <IconTile emoji={typeIcon(day.day_type, day.icon_name)} tint={tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-ink">
            {slotLabel(bundle.plan, slotIndex(bundle.plan, day))} ·{" "}
            {day.title || DAY_TYPE_LABELS[day.day_type]}
          </p>
          <p className="truncate text-xs font-bold text-muted">
            {DAY_TYPE_LABELS[day.day_type]}
            {total > 0 && ` · ${plural(total, "exercise")}`}
          </p>
        </div>
        {day.is_optional && <Pill tint="var(--t-muted)">Optional</Pill>}
      </div>

      {segments.map((segment) => {
        const slots = loggingSlots([...segment.exercises].sort((a, b) => a.sort_order - b.sort_order));
        if (slots.length === 0) return null;
        return (
          <div key={segment.id} className="mt-3">
            {segments.length > 1 && (
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide" style={{ color: segment.color }}>
                {segment.title}
              </p>
            )}
            <div className="space-y-1.5">
              {slots.map((slot) => {
                const primary = slot[0];
                return (
                  <div key={primary.id} className="rounded-xl bg-inset px-3 py-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">
                          {slot.length > 1
                            ? slot.map((e) => e.alternate_label || e.name).join("  /  ")
                            : primary.name}
                        </p>
                        <p className="text-[11px] font-semibold text-muted">
                          {primary.rep_scheme || `${primary.target_sets} × ${primary.target_reps}`}
                          {primary.target_weight_kg > 0 && ` · ${primary.target_weight_kg} kg`}
                          {primary.rest_sec > 0 && ` · ${primary.rest_sec}s rest`}
                          {primary.rpe_target > 0 && ` · RPE ${primary.rpe_target}`}
                          {primary.tempo && ` · tempo ${primary.tempo}`}
                          {!primary.is_mandatory && " · optional"}
                          {primary.repeat_rule !== "weekly" && ` · ${primary.repeat_rule}`}
                        </p>
                        {primary.trainer_notes && (
                          <p className="mt-1 text-[11px] font-semibold italic text-muted">
                            “{primary.trainer_notes}”
                          </p>
                        )}
                      </div>
                      {slot.length > 1 && <Pill tint={segment.color}>pick one</Pill>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {total === 0 && (
        <p className="mt-3 rounded-xl bg-inset px-3 py-3 text-center text-xs font-semibold text-muted">
          {day.day_type === "rest" ? "Rest day — nothing scheduled." : "No exercises added yet."}
        </p>
      )}
    </Card>
  );
}

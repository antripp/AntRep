/**
 * Days — every repeat of a planned day together.
 *
 * The other tabs slice the log by plan, by session and by exercise. This one
 * slices it by the day of the split, which is the comparison a repeating plan
 * actually invites: this pull day against the last four pull days, not against
 * yesterday's legs.
 *
 * The list is a summary only; each day opens its own page (`DayDetail`).
 */

import { useMemo } from "react";
import type { Session, SetLog } from "../../data/types";
import { DAY_TYPE_COLORS, DAY_TYPE_LABELS } from "../../data/types";
import { formatShortDate } from "../../domain/dates";
import { DAY_METRIC_LABELS, formatDayMetric, groupSessionsByDay } from "../../domain/dayTrends";
import { typeIcon } from "../../domain/plan";
import { plural } from "../../domain/text";
import { Sparkline } from "../../ui/charts";
import { Card, EmptyState, Icon, IconTile, Pill } from "../../ui/kit";
import { TrendPill } from "./DayDetail";

export function DaysTab({
  sessions,
  logs,
  onOpenDay,
}: {
  sessions: Session[];
  logs: SetLog[];
  onOpenDay: (key: string) => void;
}) {
  const groups = useMemo(() => groupSessionsByDay(sessions, logs), [sessions, logs]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No days to compare yet"
        subtitle="Log a couple of sessions and each planned day — pull, push, legs — gets its own trend here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const tint = DAY_TYPE_COLORS[group.dayType] ?? "var(--t-accent)";
        return (
          <Card key={group.key} tint={tint} onClick={() => onOpenDay(group.key)}>
            <div className="flex items-center gap-3">
              <IconTile emoji={typeIcon(group.dayType)} tint={tint} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black text-ink">{group.title}</p>
                <p className="truncate text-xs font-bold text-muted">
                  {DAY_TYPE_LABELS[group.dayType]} · {plural(group.count, "session")} · last{" "}
                  {formatShortDate(group.lastDate)}
                </p>
              </div>
              <Sparkline values={group.series} color={tint} width={70} height={24} />
              <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TrendPill pct={group.trendPct} metric={DAY_METRIC_LABELS[group.metric]} />
              <Pill tint="var(--t-muted)">
                avg {formatDayMetric(group.metric, group.avgValue)}
              </Pill>
              {group.avgRpe !== null && <Pill tint={tint}>average effort {group.avgRpe}/10</Pill>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

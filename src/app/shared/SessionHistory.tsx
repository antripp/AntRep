/** Session history list + detail — shared by the athlete and the coach view. */

import { useMemo, useState } from "react";
import type { Session, SetLog } from "../../data/types";
import { DAY_TYPE_COLORS } from "../../data/types";
import { formatDuration, formatShortDate, isoWeekday, parseDate, weekdayLabel } from "../../domain/dates";
import { elapsedSeconds, nameKey, setHasData, volumeOf } from "../../domain/logging";
import { Card, EmptyState, Icon, IconTile, Pill, Sheet } from "../../ui/kit";
import { typeIcon } from "../../domain/plan";

export function SessionList({
  sessions,
  logs,
  limit = 10,
  emptyTitle = "No sessions yet",
}: {
  sessions: Session[];
  logs: SetLog[];
  limit?: number;
  emptyTitle?: string;
}) {
  const [open, setOpen] = useState<Session | null>(null);
  const [visible, setVisible] = useState(limit);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  );
  const ordered = sorted.slice(0, visible);

  if (sorted.length === 0) {
    return <EmptyState title={emptyTitle} subtitle="Logged workouts show up here." />;
  }

  return (
    <>
      <div className="space-y-2">
        {ordered.map((session) => {
          const sessionLogs = logs.filter((l) => l.session_id === session.id && setHasData(l));
          // Logged sets count as exercises even when nothing was ticked off.
          const exerciseCount = Math.max(
            new Set(sessionLogs.map((l) => nameKey(l.exercise_name))).size,
            session.completed_names.length,
          );
          const tint = DAY_TYPE_COLORS[session.day_type] ?? "var(--t-accent)";
          const duration = elapsedSeconds(session);
          return (
            <Card key={session.id} onClick={() => setOpen(session)}>
              <div className="flex items-center gap-3">
                <IconTile emoji={typeIcon(session.day_type)} tint={tint} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{session.day_title || "Workout"}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {weekdayLabel(isoWeekday(parseDate(session.date)), true)} {formatShortDate(session.date)} ·{" "}
                    {exerciseCount} exercise
                    {exerciseCount === 1 ? "" : "s"} · {sessionLogs.length} set
                    {sessionLogs.length === 1 ? "" : "s"}
                    {duration > 0 && ` · ${formatDuration(duration)}`}
                  </p>
                </div>
                {session.status === "complete" && <Pill tint={tint}>Done</Pill>}
                {!session.shared_with_coach && <Pill tint="var(--t-muted)">Private</Pill>}
                <Icon.chevron className="h-4 w-4 text-muted" />
              </div>
            </Card>
          );
        })}
      </div>

      {visible < sorted.length && (
        <button
          className="mt-3 w-full rounded-full border border-line bg-surface py-2.5 text-xs font-black text-ink"
          onClick={() => setVisible((v) => v + 20)}
        >
          Show older sessions ({sorted.length - visible} more)
        </button>
      )}

      {open && (
        <SessionDetailSheet
          session={open}
          logs={logs.filter((l) => l.session_id === open.id)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export function SessionDetailSheet({
  session,
  logs,
  onClose,
}: {
  session: Session;
  logs: SetLog[];
  onClose: () => void;
}) {
  const byExercise = useMemo(() => {
    const map = new Map<string, { name: string; sets: SetLog[] }>();
    for (const log of logs) {
      const key = nameKey(log.exercise_name);
      const entry = map.get(key) ?? { name: log.exercise_name, sets: [] };
      entry.sets.push(log);
      map.set(key, entry);
    }
    for (const entry of map.values()) entry.sets.sort((a, b) => a.set_index - b.set_index);
    return [...map.values()];
  }, [logs]);

  const duration = elapsedSeconds(session);
  const volume = volumeOf(logs.filter(setHasData));

  return (
    <Sheet open onClose={onClose} title={session.day_title || "Workout"}>
      <div className="mb-3 flex gap-2">
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-base font-black text-ink">{formatShortDate(session.date)}</p>
          <p className="text-[11px] font-bold uppercase text-muted">
            {weekdayLabel(isoWeekday(parseDate(session.date)), true)}
            {session.is_late_completion && " · late log"}
          </p>
        </div>
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-base font-black text-ink">{duration > 0 ? formatDuration(duration) : "—"}</p>
          <p className="text-[11px] font-bold uppercase text-muted">time</p>
        </div>
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-base font-black text-ink">{Math.round(volume).toLocaleString()}</p>
          <p className="text-[11px] font-bold uppercase text-muted">kg volume</p>
        </div>
      </div>

      {session.athlete_notes && (
        <p className="mb-3 rounded-2xl bg-inset px-3 py-2 text-xs font-semibold text-muted">
          {session.athlete_notes}
        </p>
      )}

      {byExercise.length === 0 && (
        <p className="py-6 text-center text-sm font-semibold text-muted">No sets recorded in this session.</p>
      )}

      <div className="space-y-2">
        {byExercise.map((entry) => (
          <div key={entry.name} className="rounded-2xl border border-line p-3">
            <p className="mb-1.5 text-sm font-black text-ink">{entry.name}</p>
            <div className="space-y-1">
              {entry.sets.map((set) => (
                <div key={set.id} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted">Set {set.set_index}</span>
                  <span className="text-ink">{describeSet(set)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function describeSet(set: SetLog): string {
  const parts: string[] = [];
  if (set.weight_kg) parts.push(`${set.weight_kg} kg`);
  if (set.reps) parts.push(`${set.reps} reps`);
  if (set.distance_km) parts.push(`${set.distance_km} km`);
  if (set.duration_sec) parts.push(formatDuration(set.duration_sec));
  if (set.rpe) parts.push(`Effort ${set.rpe}/10`);
  return parts.length > 0 ? parts.join(" · ") : "logged";
}

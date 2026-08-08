/**
 * The activity feed — what replaced free-text chat.
 *
 * Nothing here is written by hand. The feed is derived from training the
 * athlete has already logged and check-ins they've already filled in, and the
 * only thing a coach can add is a reaction from a fixed list. The database
 * enforces that list with a CHECK constraint (migration 008), so this screen
 * is a convenience rather than the actual guard.
 *
 * Scoping: a coach sees the sessions logged against *their own* plans. When an
 * athlete works with several coaches, each coach's feed covers the work they
 * prescribed — not the athlete's free training, and not another coach's plans.
 */

import { useMemo, useState } from "react";
import { api } from "../../data";
import {
  REACTION_PRESETS,
  type ActivityReaction,
  type CheckIn,
  type CoachingBoard,
  type PlanBundle,
  type ReactionPreset,
  type Session,
} from "../../data/types";
import { DAY_TYPE_COLORS } from "../../data/types";
import { formatShortDate, isoWeekday, parseDate, weekdayLabel } from "../../domain/dates";
import { setHasData } from "../../domain/logging";
import { typeIcon } from "../../domain/plan";
import { plural } from "../../domain/text";
import type { SetLog } from "../../data/types";
import { Card, EmptyState, Icon, IconTile, Pill, SectionHeader } from "../../ui/kit";

interface FeedItem {
  key: string;
  kind: "session" | "checkin";
  date: string;
  title: string;
  detail: string;
  emoji: string;
  tint: string;
  sessionId: string | null;
  checkInId: string | null;
}

const PRESET_BY_KEY = new Map(REACTION_PRESETS.map((p) => [p.key as string, p]));

export function ActivityFeed({
  linkId,
  board,
  meProfileId,
  isCoach,
  otherName,
  sessions,
  logs,
  coachPlans,
  onChanged,
}: {
  linkId: string;
  board: CoachingBoard;
  meProfileId: string;
  /** Only a coach may react. The athlete reads. */
  isCoach: boolean;
  otherName: string;
  sessions: Session[];
  logs: SetLog[];
  /** Plans belonging to this coach — the feed is scoped to them. */
  coachPlans: PlanBundle[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

  const items = useMemo(
    () => buildFeed(sessions, logs, board.checkIns, coachPlans),
    [sessions, logs, board.checkIns, coachPlans],
  );

  const reactionFor = (item: FeedItem): ActivityReaction | undefined =>
    board.reactions.find(
      (r) =>
        (r.session_id ?? null) === item.sessionId &&
        (r.check_in_id ?? null) === item.checkInId,
    );

  async function react(item: FeedItem, preset: ReactionPreset) {
    setBusy(item.key);
    try {
      await api.saveReaction({
        linkId,
        senderProfileId: meProfileId,
        sessionId: item.sessionId,
        checkInId: item.checkInId,
        preset,
      });
      await onChanged();
      setOpenFor(null);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        subtitle={
          isCoach
            ? `Sessions ${otherName} logs against your plans show up here, and you can react to them.`
            : "Your sessions appear here once you've logged them, along with anything your coach says about them."
        }
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-[11px] font-semibold leading-snug text-muted">
        {isCoach
          ? "Everything logged against your plans. Tap a card to leave a note — the options are fixed, so nothing here is free text."
          : "Your training, and how your coach responded to it."}
      </p>

      <div className="space-y-2">
        {items.map((item) => {
          const reaction = reactionFor(item);
          const preset = reaction ? PRESET_BY_KEY.get(reaction.preset) : undefined;
          const open = openFor === item.key;

          return (
            <Card key={item.key}>
              <div className="flex items-center gap-3">
                <IconTile emoji={item.emoji} tint={item.tint} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{item.title}</p>
                  <p className="truncate text-xs font-bold text-muted">
                    {weekdayLabel(isoWeekday(parseDate(item.date)), true)}{" "}
                    {formatShortDate(item.date)} · {item.detail}
                  </p>
                </div>
                {preset && (
                  <Pill tint="var(--t-accent)">
                    {preset.emoji} {preset.label}
                  </Pill>
                )}
                {isCoach && (
                  <button
                    onClick={() => setOpenFor(open ? null : item.key)}
                    aria-label={preset ? "Change your note" : "Leave a note"}
                    aria-expanded={open}
                    className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-black text-muted"
                  >
                    {preset ? "Change" : "React"}
                  </button>
                )}
              </div>

              {isCoach && open && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {REACTION_PRESETS.map((option) => (
                    <button
                      key={option.key}
                      disabled={busy === item.key}
                      onClick={() => react(item, option.key)}
                      className={`rounded-full border px-2.5 py-1.5 text-[11px] font-black transition ${
                        reaction?.preset === option.key
                          ? "border-accent text-accent"
                          : "border-line text-muted active:scale-[0.98]"
                      }`}
                    >
                      {option.emoji} {option.label}
                    </button>
                  ))}
                  {reaction && (
                    <button
                      disabled={busy === item.key}
                      onClick={async () => {
                        setBusy(item.key);
                        try {
                          await api.removeReaction(reaction.id);
                          await onChanged();
                          setOpenFor(null);
                        } finally {
                          setBusy(null);
                        }
                      }}
                      className="rounded-full border border-line px-2.5 py-1.5 text-[11px] font-black text-danger"
                    >
                      <Icon.trash className="mr-1 inline h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <SectionHeader title="Why there's no chat" />
      <p className="text-[11px] font-semibold leading-snug text-muted">
        Free-text messaging is switched off while AntRep is in closed beta. Coaching notes and
        check-ins are still open for anything that needs words.
      </p>
    </>
  );
}

/** Sessions on the coach's plans plus submitted check-ins, newest first. */
function buildFeed(
  sessions: Session[],
  logs: SetLog[],
  checkIns: CheckIn[],
  coachPlans: PlanBundle[],
): FeedItem[] {
  const planIds = new Set(coachPlans.map((b) => b.plan.id));
  const setCounts = new Map<string, number>();
  for (const log of logs) {
    if (!setHasData(log)) continue;
    setCounts.set(log.session_id, (setCounts.get(log.session_id) ?? 0) + 1);
  }

  const items: FeedItem[] = sessions
    .filter((s) => s.shared_with_coach && s.plan_id && planIds.has(s.plan_id))
    .map((session) => ({
      key: `session:${session.id}`,
      kind: "session" as const,
      date: session.date,
      title: session.day_title || "Workout",
      detail: `${plural(session.completed_names.length, "exercise")} · ${plural(
        setCounts.get(session.id) ?? 0,
        "set",
      )}`,
      emoji: typeIcon(session.day_type),
      tint: DAY_TYPE_COLORS[session.day_type] ?? "var(--t-accent)",
      sessionId: session.id,
      checkInId: null,
    }));

  for (const checkIn of checkIns) {
    if (!checkIn.submitted_at) continue;
    items.push({
      key: `checkin:${checkIn.id}`,
      kind: "checkin",
      date: checkIn.submitted_at.slice(0, 10),
      title: `Week ${checkIn.week_index} check-in`,
      detail: checkIn.weight_kg ? `${checkIn.weight_kg} kg` : "submitted",
      emoji: "📝",
      tint: "var(--t-accent)",
      sessionId: null,
      checkInId: checkIn.id,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
}

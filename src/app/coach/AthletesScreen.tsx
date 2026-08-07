/** Coach → athletes list, with invite codes and a quick pulse per athlete. */

import { useEffect, useState } from "react";
import { api } from "../../data";
import type { CoachWorkspace } from "../../data/api";
import type { Session, SetLog } from "../../data/types";
import { formatShortDate, localDate, startOfWeek } from "../../domain/dates";
import { weeklyGymCount } from "../../domain/gamification";
import { Card, EmptyState, Icon, IconTile, Pill, ScreenTitle, SectionHeader } from "../../ui/kit";
import { InviteCodeCard } from "../shared/SettingsScreen";

interface Pulse {
  sessions: Session[];
  logs: SetLog[];
}

export default function AthletesScreen({
  workspace,
  onOpen,
  onReload,
  onToast,
}: {
  workspace: CoachWorkspace;
  onOpen: (athleteId: string) => void;
  onReload: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [pulses, setPulses] = useState<Record<string, Pulse>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        workspace.athletes.map(async ({ profile }) => {
          const training = await api.athleteTraining(profile.id);
          return [profile.id, { sessions: training.sessions, logs: training.logs }] as const;
        }),
      );
      const coachId = workspace.athletes[0]?.link.trainer_id;
      const counts = coachId
        ? await api.unreadCounts(workspace.athletes.map((a) => a.link.id), coachId)
        : {};
      if (!cancelled) {
        setPulses(Object.fromEntries(entries));
        setUnread(counts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.athletes]);

  return (
    <>
      <ScreenTitle title="Athletes" />

      <InviteCodeCard
        onCreate={async () => {
          const result = await api.createInvite();
          await onReload();
          if (!result.error) onToast("Invite code ready");
          return { code: result.code, error: result.error };
        }}
      />

      {workspace.pendingInvites.length > 0 && (
        <>
          <SectionHeader title="Waiting to be claimed" />
          <div className="space-y-2">
            {workspace.pendingInvites.map((invite) => (
              <Card key={invite.id}>
                <div className="flex items-center gap-3">
                  <Icon.link className="h-5 w-5 text-muted" />
                  <p className="flex-1 text-sm font-black tracking-widest text-ink">
                    {invite.invite_code ?? "•••-•••"}
                  </p>
                  <Pill tint="var(--t-muted)">Pending</Pill>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionHeader title={`${workspace.athletes.length} linked`} />
      {workspace.athletes.length === 0 ? (
        <EmptyState
          title="No athletes yet"
          subtitle="Create an invite code above and share it — they enter it in Settings → Coaches."
        />
      ) : (
        <div className="space-y-2">
          {workspace.athletes.map(({ profile, link }) => {
            const pulse = pulses[profile.id];
            const last = pulse?.sessions.reduce<Session | undefined>(
              (newest, s) => (!newest || s.date > newest.date ? s : newest),
              undefined,
            );
            const weekCount = pulse ? weeklyGymCount(pulse.sessions, startOfWeek()) : 0;
            const trainedToday = pulse?.sessions.some((s) => s.date === localDate());
            return (
              <Card key={profile.id} onClick={() => onOpen(profile.id)}>
                <div className="flex items-center gap-3">
                  <IconTile emoji={link.is_self_link ? "🫵" : "🏋️"} tint="var(--t-accent)" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-black text-ink">
                      {profile.display_name || "Athlete"}
                      {link.is_self_link && <span className="ml-1 text-xs font-bold text-muted">(you)</span>}
                    </p>
                    <p className="truncate text-xs font-bold text-muted">
                      {last
                        ? `Last session ${formatShortDate(last.date)} · ${weekCount} this week`
                        : "No sessions logged yet"}
                    </p>
                  </div>
                  {unread[link.id] > 0 && (
                    <Pill tint="var(--t-accent)">{unread[link.id]} new</Pill>
                  )}
                  {trainedToday && <Pill tint="var(--color-done)">Today</Pill>}
                  <Icon.chevron className="h-4 w-4 text-muted" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

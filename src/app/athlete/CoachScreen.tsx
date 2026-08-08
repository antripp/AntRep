/** Coach tab — the activity feed, weekly check-ins, trackers and coach notes. */

import { useMemo, useState } from "react";
import type { CoachLink, Profile } from "../../data/types";
import {
  BoardLoading,
  CheckInsPanel,
  currentWeekIndex,
  NotesPanel,
  TrackersPanel,
  useCoachingBoard,
} from "../shared/CoachingPanels";
import { ActivityFeed } from "../shared/ActivityFeed";
import { EmptyState, Pill, ScreenTitle, Segmented } from "../../ui/kit";
import { useWorkspace } from "../workspace";

type View = "chat" | "checkin" | "trackers" | "notes";

export default function CoachScreen() {
  const { profile, workspace, sessions, logs } = useWorkspace();
  const coaches = workspace.coaches;
  const [activeLinkId, setActiveLinkId] = useState<string | null>(coaches[0]?.link.id ?? null);
  const [view, setView] = useState<View>("chat");

  const active = useMemo(
    () => coaches.find((c) => c.link.id === activeLinkId) ?? coaches[0],
    [coaches, activeLinkId],
  );

  const { board, loading, reload } = useCoachingBoard(active?.link.id ?? null);

  // The feed covers what this coach prescribed — with several coaches linked,
  // each tab shows only that coach's plans.
  const coachPlans = useMemo(
    () =>
      workspace.assigned
        .filter((a) => a.bundle.plan.trainer_id === active?.coach.id)
        .map((a) => a.bundle),
    [workspace.assigned, active?.coach.id],
  );

  if (coaches.length === 0) {
    return (
      <>
        <ScreenTitle title="Coach" />
        <EmptyState
          title="No coach linked"
          subtitle="Ask your coach for an invite code, then enter it in Settings → Coaches. Your activity feed, check-ins and trackers appear here."
        />
      </>
    );
  }

  const link: CoachLink = active!.link;
  const coach: Profile = active!.coach;
  const weekIndex = currentWeekIndex(link.claimed_at);

  return (
    <>
      <ScreenTitle title="Coach" />

      {coaches.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {coaches.map(({ link: l, coach: c }) => (
            <button
              key={l.id}
              onClick={() => setActiveLinkId(l.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                l.id === link.id ? "bg-accent text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {c.display_name || "Coach"}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-black text-ink">{coach.display_name || "Your coach"}</p>
        <Pill tint="var(--t-accent)">Week {weekIndex}</Pill>
      </div>

      <div className="mb-4">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "chat", label: "Activity" },
            { value: "checkin", label: "Check-in" },
            { value: "trackers", label: "Trackers" },
            { value: "notes", label: "Notes" },
          ]}
        />
      </div>

      {loading ? (
        <BoardLoading />
      ) : (
        <>
          {view === "chat" && (
            <ActivityFeed
              linkId={link.id}
              board={board}
              meProfileId={profile.id}
              isCoach={false}
              otherName={coach.display_name || "your coach"}
              sessions={sessions}
              logs={logs}
              coachPlans={coachPlans}
              onChanged={reload}
            />
          )}
          {view === "checkin" && (
            <CheckInsPanel
              linkId={link.id}
              board={board}
              canSubmit
              weekIndex={weekIndex}
              onChanged={reload}
            />
          )}
          {view === "trackers" && (
            <TrackersPanel linkId={link.id} board={board} canEdit={false} onChanged={reload} />
          )}
          {view === "notes" && (
            <NotesPanel linkId={link.id} board={board} canEdit={false} onChanged={reload} />
          )}
        </>
      )}
    </>
  );
}

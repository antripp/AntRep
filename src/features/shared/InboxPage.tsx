import { useCallback, useEffect, useState } from "react";
import { fetchInboxThreads, type InboxThread } from "../../lib/inboxData";
import type { Role } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { Avatar, Card, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import ActivityThread from "./ActivityThread";

export default function InboxPage({
  role,
  initialLinkId,
  onLinkOpened,
}: {
  role: Role;
  initialLinkId?: string | null;
  onLinkOpened?: () => void;
}) {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(initialLinkId ?? null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const rows = await fetchInboxThreads(profile.id, role);
    setThreads(rows);
    setActiveLinkId((cur) => {
      if (initialLinkId && rows.some((t) => t.link.id === initialLinkId)) return initialLinkId;
      if (cur && rows.some((t) => t.link.id === cur)) return cur;
      return rows[0]?.link.id ?? null;
    });
    setLoading(false);
  }, [profile, role, initialLinkId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (initialLinkId) setActiveLinkId(initialLinkId);
  }, [initialLinkId]);

  useEffect(() => {
    if (activeLinkId && onLinkOpened) onLinkOpened();
  }, [activeLinkId, onLinkOpened]);

  useRealtime("inbox", ["messages", "check_ins", "sessions", "coach_notes", "coach_links"], load);

  if (loading) return <Spinner />;

  const active = threads.find((t) => t.link.id === activeLinkId) ?? null;
  const athleteId = role === "coach" ? active?.link.athlete_id : profile?.id;

  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-black">Inbox</h1>
        <p className="text-sm font-semibold text-muted">Messages and activity updates</p>
      </header>

      {threads.length === 0 ? (
        <Card>
          <EmptyState
            title="No conversations yet"
            subtitle={role === "coach" ? "Link an athlete to start messaging." : "Link a coach in Settings."}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row">
          <div className={`flex flex-col gap-2 ${active ? "md:w-44 md:shrink-0" : ""}`}>
            {threads.map((t) => (
              <button
                key={t.link.id}
                type="button"
                onClick={() => setActiveLinkId(t.link.id)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition ${
                  t.link.id === activeLinkId ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-inset"
                }`}
              >
                <Avatar name={t.other.display_name} avatar={t.other.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold">{t.other.display_name}</p>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black text-white">
                        {t.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs font-semibold text-muted">{t.preview}</p>
                </div>
              </button>
            ))}
          </div>

          {active && profile && athleteId && (
            <Card className="min-w-0 flex-1">
              <h2 className="mb-3 font-black">{active.other.display_name}</h2>
              <ActivityThread
                coachLinkId={active.link.id}
                athleteProfileId={athleteId}
                myProfile={profile}
                otherName={active.other.display_name}
              />
            </Card>
          )}
        </div>
      )}
    </>
  );
}

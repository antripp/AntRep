import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { markMessagesRead } from "../../lib/coachLinkData";
import { fetchThreadTimeline, type ThreadItem } from "../../lib/inboxData";
import type { Message, Profile } from "../../lib/types";
import { useRealtime } from "../../lib/useRealtime";
import { Button, Card, EmptyState, Spinner, TextInput } from "../../components/ui";

const ACTIVITY_ICONS = {
  session: "💪",
  check_in: "📋",
  coach_note: "📝",
} as const;

export default function ActivityThread({
  coachLinkId,
  athleteProfileId,
  myProfile,
  otherName,
}: {
  coachLinkId: string;
  athleteProfileId: string;
  myProfile: Profile;
  otherName: string;
}) {
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const timeline = await fetchThreadTimeline(coachLinkId, athleteProfileId);
    setItems(timeline);
    setLoading(false);
    const messages = timeline.filter((i): i is Extract<ThreadItem, { kind: "message" }> => i.kind === "message");
    if (messages.length > 0) {
      await markMessagesRead(coachLinkId, myProfile.id);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [coachLinkId, athleteProfileId, myProfile.id]);

  useRealtime(
    "activity-thread",
    ["messages", "check_ins", "sessions", "coach_notes", "set_logs"],
    load,
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("messages")
      .insert({ coach_link_id: coachLinkId, sender_profile_id: myProfile.id, body: text })
      .select()
      .single();
    if (err || !data) setError(err?.message ?? "Couldn't send message.");
    else {
      const msg = data as Message;
      setItems((prev) => [...prev, { kind: "message", id: msg.id, message: msg }]);
      setBody("");
    }
    setBusy(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-3">
      <Card className="max-h-[28rem] overflow-y-auto p-3">
        {items.length === 0 ? (
          <EmptyState title="No messages yet" subtitle={`Start a conversation with ${otherName}.`} />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              if (item.kind === "activity") {
                return (
                  <div key={item.id} className="flex justify-center">
                    <div className="max-w-[95%] rounded-2xl border-2 border-line bg-inset px-3 py-2 text-center">
                      <p className="text-xs font-extrabold">
                        {ACTIVITY_ICONS[item.activityKind]} {item.title}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-muted">{item.detail}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-muted">
                        {new Date(item.at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              }
              const m = item.message;
              const mine = m.sender_profile_id === myProfile.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl border-2 px-3 py-2 ${
                      mine ? "border-accent/30 bg-accent-soft text-ink" : "border-line bg-surface"
                    }`}
                  >
                    <p className="text-sm font-semibold">{m.body}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-muted">
                      {new Date(m.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </Card>
      <div className="flex gap-2">
        <TextInput
          className="flex-1"
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
        />
        <Button onClick={send} disabled={busy || !body.trim()}>
          {busy ? "…" : "Send"}
        </Button>
      </div>
      {error && <p className="text-xs font-bold text-danger">{error}</p>}
    </div>
  );
}

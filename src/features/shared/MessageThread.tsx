import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Message, Profile } from "../../lib/types";
import { markMessagesRead } from "../../lib/coachLinkData";
import { Button, Card, EmptyState, TextInput } from "../../components/ui";

export default function MessageThread({
  coachLinkId,
  messages,
  myProfile,
  otherName,
  onNewMessage,
}: {
  coachLinkId: string;
  messages: Message[];
  myProfile: Profile;
  otherName: string;
  onNewMessage: (msg: Message) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markMessagesRead(coachLinkId, myProfile.id);
  }, [coachLinkId, myProfile.id, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      onNewMessage(data as Message);
      setBody("");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="max-h-80 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <EmptyState title="No messages yet" subtitle={`Start a conversation with ${otherName}.`} />
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.sender_profile_id === myProfile.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl border-2 px-3 py-2 ${
                      mine ? "border-accent/30 bg-accent-soft text-ink" : "border-line bg-inset"
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

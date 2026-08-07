/**
 * Everything that hangs off one coach ↔ athlete link: the chat thread, weekly
 * check-ins, coach notes and the assessment trackers. Both portals use these —
 * `canCoach` decides who may edit what.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../data";
import { makeCheckIn, makeCoachNote, makeTrackerTemplate, newId } from "../../data/factories";
import {
  TRACKER_KIND_LABELS,
  type CoachingBoard,
  type CheckIn,
  type CoachNote,
  type TrackerEntry,
  type TrackerKind,
  type TrackerTemplate,
} from "../../data/types";
import { formatShortDate, localDate, startOfWeek } from "../../domain/dates";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  IconButton,
  NumberField,
  Pill,
  SectionHeader,
  Sheet,
  Spinner,
  TextField,
} from "../../ui/kit";

const emptyBoard: CoachingBoard = { messages: [], checkIns: [], notes: [], templates: [], entries: [] };

/** Loads (and reloads) everything attached to a link. */
export function useCoachingBoard(linkId: string | null) {
  const [board, setBoard] = useState<CoachingBoard>(emptyBoard);
  const [loading, setLoading] = useState(Boolean(linkId));

  const reload = useCallback(async () => {
    if (!linkId) {
      setBoard(emptyBoard);
      setLoading(false);
      return;
    }
    setBoard(await api.coachingBoard(linkId));
    setLoading(false);
  }, [linkId]);

  useEffect(() => {
    setLoading(Boolean(linkId));
    reload();
  }, [reload, linkId]);

  return { board, loading, reload };
}

// ------------------------------------------------------------------
// Chat
// ------------------------------------------------------------------

export function MessageThread({
  linkId,
  board,
  meProfileId,
  otherName,
  onChanged,
}: {
  linkId: string;
  board: CoachingBoard;
  meProfileId: string;
  otherName: string;
  onChanged: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [board.messages.length]);

  // Anything the other side sent is read once the thread is on screen.
  useEffect(() => {
    const unread = board.messages.some((m) => !m.read_at && m.sender_profile_id !== meProfileId);
    if (unread) api.markThreadRead(linkId, meProfileId).then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.messages, linkId, meProfileId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api.sendMessage(linkId, meProfileId, body);
      setText("");
      await onChanged();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mb-3 max-h-[52dvh] space-y-2 overflow-y-auto rounded-card border border-line bg-surface p-3">
        {board.messages.length === 0 && (
          <p className="py-8 text-center text-sm font-semibold text-muted">
            No messages yet — say hello to {otherName}.
          </p>
        )}
        {board.messages.map((message) => {
          const mine = message.sender_profile_id === meProfileId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  mine ? "bg-accent text-white" : "bg-inset text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm font-semibold leading-snug">{message.body}</p>
                <p className={`mt-1 text-[10px] font-bold ${mine ? "text-white/70" : "text-muted"}`}>
                  {new Date(message.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="flex gap-2">
        <TextField
          value={text}
          placeholder={`Message ${otherName}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={sending || !text.trim()}>
          <Icon.send className="h-4 w-4" /> Send
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Weekly check-ins
// ------------------------------------------------------------------

/** Week number since the link started, 1-based. */
export function currentWeekIndex(startISO?: string | null): number {
  if (!startISO) return 1;
  const start = startOfWeek(new Date(startISO));
  const now = startOfWeek(new Date());
  return Math.max(1, Math.round((now.getTime() - start.getTime()) / (7 * 86400000)) + 1);
}

export function CheckInsPanel({
  linkId,
  board,
  canSubmit,
  weekIndex,
  onChanged,
}: {
  linkId: string;
  board: CoachingBoard;
  canSubmit: boolean;
  weekIndex: number;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<CheckIn | null>(null);
  const existing = board.checkIns.find((c) => c.week_index === weekIndex);

  return (
    <>
      {canSubmit && (
        <Card className="mb-3">
          <p className="text-sm font-black text-ink">This week's check-in</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Week {weekIndex}
            {existing
              ? ` · submitted ${formatShortDate(existing.submitted_at.slice(0, 10))}`
              : " · not submitted yet"}
          </p>
          <Button
            className="mt-3"
            full
            variant={existing ? "secondary" : "primary"}
            onClick={() => setEditing(existing ?? makeCheckIn(linkId, weekIndex))}
          >
            {existing ? "Update check-in" : "Submit check-in"}
          </Button>
        </Card>
      )}

      <SectionHeader title="History" />
      {board.checkIns.length === 0 ? (
        <EmptyState
          title="No check-ins yet"
          subtitle={canSubmit ? "Your coach sees these each week." : "Nothing submitted yet."}
        />
      ) : (
        <div className="space-y-2">
          {[...board.checkIns]
            .sort((a, b) => b.week_index - a.week_index)
            .map((checkIn) => (
              <Card key={checkIn.id}>
                <div className="flex items-center gap-2">
                  <Pill tint="var(--t-accent)">Week {checkIn.week_index}</Pill>
                  {checkIn.weight_kg !== null && (
                    <span className="text-sm font-black text-ink">{checkIn.weight_kg} kg</span>
                  )}
                  <span className="ml-auto text-[11px] font-bold text-muted">
                    {formatShortDate(checkIn.submitted_at.slice(0, 10))}
                  </span>
                  {canSubmit && (
                    <IconButton label="Edit check-in" onClick={() => setEditing(checkIn)}>
                      <Icon.edit className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {(
                    [
                      ["Sleep", checkIn.sleep],
                      ["Energy", checkIn.energy],
                      ["Appetite", checkIn.appetite],
                      ["Pain", checkIn.pain],
                    ] as const
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] font-black uppercase text-muted">{label}</dt>
                        <dd className="text-xs font-bold text-ink">{value}</dd>
                      </div>
                    ))}
                </dl>
              </Card>
            ))}
        </div>
      )}

      {editing && (
        <CheckInSheet
          checkIn={editing}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await api.saveCheckIn(next);
            await onChanged();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CheckInSheet({
  checkIn,
  onSave,
  onClose,
}: {
  checkIn: CheckIn;
  onSave: (c: CheckIn) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(checkIn);
  const set = (patch: Partial<CheckIn>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Sheet open onClose={onClose} title={`Week ${draft.week_index} check-in`}>
      <div className="space-y-3">
        <Field label="Body weight">
          <NumberField
            value={draft.weight_kg}
            step={0.1}
            max={400}
            suffix="kg"
            onChange={(v) => set({ weight_kg: v })}
          />
        </Field>
        <Field label="Sleep">
          <TextField value={draft.sleep} placeholder="7h, waking once" onChange={(e) => set({ sleep: e.target.value })} />
        </Field>
        <Field label="Energy">
          <TextField value={draft.energy} placeholder="Good / flat / up and down" onChange={(e) => set({ energy: e.target.value })} />
        </Field>
        <Field label="Appetite">
          <TextField value={draft.appetite} placeholder="Normal" onChange={(e) => set({ appetite: e.target.value })} />
        </Field>
        <Field label="Aches or pain">
          <TextField value={draft.pain} placeholder="Left shoulder on press" onChange={(e) => set({ pain: e.target.value })} />
        </Field>
      </div>
      <Button
        full
        className="mt-4"
        onClick={() => onSave({ ...draft, submitted_at: new Date().toISOString() })}
      >
        Save check-in
      </Button>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// Coach notes
// ------------------------------------------------------------------

export function NotesPanel({
  linkId,
  board,
  canEdit,
  onChanged,
}: {
  linkId: string;
  board: CoachingBoard;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<CoachNote | null>(null);

  return (
    <>
      <SectionHeader
        title="Coach notes"
        action={
          canEdit ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(makeCoachNote(linkId))}>
              <Icon.plus className="h-4 w-4" /> Note
            </Button>
          ) : undefined
        }
      />
      {board.notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          subtitle={canEdit ? "Record what you changed and why." : "Your coach hasn't left notes yet."}
        />
      ) : (
        <div className="space-y-2">
          {board.notes.map((note) => (
            <Card key={note.id}>
              <div className="flex items-center gap-2">
                <Pill tint="var(--t-accent)">{formatShortDate(note.note_date)}</Pill>
                {note.next_review && (
                  <span className="text-[11px] font-bold text-muted">
                    review {formatShortDate(note.next_review)}
                  </span>
                )}
                {canEdit && (
                  <div className="ml-auto flex gap-1">
                    <IconButton label="Edit note" onClick={() => setEditing(note)}>
                      <Icon.edit className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Delete note"
                      onClick={async () => {
                        await api.deleteCoachNote(note.id);
                        await onChanged();
                      }}
                    >
                      <Icon.trash className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
              {note.observation && <p className="mt-2 text-sm font-bold text-ink">{note.observation}</p>}
              {note.adjustment && (
                <p className="mt-1 text-xs font-semibold text-muted">
                  <span className="font-black uppercase">Change:</span> {note.adjustment}
                </p>
              )}
              {note.reason && (
                <p className="mt-0.5 text-xs font-semibold text-muted">
                  <span className="font-black uppercase">Why:</span> {note.reason}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <NoteSheet
          note={editing}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await api.saveCoachNote(next);
            await onChanged();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function NoteSheet({
  note,
  onSave,
  onClose,
}: {
  note: CoachNote;
  onSave: (n: CoachNote) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const set = (patch: Partial<CoachNote>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Sheet open onClose={onClose} title="Coach note">
      <div className="space-y-3">
        <Field label="Date">
          <TextField type="date" value={draft.note_date} onChange={(e) => set({ note_date: e.target.value })} />
        </Field>
        <Field label="What you saw">
          <TextField
            value={draft.observation}
            placeholder="Bar speed dropped on the top set"
            onChange={(e) => set({ observation: e.target.value })}
          />
        </Field>
        <Field label="What you changed">
          <TextField
            value={draft.adjustment}
            placeholder="Hold the load another week"
            onChange={(e) => set({ adjustment: e.target.value })}
          />
        </Field>
        <Field label="Why">
          <TextField value={draft.reason} onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <Field label="Next review">
          <TextField
            type="date"
            value={draft.next_review ?? ""}
            onChange={(e) => set({ next_review: e.target.value || null })}
          />
        </Field>
      </div>
      <Button full className="mt-4" onClick={() => onSave(draft)}>
        Save note
      </Button>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// Trackers (body assessment, mobility, flexibility, cardio)
// ------------------------------------------------------------------

export function TrackersPanel({
  linkId,
  board,
  canEdit,
  onChanged,
}: {
  linkId: string;
  board: CoachingBoard;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<TrackerTemplate | null>(null);

  const entryFor = useCallback(
    (templateId: string, metricKey: string, column: number) =>
      board.entries.find(
        (e) => e.template_id === templateId && e.metric_key === metricKey && e.column_index === column,
      ),
    [board.entries],
  );

  async function setValue(template: TrackerTemplate, metricKey: string, column: number, value: string) {
    const existing = entryFor(template.id, metricKey, column);
    const entry: TrackerEntry = existing
      ? { ...existing, value }
      : {
          id: newId(),
          template_id: template.id,
          coach_link_id: linkId,
          metric_key: metricKey,
          column_index: column,
          value,
        };
    await api.saveTrackerEntry(entry);
    await onChanged();
  }

  return (
    <>
      <SectionHeader
        title="Trackers"
        action={
          canEdit ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(makeTrackerTemplate(linkId))}>
              <Icon.plus className="h-4 w-4" /> Tracker
            </Button>
          ) : undefined
        }
      />

      {board.templates.length === 0 ? (
        <EmptyState
          title="No trackers yet"
          subtitle={
            canEdit
              ? "Add a body assessment, mobility or flexibility tracker and fill it in over the block."
              : "Your coach hasn't set up trackers yet."
          }
        />
      ) : (
        <div className="space-y-3">
          {board.templates.map((template) => (
            <Card key={template.id}>
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{template.title}</p>
                  <p className="text-[11px] font-bold uppercase text-muted">
                    {TRACKER_KIND_LABELS[template.kind]}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <IconButton label="Edit tracker" onClick={() => setEditing(template)}>
                      <Icon.edit className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Delete tracker"
                      onClick={async () => {
                        await api.deleteTrackerTemplate(template.id);
                        await onChanged();
                      }}
                    >
                      <Icon.trash className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>

              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[420px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="pb-1 pr-2 text-[10px] font-black uppercase text-muted">Metric</th>
                      {template.column_labels.map((label, i) => (
                        <th key={`${label}-${i}`} className="pb-1 pr-2 text-[10px] font-black uppercase text-muted">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {template.metrics.map((metric) => (
                      <tr key={metric.key} className="border-t border-line">
                        <td className="py-1.5 pr-2 text-xs font-bold text-ink">
                          {metric.label}
                          {metric.unit && <span className="ml-1 text-[10px] font-semibold text-muted">{metric.unit}</span>}
                        </td>
                        {template.column_labels.map((_, column) => {
                          const value = entryFor(template.id, metric.key, column)?.value ?? "";
                          return (
                            <td key={column} className="py-1 pr-2">
                              {canEdit ? (
                                <input
                                  defaultValue={value}
                                  onBlur={(e) => {
                                    if (e.target.value !== value) {
                                      setValue(template, metric.key, column, e.target.value);
                                    }
                                  }}
                                  className="h-8 w-16 rounded-lg border border-line bg-inset px-2 text-xs font-bold text-ink outline-none focus:border-accent"
                                />
                              ) : (
                                <span className="text-xs font-bold text-ink">{value || "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TrackerSheet
          template={editing}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await api.saveTrackerTemplate(next);
            await onChanged();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function TrackerSheet({
  template,
  onSave,
  onClose,
}: {
  template: TrackerTemplate;
  onSave: (t: TrackerTemplate) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(template);
  const metricsText = useMemo(
    () => draft.metrics.map((m) => (m.unit ? `${m.label} (${m.unit})` : m.label)).join("\n"),
    [draft.metrics],
  );

  function parseMetrics(text: string) {
    const metrics = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.*?)\s*\((.*?)\)$/);
        const label = (match ? match[1] : line).trim();
        return {
          key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || newId(),
          label,
          unit: match ? match[2].trim() : undefined,
        };
      });
    setDraft((d) => ({ ...d, metrics }));
  }

  return (
    <Sheet open onClose={onClose} title="Tracker">
      <div className="space-y-3">
        <Field label="Title">
          <TextField value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        </Field>

        <Field label="Kind">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TRACKER_KIND_LABELS) as TrackerKind[]).map((kind) => (
              <button
                key={kind}
                onClick={() => setDraft((d) => ({ ...d, kind }))}
                className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  draft.kind === kind ? "bg-accent text-white" : "border border-line bg-inset text-muted"
                }`}
              >
                {TRACKER_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Metrics — one per line, unit in brackets" hint="e.g. Waist (cm)">
          <textarea
            defaultValue={metricsText}
            onBlur={(e) => parseMetrics(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-line bg-inset p-3 text-sm font-bold text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Columns — one per line" hint="e.g. Start, Week 4, Week 8">
          <textarea
            defaultValue={draft.column_labels.join("\n")}
            onBlur={(e) =>
              setDraft((d) => ({
                ...d,
                column_labels: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            rows={4}
            className="w-full rounded-2xl border border-line bg-inset p-3 text-sm font-bold text-ink outline-none focus:border-accent"
          />
        </Field>
      </div>

      <Button full className="mt-4" onClick={() => onSave(draft)}>
        Save tracker
      </Button>
    </Sheet>
  );
}

export function BoardLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export { localDate };

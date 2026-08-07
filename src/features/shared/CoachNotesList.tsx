import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachNote } from "../../lib/types";
import { Button, Card, EmptyState, Modal, TextInput } from "../../components/ui";

export default function CoachNotesList({
  notes,
  readOnly = false,
  coachLinkId,
  onChanged,
}: {
  notes: CoachNote[];
  readOnly?: boolean;
  coachLinkId?: string;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CoachNote | null>(null);

  if (notes.length === 0 && readOnly) {
    return (
      <Card>
        <EmptyState title="No coach notes yet" subtitle="Your coach will post observations and plan adjustments here." />
      </Card>
    );
  }

  return (
    <>
      {!readOnly && coachLinkId && (
        <Button className="mb-3 w-full" onClick={() => { setEditing(null); setOpen(true); }}>
          + Add coach note
        </Button>
      )}
      <div className="flex flex-col gap-2">
        {notes.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold text-muted">No notes yet — add one for your athlete.</p>
          </Card>
        ) : (
          notes.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-muted">
                    {new Date(`${n.note_date}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {n.next_review && ` · Review ${new Date(`${n.next_review}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  </p>
                  {n.observation && (
                    <p className="mt-1 text-sm font-semibold">
                      <span className="font-extrabold">Observation:</span> {n.observation}
                    </p>
                  )}
                  {n.adjustment && (
                    <p className="mt-1 text-sm font-semibold">
                      <span className="font-extrabold">Adjustment:</span> {n.adjustment}
                    </p>
                  )}
                  {n.reason && (
                    <p className="mt-1 text-xs font-semibold text-muted">
                      <span className="font-extrabold">Reason:</span> {n.reason}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setEditing(n); setOpen(true); }}>
                    Edit
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {open && coachLinkId && (
        <CoachNoteEditor
          coachLinkId={coachLinkId}
          note={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function CoachNoteEditor({
  coachLinkId,
  note,
  onClose,
  onSaved,
}: {
  coachLinkId: string;
  note: CoachNote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [noteDate, setNoteDate] = useState(note?.note_date ?? new Date().toISOString().slice(0, 10));
  const [observation, setObservation] = useState(note?.observation ?? "");
  const [adjustment, setAdjustment] = useState(note?.adjustment ?? "");
  const [reason, setReason] = useState(note?.reason ?? "");
  const [nextReview, setNextReview] = useState(note?.next_review ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const row = {
      coach_link_id: coachLinkId,
      note_date: noteDate,
      observation: observation.trim(),
      adjustment: adjustment.trim(),
      reason: reason.trim(),
      next_review: nextReview.trim() || null,
    };
    const { error: err } = note
      ? await supabase.from("coach_notes").update(row).eq("id", note.id)
      : await supabase.from("coach_notes").insert(row);
    if (err) setError(err.message);
    else onSaved();
    setBusy(false);
  }

  async function remove() {
    if (!note || !confirm("Delete this note?")) return;
    await supabase.from("coach_notes").delete().eq("id", note.id);
    onSaved();
  }

  return (
    <Modal title={note ? "Edit coach note" : "New coach note"} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <Field label="Date">
          <TextInput type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
        </Field>
        <Field label="Observation">
          <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="What you noticed" />
        </Field>
        <Field label="Adjustment">
          <TextInput value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="Plan change" />
        </Field>
        <Field label="Reason">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why" />
        </Field>
        <Field label="Next review">
          <TextInput type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} />
        </Field>
        {error && <p className="text-xs font-bold text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={busy}>{busy ? "…" : "Save"}</Button>
          {note && (
            <Button variant="danger" onClick={remove}>Delete</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

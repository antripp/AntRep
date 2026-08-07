/**
 * Exercise library — the logging shape saved per exercise name. Whatever you
 * set here is what you get every time you log that exercise, in or out of a plan.
 */

import { useMemo, useState } from "react";
import { api } from "../../data";
import { makePreset } from "../../data/factories";
import { LOG_TYPE_LABELS, type ExercisePreset } from "../../data/types";
import { Button, Card, Field, Icon, NumberField, Pill, SectionHeader, Sheet, TextField } from "../../ui/kit";
import { CustomFieldsEditor, LogTypePicker } from "../plans/LoggingFields";
import { useWorkspace } from "../workspace";

export default function LibrarySection() {
  const { profile, presets, reload, showToast } = useWorkspace();
  const [editing, setEditing] = useState<ExercisePreset | null>(null);

  const sorted = useMemo(
    () => [...presets].sort((a, b) => a.name.localeCompare(b.name)),
    [presets],
  );

  async function save(preset: ExercisePreset) {
    await api.savePreset(preset);
    await reload();
    setEditing(null);
    showToast(`${preset.name} saved to your library`);
  }

  return (
    <>
      <SectionHeader
        title="Exercise library"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(makePreset(profile.id, ""))}
          >
            <Icon.plus className="h-4 w-4" /> New
          </Button>
        }
      />

      <Card className="p-0">
        <p className="border-b border-line px-4 py-3 text-xs font-semibold leading-snug text-muted">
          Set how each exercise is logged — weight × reps, reps only, time, distance, or your own
          fields. Saved here, it logs the same way everywhere, including workouts outside your plan.
        </p>

        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm font-semibold text-muted">
            Nothing saved yet. Add one, or save an exercise from the Exercises tab.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {sorted.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setEditing(preset)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{preset.name}</p>
                  <p className="truncate text-[11px] font-semibold text-muted">
                    {LOG_TYPE_LABELS[preset.log_type]}
                    {preset.custom_fields.length > 0 &&
                      ` · ${preset.custom_fields.map((f) => f.label).join(", ")}`}
                  </p>
                </div>
                {preset.is_favorite && <Pill tint="var(--t-accent)">Favourite</Pill>}
                <Icon.chevron className="h-4 w-4 text-muted" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <PresetSheet
          preset={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={
            presets.some((p) => p.id === editing.id)
              ? async () => {
                  await api.deletePreset(editing.id);
                  await reload();
                  setEditing(null);
                  showToast("Removed from your library");
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function PresetSheet({
  preset,
  onSave,
  onDelete,
  onClose,
}: {
  preset: ExercisePreset;
  onSave: (p: ExercisePreset) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(preset);
  const set = (patch: Partial<ExercisePreset>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Sheet open onClose={onClose} title={preset.name || "New exercise"}>
      <div className="space-y-3">
        <Field label="Exercise name">
          <TextField
            value={draft.name}
            placeholder="Sled push"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <LogTypePicker value={draft.log_type} onChange={(log_type) => set({ log_type })} />

        <div className="grid grid-cols-3 gap-2">
          <Field label="Sets">
            <NumberField value={draft.target_sets} min={1} max={20} onChange={(v) => set({ target_sets: v ?? 1 })} />
          </Field>
          <Field label="Reps">
            <NumberField value={draft.target_reps} min={0} max={100} onChange={(v) => set({ target_reps: v ?? 0 })} />
          </Field>
          <Field label="Rest">
            <NumberField value={draft.rest_sec} step={15} max={600} suffix="s" onChange={(v) => set({ rest_sec: v ?? 0 })} />
          </Field>
        </div>

        <CustomFieldsEditor
          fields={draft.custom_fields}
          onChange={(custom_fields) => set({ custom_fields })}
        />

        <Field label="Notes">
          <TextField
            value={draft.notes}
            placeholder="Setup, cue, machine number…"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-inset px-3 py-2">
          <p className="text-sm font-bold text-ink">Favourite</p>
          <button
            onClick={() => set({ is_favorite: !draft.is_favorite })}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              draft.is_favorite ? "bg-accent text-white" : "border border-line text-muted"
            }`}
          >
            {draft.is_favorite ? "Yes" : "No"}
          </button>
        </div>
      </div>

      <Button full className="mt-4" disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
        Save exercise
      </Button>
      {onDelete && (
        <Button full variant="danger" className="mt-2" onClick={onDelete}>
          <Icon.trash className="h-4 w-4" /> Remove from library
        </Button>
      )}
    </Sheet>
  );
}

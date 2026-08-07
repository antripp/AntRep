/**
 * Library — the movements available to log, yours and the built-in catalogue.
 *
 * Your own history, trends and per-exercise pages live under Progress →
 * Exercises; this screen is about what you *can* log, not what you have.
 */

import { useMemo, useState } from "react";
import { api } from "../../data";
import { CATALOG, categoryFor } from "../../data/catalog";
import { makePreset } from "../../data/factories";
import { CATEGORY_EMOJI } from "../progress/ExercisesTab";
import { Button, EmptyState, Icon, IconTile, ScreenTitle, SectionHeader, TextField } from "../../ui/kit";
import { useWorkspace } from "../workspace";

export default function ExercisesScreen() {
  const { profile, sessions, logs, presets, reload, showToast } = useWorkspace();
  const [query, setQuery] = useState("");

  // Names the athlete has actually logged, so the library can flag them.
  const logged = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.id));
    return new Set(
      logs.filter((l) => ids.has(l.session_id)).map((l) => l.exercise_name.trim().toLowerCase()),
    );
  }, [sessions, logs]);

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = new Set(presets.map((p) => p.name.toLowerCase()));
    const merged = [
      ...presets.map((p) => ({ name: p.name, category: p.category, saved: true })),
      ...CATALOG.filter((c) => !names.has(c.name.toLowerCase())).map((c) => ({
        name: c.name,
        category: c.category,
        saved: false,
      })),
    ];
    return q ? merged.filter((m) => m.name.toLowerCase().includes(q)) : merged;
  }, [presets, query]);

  async function toggleSaved(name: string, saved: boolean) {
    if (saved) {
      const preset = presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (preset) await api.deletePreset(preset.id);
      showToast("Removed from your library");
    } else {
      await api.savePreset(makePreset(profile.id, name));
      showToast("Saved to your library");
    }
    await reload();
  }

  return (
    <>
      <ScreenTitle title="Library" />

      <div className="mb-3">
        <TextField
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <SectionHeader title={`${library.length} exercises`} />

      {library.length === 0 ? (
        <EmptyState title="No match" subtitle="Nothing in the catalogue under that name." />
      ) : (
        <div className="space-y-1.5">
          {library.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            >
              <IconTile
                emoji={CATEGORY_EMOJI[entry.category] ?? CATEGORY_EMOJI[categoryFor(entry.name)] ?? "🏋️"}
                tint="var(--t-accent)"
                size={34}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{entry.name}</p>
                <p className="text-[11px] font-bold uppercase text-muted">
                  {entry.category}
                  {logged.has(entry.name.trim().toLowerCase()) && " · logged"}
                </p>
              </div>
              <Button
                size="sm"
                variant={entry.saved ? "secondary" : "ghost"}
                onClick={() => toggleSaved(entry.name, entry.saved)}
              >
                {entry.saved ? <Icon.check className="h-4 w-4" /> : <Icon.plus className="h-4 w-4" />}
                {entry.saved ? "Saved" : "Save"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] font-semibold text-muted">
        Your history, trends and records live under Progress → Exercises.
      </p>
    </>
  );
}

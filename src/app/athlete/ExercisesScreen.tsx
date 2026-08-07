/** Exercises — the library plus your own history, PRs and trend per movement. */

import { useMemo, useState } from "react";
import { api } from "../../data";
import { CATALOG, categoryFor } from "../../data/catalog";
import { makePreset } from "../../data/factories";
import { formatShortDate } from "../../domain/dates";
import { exerciseStats, type ExerciseStat } from "../../domain/analytics";
import { LineChart } from "../../ui/charts";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconTile,
  Pill,
  ScreenTitle,
  SectionHeader,
  Segmented,
  Sheet,
  TextField,
} from "../../ui/kit";
import { useWorkspace } from "../workspace";

const CATEGORY_EMOJI: Record<string, string> = {
  push: "🏋️",
  pull: "🚣",
  legs: "🦵",
  core: "🧘",
  cardio: "🏃",
};

export default function ExercisesScreen() {
  const { profile, sessions, logs, presets, reload, showToast } = useWorkspace();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"history" | "library">("history");
  const [open, setOpen] = useState<ExerciseStat | null>(null);

  const stats = useMemo(() => exerciseStats(sessions, logs), [sessions, logs]);

  const filteredStats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? stats.filter((s) => s.name.toLowerCase().includes(q)) : stats;
  }, [stats, query]);

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
      <ScreenTitle title="Exercises" />

      <div className="mb-3 space-y-2">
        <TextField
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "history", label: `My history (${stats.length})` },
            { value: "library", label: "Library" },
          ]}
        />
      </div>

      {tab === "history" && (
        <>
          {filteredStats.length === 0 ? (
            <EmptyState
              title="No logged exercises yet"
              subtitle="Every exercise you log shows up here with its own chart and records."
            />
          ) : (
            <div className="space-y-2">
              {filteredStats.map((stat) => (
                <Card key={stat.key} onClick={() => setOpen(stat)}>
                  <div className="flex items-center gap-3">
                    <IconTile emoji={CATEGORY_EMOJI[categoryFor(stat.name)] ?? "🏋️"} tint="var(--t-accent)" size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-ink">{stat.name}</p>
                      <p className="truncate text-xs font-bold text-muted">
                        {stat.sessions} session{stat.sessions === 1 ? "" : "s"}
                        {stat.lastDate && ` · last ${formatShortDate(stat.lastDate)}`}
                      </p>
                    </div>
                    <Pill tint="var(--t-accent)">
                      {stat.logType === "cardio"
                        ? `${Math.round(stat.best * 10) / 10} km`
                        : stat.logType === "timed"
                          ? `${Math.round(stat.best)} s`
                          : `${stat.best} kg`}
                    </Pill>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "library" && (
        <>
          <SectionHeader title={`${library.length} exercises`} />
          <div className="space-y-1.5">
            {library.map((entry) => (
              <div key={entry.name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <IconTile emoji={CATEGORY_EMOJI[entry.category] ?? "🏋️"} tint="var(--t-accent)" size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{entry.name}</p>
                  <p className="text-[11px] font-bold uppercase text-muted">{entry.category}</p>
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
        </>
      )}

      {open && <ExerciseDetailSheet stat={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function ExerciseDetailSheet({ stat, onClose }: { stat: ExerciseStat; onClose: () => void }) {
  const unit = stat.logType === "cardio" ? "km" : stat.logType === "timed" ? "sec" : "kg";
  const [view, setView] = useState<"best" | "volume" | "reps">("best");

  const chart = stat.history.slice(-12).map((h) => ({
    label: formatShortDate(h.date),
    value: view === "best" ? h.best : view === "volume" ? h.volume : h.reps,
    detail: `${formatShortDate(h.date)} · ${Math.round(h.best * 10) / 10} ${unit} best · ${Math.round(h.volume)} kg volume`,
  }));

  return (
    <Sheet open onClose={onClose} title={stat.name}>
      <div className="mb-3 flex gap-2">
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-lg font-black text-ink">
            {Math.round(stat.best * 10) / 10} {unit}
          </p>
          <p className="text-[11px] font-bold uppercase text-muted">best</p>
        </div>
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-lg font-black text-ink">{stat.sessions}</p>
          <p className="text-[11px] font-bold uppercase text-muted">sessions</p>
        </div>
        <div className="flex-1 rounded-2xl bg-inset p-3 text-center">
          <p className="text-lg font-black text-ink">{Math.round(stat.volume).toLocaleString()}</p>
          <p className="text-[11px] font-bold uppercase text-muted">kg volume</p>
        </div>
      </div>

      <div className="mb-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "best", label: `Best ${unit}` },
            { value: "volume", label: "Volume" },
            { value: "reps", label: "Reps" },
          ]}
        />
      </div>

      <LineChart
        data={chart}
        format={(v) => (view === "best" ? `${Math.round(v * 10) / 10} ${unit}` : String(Math.round(v)))}
      />

      {stat.best1RM > 0 && (
        <p className="mt-1 text-center text-[11px] font-bold text-muted">
          Best estimated 1RM {Math.round(stat.best1RM * 10) / 10} kg
        </p>
      )}

      <SectionHeader title="Recent sessions" />
      <div className="space-y-1.5">
        {[...stat.history]
          .reverse()
          .slice(0, 8)
          .map((h) => (
            <div key={h.date} className="flex items-center justify-between rounded-xl bg-inset px-3 py-2">
              <span className="text-xs font-bold text-muted">{formatShortDate(h.date)}</span>
              <span className="text-sm font-black text-ink">
                {Math.round(h.best * 10) / 10} {unit}
                {h.volume > 0 && <span className="ml-2 text-xs font-bold text-muted">{Math.round(h.volume)} kg vol</span>}
              </span>
            </div>
          ))}
      </div>
    </Sheet>
  );
}

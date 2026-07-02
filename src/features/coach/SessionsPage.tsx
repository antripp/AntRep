import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { localDateString, type CoachSettings, type Session, type SetLog } from "../../lib/types";
import { applyLayout, buildColumns, exportCsv, exportXlsx, type SessionExport } from "../../lib/exportXlsx";
import { Button, Card, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../auth/useAuth";
import { AthletePicker, type LinkedAthlete } from "./CoachApp";

export default function SessionsPage({
  athletes,
  selectedId,
  onSelectAthlete,
}: {
  athletes: LinkedAthlete[];
  selectedId: string | null;
  onSelectAthlete: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logsBySession, setLogsBySession] = useState<Map<string, SetLog[]>>(new Map());
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 28);
    return localDateString(d);
  });
  const [toDate, setToDate] = useState(localDateString(new Date()));

  const load = useCallback(async () => {
    if (!selectedId || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: s } = await supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", selectedId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false });
    const sessionRows = (s as Session[]) ?? [];
    setSessions(sessionRows);

    const map = new Map<string, SetLog[]>();
    if (sessionRows.length > 0) {
      const { data: logs } = await supabase
        .from("set_logs")
        .select("*")
        .in("session_id", sessionRows.map((row) => row.id));
      for (const log of (logs as SetLog[]) ?? []) {
        const arr = map.get(log.session_id) ?? [];
        arr.push(log);
        map.set(log.session_id, arr);
      }
    }
    setLogsBySession(map);

    const { data: cs } = await supabase
      .from("coach_settings")
      .select("*")
      .eq("trainer_id", profile.id)
      .maybeSingle();
    setSettings((cs as CoachSettings) ?? null);
    setLoading(false);
  }, [selectedId, profile, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  function columns() {
    return applyLayout(buildColumns(settings?.custom_fields ?? []), settings?.export_columns ?? []);
  }

  function exportData(data: SessionExport[], name: string, format: "xlsx" | "csv") {
    if (format === "xlsx") exportXlsx(data, columns(), name);
    else exportCsv(data, columns(), name);
  }

  function exportAll(format: "xlsx" | "csv") {
    const data = sessions
      .map((s) => ({ session: s, sets: logsBySession.get(s.id) ?? [] }))
      .filter((d) => d.sets.length > 0)
      .reverse(); // chronological in the file
    const athleteName = athletes.find((a) => a.athlete.id === selectedId)?.athlete.display_name ?? "athlete";
    exportData(data, `antrep_${athleteName}_${fromDate}_${toDate}`.replace(/\s+/g, "-"), format);
  }

  if (athletes.length === 0) {
    return (
      <Card>
        <EmptyState title="Link an athlete first" subtitle="Create an invite code on the Athletes tab." />
      </Card>
    );
  }

  return (
    <>
      <h1 className="mb-3 text-2xl font-black">Sessions</h1>
      <AthletePicker athletes={athletes} selectedId={selectedId} onSelect={onSelectAthlete} />

      <Card className="mb-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-extrabold text-chip">
            From
            <input
              type="date"
              className="mt-1 block rounded-xl border border-mint/60 bg-white px-2 py-1.5 text-sm font-bold text-ink"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="text-xs font-extrabold text-chip">
            To
            <input
              type="date"
              className="mt-1 block rounded-xl border border-mint/60 bg-white px-2 py-1.5 text-sm font-bold text-ink"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button onClick={() => exportAll("xlsx")} disabled={sessions.length === 0}>
              Export .xlsx
            </Button>
            <Button variant="secondary" onClick={() => exportAll("csv")} disabled={sessions.length === 0}>
              .csv
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState title="No sessions in this range" subtitle="Completed workouts show up here as they happen." />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const sets = logsBySession.get(s.id) ?? [];
            const volume = sets.reduce((acc, l) => acc + (l.weight_kg ?? 0) * (l.reps ?? 0), 0);
            const open = expanded === s.id;
            return (
              <Card key={s.id}>
                <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setExpanded(open ? null : s.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">
                      {s.day_title}{" "}
                      <span className="text-xs font-bold text-chip">
                        {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-chip">
                      {s.status === "complete" ? "✓ Complete" : "In progress"} · {sets.length} sets
                      {volume > 0 && ` · ${Math.round(volume)} kg volume`}
                    </p>
                  </div>
                  <span className="text-chip">{open ? "▴" : "▾"}</span>
                </button>

                {open && (
                  <div className="mt-2 border-t border-mint-pale pt-2">
                    {groupSets(sets).map(([exercise, exSets]) => (
                      <p key={exercise} className="py-0.5 text-xs font-semibold">
                        <span className="font-extrabold">{exercise}:</span>{" "}
                        {exSets
                          .map((l) =>
                            l.weight_kg != null
                              ? `${l.weight_kg}×${l.reps ?? 0}`
                              : l.distance_km != null
                                ? `${l.distance_km} km/${Math.round((l.duration_sec ?? 0) / 60)} min`
                                : `${Math.round((l.duration_sec ?? 0) / 60)} min`,
                          )
                          .join(" · ")}
                      </p>
                    ))}
                    <Button
                      variant="secondary"
                      className="mt-2"
                      onClick={() => exportData([{ session: s, sets }], `antrep_session_${s.date}`, "xlsx")}
                    >
                      Export this session
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function groupSets(sets: SetLog[]): [string, SetLog[]][] {
  const map = new Map<string, SetLog[]>();
  for (const l of sets) {
    const arr = map.get(l.exercise_name) ?? [];
    arr.push(l);
    map.set(l.exercise_name, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.set_index - b.set_index);
  return [...map.entries()];
}

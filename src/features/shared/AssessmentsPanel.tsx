import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  columnLabelsForTemplate,
  computeCardioAutoFill,
  DEFAULT_TRACKER_DEFS,
  type ClientProfileData,
} from "../../lib/trackers";
import type { TrackerEntry, TrackerTemplate } from "../../lib/types";
import { fetchProgressionLogs } from "../../lib/coachLinkData";
import { Card, Spinner } from "../../components/ui";
import ClientProfileForm from "./ClientProfileForm";
import TrackerGrid from "./TrackerGrid";

export default function AssessmentsPanel({
  coachLinkId,
  athleteProfileId,
  programStart,
  durationWeeks,
  readOnly = false,
}: {
  coachLinkId: string;
  athleteProfileId: string;
  programStart: string;
  durationWeeks: number;
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TrackerTemplate[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientProfileData>({});
  const [cardioAuto, setCardioAuto] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    await ensureDefaultTemplates(coachLinkId, durationWeeks);

    const [{ data: tpls }, { data: ents }, { data: cp }] = await Promise.all([
      supabase.from("tracker_templates").select("*").eq("coach_link_id", coachLinkId).eq("is_active", true).order("sort_order"),
      supabase.from("tracker_entries").select("*").eq("coach_link_id", coachLinkId),
      supabase.from("athlete_client_profiles").select("*").eq("coach_link_id", coachLinkId).maybeSingle(),
    ]);

    setTemplates((tpls as TrackerTemplate[]) ?? []);
    setEntries((ents as TrackerEntry[]) ?? []);
    setClientProfile(((cp as { profile?: ClientProfileData })?.profile) ?? {});

    const cardioTpl = ((tpls as TrackerTemplate[]) ?? []).find((t) => t.kind === "cardio");
    if (cardioTpl) {
      const { sessions, setLogs } = await fetchProgressionLogs(athleteProfileId, programStart, durationWeeks);
      setCardioAuto(
        computeCardioAutoFill(sessions, setLogs, programStart, durationWeeks, cardioTpl.column_labels),
      );
    }
    setLoading(false);
  }, [coachLinkId, athleteProfileId, programStart, durationWeeks]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [templates],
  );

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <ClientProfileForm
        coachLinkId={coachLinkId}
        profile={clientProfile}
        readOnly={readOnly}
        onSaved={setClientProfile}
      />

      {activeTemplates.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-muted">No assessment trackers configured yet.</p>
        </Card>
      ) : (
        activeTemplates.map((tpl) => (
          <section key={tpl.id}>
            <h3 className="mb-2 font-black">{tpl.title}</h3>
            {tpl.kind === "cardio" && !readOnly && (
              <p className="mb-2 text-xs font-semibold text-muted">
                Cycling time, distance, and RPE auto-fill from logged cardio sessions (accent = auto).
              </p>
            )}
            <TrackerGrid
              template={tpl}
              entries={entries.filter((e) => e.template_id === tpl.id)}
              readOnly={readOnly}
              autoFill={tpl.kind === "cardio" ? cardioAuto : new Map()}
              onSaved={load}
            />
          </section>
        ))
      )}
    </div>
  );
}

async function ensureDefaultTemplates(coachLinkId: string, durationWeeks: number) {
  const { data: existing } = await supabase
    .from("tracker_templates")
    .select("kind")
    .eq("coach_link_id", coachLinkId);
  const have = new Set(((existing as { kind: string }[]) ?? []).map((r) => r.kind));

  const toInsert = DEFAULT_TRACKER_DEFS.filter((d) => !have.has(d.kind)).map((def, i) => ({
    coach_link_id: coachLinkId,
    kind: def.kind,
    title: def.title,
    metrics: def.metrics,
    column_labels: columnLabelsForTemplate(def, durationWeeks),
    column_mode: def.column_mode,
    sort_order: i,
    is_active: true,
  }));

  if (toInsert.length > 0) {
    await supabase.from("tracker_templates").insert(toInsert);
  }
}

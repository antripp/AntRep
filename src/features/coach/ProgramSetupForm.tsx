import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AthleteProgram, ProgressionMetric } from "../../lib/types";
import { Button, Card, Select, TextInput } from "../../components/ui";

export default function ProgramSetupForm({
  coachLinkId,
  program,
  defaultStartDate,
  onSaved,
}: {
  coachLinkId: string;
  program: AthleteProgram | null;
  defaultStartDate: string;
  onSaved: (p: AthleteProgram) => void;
}) {
  const [goals, setGoals] = useState(program?.goals ?? "");
  const [durationWeeks, setDurationWeeks] = useState(String(program?.duration_weeks ?? 12));
  const [startDate, setStartDate] = useState(program?.start_date ?? defaultStartDate);
  const [assessmentDate, setAssessmentDate] = useState(program?.assessment_date ?? "");
  const [metric, setMetric] = useState<ProgressionMetric>(program?.progression_metric ?? "max_weight");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    const row = {
      coach_link_id: coachLinkId,
      goals: goals.trim(),
      duration_weeks: Math.min(104, Math.max(1, Number(durationWeeks) || 12)),
      start_date: startDate || null,
      assessment_date: assessmentDate.trim() || null,
      progression_metric: metric,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = program
      ? await supabase.from("athlete_programs").update(row).eq("id", program.id).select().single()
      : await supabase.from("athlete_programs").insert(row).select().single();
    if (!error && data) {
      onSaved(data as AthleteProgram);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setBusy(false);
  }

  return (
    <Card>
      <h3 className="mb-2 font-black">Program setup</h3>
      <p className="mb-3 text-xs font-semibold text-muted">Goals, timeline, and how progression is measured.</p>
      <div className="flex flex-col gap-3">
        <Field label="Goals">
          <TextInput value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. Joint strength, cardio, flexibility" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (weeks)">
            <TextInput type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
          </Field>
          <Field label="Start date">
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Assessment date">
          <TextInput type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
        </Field>
        <Field label="Progression metric">
          <Select
            value={metric}
            onChange={setMetric}
            options={[
              { value: "max_weight", label: "Max weight (kg)" },
              { value: "total_volume", label: "Total volume (kg)" },
            ]}
          />
        </Field>
      </div>
      <Button className="mt-4 w-full" onClick={save} disabled={busy}>
        {busy ? "…" : saved ? "Saved ✓" : "Save program"}
      </Button>
    </Card>
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

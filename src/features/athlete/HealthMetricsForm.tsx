import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { HealthMetrics } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";
import { useAuth } from "../auth/useAuth";

const FIELDS: { key: keyof HealthMetrics; label: string; placeholder?: string }[] = [
  { key: "height_cm", label: "Height (cm)", placeholder: "170" },
  { key: "weight_kg", label: "Weight (kg)", placeholder: "68" },
  { key: "age", label: "Age", placeholder: "30" },
  { key: "sex", label: "Sex", placeholder: "Optional" },
  { key: "resting_hr", label: "Resting HR (bpm)", placeholder: "62" },
  { key: "blood_pressure", label: "Blood pressure", placeholder: "120/80" },
];

export default function HealthMetricsForm() {
  const { profile, refreshProfiles } = useAuth();
  const existing = profile?.health_metrics ?? {};
  const [metrics, setMetrics] = useState<HealthMetrics>({ ...existing });
  const [notes, setNotes] = useState(existing.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const row: HealthMetrics = { ...metrics, notes: notes.trim() || undefined };
    await supabase.from("profiles").update({ health_metrics: row }).eq("id", profile.id);
    await refreshProfiles();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setBusy(false);
  }

  return (
    <Card>
      <h2 className="mb-1 font-black">Health metrics</h2>
      <p className="mb-3 text-xs font-semibold text-muted">Your baseline stats — shared with coaches for assessments.</p>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-muted">{f.label}</span>
            <TextInput
              value={metrics[f.key] ?? ""}
              onChange={(e) => setMetrics((m) => ({ ...m, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-muted">Notes</span>
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, conditions, etc." />
      </label>
      <Button className="mt-4 w-full" onClick={save} disabled={busy}>
        {busy ? "…" : saved ? "Saved ✓" : "Save health metrics"}
      </Button>
    </Card>
  );
}

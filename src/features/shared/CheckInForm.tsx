import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CheckIn } from "../../lib/types";
import { Button, Card, TextInput } from "../../components/ui";

export default function CheckInForm({
  coachLinkId,
  weekIndex,
  existing,
  onSaved,
}: {
  coachLinkId: string;
  weekIndex: number;
  existing: CheckIn | null;
  onSaved: (row: CheckIn) => void;
}) {
  const [weightKg, setWeightKg] = useState(existing?.weight_kg != null ? String(existing.weight_kg) : "");
  const [sleep, setSleep] = useState(existing?.sleep ?? "");
  const [energy, setEnergy] = useState(existing?.energy ?? "");
  const [appetite, setAppetite] = useState(existing?.appetite ?? "");
  const [pain, setPain] = useState(existing?.pain ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const row = {
      coach_link_id: coachLinkId,
      week_index: weekIndex,
      weight_kg: weightKg.trim() === "" ? null : Number(weightKg),
      sleep: sleep.trim(),
      energy: energy.trim(),
      appetite: appetite.trim(),
      pain: pain.trim(),
      submitted_at: new Date().toISOString(),
    };
    const { data, error: err } = existing
      ? await supabase.from("check_ins").update(row).eq("id", existing.id).select().single()
      : await supabase.from("check_ins").insert(row).select().single();
    if (err || !data) setError(err?.message ?? "Couldn't save check-in.");
    else onSaved(data as CheckIn);
    setBusy(false);
  }

  return (
    <Card>
      <h3 className="mb-3 font-black">Week {weekIndex} check-in</h3>
      <div className="flex flex-col gap-3">
        <Field label="Weight (kg)">
          <TextInput type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Sleep">
          <TextInput value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="e.g. 7h, restless" />
        </Field>
        <Field label="Energy">
          <TextInput value={energy} onChange={(e) => setEnergy(e.target.value)} placeholder="e.g. Good, low afternoon" />
        </Field>
        <Field label="Appetite">
          <TextInput value={appetite} onChange={(e) => setAppetite(e.target.value)} placeholder="e.g. Normal" />
        </Field>
        <Field label="Pain">
          <TextInput value={pain} onChange={(e) => setPain(e.target.value)} placeholder="e.g. Knee 3/10" />
        </Field>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
      <Button className="mt-4 w-full" onClick={submit} disabled={busy}>
        {busy ? "…" : existing ? "Update check-in" : "Submit check-in"}
      </Button>
    </Card>
  );
}

export function CheckInHistory({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) return null;
  return (
    <Card>
      <h3 className="mb-2 font-black">History</h3>
      <div className="flex flex-col gap-2">
        {[...checkIns].reverse().map((c) => (
          <div key={c.id} className="rounded-xl bg-inset px-3 py-2">
            <p className="text-sm font-extrabold">Week {c.week_index}</p>
            <p className="text-xs font-semibold text-muted">
              {[
                c.weight_kg != null && `${c.weight_kg} kg`,
                c.sleep && `Sleep: ${c.sleep}`,
                c.energy && `Energy: ${c.energy}`,
                c.appetite && `Appetite: ${c.appetite}`,
                c.pain && `Pain: ${c.pain}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Submitted"}
            </p>
          </div>
        ))}
      </div>
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

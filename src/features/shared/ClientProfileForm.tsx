import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_CLIENT_PROFILE,
  MEDICAL_FIELDS,
  RESTRICTION_FIELDS,
  type ClientProfileData,
} from "../../lib/trackers";
import { Button, Card, TextInput } from "../../components/ui";

export default function ClientProfileForm({
  coachLinkId,
  profile,
  readOnly = false,
  onSaved,
}: {
  coachLinkId: string;
  profile: ClientProfileData;
  readOnly?: boolean;
  onSaved?: (p: ClientProfileData) => void;
}) {
  const merged = { ...DEFAULT_CLIENT_PROFILE, ...profile };
  const [data, setData] = useState<ClientProfileData>(merged);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("athlete_client_profiles").upsert({
      coach_link_id: coachLinkId,
      profile: data,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      onSaved?.(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setBusy(false);
  }

  if (readOnly) {
    return (
      <Card>
        <h3 className="mb-2 font-black">Client profile</h3>
        <div className="flex flex-col gap-2 text-sm font-semibold">
          {data.age && <p><span className="font-extrabold">Age:</span> {data.age}</p>}
          {data.height && <p><span className="font-extrabold">Height:</span> {data.height}</p>}
          {data.doctor_clearance && <p><span className="font-extrabold">Doctor clearance:</span> {data.doctor_clearance}</p>}
          {MEDICAL_FIELDS.map((f) => {
            const v = data.medical_history?.[f.key];
            if (!v) return null;
            return (
              <p key={f.key}>
                <span className="font-extrabold">{f.label}:</span> {v}
              </p>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 font-black">Client profile</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" value={data.age ?? ""} onChange={(v) => setData({ ...data, age: v })} />
        <Field label="Height" value={data.height ?? ""} onChange={(v) => setData({ ...data, height: v })} />
        <Field label="Phone" value={data.phone ?? ""} onChange={(v) => setData({ ...data, phone: v })} className="col-span-2" />
        <Field label="Doctor clearance" value={data.doctor_clearance ?? ""} onChange={(v) => setData({ ...data, doctor_clearance: v })} className="col-span-2" />
      </div>
      <h4 className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-muted">Medical history</h4>
      <div className="flex flex-col gap-2">
        {MEDICAL_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={data.medical_history?.[f.key] ?? ""}
            onChange={(v) =>
              setData({
                ...data,
                medical_history: { ...data.medical_history, [f.key]: v },
              })
            }
          />
        ))}
      </div>
      <h4 className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-muted">Restrictions</h4>
      <div className="flex flex-col gap-2">
        {RESTRICTION_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={data.restrictions?.[f.key] ?? ""}
            onChange={(v) =>
              setData({
                ...data,
                restrictions: { ...data.restrictions, [f.key]: v },
              })
            }
          />
        ))}
      </div>
      <Button className="mt-4 w-full" onClick={save} disabled={busy}>
        {busy ? "…" : saved ? "Saved ✓" : "Save profile"}
      </Button>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</span>
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

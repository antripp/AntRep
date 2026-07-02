import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CoachSettings, CustomField } from "../../lib/types";
import { buildColumns } from "../../lib/exportXlsx";
import { Button, Card, Spinner, TextInput } from "../../components/ui";
import { useAuth } from "../auth/useAuth";

/**
 * Coach-configurable logging & export:
 *  - custom per-set fields the athlete's logging form will show
 *  - which columns (and order) exports contain, to match the coach's sheet
 */
export default function CoachSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [layout, setLayout] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newType, setNewType] = useState<"number" | "text">("number");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const { data } = await supabase
        .from("coach_settings")
        .select("*")
        .eq("trainer_id", profile.id)
        .maybeSingle();
      const cs = data as CoachSettings | null;
      setFields(cs?.custom_fields ?? []);
      setLayout(cs?.export_columns ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const allColumns = useMemo(() => buildColumns(fields), [fields]);
  const effectiveLayout = layout.length > 0 ? layout : allColumns.map((c) => c.key);

  async function save(nextFields: CustomField[], nextLayout: string[]) {
    if (!profile) return;
    setFields(nextFields);
    setLayout(nextLayout);
    await supabase.from("coach_settings").upsert({
      trainer_id: profile.id,
      custom_fields: nextFields,
      export_columns: nextLayout,
      updated_at: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function addField() {
    const label = newLabel.trim();
    if (!label) return;
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!key || fields.some((f) => f.key === key)) return;
    const field: CustomField = { key, label, type: newType, ...(newUnit.trim() ? { unit: newUnit.trim() } : {}) };
    const nextFields = [...fields, field];
    // Newly added fields join the export layout automatically.
    const nextLayout = layout.length > 0 ? [...layout, `extra.${key}`] : [];
    save(nextFields, nextLayout);
    setNewLabel("");
    setNewUnit("");
  }

  function removeField(key: string) {
    save(
      fields.filter((f) => f.key !== key),
      layout.filter((k) => k !== `extra.${key}`),
    );
  }

  function toggleColumn(key: string) {
    const current = effectiveLayout;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    save(fields, next);
  }

  function moveColumn(key: string, dir: -1 | 1) {
    const current = [...effectiveLayout];
    const i = current.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    [current[i], current[j]] = [current[j], current[i]];
    save(fields, current);
  }

  async function saveName() {
    if (!profile) return;
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.id);
    await refreshProfile();
  }

  if (loading) return <Spinner />;

  return (
    <>
      <h1 className="mb-4 text-2xl font-black">Settings {saved && <span className="text-sm text-done-back">✓ saved</span>}</h1>
      <div className="flex flex-col gap-3">
        <Card>
          <h2 className="mb-2 font-black">Display name</h2>
          <div className="flex gap-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={saveName}>Save</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-black">Custom logging fields</h2>
          <p className="mb-3 text-xs font-semibold text-chip">
            Extra fields your athletes see when logging a set — e.g. band colour, tempo, machine setting.
            They also become export columns.
          </p>
          {fields.map((f) => (
            <div key={f.key} className="mb-1 flex items-center justify-between rounded-xl bg-mint-pale/60 px-3 py-2">
              <span className="text-sm font-extrabold">
                {f.label}
                {f.unit && <span className="text-chip"> ({f.unit})</span>}
                <span className="ml-2 text-[10px] font-bold uppercase text-chip">{f.type}</span>
              </span>
              <button type="button" className="text-xs font-extrabold text-red-400" onClick={() => removeField(f.key)}>
                ✕
              </button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            <TextInput
              className="max-w-40"
              placeholder="Field label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <TextInput
              className="max-w-24"
              placeholder="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
            <select
              className="rounded-xl border border-mint/60 bg-white px-2 text-xs font-extrabold"
              value={newType}
              onChange={(e) => setNewType(e.target.value as "number" | "text")}
            >
              <option value="number">number</option>
              <option value="text">text</option>
            </select>
            <Button onClick={addField} disabled={!newLabel.trim()}>
              Add
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-black">Export columns</h2>
          <p className="mb-3 text-xs font-semibold text-chip">
            Choose and order the columns in exported files so they match your own spreadsheet.
          </p>
          {allColumns.map((c) => {
            const included = effectiveLayout.includes(c.key);
            return (
              <div key={c.key} className="mb-1 flex items-center gap-2 rounded-xl bg-mint-pale/40 px-3 py-1.5">
                <input type="checkbox" checked={included} onChange={() => toggleColumn(c.key)} />
                <span className={`flex-1 text-sm font-bold ${included ? "" : "text-chip line-through"}`}>
                  {c.label}
                </span>
                {included && (
                  <>
                    <span className="text-xs font-black text-chip">#{effectiveLayout.indexOf(c.key) + 1}</span>
                    <button type="button" className="px-1 font-black text-chip" onClick={() => moveColumn(c.key, -1)}>
                      ↑
                    </button>
                    <button type="button" className="px-1 font-black text-chip" onClick={() => moveColumn(c.key, 1)}>
                      ↓
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

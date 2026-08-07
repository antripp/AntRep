/**
 * How an exercise is logged: one of the traditional methods, plus any custom
 * fields. Shared by the plan editor and the exercise library so the same
 * exercise always logs the same way — and the custom fields are the very same
 * `{key,label,type,unit}` shape the coach's Excel export uses.
 */

import { useState } from "react";
import {
  fieldKey,
  LOG_TYPES,
  LOG_TYPE_HINTS,
  LOG_TYPE_LABELS,
  type CustomField,
  type LogType,
} from "../../data/types";
import { Button, Field, Icon, IconButton, TextField } from "../../ui/kit";

export function LogTypePicker({
  value,
  onChange,
}: {
  value: LogType;
  onChange: (v: LogType) => void;
}) {
  return (
    <Field label="Logging method" hint={LOG_TYPE_HINTS[value]}>
      <div className="flex flex-wrap gap-1.5">
        {LOG_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              value === type ? "bg-accent text-white" : "border border-line bg-inset text-muted"
            }`}
          >
            {LOG_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [type, setType] = useState<CustomField["type"]>("number");

  function add() {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = fieldKey(trimmed);
    if (fields.some((f) => f.key === key)) return;
    onChange([...fields, { key, label: trimmed, type, unit: unit.trim() || undefined }]);
    setLabel("");
    setUnit("");
  }

  return (
    <Field label="Extra fields per set" hint="Logged alongside the built-in ones, and exported as columns">
      {fields.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {fields.map((field) => (
            <div key={field.key} className="flex items-center gap-2 rounded-xl bg-inset px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{field.label}</p>
                <p className="text-[11px] font-semibold text-muted">
                  {field.type === "number" ? "Number" : "Text"}
                  {field.unit ? ` · ${field.unit}` : ""} · key {field.key}
                </p>
              </div>
              <IconButton
                label={`Remove ${field.label}`}
                onClick={() => onChange(fields.filter((f) => f.key !== field.key))}
              >
                <Icon.trash className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <TextField
          value={label}
          placeholder="Field name, e.g. Band"
          className="min-w-32 flex-1"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <TextField
          value={unit}
          placeholder="Unit"
          className="w-20"
          onChange={(e) => setUnit(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setType((t) => (t === "number" ? "text" : "number"))}
          className="h-11 rounded-2xl border border-line bg-inset px-3 text-xs font-black text-muted"
        >
          {type === "number" ? "123" : "abc"}
        </button>
        <Button size="md" onClick={add} disabled={!label.trim()}>
          <Icon.plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </Field>
  );
}

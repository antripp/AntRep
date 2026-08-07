import ThemedDataTable from "../../components/ThemedDataTable";
import { supabase } from "../../lib/supabase";
import type { TrackerEntry, TrackerMetric, TrackerTemplate } from "../../lib/types";
import { entryKey } from "../../lib/trackers";
import { TextInput } from "../../components/ui";

export default function TrackerGrid({
  template,
  entries,
  readOnly = false,
  autoFill = new Map<string, string>(),
  onSaved,
}: {
  template: TrackerTemplate;
  entries: TrackerEntry[];
  readOnly?: boolean;
  autoFill?: Map<string, string>;
  onSaved?: () => void;
}) {
  const entryMap = new Map(entries.map((e) => [entryKey(e.metric_key, e.column_index), e]));

  function cellValue(metric: TrackerMetric, colIndex: number): string {
    const key = entryKey(metric.key, colIndex);
    const stored = entryMap.get(key);
    if (stored?.value) return stored.value;
    return autoFill.get(key) ?? "";
  }

  async function saveCell(metricKey: string, columnIndex: number, value: string) {
    const existing = entryMap.get(entryKey(metricKey, columnIndex));
    if (existing) {
      await supabase.from("tracker_entries").update({ value, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tracker_entries").insert({
        template_id: template.id,
        coach_link_id: template.coach_link_id,
        metric_key: metricKey,
        column_index: columnIndex,
        value,
      });
    }
    onSaved?.();
  }

  const colColumns = template.column_labels.map((label, i) => ({
    key: label,
    header: label,
    className: "text-center",
    render: (metric: TrackerMetric) => {
      const col = i + 1;
      const val = cellValue(metric, col);
      const isAuto = !entryMap.get(entryKey(metric.key, col))?.value && autoFill.has(entryKey(metric.key, col));
      if (readOnly) {
        return <span className={`font-bold ${isAuto ? "text-accent" : "text-ink"}`}>{val || "—"}</span>;
      }
      return <CellInput value={val} onCommit={(v) => saveCell(metric.key, col, v)} />;
    },
  }));

  return (
    <ThemedDataTable
      rows={template.metrics}
      rowKey={(m) => m.key}
      columns={[
        {
          key: "metric",
          header: "Measurement",
          render: (metric) => (
            <span className="font-extrabold">
              {metric.label}
              {metric.unit && <span className="ml-1 text-[10px] font-semibold text-muted">({metric.unit})</span>}
            </span>
          ),
        },
        ...colColumns,
      ]}
    />
  );
}

function CellInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  return (
    <TextInput
      className="w-16 px-1 py-0.5 text-center text-xs"
      defaultValue={value}
      key={value}
      onBlur={(e) => onCommit(e.target.value.trim())}
    />
  );
}

import { formatMetricValue, weekLabel, type ProgressionGridRow } from "../../lib/progression";
import type { ProgressionMetric } from "../../lib/types";
import ThemedDataTable from "../../components/ThemedDataTable";

export default function ProgressionGrid({
  rows,
  metric,
  readOnly = true,
  onCellEdit,
}: {
  rows: ProgressionGridRow[];
  metric: ProgressionMetric;
  readOnly?: boolean;
  onCellEdit?: (exerciseName: string, weekIndex: number, value: number | null) => void;
}) {
  if (rows.length === 0) {
    return (
      <ThemedDataTable
        rows={[]}
        rowKey={() => ""}
        emptyMessage="No progression exercises configured yet."
        columns={[{ key: "exercise", header: "Exercise", render: () => null }]}
      />
    );
  }

  const weekCount = rows[0]?.cells.length ?? 0;
  const weekColumns = Array.from({ length: weekCount }, (_, i) => ({
    key: `w${i + 1}`,
    header: weekLabel(i + 1),
    className: "text-center",
    render: (row: ProgressionGridRow) => {
      const cell = row.cells[i];
      if (readOnly || !onCellEdit) {
        return (
          <span className={`font-bold ${cell.isOverride ? "text-accent" : "text-ink"}`}>
            {formatMetricValue(cell.value, metric)}
          </span>
        );
      }
      return (
        <input
          type="number"
          className="w-14 rounded-lg border-2 border-line bg-surface px-1 py-0.5 text-center text-xs font-bold outline-none focus:border-accent"
          value={cell.value ?? ""}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value.trim();
            onCellEdit(row.exerciseName, i + 1, v === "" ? null : Number(v));
          }}
        />
      );
    },
  }));

  return (
    <ThemedDataTable
      rows={rows}
      rowKey={(r) => r.exerciseName}
      emptyMessage="No progression exercises configured yet."
      columns={[
        {
          key: "exercise",
          header: "Exercise",
          render: (row) => <span className="font-extrabold">{row.exerciseName}</span>,
        },
        ...weekColumns,
      ]}
    />
  );
}

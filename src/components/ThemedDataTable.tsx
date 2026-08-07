import type { ReactNode } from "react";
import { Card } from "./ui";

export interface ThemedColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T, rowIndex: number) => ReactNode;
  className?: string;
}

export default function ThemedDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No data yet.",
}: {
  columns: ThemedColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm font-semibold text-muted">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[20rem] border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-accent/30 bg-inset">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-extrabold text-muted ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={`border-t border-line ${i % 2 === 1 ? "bg-inset/40" : ""}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 ${col.className ?? ""}`}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

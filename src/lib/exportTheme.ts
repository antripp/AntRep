import * as XLSX from "xlsx-js-style";

/** Read current app theme colors for Excel export styling. */
export interface ExportTheme {
  headerBg: string;
  headerFg: string;
  accent: string;
  zebra: string;
}

export function getExportTheme(): ExportTheme {
  if (typeof document === "undefined") {
    return { headerBg: "588240", headerFg: "FFFFFF", accent: "58CC02", zebra: "F0F4F8" };
  }
  const root = getComputedStyle(document.documentElement);
  const accent = cssHex(root.getPropertyValue("--t-accent")) ?? "58CC02";
  const deep = cssHex(root.getPropertyValue("--t-accent-deep")) ?? accent;
  const surface = cssHex(root.getPropertyValue("--t-surface")) ?? "F0F4F8";
  return {
    headerBg: deep,
    headerFg: "FFFFFF",
    accent,
    zebra: surface,
  };
}

function cssHex(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("#")) return v.slice(1).toUpperCase();
  return null;
}

export function styleHeaderRow(ws: XLSX.WorkSheet, colCount: number, theme: ExportTheme) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;
    cell.s = {
      fill: { fgColor: { rgb: theme.headerBg } },
      font: { bold: true, color: { rgb: theme.headerFg } },
      alignment: { horizontal: "center" },
    };
  }
}

export function aoaToStyledSheet(rows: (string | number)[][], theme?: ExportTheme): XLSX.WorkSheet {
  const t = theme ?? getExportTheme();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (rows.length > 0) {
    styleHeaderRow(ws, rows[0].length, t);
    for (let r = 1; r < rows.length; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < rows[r].length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr] as XLSX.CellObject | undefined;
          if (cell) {
            cell.s = { fill: { fgColor: { rgb: t.zebra } } };
          }
        }
      }
    }
  }
  return ws;
}

export { XLSX };

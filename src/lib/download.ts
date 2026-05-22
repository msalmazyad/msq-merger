import * as XLSX from "xlsx";
import type { Cell } from "@/types";

/** Trigger a browser download for a Blob. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a row-of-objects table into a 2D array using the given column order. */
function toMatrix(
  columns: string[],
  rows: Record<string, Cell>[],
): (string | number)[][] {
  const out: (string | number)[][] = [columns];
  for (const r of rows) {
    out.push(columns.map((c) => {
      const v = r[c];
      if (v == null) return "";
      return v as string | number;
    }));
  }
  return out;
}

/** Download as Excel .xlsx — the most portable format. */
export function downloadXLSX(
  columns: string[],
  rows: Record<string, Cell>[],
  filename: string,
) {
  const matrix = toMatrix(columns, rows);
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grade Center");
  const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  saveBlob(new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), filename);
}

/** Download as CSV with UTF-8 BOM (so Excel opens Arabic correctly). */
export function downloadCSV(
  columns: string[],
  rows: Record<string, Cell>[],
  filename: string,
) {
  const matrix = toMatrix(columns, rows);
  const lines = matrix.map((row) => row.map(csvEscape).join(","));
  const text = lines.join("\n");
  // Prefix with UTF-8 BOM
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const body = new TextEncoder().encode(text);
  const blob = new Blob([bom, body], { type: "text/csv;charset=utf-8" });
  saveBlob(blob, filename);
}

/**
 * Download in Blackboard's import format: tab-separated, UTF-16 LE, with
 * a BOM. This matches what Blackboard exports, so re-uploading "just
 * works" for the gradebook import flow.
 */
export function downloadBlackboard(
  columns: string[],
  rows: Record<string, Cell>[],
  filename: string,
) {
  const matrix = toMatrix(columns, rows);
  // Blackboard's export quotes every field, even simple ones, so we do too
  // to maximise compatibility.
  const lines = matrix.map((row) => row.map(tsvEscape).join("\t"));
  const text = lines.join("\n");

  // Encode as UTF-16 LE. JavaScript strings are UTF-16 already, so we
  // just write each code unit as a little-endian pair of bytes.
  const codeUnits = text.length;
  const out = new Uint8Array(2 + codeUnits * 2);
  out[0] = 0xFF;  // BOM low byte
  out[1] = 0xFE;  // BOM high byte
  for (let i = 0; i < codeUnits; i++) {
    const cu = text.charCodeAt(i);
    out[2 + i * 2]     = cu & 0xFF;
    out[2 + i * 2 + 1] = (cu >> 8) & 0xFF;
  }
  saveBlob(new Blob([out], {
    type: "application/vnd.ms-excel;charset=utf-16",
  }), filename);
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function tsvEscape(v: string | number): string {
  const s = String(v ?? "");
  // Blackboard's exports wrap every field in double quotes and escape
  // internal quotes by doubling them.
  return `"${s.replace(/"/g, '""')}"`;
}

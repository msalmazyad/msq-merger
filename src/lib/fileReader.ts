import * as XLSX from "xlsx";
import type { RawTable, Row } from "@/types";

/**
 * Universal file reader. Looks at the first 8 bytes of the file to decide
 * how to parse it — extensions are unreliable (Blackboard exports `.xls`
 * files that are actually UTF-16 tab-separated text).
 *
 * Returns a 2D array of cells, with header rows intact (no header
 * detection here — that's done downstream).
 */
export async function readFileSmart(file: File): Promise<RawTable> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Binary XLS (BIFF signature)
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    return readWithSheetJS(buf);
  }
  // XLSX (ZIP signature)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return readWithSheetJS(buf);
  }
  // UTF-16 LE BOM (Blackboard exports)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    const text = new TextDecoder("utf-16le").decode(bytes.slice(2));
    return parseDelimited(text);
  }
  // UTF-16 BE BOM
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    const text = new TextDecoder("utf-16be").decode(bytes.slice(2));
    return parseDelimited(text);
  }
  // UTF-8 BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    const text = new TextDecoder("utf-8").decode(bytes.slice(3));
    return parseDelimited(text);
  }

  // Try UTF-8 first, then CP1256 / Latin-1 if it looks garbled.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const parsed = parseDelimited(text);
  if (parsed.length > 0 && parsed[0].length > 1) return parsed;

  // Last resort: hand it to SheetJS — it knows lots of formats.
  try {
    return readWithSheetJS(buf);
  } catch {
    throw new Error(`Could not parse file: ${file.name}`);
  }
}

function readWithSheetJS(buf: ArrayBuffer): RawTable {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  if (wb.SheetNames.length === 0) throw new Error("Workbook has no sheets");
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header: 1 returns a 2D array of cells, preserving all rows.
  // defval: null gives us null for empty cells so we can detect them.
  const data = XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true,
  });
  return data;
}

/**
 * Parse delimited text: tries tab, comma, semicolon in that order and
 * picks whichever produces more than one column.
 */
function parseDelimited(text: string): RawTable {
  const candidates = ["\t", ",", ";"];
  for (const sep of candidates) {
    const rows = splitCSV(text, sep);
    if (rows.length > 0 && rows[0].length > 1) return rows;
  }
  // Fallback: single-column data
  return text.split(/\r?\n/).filter((l) => l.length > 0).map((l) => [l]);
}

/**
 * Minimal RFC-4180-ish CSV/TSV parser: handles quoted fields, escaped
 * quotes, and embedded newlines inside quotes. Enough for the files
 * Blackboard and Remark produce.
 */
function splitCSV(text: string, sep: string): RawTable {
  const rows: RawTable = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === sep) {
        current.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        // Handle \r\n by skipping the \n that follows \r
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field); field = "";
        rows.push(current);
        current = [];
      } else {
        field += c;
      }
    }
  }
  // Last field
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  // Drop fully-empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "" || c == null)) {
    rows.pop();
  }
  return rows;
}

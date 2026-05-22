import { readFileSmart } from "./fileReader";
import {
  ID_KEYWORDS, SCORE_KEYWORDS, GC_ID_KEYWORDS,
  GC_GRADE_COL_PATTERN, SUMMARY_WORDS,
  findHeaderRow, pickColumn,
} from "./keywords";
import { AppError } from "./errors";
import type { Cell, MSQFileInfo, ParsedGC, ScoreRecord } from "@/types";

/** Parse one MSQ file. Returns its score records + a metadata summary. */
export async function parseMSQFile(file: File):
  Promise<{ scores: ScoreRecord[]; info: MSQFileInfo }> {
  let raw;
  try {
    raw = await readFileSmart(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError("UNREADABLE_FILE",
      `Could not read ${file.name}: ${msg}`,
      { file: file.name });
  }
  if (raw.length === 0) {
    throw new AppError("EMPTY_FILE", `${file.name} contains no data`,
                       { file: file.name });
  }

  const headerIdx = findHeaderRow(raw);
  const headerRow = raw[headerIdx] || [];
  const dataRows = raw.slice(headerIdx + 1);

  const columns = headerRow.map((h, i) =>
    h == null || String(h).trim() === "" ? `col_${i}` : String(h).trim(),
  );

  const idCol = pickColumn(columns, ID_KEYWORDS);
  const scoreCol = pickColumn(
    columns, SCORE_KEYWORDS, idCol ? [idCol] : [],
  );

  if (!idCol || !scoreCol) {
    throw new AppError("MISSING_MSQ_COLUMNS",
      `Couldn't find ID/Score columns in ${file.name}. ` +
      `Detected columns: ${columns.slice(0, 10).join(", ")}`,
      { file: file.name, columns: columns.slice(0, 10).join(", ") });
  }

  const idIdx = columns.indexOf(idCol);
  const scoreIdx = columns.indexOf(scoreCol);

  const scores: ScoreRecord[] = [];
  for (const row of dataRows) {
    const idCell = row[idIdx];
    const scoreCell = row[scoreIdx];
    if (idCell == null || String(idCell).trim() === "") continue;

    let sid = String(idCell).trim();
    // Strip trailing ".0" from float-coerced IDs.
    sid = sid.replace(/\.0+$/, "");

    // Drop summary rows ("Mean", "Average", "متوسط").
    if (SUMMARY_WORDS.has(sid.toLowerCase())) continue;
    // Only keep numeric-looking IDs (defensive).
    if (!/^\d+$/.test(sid)) continue;

    const score = toNumber(scoreCell);
    if (score == null || Number.isNaN(score)) continue;

    scores.push({ studentId: sid, score });
  }

  if (scores.length === 0) {
    throw new AppError("NO_DATA_ROWS",
      `${file.name} has the right columns but no valid student rows. ` +
      `Check that student IDs are numeric and the score column has numbers.`,
      { file: file.name });
  }

  return {
    scores,
    info: {
      filename: file.name,
      headerRow: headerIdx,
      idColumn: idCol,
      scoreColumn: scoreCol,
      rowCount: scores.length,
      meanScore: scores.length > 0
        ? scores.reduce((a, s) => a + s.score, 0) / scores.length
        : 0,
      minScore: scores.length > 0
        ? Math.min(...scores.map((s) => s.score))
        : 0,
      maxScore: scores.length > 0
        ? Math.max(...scores.map((s) => s.score))
        : 0,
    },
  };
}

/** Parse the Blackboard Grade Center file. */
export async function parseGCFile(file: File): Promise<ParsedGC> {
  let raw;
  try {
    raw = await readFileSmart(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError("UNREADABLE_FILE",
      `Could not read ${file.name}: ${msg}`,
      { file: file.name });
  }
  if (raw.length < 2) {
    throw new AppError("EMPTY_FILE",
      `${file.name} looks empty — at least a header and one row are expected.`,
      { file: file.name });
  }

  // GC files have a single header row at row 0.
  const headerRow = raw[0];
  const columns = headerRow.map((h, i) =>
    h == null || String(h).trim() === "" ? `col_${i}` : String(h).trim(),
  );

  // Restrict ID search to NON-grade columns (grade columns end in |NUMBER).
  const nonGradeCols = columns.filter((c) => !GC_GRADE_COL_PATTERN.test(c));
  const idCol = pickColumn(nonGradeCols, GC_ID_KEYWORDS);
  if (!idCol) {
    throw new AppError("MISSING_GC_ID",
      `Couldn't find a Student-ID column in ${file.name}. ` +
      `Detected columns: ${columns.slice(0, 10).join(", ")}`,
      { file: file.name, columns: columns.slice(0, 10).join(", ") });
  }

  const gradeColumns = columns.filter((c) => GC_GRADE_COL_PATTERN.test(c));

  // Detect name columns. Blackboard's Grade Center exports use "First Name"
  // and "Last Name" in English, or "الاسم الأول" / "اسم العائلة" in Arabic.
  // Matching is whole-word so "Username" (the student-ID column) doesn't
  // get caught by the "name" keyword.
  const NAME_KEYWORDS = [
    "first name", "last name", "full name", "student name", "name",
    "الاسم الأول", "اسم العائلة", "الاسم الكامل", "اسم الطالب", "الاسم",
  ];
  const EXCLUDE_NAME_PATTERNS = [
    "username", "user name", "اسم المستخدم",
  ];
  const nameColumns: string[] = [];
  for (const c of columns) {
    if (GC_GRADE_COL_PATTERN.test(c)) continue;
    if (c === idCol) continue;
    const lc = c.toLowerCase().trim();
    // Skip explicit anti-matches first (Username looks like a name to a
    // naive substring matcher).
    if (EXCLUDE_NAME_PATTERNS.some((p) => lc.includes(p))) continue;
    // Whole-word/phrase match: split on whitespace and check tokens, or
    // accept any multi-word keyword that appears as a substring.
    const tokens = lc.split(/\s+/);
    const matched = NAME_KEYWORDS.some((kw) => {
      const k = kw.toLowerCase().trim();
      if (k.includes(" ")) return lc.includes(k);   // multi-word phrase
      return tokens.includes(k);                    // single-word token
    });
    if (matched) nameColumns.push(c);
  }

  // Build row objects with normalised ID.
  const rows: Record<string, Cell>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const obj: Record<string, Cell> = {};
    let nonEmpty = false;
    for (let j = 0; j < columns.length; j++) {
      const v = raw[i][j] ?? null;
      obj[columns[j]] = v;
      if (v != null && String(v).trim() !== "") nonEmpty = true;
    }
    if (!nonEmpty) continue;
    // Normalise the ID column: strip whitespace + trailing ".0"
    const sid = obj[idCol];
    if (sid != null) {
      obj[idCol] = String(sid).trim().replace(/\.0+$/, "");
    }
    rows.push(obj);
  }

  return {
    filename: file.name,
    idColumn: idCol,
    nameColumns,
    allColumns: columns,
    gradeColumns,
    rows,
  };
}

function toNumber(v: Cell): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

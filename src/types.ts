// Domain types shared across modules.

export type Cell = string | number | null | undefined;
export type Row = Cell[];
export type RawTable = Row[];

/** One parsed MSQ file. */
export interface MSQFileInfo {
  filename: string;
  headerRow: number;       // 0-indexed
  idColumn: string;
  scoreColumn: string;
  rowCount: number;
  meanScore: number;
  minScore: number;
  maxScore: number;
}

/** One parsed score record. */
export interface ScoreRecord {
  studentId: string;
  score: number;
}

/** A student in the GC who didn't take the exam. */
export interface NoShowStudent {
  studentId: string;
  name: string;       // best-effort: "First Last" or whatever name cols we found
}

/** Parsed Grade Center metadata. */
export interface GCInfo {
  filename: string;
  idColumn: string;
  /** Column we'll use for the student's name in display, or null if none found. */
  nameColumns: string[];
  allColumns: string[];
  /** Columns whose header ends with `|NUMBER` (real grade columns in Bb). */
  gradeColumns: string[];
}

/** Full parsed Grade Center: columns + every row as a string-keyed object. */
export interface ParsedGC extends GCInfo {
  rows: Record<string, Cell>[];
}

/** Result of the merge step. */
export interface MergeResult {
  columns: string[];
  rows: Record<string, Cell>[];
  targetColumn: string;
  stats: {
    matched: number;
    unmatchedInGC: number;
    orphans: number;
    orphanIds: string[];
    /** Total = matched + unmatchedInGC (every student row in the GC). */
    total: number;
    /** Aggregate stats over the MATCHED scores only. */
    meanScore: number;
    minScore: number;
    maxScore: number;
    /** Students in the GC who didn't take the exam (no MSQ score). */
    noShowStudents: NoShowStudent[];
  };
}

export type Language = "en" | "ar";

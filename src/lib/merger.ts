import { AppError } from "./errors";
import type { Cell, MergeResult, NoShowStudent, ParsedGC, ScoreRecord } from "@/types";

/**
 * Combine score records from multiple MSQ files into a single map.
 * If the same student appears in more than one file, keep the highest score.
 */
export function combineScores(scoreLists: ScoreRecord[][]): ScoreRecord[] {
  const map = new Map<string, number>();
  for (const list of scoreLists) {
    for (const { studentId, score } of list) {
      const prev = map.get(studentId);
      if (prev === undefined || score > prev) {
        map.set(studentId, score);
      }
    }
  }
  return Array.from(map, ([studentId, score]) => ({ studentId, score }));
}

/**
 * Build a display name from a GC row using its detected name columns.
 * Falls back to "(no name)" if nothing's available.
 */
function buildName(row: Record<string, Cell>, nameColumns: string[]): string {
  const parts = nameColumns
    .map((c) => row[c])
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v).trim());
  return parts.length > 0 ? parts.join(" ") : "(no name)";
}

/**
 * Merge MSQ scores into the GC. Returns a fresh result; doesn't mutate
 * the input. Reports matched / unmatched / orphan counts and aggregate
 * score statistics over the matched students.
 */
export function mergeScores(
  gc: ParsedGC,
  targetColumn: string,
  scores: ScoreRecord[],
  fillMissingWithZero: boolean,
): MergeResult {
  if (!targetColumn || !targetColumn.trim()) {
    throw new AppError("NO_TARGET_COLUMN",
      "Please pick or name a target column before merging.");
  }
  if (scores.length === 0) {
    throw new AppError("NO_SCORES",
      "No scores to merge — upload at least one MSQ file with student rows.");
  }

  const scoreMap = new Map(scores.map((s) => [s.studentId, s.score]));

  // If target column is new, append it to the column list.
  const columns = gc.allColumns.includes(targetColumn)
    ? [...gc.allColumns]
    : [...gc.allColumns, targetColumn];

  const matchedIds: string[] = [];
  const matchedScores: number[] = [];
  const noShowStudents: NoShowStudent[] = [];

  const rows: Record<string, Cell>[] = gc.rows.map((r) => {
    const next: Record<string, Cell> = { ...r };
    const sid = String(next[gc.idColumn] ?? "").trim();
    if (sid && scoreMap.has(sid)) {
      const score = scoreMap.get(sid)!;
      next[targetColumn] = score;
      matchedIds.push(sid);
      matchedScores.push(score);
    } else {
      if (fillMissingWithZero) next[targetColumn] = 0;
      else if (!(targetColumn in next)) next[targetColumn] = null;
      // Only count as a no-show if the row actually has a student ID —
      // empty/placeholder rows aren't really students.
      if (sid) {
        noShowStudents.push({
          studentId: sid,
          name: buildName(r, gc.nameColumns),
        });
      }
    }
    return next;
  });

  // Orphans = MSQ students who don't appear in the GC at all.
  const gcIds = new Set(
    gc.rows.map((r) => String(r[gc.idColumn] ?? "").trim()).filter(Boolean),
  );
  const orphanIds = scores
    .map((s) => s.studentId)
    .filter((sid) => !gcIds.has(sid));

  const n = matchedScores.length;
  const sum = matchedScores.reduce((a, b) => a + b, 0);

  return {
    columns,
    rows,
    targetColumn,
    stats: {
      matched: matchedIds.length,
      unmatchedInGC: noShowStudents.length,
      orphans: orphanIds.length,
      orphanIds: orphanIds.slice(0, 50),
      total: matchedIds.length + noShowStudents.length,
      meanScore: n > 0 ? sum / n : 0,
      minScore:  n > 0 ? Math.min(...matchedScores) : 0,
      maxScore:  n > 0 ? Math.max(...matchedScores) : 0,
      noShowStudents,
    },
  };
}

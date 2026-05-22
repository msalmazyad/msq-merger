// Bilingual keyword lists for smart column detection.
// IMPORTANT: keywords are listed in PRIORITY ORDER (most specific first).
// The picker walks them in order, so "total" wins over "grade" and
// "student id" wins over "username" — exactly like the Python version.

export const ID_KEYWORDS: string[] = [
  // English
  "academic no", "academic number",
  "student id", "student no", "student number",
  "id number",
  "id",
  // Arabic
  "معرف الطالب", "الرقم الأكاديمي", "رقم الطالب", "الرقم الجامعي",
  "اسم المستخدم",
];

export const SCORE_KEYWORDS: string[] = [
  // English — "total" is the numeric score in Remark exports.
  // "grade" is often a letter grade (A/B/C), so put it last.
  "total", "score", "mark", "result",
  "grade",
  // Arabic
  "النتيجة", "الدرجة", "المجموع", "الكلي", "العلامة",
];

export const GC_ID_KEYWORDS: string[] = [
  "student id", "academic no",
  "id number",
  "username",
  "id",
  "معرف الطالب", "الرقم الأكاديمي", "رقم الطالب", "اسم المستخدم",
];

// A Blackboard "grade column" header always ends with `|NUMBER`
// (the gradebook item id). We use this to distinguish real grade columns
// from metadata columns like "Last Name", "Availability".
export const GC_GRADE_COL_PATTERN = /\|\s*\d+\s*$/;

// Summary-row markers that appear in MSQ files (last row).
export const SUMMARY_WORDS = new Set([
  "mean", "average", "متوسط", "المعدل",
]);

/**
 * Case-insensitive substring match: cell equals or contains any keyword,
 * or any keyword contains the cell (helps "ID" match "id" cells).
 */
export function matchesAny(cell: string, keywords: string[]): boolean {
  if (!cell) return false;
  const c = String(cell).trim().toLowerCase();
  if (!c) return false;
  for (const kw of keywords) {
    const kwL = kw.trim().toLowerCase();
    if (!kwL) continue;
    if (c === kwL || kwL.includes(c) || c.includes(kwL)) return true;
  }
  return false;
}

/**
 * Pick the best matching column for an ordered list of keywords.
 * Walks the keywords in PRIORITY order. For each keyword, scans all columns
 * and returns the first column that contains that keyword. This is why
 * "total" wins over "grade" even if grade appears first in the column list.
 *
 * `exclude` lets the caller skip columns that already matched something
 * else (e.g. don't pick the same column for both ID and Score).
 */
export function pickColumn(
  columns: string[],
  keywords: string[],
  exclude: string[] = [],
): string | null {
  const excludeSet = new Set(exclude.map((e) => String(e).trim().toLowerCase()));
  const candidates = columns
    .map((c) => ({ orig: c, norm: String(c).trim().toLowerCase() }))
    .filter((x) => !excludeSet.has(x.norm));

  for (const kw of keywords) {
    const kwL = kw.trim().toLowerCase();
    if (!kwL) continue;
    // Pass 1: exact match
    for (const { orig, norm } of candidates) {
      if (norm === kwL) return orig;
    }
    // Pass 2: substring match (keyword inside column name)
    for (const { orig, norm } of candidates) {
      if (norm.includes(kwL)) return orig;
    }
  }
  return null;
}

/**
 * Scan the first ~25 rows of a raw table looking for the header row.
 * The header is the row that contains BOTH an ID-like cell and a
 * Score-like cell. Falls back to the row with the most keyword hits.
 */
export function findHeaderRow(rows: (string | number | null | undefined)[][],
                              maxScan = 25): number {
  let bestIdx = 0;
  let bestScore = -1;
  const scanLimit = Math.min(maxScan, rows.length);

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i] || [];
    const cells = row.map((v) => (v == null ? "" : String(v)));

    const hasId = cells.some((c) => matchesAny(c, ID_KEYWORDS));
    const hasScore = cells.some((c) => matchesAny(c, SCORE_KEYWORDS));

    if (hasId && hasScore) return i;  // strong signal — done

    const matchCount = cells.reduce(
      (n, c) =>
        n + (matchesAny(c, ID_KEYWORDS) || matchesAny(c, SCORE_KEYWORDS) ? 1 : 0),
      0,
    );
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestIdx = i;
    }
  }
  return bestIdx;
}

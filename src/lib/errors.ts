// Domain-level errors. Throwing AppError instead of plain Error lets the
// UI show a specific, actionable, translated message based on the `code`
// — rather than dumping raw exception text at the user.

export type AppErrorCode =
  // File-level errors (Step 1 / 2)
  | "UNSUPPORTED_FORMAT"   // .pdf, .zip, etc — we don't read those
  | "FILE_TOO_LARGE"       // > MAX_FILE_BYTES
  | "EMPTY_FILE"           // 0 bytes or only whitespace
  | "UNREADABLE_FILE"      // we tried every parser, none worked
  | "NO_DATA_ROWS"         // parsed fine but contained no student rows

  // Schema errors
  | "MISSING_MSQ_COLUMNS"  // couldn't find ID + Score in an MSQ file
  | "MISSING_GC_ID"        // couldn't find Student ID in the GC

  // Merge-time errors
  | "NO_SCORES"            // tried to merge with zero scores
  | "NO_TARGET_COLUMN"     // empty target column name
  | "NO_MATCHES";          // 0 students from the MSQ file appeared in the GC

export class AppError extends Error {
  code: AppErrorCode;
  /** Optional structured details for message templates. */
  details: Record<string, string | number>;

  constructor(code: AppErrorCode, message: string, details: Record<string, string | number> = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

/** Type guard — useful in catch blocks. */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// Limits — generous enough for any real gradebook, but block accidental
// drops of a 500MB video file or similar.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;        // 20 MB

// Extensions we'll attempt to parse. Anything else is rejected up-front
// with a clear message instead of "Could not parse file".
export const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".tsv"];

/** Validate a File before attempting to parse it. Throws AppError on failure. */
export function validateFile(file: File): void {
  if (file.size === 0) {
    throw new AppError("EMPTY_FILE", `${file.name} is empty (0 bytes)`,
                       { file: file.name });
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new AppError("FILE_TOO_LARGE",
      `${file.name} is too large (${mb} MB, limit 20 MB)`,
      { file: file.name, sizeMB: mb });
  }
  const lower = file.name.toLowerCase();
  const ok = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) {
    throw new AppError("UNSUPPORTED_FORMAT",
      `${file.name} is not a supported format. Use .xlsx, .xls, or .csv.`,
      { file: file.name });
  }
}

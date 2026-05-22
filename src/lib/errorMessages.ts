import { AppError, isAppError } from "./errors";
import type { StringKey } from "./i18n";

type Translator = (key: StringKey, vars?: Record<string, string | number>) => string;

/** Map an error code to its i18n key. */
const CODE_TO_KEY: Record<string, StringKey> = {
  UNSUPPORTED_FORMAT:  "errUnsupportedFormat",
  FILE_TOO_LARGE:      "errFileTooLarge",
  EMPTY_FILE:          "errEmptyFile",
  UNREADABLE_FILE:     "errUnreadableFile",
  NO_DATA_ROWS:        "errNoDataRows",
  MISSING_MSQ_COLUMNS: "errMissingMSQColumns",
  MISSING_GC_ID:       "errMissingGCID",
  NO_SCORES:           "errNoScores",
  NO_TARGET_COLUMN:    "errNoTargetColumn",
  NO_MATCHES:          "errNoMatches",
};

/**
 * Convert any thrown value into a friendly, translated message.
 * - AppError → look up its code in i18n + interpolate details.
 * - Anything else → fall back to errUnknown with the raw message.
 *
 * `t` is the translator function from useI18n().
 */
export function describeError(e: unknown, t: Translator): string {
  if (isAppError(e)) {
    const key = CODE_TO_KEY[e.code];
    if (key) {
      // Convert all detail values to strings so they're safe for interpolation
      const vars: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(e.details)) vars[k] = v;
      return t(key, vars);
    }
    // Known AppError code but no i18n entry — show the message as-is
    return e.message;
  }
  if (e instanceof Error) {
    return t("errUnknown", { err: e.message });
  }
  return t("errUnknown", { err: String(e) });
}

/** Re-export so callers can `import { AppError, describeError }` from one place. */
export { AppError, isAppError };

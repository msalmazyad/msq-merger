// Tiny client for the public stats Worker. All calls are best-effort:
// network errors are swallowed so usage tracking never breaks the app.
//
// The endpoint URL comes from VITE_STATS_URL at build time. If it isn't
// set, every function here becomes a no-op, so the app works fine
// without the Worker.

export interface GlobalStats {
  files: number;
  students: number;
  merges: number;
  updatedAt: string | null;
}

const BASE = (import.meta.env.VITE_STATS_URL ?? "").replace(/\/$/, "");

/** Fetch the current global counters. Returns null if disabled or offline. */
export async function fetchStats(): Promise<GlobalStats | null> {
  if (!BASE) return null;
  try {
    const r = await fetch(`${BASE}/stats`, { method: "GET" });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      files:     Number(data.files ?? 0),
      students:  Number(data.students ?? 0),
      merges:    Number(data.merges ?? 0),
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Report a successful merge. Fire-and-forget — we don't await this in
 * the main flow, and we never surface errors to the user.
 */
export async function reportMerge(files: number, students: number): Promise<GlobalStats | null> {
  if (!BASE) return null;
  try {
    const r = await fetch(`${BASE}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files, students }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** True if the frontend was built with a stats URL configured. */
export const STATS_ENABLED = BASE.length > 0;

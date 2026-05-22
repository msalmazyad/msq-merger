/**
 * MSQ Merger — public stats counter.
 *
 * Two endpoints:
 *   GET  /stats      → { files, students, merges, updatedAt }
 *   POST /merge      → body: { files: number, students: number }
 *                      increments the global counters; returns the new totals.
 *
 * No personal data is collected. Only three integers and a timestamp live
 * in KV. The request body is validated to be small integers — anything
 * malicious or oversized is rejected.
 *
 * CORS is open to all origins because this Worker is a public counter; the
 * URL is embedded in a static site that may be accessed from anywhere.
 */

const KEY = "global";                 // single KV key holds the JSON blob
const MAX_FILES_PER_CALL    = 50;     // sanity caps so bots can't inflate counts
const MAX_STUDENTS_PER_CALL = 5000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age":       "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function readStats(env) {
  const raw = await env.STATS.get(KEY);
  if (!raw) return { files: 0, students: 0, merges: 0, updatedAt: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      files:     Number(parsed.files     || 0),
      students:  Number(parsed.students  || 0),
      merges:    Number(parsed.merges    || 0),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { files: 0, students: 0, merges: 0, updatedAt: null };
  }
}

async function writeStats(env, stats) {
  await env.STATS.put(KEY, JSON.stringify(stats));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      const stats = await readStats(env);
      return json(stats);
    }

    if (request.method === "POST" && url.pathname === "/merge") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      const files    = Number(body?.files);
      const students = Number(body?.students);

      if (!Number.isFinite(files) || !Number.isFinite(students)
          || !Number.isInteger(files) || !Number.isInteger(students)
          || files < 0 || students < 0
          || files > MAX_FILES_PER_CALL || students > MAX_STUDENTS_PER_CALL) {
        return json({ error: "Invalid counts" }, 400);
      }

      const stats = await readStats(env);
      stats.files    += files;
      stats.students += students;
      stats.merges   += 1;
      stats.updatedAt = new Date().toISOString();
      await writeStats(env, stats);
      return json(stats);
    }

    if (url.pathname === "/" || url.pathname === "") {
      return json({
        name: "MSQ Merger Stats",
        endpoints: ["GET /stats", "POST /merge"],
      });
    }

    return json({ error: "Not found" }, 404);
  },
};

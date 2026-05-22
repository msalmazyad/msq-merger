# MSQ Merger Stats Worker

A tiny Cloudflare Worker that keeps three global counters:

- `files`     — total MSQ files ever processed
- `students`  — total students merged into Grade Centers
- `merges`    — total successful merges (one per "Step 4" in the UI)

Plus an `updatedAt` ISO timestamp.

**Privacy guarantee**: The Worker receives two integers per merge.
No student IDs, no names, no file contents, no nothing else. The full
payload schema is at the top of `src/index.js`.

## Deploy (one-time, ~5 minutes)

### 1. Install Wrangler (the Cloudflare CLI)

```bash
npm install -g wrangler
```

### 2. Log in to your Cloudflare account

```bash
wrangler login
```

This opens your browser. Approve the access.

### 3. Create the KV namespace (where the counters live)

```bash
cd worker
wrangler kv namespace create STATS
```

You'll see output like:

```
🌀  Creating namespace with title "msq-merger-stats-STATS"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "STATS"
id = "abc123def4567890abc123def4567890"
```

Copy that `id` value.

### 4. Paste the id into `wrangler.toml`

Open `worker/wrangler.toml` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`
with the id you just copied.

### 5. Deploy

```bash
npm install     # only the first time
npm run deploy
```

You'll see:

```
Published msq-merger-stats
  https://msq-merger-stats.<your-subdomain>.workers.dev
```

That URL is your stats backend. Copy it.

### 6. Tell the frontend where to find it

Back in the project root (one level up from `worker/`), create a `.env`
file (or edit it if it exists) and add:

```
VITE_STATS_URL=https://msq-merger-stats.<your-subdomain>.workers.dev
```

Rebuild the frontend (`npm run build`) and the deployed site will start
showing live totals. If `VITE_STATS_URL` is not set, the frontend
silently skips all stats calls — the app still works normally without
the Worker.

## Test it manually

```bash
# Read the current stats
curl https://msq-merger-stats.<your-subdomain>.workers.dev/stats

# Increment by hand
curl -X POST https://msq-merger-stats.<your-subdomain>.workers.dev/merge \
  -H "Content-Type: application/json" \
  -d '{"files": 2, "students": 31}'
```

## Local development

```bash
npm run dev
# starts a local Worker at http://localhost:8787
```

## View logs in real time

```bash
npm run tail
```

Useful if you want to see who's hitting the API. Cloudflare only logs
the request line + status — no body content.

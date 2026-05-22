# MSQ Grade Merger

A static web app that merges MSQ exam results (Template A / Template B files
from the testing office) into a Blackboard Grade Center file.

**Runs 100% in the browser** — no backend, no servers, no data ever leaves
the instructor's computer. Built with React + TypeScript + Vite + Tailwind
+ shadcn/ui + SheetJS, deployed as static files on GitHub Pages.

## What it does

- **Smart header detection** — finds the header row in MSQ files
  automatically by scanning for a row that contains both an ID-like and a
  Score-like column. No more hard-coded `skiprows=7`.
- **Universal file reader** — handles `.xlsx`, real binary `.xls`, the
  pseudo-`.xls` files Blackboard exports (which are actually UTF-16
  tab-separated), and `.csv`. File type is sniffed from the first 8 bytes,
  not the extension.
- **Bilingual** — recognises column names in both English (`Academic No`,
  `Student ID`, `Total`) and Arabic (`معرف الطالب`, `الرقم الأكاديمي`,
  `النتيجة`, `الدرجة`). The whole UI also flips to Arabic / RTL when the
  instructor picks Arabic.
- **Missing-column workflow** — if the instructor hasn't added an MSQ
  column to Blackboard, the app creates one with a Blackboard-compatible
  header like `Midterm MSQ [Total Pts: 10 Score]`.
- **Preview before download** — shows the full merged table with the
  target column highlighted, plus match statistics (matched, unmatched,
  orphans).
- **Three download formats** — Blackboard `.xls` (UTF-16 TSV, the one to
  re-upload), `.xlsx`, and `.csv`.

## Optional: enable the "Used worldwide" stats panel

The app can show a small footer panel with three global counters: total
files processed, total students merged, and total successful merges. This
requires a tiny backend (Cloudflare Worker + KV) that just stores three
integers. **No student data ever leaves the browser** — only the two
counts (`files`, `students`) are sent.

Without the Worker, the app works exactly the same; the stats panel just
doesn't appear.

### Deploy the Worker (~5 minutes, all free)

```bash
npm install -g wrangler         # Cloudflare CLI
wrangler login                  # opens browser to authenticate

cd worker
wrangler kv namespace create STATS
# Copy the printed `id` into wrangler.toml, replacing
# REPLACE_WITH_YOUR_KV_NAMESPACE_ID.

npm install
npm run deploy
# Note the published URL, e.g.
# https://msq-merger-stats.your-name.workers.dev
```

Full deploy guide: see `worker/README.md`.

### Tell the frontend to use it

Two ways:

**Local development**: copy `.env.example` to `.env` and paste the
Worker URL into `VITE_STATS_URL`.

**GitHub Pages deploys**: in the repo, go to
**Settings → Secrets and variables → Actions → Variables tab → New
repository variable**, name it `VITE_STATS_URL`, value is the Worker
URL. Push again — the next build will include it.

## Run locally

```bash
npm install
npm run dev
# opens http://localhost:5173
```

## Build

```bash
npm run build       # outputs dist/
npm run preview     # serve the production build locally
```

## Deploy to GitHub Pages

The repo includes a GitHub Actions workflow at
`.github/workflows/deploy.yml` that builds and deploys automatically.

### One-time setup

1. **Create a GitHub repo** (e.g. `msq-merger`) and push this code to the
   `main` branch.
2. In the repo settings: **Settings → Pages → Source → "GitHub Actions"**.
3. Push to `main`. The action will build with `VITE_BASE=/msq-merger/` and
   publish to `https://<your-username>.github.io/msq-merger/`.

The base path is set from the repo name automatically — no manual config
needed.

### Deploy somewhere else

The build output is just static files, so any static host works:

- **Vercel / Netlify**: drag-and-drop the `dist/` folder, or connect the
  repo and set the build command to `npm run build`.
- **Cloudflare Pages**: same as Netlify.
- **Your own server**: copy `dist/` to anywhere nginx/Apache can serve.

For non-GitHub-Pages hosts you usually want `VITE_BASE=/`. The default
already handles that.

## Project layout

```
msq-merger/
├── .github/workflows/deploy.yml   ← GitHub Pages deployment
├── .env.example                   ← copy to .env to enable global stats
├── index.html
├── src/
│   ├── main.tsx                   ← React entry
│   ├── App.tsx                    ← 4-step workflow
│   ├── index.css                  ← Tailwind + shadcn tokens
│   ├── types.ts
│   ├── vite-env.d.ts              ← Vite env type declarations
│   ├── lib/
│   │   ├── utils.ts               ← shadcn cn() helper
│   │   ├── keywords.ts            ← bilingual column matching + header detection
│   │   ├── fileReader.ts          ← byte-sniffing universal reader
│   │   ├── parsers.ts             ← MSQ + Grade Center parsers
│   │   ├── merger.ts              ← merge + statistics
│   │   ├── download.ts            ← xlsx / csv / Blackboard UTF-16 TSV
│   │   ├── stats.ts               ← optional Worker client
│   │   └── i18n.tsx               ← English / Arabic translations + RTL
│   └── components/
│       ├── ui/                    ← shadcn components (button, card, …)
│       ├── StepIndicator.tsx
│       ├── FileDropzone.tsx
│       └── LanguageToggle.tsx
├── worker/                        ← Cloudflare Worker for global stats
│   ├── src/index.js               ← Worker source (~80 lines)
│   ├── wrangler.toml              ← Cloudflare config
│   ├── package.json
│   └── README.md                  ← Worker deploy guide
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## How the smart detection works

**`findHeaderRow`** — scans the first 25 rows looking for one that
contains both an ID-keyword cell and a Score-keyword cell. If it finds
such a row, that's the header. Otherwise it picks the row with the most
keyword hits.

**`pickColumn`** — walks a *priority-ordered* keyword list, and for each
keyword scans every column for a match. This is why "Total" beats "Grade"
— both are score keywords, but "total" is listed first. Same trick prefers
"Student ID" over "Username".

**`readFileSmart`** — looks at the first 8 bytes of the file:
- `D0 CF 11 E0` → binary `.xls` (hand to SheetJS)
- `50 4B 03 04` → `.xlsx` zip (hand to SheetJS)
- `FF FE` / `FE FF` → UTF-16 (try TSV first, then CSV)
- otherwise → try UTF-8 with tab/comma/semicolon separators

This means the user can rename files freely and the app still figures it
out.

## Browser support

Modern browsers only (Chrome 90+, Edge 90+, Firefox 90+, Safari 14+). The
app uses `TextDecoder`, `Blob`, `URL.createObjectURL`, and `Array.from` —
all of which have been universally supported for years.

## License

MIT.

import { useEffect, useMemo, useState } from "react";
import { FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, Shield } from "lucide-react";

import { StepIndicator } from "@/components/StepIndicator";
import { FileDropzone } from "@/components/FileDropzone";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { parseMSQFile, parseGCFile } from "@/lib/parsers";
import { combineScores, mergeScores } from "@/lib/merger";
import { downloadBlackboard, downloadCSV, downloadXLSX } from "@/lib/download";
import { fetchStats, reportMerge, STATS_ENABLED, type GlobalStats } from "@/lib/stats";
import { validateFile, AppError } from "@/lib/errors";
import { describeError } from "@/lib/errorMessages";
import type { MSQFileInfo, ParsedGC, MergeResult, ScoreRecord } from "@/types";

type Step = 1 | 2 | 3 | 4;
type Mode = "existing" | "new";

export default function App() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [msqFiles, setMsqFiles] = useState<File[]>([]);
  const [msqInfos, setMsqInfos] = useState<MSQFileInfo[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  // Per-file error messages, keyed by file index. If present, the file
  // failed validation or parsing and the user sees an inline message.
  const [fileErrors, setFileErrors] = useState<Record<number, string>>({});

  // Step 2 state
  const [gcFile, setGcFile] = useState<File | null>(null);
  const [gc, setGc] = useState<ParsedGC | null>(null);

  // Step 3 state
  const [mode, setMode] = useState<Mode>("existing");
  const [existingCol, setExistingCol] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState(10);
  const [fillZero, setFillZero] = useState(true);

  // Step 4 state
  const [result, setResult] = useState<MergeResult | null>(null);

  // Global stats (Cloudflare Worker, optional — silent no-op if unconfigured)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  // Fetch global stats once on mount.
  useEffect(() => {
    if (!STATS_ENABLED) return;
    fetchStats().then((s) => { if (s) setGlobalStats(s); });
  }, []);

  const newNameDefault = t("newColNameDefault");
  // Initialise new-column name from i18n on first render
  useMemo(() => { if (!newName) setNewName(newNameDefault); }, [newNameDefault]);

  function reset() {
    setStep(1);
    setMsqFiles([]); setMsqInfos([]); setScores([]);
    setFileErrors({});
    setGcFile(null); setGc(null);
    setMode("existing"); setExistingCol(""); setNewName(newNameDefault);
    setNewPoints(10); setFillZero(true);
    setResult(null); setError(null);
  }

  // ─── Step 1 ────────────────────────────────────────────────────────────
  async function processMSQ() {
    if (msqFiles.length === 0) { setError(t("noFiles")); return; }
    setBusy(true); setError(null);
    const infos: MSQFileInfo[] = [];
    const allScores: ScoreRecord[][] = [];
    const errs: Record<number, string> = {};

    for (let i = 0; i < msqFiles.length; i++) {
      const f = msqFiles[i];
      try {
        validateFile(f);                         // extension / size / non-empty
        const { scores: s, info } = await parseMSQFile(f);
        infos[i] = info;
        allScores.push(s);
      } catch (e) {
        errs[i] = describeError(e, t);
      }
    }

    setMsqInfos(infos);
    setFileErrors(errs);
    setBusy(false);

    // If every file failed, surface a top-level error and stay on step 1.
    if (allScores.length === 0) {
      setError(t("errNoScores"));
      return;
    }
    // If some failed, show a summary banner but still advance with the
    // successful files — the instructor can come back to fix the bad ones.
    if (Object.keys(errs).length > 0) {
      setError(`${Object.keys(errs).length} file(s) failed to parse. ` +
               `Continuing with the ${allScores.length} that succeeded.`);
    }
    setScores(combineScores(allScores));
    setStep(2);
  }

  /** Remove a file from the MSQ list (cleans up its error too). */
  function removeMsqFile(idx: number) {
    setMsqFiles((prev) => prev.filter((_, i) => i !== idx));
    setMsqInfos((prev) => prev.filter((_, i) => i !== idx));
    setFileErrors((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      }
      return next;
    });
  }

  // ─── Step 2 ────────────────────────────────────────────────────────────
  async function processGC() {
    if (!gcFile) { setError(t("noFiles")); return; }
    setBusy(true); setError(null);
    try {
      validateFile(gcFile);
      const parsed = await parseGCFile(gcFile);
      setGc(parsed);

      // Preselect a sensible column if one exists.
      const guess = parsed.gradeColumns.find((c) => {
        const lc = c.toLowerCase();
        return lc.includes("msq") || lc.includes("midterm") ||
               lc.includes("mid-term") || lc.includes("اختبار");
      });
      if (guess) {
        setExistingCol(guess);
        setMode("existing");
      } else if (parsed.gradeColumns.length === 0) {
        setMode("new");
      } else {
        setExistingCol(parsed.gradeColumns[0]);
      }
      setStep(3);
    } catch (e) {
      setError(describeError(e, t));
    } finally {
      setBusy(false);
    }
  }

  // ─── Step 3 ────────────────────────────────────────────────────────────
  function doMerge() {
    if (!gc) return;
    setError(null);
    let target: string;
    if (mode === "existing") {
      if (!existingCol) {
        setError(describeError(new AppError("NO_TARGET_COLUMN",
          "Please pick a target column."), t));
        return;
      }
      target = existingCol;
    } else {
      const name = newName.trim();
      if (!name) {
        setError(describeError(new AppError("NO_TARGET_COLUMN",
          "Please name the new column."), t));
        return;
      }
      // Wrap the name with Blackboard's standard suffix so re-uploading
      // creates a real grade column automatically.
      target = name.includes("[")
        ? name
        : `${name} [Total Pts: ${newPoints} Score]`;
    }
    setBusy(true);
    try {
      const merged = mergeScores(gc, target, scores, fillZero);
      // Special case: parse succeeded but nothing matched. Almost always
      // means the wrong GC was uploaded for this course.
      if (merged.stats.matched === 0) {
        throw new AppError("NO_MATCHES",
          "No students from the MSQ file appeared in your Grade Center.");
      }
      setResult(merged);
      setStep(4);
      // Best-effort, fire-and-forget: report to the global counter.
      // Sends only two integers — no IDs, names, or file contents.
      if (STATS_ENABLED) {
        reportMerge(msqFiles.length, merged.stats.matched).then((s) => {
          if (s) setGlobalStats(s);
        });
      }
    } catch (e) {
      setError(describeError(e, t));
    } finally {
      setBusy(false);
    }
  }

  // ─── Step 4 ────────────────────────────────────────────────────────────
  function downloadFile(fmt: "bb" | "xlsx" | "csv") {
    if (!result || !gc) return;
    setError(null);
    try {
      const baseName = gc.filename.replace(/\.[^.]+$/, "") + "_updated";
      if (fmt === "bb")    downloadBlackboard(result.columns, result.rows, baseName + ".xls");
      if (fmt === "xlsx")  downloadXLSX(result.columns, result.rows, baseName + ".xlsx");
      if (fmt === "csv")   downloadCSV(result.columns, result.rows, baseName + ".csv");
    } catch (e) {
      setError(describeError(e, t));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-card">
        <div className="container max-w-5xl mx-auto py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
              📝
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("appTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("appTagline")}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-6 px-4">
        <StepIndicator current={step} />

        <Alert variant="info" className="mb-6">
          <Shield className="w-4 h-4" />
          <AlertDescription>{t("privacyBadge")}</AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="flex items-start justify-between gap-3">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-xs underline opacity-70 hover:opacity-100 shrink-0"
                aria-label={t("dismissAlert")}
              >
                {t("dismissAlert")}
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* ─── Step 1 ──────────────────────────────────────────────────── */}
        {step === 1 && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader>
              <CardTitle>{t("step1Title")}</CardTitle>
              <CardDescription>{t("step1Help")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                label={t("dropMSQLabel")}
                hint={t("dropMSQHint")}
                multiple
                accept=".xlsx,.xls,.csv"
                onFiles={(files) => {
                  setMsqFiles((prev) => [...prev, ...files]);
                  setMsqInfos([]);
                  setFileErrors({});
                  setError(null);
                }}
              />

              {msqFiles.length > 0 && (
                <ul className="space-y-2">
                  {msqFiles.map((f, i) => {
                    const info = msqInfos[i];
                    const fileError = fileErrors[i];
                    const hasError = !!fileError;
                    return (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-md border bg-card animate-in fade-in slide-in-from-start-3 duration-300 transition-shadow hover:shadow-sm",
                          hasError && "border-destructive/40 bg-destructive/5",
                        )}
                      >
                        {hasError
                          ? <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                          : <FileText  className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {f.name}
                            {info && !hasError && <CheckCircle2 className="w-4 h-4 text-success inline-block ms-2" />}
                          </div>
                          {hasError ? (
                            <div className="text-xs text-destructive mt-1">{fileError}</div>
                          ) : info ? (
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              <div>
                                {t("parsedFile", {
                                  row: info.headerRow + 1,
                                  id: info.idColumn,
                                  score: info.scoreColumn,
                                  n: info.rowCount,
                                })}
                              </div>
                              <div className="font-medium text-foreground">
                                {t("fileStats", {
                                  n: info.rowCount,
                                  avg: info.meanScore.toFixed(2),
                                  min: info.minScore.toFixed(2),
                                  max: info.maxScore.toFixed(2),
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">
                              {(f.size / 1024).toFixed(1)} KB
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeMsqFile(i)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0 underline"
                          aria-label={t("removeFile")}
                        >
                          {t("removeFile")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {msqInfos.length > 0 && (
                <Alert variant="success">
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertDescription>
                    {t("totalUnique", { n: scores.length })}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button onClick={processMSQ} disabled={busy || msqFiles.length === 0}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("processBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2 ──────────────────────────────────────────────────── */}
        {step === 2 && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader>
              <CardTitle>{t("step2Title")}</CardTitle>
              <CardDescription>{t("step2Help")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                label={t("dropGCLabel")}
                hint={t("dropGCHint")}
                accept=".xlsx,.xls,.csv"
                onFiles={(files) => { setGcFile(files[0]); setGc(null); }}
              />

              {gcFile && (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{gcFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(gcFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← {t("backBtn")}
                </Button>
                <Button onClick={processGC} disabled={busy || !gcFile}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("readGCBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 3 ──────────────────────────────────────────────────── */}
        {step === 3 && gc && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader>
              <CardTitle>{t("step3Title")}</CardTitle>
              <CardDescription>{t("step3Help")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert variant="info">
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  {t("gcDetected", { id: gc.idColumn, n: gc.gradeColumns.length })}
                </AlertDescription>
              </Alert>

              {gc.gradeColumns.length === 0 && (
                <Alert variant="warning">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{t("noGradeColumns")}</AlertDescription>
                </Alert>
              )}

              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-3">
                <label
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value="existing" id="mode-existing" className="mt-0.5" disabled={gc.gradeColumns.length === 0} />
                  <span className="text-sm">{t("existingOption")}</span>
                </label>
                <label
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value="new" id="mode-new" className="mt-0.5" />
                  <span className="text-sm">{t("newOption")}</span>
                </label>
              </RadioGroup>

              {mode === "existing" && gc.gradeColumns.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="existing-select">{t("pickColumnLabel")}</Label>
                  <Select value={existingCol} onValueChange={setExistingCol}>
                    <SelectTrigger id="existing-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gc.gradeColumns.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === "new" && (
                <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-name">{t("newColNameLabel")}</Label>
                    <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-points">{t("newColPointsLabel")}</Label>
                    <Input
                      id="new-points" type="number" min={1} max={100}
                      value={newPoints}
                      onChange={(e) => setNewPoints(parseInt(e.target.value || "10"))}
                      className="w-28"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={fillZero}
                  onCheckedChange={(c) => setFillZero(c === true)}
                />
                <span>{t("fillZero")}</span>
              </label>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>← {t("backBtn")}</Button>
                <Button onClick={doMerge} disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("mergeBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 4 ──────────────────────────────────────────────────── */}
        {step === 4 && result && gc && (
          <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader>
              <CardTitle>{t("step4Title")}</CardTitle>
              <CardDescription>{t("step4Help")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats — counts on top row, score aggregates on bottom row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label={t("statTotal")}      value={result.stats.total}          tone="muted" />
                <Stat label={t("statMatched")}    value={result.stats.matched}        tone="success" />
                <Stat label={t("statUnmatched")}  value={result.stats.unmatchedInGC}  tone={result.stats.unmatchedInGC > 0 ? "warning" : "muted"} />
                <Stat label={t("statOrphans")}    value={result.stats.orphans}        tone={result.stats.orphans > 0 ? "warning" : "muted"} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t("statMean")} value={result.stats.meanScore.toFixed(2)} tone="muted" />
                <Stat label={t("statMin")}  value={result.stats.minScore.toFixed(2)}  tone="muted" />
                <Stat label={t("statMax")}  value={result.stats.maxScore.toFixed(2)}  tone="muted" />
              </div>

              {/* Students who didn't take the exam */}
              <div className="rounded-md border bg-card">
                <div className="px-4 py-3 border-b">
                  <div className="font-semibold text-sm">
                    {t("noShowTitle")}
                    <Badge variant="secondary" className="ms-2">
                      {result.stats.unmatchedInGC}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("noShowSubtitle")}
                  </div>
                </div>
                {result.stats.noShowStudents.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-center text-muted-foreground">
                    ✅ {t("noShowEmpty")}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("colName")}</TableHead>
                          <TableHead>{t("colId")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.stats.noShowStudents.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {s.studentId}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {result.stats.orphans > 0 && (
                <Alert variant="warning">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    {t("orphanWarn", {
                      n: result.stats.orphans,
                      ids: result.stats.orphanIds.join(", "),
                    })}
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview table */}
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.columns.map((c) => (
                          <TableHead
                            key={c}
                            className={
                              c === result.targetColumn
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                                : undefined
                            }
                          >
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.slice(0, 200).map((r, i) => (
                        <TableRow key={i}>
                          {result.columns.map((c) => (
                            <TableCell
                              key={c}
                              className={
                                c === result.targetColumn
                                  ? "bg-amber-50 font-medium dark:bg-amber-900/10"
                                  : undefined
                              }
                            >
                              {r[c] == null ? "" : String(r[c])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("previewNote", {
                  shown: Math.min(200, result.rows.length),
                  total: result.rows.length,
                })}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  {t("backChangeBtn")}
                </Button>
                <Button variant="success" onClick={() => downloadFile("bb")}>
                  {t("dlBlackboard")}
                </Button>
                <Button variant="outline" onClick={() => downloadFile("xlsx")}>
                  {t("dlExcel")}
                </Button>
                <Button variant="outline" onClick={() => downloadFile("csv")}>
                  {t("dlCSV")}
                </Button>
                <Button variant="ghost" onClick={reset} className="ms-auto">
                  <RefreshCw className="w-4 h-4" />
                  {t("startOver")}
                </Button>
              </div>

              <Alert variant="info">
                <AlertDescription>{t("blackboardTip")}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {globalStats && (
          <div className="mt-10 rounded-xl border bg-card px-6 py-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="text-center mb-4">
              <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                🌍 {t("globalStatsTitle")}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="transition-transform hover:scale-105">
                <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">
                  <CountUp value={globalStats.students} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("globalStudents")}
                </div>
              </div>
              <div className="transition-transform hover:scale-105">
                <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">
                  <CountUp value={globalStats.merges} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("globalMerges")}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-muted-foreground mt-8 py-6 space-y-2">
          <div>
            <a
              href="mailto:msalmazyad@iau.edu.sa"
              className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
              aria-label="Email Mohammed Almazyad"
            >
              {t("madeBy")}
              <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                ✉️
              </span>
            </a>
          </div>
          <div>
            <Badge variant="outline" className="font-normal">
              v1.3 · 100% client-side · MIT
            </Badge>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: {
  label: string; value: number | string; tone: "success" | "warning" | "muted";
}) {
  const colors = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    muted:   "text-foreground",
  };
  return (
    <div className="rounded-md border p-3 bg-card transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
      <div className={`text-2xl font-bold ${colors[tone]}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/**
 * Animates a number from 0 to the target value over ~900ms using
 * requestAnimationFrame and an ease-out curve. Re-animates whenever
 * `value` changes.
 */
function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let rafId = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

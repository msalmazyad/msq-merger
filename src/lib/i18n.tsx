import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Language } from "@/types";

/** All UI strings, keyed for fast lookup. English is the source of truth. */
const STRINGS = {
  // Header
  appTitle:        { en: "MSQ Grade Merger",
                     ar: "دامج درجات الاختبارات" },
  appTagline:      { en: "Merge exam results from the testing office into your Blackboard Grade Center file.",
                     ar: "دمج نتائج الاختبارات من مكتب الاختبارات في ملف Blackboard Grade Center." },
  privacyBadge:    { en: "Runs in your browser — files never leave your computer.",
                     ar: "يعمل في متصفحك — لا تغادر ملفاتك جهازك." },

  // Step indicator
  step1Label:      { en: "Upload MSQ files",       ar: "رفع ملفات الاختبار" },
  step2Label:      { en: "Upload Blackboard file", ar: "رفع ملف Blackboard" },
  step3Label:      { en: "Pick target column",     ar: "اختيار العمود الهدف" },
  step4Label:      { en: "Preview & download",     ar: "المعاينة والتنزيل" },

  // Step 1
  step1Title:      { en: "Step 1 — Upload MSQ exam files",
                     ar: "الخطوة ١ — ارفع ملفات الاختبار" },
  step1Help:       { en: "Drop the files from the testing office (Template A, Template B…). Accepts .xlsx, .xls, and .csv.",
                     ar: "اسحب ملفات مكتب الاختبارات (نموذج أ، نموذج ب…). يقبل xlsx و xls و csv." },
  dropMSQLabel:    { en: "Click to select files, or drag & drop here",
                     ar: "اضغط لاختيار الملفات، أو اسحبها وأفلتها هنا" },
  dropMSQHint:     { en: "Multiple files allowed",
                     ar: "يمكنك رفع عدة ملفات معًا" },
  processBtn:      { en: "Process MSQ files",       ar: "معالجة الملفات" },
  parsedFile:      { en: "Header at row {row} · ID: {id} · Score: {score} · {n} students",
                     ar: "العنوان في الصف {row} · المعرف: {id} · الدرجة: {score} · {n} طالبًا" },
  fileStats:       { en: "{n} students · avg {avg} · min {min} · max {max}",
                     ar: "{n} طالبًا · المتوسط {avg} · الأدنى {min} · الأعلى {max}" },
  totalUnique:     { en: "{n} unique students across all files.",
                     ar: "{n} طالبًا فريدًا في جميع الملفات." },

  // Step 2
  step2Title:      { en: "Step 2 — Upload your Blackboard Grade Center file",
                     ar: "الخطوة ٢ — ارفع ملف Blackboard Grade Center" },
  step2Help:       { en: "Download the full Grade Center from Blackboard. The export usually has a .xls extension but is actually a UTF-16 tab-separated file — the app handles that automatically.",
                     ar: "نزّل Grade Center الكامل من Blackboard. عادةً ما يكون امتداد الملف xls لكنه فعليًا ملف UTF-16 مفصول بعلامات تبويب — يتعامل التطبيق مع ذلك تلقائيًا." },
  dropGCLabel:     { en: "Click to select the Grade Center file",
                     ar: "اضغط لاختيار ملف Grade Center" },
  dropGCHint:      { en: "One file only",            ar: "ملف واحد فقط" },
  readGCBtn:       { en: "Read Grade Center",        ar: "قراءة Grade Center" },
  gcDetected:      { en: "ID column: {id} · {n} grade column(s) found.",
                     ar: "عمود المعرف: {id} · تم العثور على {n} عمود درجات." },

  // Step 3
  step3Title:      { en: "Step 3 — Where should the MSQ scores go?",
                     ar: "الخطوة ٣ — أين تريد إدراج درجات الاختبار؟" },
  step3Help:       { en: "Pick an existing grade column from your Blackboard file, or have the app add a new column for you.",
                     ar: "اختر عمود درجات موجودًا من ملفك، أو دع التطبيق يضيف عمودًا جديدًا." },
  existingOption:  { en: "I already added a column in Blackboard — use one of the existing columns",
                     ar: "تمت إضافة عمود مسبقًا في Blackboard — يرجى استخدام أحد الأعمدة الموجودة." },
  newOption:       { en: "I haven't added a column — please add one for me",
                     ar: "لم أضف عمودًا — أضفه لي من فضلك" },
  pickColumnLabel: { en: "Pick an existing grade column",
                     ar: "اختر عمود درجات موجودًا" },
  newColNameLabel: { en: "New column name",         ar: "اسم العمود الجديد" },
  newColNameDefault:{ en: "Midterm MSQ",            ar: "اختبار النصفي" },
  newColPointsLabel:{ en: "Total points",           ar: "مجموع الدرجات" },
  fillZero:        { en: "Fill students with no MSQ result with 0 (uncheck to leave blank)",
                     ar: "حدّد هذا الخيار لملء 0 للطلاب بدون نتيجة، واتركه غير محدد لتركها فارغة."},
  backBtn:         { en: "Back",                    ar: "رجوع" },
  mergeBtn:        { en: "Merge & preview",         ar: "دمج ومعاينة" },

  // Step 4
  step4Title:      { en: "Step 4 — Review the merged file",
                     ar: "الخطوة ٤ — مراجعة الملف المدمج" },
  step4Help:       { en: "The highlighted column is the one being written. Check it carefully before downloading.",
                     ar: "العمود المظلل هو العمود الذي ستتم كتابته. راجعه جيدًا قبل التنزيل." },
  statMatched:     { en: "Students matched",        ar: "طلاب تم مطابقتهم" },
  statUnmatched:   { en: "Didn't take the exam",     ar: "لم يؤدوا الاختبار" },
  statOrphans:     { en: "In MSQ, not in Blackboard", ar: "في الاختبار و ليس في Blackboard" },
  statTotal:       { en: "Total students",           ar: "إجمالي الطلاب" },
  statMin:         { en: "Lowest score",             ar: "أدنى درجة" },
  statMax:         { en: "Highest score",            ar: "أعلى درجة" },
  statMean:        { en: "Average score",            ar: "متوسط الدرجات" },
  noShowTitle:     { en: "Students who didn't take the exam",
                     ar: "الطلاب الذين لم يؤدوا الاختبار" },
  noShowSubtitle:  { en: "These students are in your Grade Center but have no MSQ result.",
                     ar: "هؤلاء الطلاب موجودون في Grade Center ولكن ليس لديهم نتيجة اختبار." },
  noShowEmpty:     { en: "Everyone took the exam — nice!",
                     ar: "جميع الطلاب أدوا الاختبار — ممتاز!" },
  colName:         { en: "Name",                     ar: "الاسم" },
  colId:           { en: "Student ID",               ar: "معرف الطالب" },
  orphanWarn:      { en: "{n} student(s) appear in the MSQ files but are NOT in your Grade Center. Their scores were skipped. IDs: {ids}",
                     ar: "{n} طالب موجود في ملفات الاختبار لكن غير موجود في Grade Center. تم تخطي درجاتهم. المعرفات: {ids}" },
  previewNote:     { en: "Showing {shown} of {total} rows. The highlighted column is the one filled with MSQ scores.",
                     ar: "عرض {shown} من {total} صف. العمود المظلل هو ما تم تعبئته بدرجات الاختبار." },
  backChangeBtn:   { en: "← Back & change column",  ar: "← رجوع وتغيير العمود" },
  dlBlackboard:    { en: "↓ Download for Blackboard (.xls)", ar: "↓ تنزيل لـ Blackboard (.xls)" },
  dlExcel:         { en: "↓ Excel (.xlsx)",         ar: "↓ Excel (.xlsx)" },
  dlCSV:           { en: "↓ CSV (.csv)",            ar: "↓ CSV (.csv)" },
  startOver:       { en: "Start over",              ar: "البدء من جديد" },
  blackboardTip:   { en: "The .xls Blackboard format is the one to re-upload to Blackboard. Excel and CSV are for your own records.",
                     ar: "صيغة Blackboard هي ما يجب رفعه مرة أخرى إلى Blackboard. صيغتا Excel و CSV لسجلاتك الشخصية." },

  // Errors / generic
  noFiles:         { en: "Please select at least one file first.",
                     ar: "يرجى اختيار ملف واحد على الأقل أولًا." },
  parseError:      { en: "Failed to read {file}: {err}",
                     ar: "فشل في قراءة {file}: {err}" },
  noGradeColumns:  { en: "No grade columns found in your Grade Center. The app will add a new column for you.",
                     ar: "لم يتم العثور على أعمدة درجات في Grade Center. سيضيف التطبيق عمودًا جديدًا." },

  // Error code → friendly message. The {file} / {columns} placeholders
  // are filled from AppError.details.
  errUnsupportedFormat: {
    en: "{file} isn't a supported format. Please upload .xlsx, .xls, or .csv.",
    ar: "{file} ليس بصيغة مدعومة. يُرجى رفع ملف بصيغة .xlsx أو .xls أو .csv.",
  },
  errFileTooLarge: {
    en: "{file} is too large ({sizeMB} MB). The maximum is 20 MB.",
    ar: "{file} حجمه كبير جدًا ({sizeMB} ميغابايت). الحد الأقصى هو 20 ميغابايت.",
  },
  errEmptyFile: {
    en: "{file} is empty. Please check the file and try again.",
    ar: "{file} فارغ. يُرجى التحقق من الملف والمحاولة مرة أخرى.",
  },
  errUnreadableFile: {
    en: "{file} couldn't be read. It may be corrupted or in an unsupported format.",
    ar: "تعذرت قراءة {file}. قد يكون تالفًا أو بصيغة غير مدعومة.",
  },
  errNoDataRows: {
    en: "{file} has the right columns but no valid student rows. Check that student IDs are numeric and the score column has numbers.",
    ar: "{file} يحتوي على الأعمدة الصحيحة لكن بدون صفوف طلاب صالحة. تأكد أن معرفات الطلاب أرقام وأن عمود الدرجات يحتوي على أرقام.",
  },
  errMissingMSQColumns: {
    en: "Couldn't find ID and Score columns in {file}. Detected: {columns}.",
    ar: "تعذر العثور على أعمدة المعرف والدرجة في {file}. المكتشف: {columns}.",
  },
  errMissingGCID: {
    en: "Couldn't find a Student-ID column in {file}. Make sure you exported the full Grade Center from Blackboard.",
    ar: "تعذر العثور على عمود معرف الطالب في {file}. تأكد من تصدير Grade Center كاملًا من Blackboard.",
  },
  errNoScores: {
    en: "No scores to merge — upload at least one MSQ file with student rows.",
    ar: "لا توجد درجات للدمج — يُرجى رفع ملف MSQ واحد على الأقل يحتوي على صفوف طلاب.",
  },
  errNoTargetColumn: {
    en: "Please pick or name a target column before merging.",
    ar: "يُرجى اختيار أو تسمية عمود هدف قبل الدمج.",
  },
  errNoMatches: {
    en: "No students from the MSQ file appeared in your Grade Center. Double-check that you uploaded the right Grade Center for this course.",
    ar: "لم يظهر أي طالب من ملف MSQ في Grade Center. تأكد من رفع Grade Center الصحيح لهذه المادة.",
  },
  errUnknown: {
    en: "Something went wrong: {err}",
    ar: "حدث خطأ ما: {err}",
  },

  // Global error boundary
  fatalTitle:      { en: "Something went wrong",
                     ar: "حدث خطأ ما" },
  fatalSubtitle:   { en: "The app hit an unexpected error. Reloading the page usually fixes it.",
                     ar: "واجه التطبيق خطأً غير متوقع. عادةً ما يؤدي إعادة تحميل الصفحة إلى حل المشكلة." },
  reload:          { en: "Reload page",
                     ar: "إعادة تحميل الصفحة" },
  dismissAlert:    { en: "Dismiss",  ar: "إغلاق" },
  removeFile:      { en: "Remove",   ar: "إزالة" },

  // Footer
  madeBy:          { en: "Made by Mohammed Almazyad",
                     ar: "تطوير محمد المزيد" },
  globalStatsTitle:{ en: "Website Statistics",
                     ar: "إحصائيات الموقع" },
  globalStudents:  { en: "Students grades recorded",  ar: "طالب رُصدت درجاتهم" },
  globalMerges:    { en: "successful merges", ar: "عملية دمج ناجحة" },
} as const;

export type StringKey = keyof typeof STRINGS;

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("msq-lang") : null;
    return stored === "ar" ? "ar" : "en";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("msq-lang", lang);
  }, [lang]);

  const value = useMemo<I18nCtx>(() => ({
    lang,
    setLang,
    t: (key, vars) => {
      let s: string = STRINGS[key][lang] || STRINGS[key].en;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return s;
    },
  }), [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}

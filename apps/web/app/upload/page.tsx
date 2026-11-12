"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Source = { page: number; quote: string };
type Row = { label: string; value: string; source?: Source | null };

// The shape POST /api/sla/extract returns (apps/sla-service/schema.py).
type SlaResult = {
  provider: string | null;
  service: string | null;
  measurement_period: string | null;
  timezone: string | null;
  commitments: { id: string; metric: string; operator: string; threshold: number; source: Source }[];
  credit_rules: { commitment_id: string; if_below: number | null; if_above: number | null; credit_percent: number; source: Source }[];
  credit_cap_percent: number | null;
  credit_cap_source: Source | null;
  exclusions: { type: string; max_hours_per_month: number | null; source: Source }[];
  validation: { status: "ok" | "needs_review"; issues: string[] };
};

// Shown only when the AI service can't be reached, and labelled as samples.
const SAMPLE_TERMS: Row[] = [
  { label: "Uptime guarantee", value: "99.9%" },
  { label: "Latency target (p95)", value: "300 ms" },
  { label: "Measurement window", value: "Monthly" },
  { label: "Credit formula", value: "25% of fee when uptime is below 99.9%" },
];

const METRIC_LABELS: Record<string, [string, string]> = {
  uptime_percent: ["Uptime guarantee", "%"],
  p95_latency_ms: ["Latency target (p95)", " ms"],
};

function toRows(sla: SlaResult): Row[] {
  const rows: Row[] = [];
  if (sla.provider) rows.push({ label: "Provider", value: [sla.provider, sla.service].filter(Boolean).join(" · ") });
  for (const c of sla.commitments) {
    const [label, unit] = METRIC_LABELS[c.metric] ?? [c.metric, ""];
    rows.push({ label, value: `${c.operator} ${c.threshold}${unit}`, source: c.source });
  }
  const unitOf = (id: string) => METRIC_LABELS[sla.commitments.find((c) => c.id === id)?.metric ?? ""]?.[1] ?? "";
  for (const r of sla.credit_rules) {
    const unit = unitOf(r.commitment_id);
    const when = r.if_below !== null ? `below ${r.if_below}${unit}` : `above ${r.if_above}${unit}`;
    rows.push({ label: `Credit if ${when}`, value: `${r.credit_percent}% of fee`, source: r.source });
  }
  rows.push({
    label: "Credit cap",
    value: sla.credit_cap_percent !== null ? `${sla.credit_cap_percent}% of fee` : "Not stated",
    source: sla.credit_cap_source,
  });
  rows.push({
    label: "Measurement window",
    value: [sla.measurement_period, sla.timezone].filter(Boolean).join(", ") || "Not stated",
  });
  for (const e of sla.exclusions) {
    rows.push({
      label: `Excluded: ${e.type.replace(/_/g, " ")}`,
      value: e.max_hours_per_month !== null ? `up to ${e.max_hours_per_month} h/month` : "No limit",
      source: e.source,
    });
  }
  return rows;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "parsing" | "done">("idle");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[]>(SAMPLE_TERMS);
  const [result, setResult] = useState<SlaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setStage("parsing");
    setResult(null);
    setError(null);
    setRows(SAMPLE_TERMS);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiUrl}/api/sla/extract`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.validation) {
        setResult(data as SlaResult);
        setRows(toRows(data as SlaResult));
      } else {
        setError(data?.detail || data?.message || `AI service returned ${res.status}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Smooth visual feedback
      setTimeout(() => setStage("done"), 600);
    }
  };

  const loadSample = async (path: string, name: string) => {
    try {
      const res = await fetch(path);
      const blob = await res.blob();
      handleFile(new File([blob], name, { type: "application/pdf" }));
    } catch (e) {
      console.warn("Could not load sample PDF", e);
    }
  };

  const needsReview = result?.validation.status === "needs_review";

  return (
    <main className="pt-24 sm:pt-28 pb-24 px-4 sm:px-6 max-w-3xl mx-auto">
      <h1 className="font-headline font-bold text-3xl sm:text-4xl text-primary">Upload SLA</h1>
      <p className="text-sm sm:text-base text-on-surface-variant mt-1 mb-6 sm:mb-8">
        Drop a contract and measurable promises are extracted by Groq AI.
      </p>

      {stage === "idle" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-3 h-60 sm:h-72 px-4 rounded-3xl border-2 border-dashed cursor-pointer transition-colors text-center ${
            dragging
              ? "border-primary bg-primary/10"
              : "border-outline-variant bg-surface-container-lowest hover:border-primary/60"
          }`}
        >
          <UploadCloud size={40} className="text-primary" />
          <p className="font-headline font-bold text-lg sm:text-xl text-primary">
            Drop your SLA PDF here
          </p>
          <p className="text-xs sm:text-sm text-on-surface-variant">or tap to browse files</p>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) =>
              e.target.files?.[0] && handleFile(e.target.files[0])
            }
          />
        </label>
      )}

      {stage === "idle" && (
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-on-surface-variant px-2">
          <span>Need a sample file to test?</span>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => loadSample("/demo_tiered_sla.pdf", "nimbus_tiered_sla.pdf")}
              className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              ⚡ Tap to auto-load demo SLA contract
            </button>
            <button
              type="button"
              onClick={() => loadSample("/demo_vague_sla.pdf", "cirrus_vague_sla.pdf")}
              className="text-on-surface-variant hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              Try a vague contract
            </button>
          </div>
        </div>
      )}

      {stage === "parsing" && (
        <div className="flex flex-col items-center justify-center gap-4 h-60 sm:h-72 rounded-3xl bg-surface-container-lowest border border-outline-variant/50 px-4 text-center">
          <Loader2 size={40} className="text-primary animate-spin" />
          <p className="font-headline font-bold text-lg sm:text-xl text-primary">
            Reading {file?.name}
          </p>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Extracting promises via Groq AI &amp; PDFPlumber
          </p>
        </div>
      )}

      {stage === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl bg-surface-container-lowest border border-outline-variant/50 p-5 sm:p-8 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <FileText className="text-primary" />
            <p className="font-semibold text-primary truncate max-w-[200px] sm:max-w-md">{file?.name}</p>
            {result && !needsReview && (
              <span className="ml-auto flex items-center gap-1 text-secondary font-bold text-xs sm:text-sm">
                <CheckCircle2 size={18} /> AI Extracted · all checks passed
              </span>
            )}
            {needsReview && (
              <span className="ml-auto flex items-center gap-1 text-error font-bold text-xs sm:text-sm">
                <AlertTriangle size={18} /> Needs human review
              </span>
            )}
            {!result && (
              <span className="ml-auto flex items-center gap-1 text-on-surface-variant font-bold text-xs sm:text-sm">
                <AlertTriangle size={18} /> Sample terms (AI unavailable)
              </span>
            )}
          </div>

          {needsReview && (
            <div className="mb-6 p-4 rounded-2xl border border-error/40 bg-error-container/30">
              <p className="font-semibold text-error text-sm mb-2">
                {result!.validation.issues.length} issue(s) found. Money won&apos;t move on this contract until a person checks it.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-on-surface">
                {result!.validation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="mb-6 text-xs sm:text-sm text-on-surface-variant">
              Couldn&apos;t reach the AI service ({error}). The values below are samples, not read from your file.
            </p>
          )}

          <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
            {rows.map((e, i) => (
              <div
                key={`${e.label}-${i}`}
                className="p-3 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                  <span className="text-xs sm:text-sm text-on-surface-variant">{e.label}</span>
                  <span className="font-bold text-primary sm:text-right text-sm sm:text-base">{e.value}</span>
                </div>
                {e.source && (
                  <p className="mt-1.5 text-[11px] sm:text-xs text-on-surface-variant italic">
                    p.{e.source.page}: &ldquo;{e.source.quote}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="flex-1 text-center py-3 px-4 rounded-full bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shadow-sm text-sm sm:text-base active:scale-95"
            >
              Start monitoring
            </Link>
            <button
              onClick={() => {
                setFile(null);
                setStage("idle");
              }}
              className="px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors text-sm sm:text-base active:scale-95"
            >
              Upload another
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}

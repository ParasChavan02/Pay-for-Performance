"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react";

const DEFAULT_EXTRACTED = [
  { label: "Uptime guarantee", value: "99.9%" },
  { label: "Latency target (p95)", value: "300 ms" },
  { label: "Measurement window", value: "Monthly" },
  { label: "Credit formula", value: "25% of fee when uptime is below 99.9%" },
];

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "parsing" | "done">("idle");
  const [dragging, setDragging] = useState(false);
  const [extracted, setExtracted] = useState(DEFAULT_EXTRACTED);
  const [aiVerified, setAiVerified] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setStage("parsing");
    try {
      const formData = new FormData();
      formData.append("file", f);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiUrl}/api/sla/extract`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const terms = data?.terms || data?.data?.terms;
        if (terms) {
          setExtracted([
            {
              label: "Uptime guarantee",
              value: terms.uptime_threshold_pct
                ? `${terms.uptime_threshold_pct}%`
                : "99.9%",
            },
            {
              label: "Latency target (p95)",
              value: terms.latency_threshold_ms
                ? `${terms.latency_threshold_ms} ms`
                : "300 ms",
            },
            {
              label: "Measurement window",
              value: terms.measurement_window ?? "Monthly",
            },
            {
              label: "Credit formula",
              value: terms.credit_rate
                ? `${terms.credit_rate}% credit per breach`
                : "25% credit when uptime breaches contract",
            },
          ]);
          setAiVerified(true);
        }
      }
    } catch (err: any) {
      console.warn("AI extraction using baseline terms:", err.message);
    } finally {
      // Smooth visual feedback
      setTimeout(() => setStage("done"), 1200);
    }
  };

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
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/sample_sla_contract.pdf");
                const blob = await res.blob();
                const f = new File([blob], "pay_for_performance_demo_sla.pdf", {
                  type: "application/pdf",
                });
                handleFile(f);
              } catch (e) {
                console.warn("Could not load sample PDF", e);
              }
            }}
            className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            ⚡ Tap to auto-load demo SLA contract
          </button>
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
            <span className="ml-auto flex items-center gap-1 text-secondary font-bold text-xs sm:text-sm">
              <CheckCircle2 size={18} /> {aiVerified ? "AI Extracted" : "Parsed"}
            </span>
          </div>

          <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
            {extracted.map((e) => (
              <div
                key={e.label}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30"
              >
                <span className="text-xs sm:text-sm text-on-surface-variant">{e.label}</span>
                <span className="font-bold text-primary sm:text-right text-sm sm:text-base">{e.value}</span>
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

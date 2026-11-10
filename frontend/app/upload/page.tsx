"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react";

// demo extraction, replace with the AI extraction api later
const extracted = [
  { label: "Uptime guarantee", value: "99.9%" },
  { label: "Latency target (p95)", value: "300 ms" },
  { label: "Measurement window", value: "Monthly" },
  { label: "Credit formula", value: "25% of fee when uptime is below 99.9%" },
];

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "parsing" | "done">("idle");
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setStage("parsing");
    setTimeout(() => setStage("done"), 1800);
  };

  return (
    <main className="pt-28 pb-24 px-6 max-w-3xl mx-auto">
      <h1 className="font-headline font-bold text-4xl text-primary">Upload SLA</h1>
      <p className="text-on-surface-variant mt-1 mb-8">
        Drop a contract and the measurable promises are extracted for you.
      </p>

      {stage === "idle" && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-3 h-72 rounded-3xl border-2 border-dashed cursor-pointer transition-colors ${
            dragging ? "border-primary bg-surface-container" : "border-outline-variant bg-surface-container-lowest"
          }`}
        >
          <UploadCloud size={40} className="text-primary" />
          <p className="font-headline font-bold text-xl text-primary">Drop your SLA PDF here</p>
          <p className="text-sm text-on-surface-variant">or click to browse</p>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      )}

      {stage === "parsing" && (
        <div className="flex flex-col items-center justify-center gap-4 h-72 rounded-3xl bg-surface-container-lowest border border-surface-container">
          <Loader2 size={40} className="text-primary animate-spin" />
          <p className="font-headline font-bold text-xl text-primary">Reading {file?.name}</p>
          <p className="text-sm text-on-surface-variant">Extracting promises from the contract</p>
        </div>
      )}

      {stage === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl bg-surface-container-lowest border border-surface-container p-8 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-primary" />
            <p className="font-semibold text-primary">{file?.name}</p>
            <span className="ml-auto flex items-center gap-1 text-secondary font-bold text-sm">
              <CheckCircle2 size={18} /> Parsed
            </span>
          </div>

          <div className="space-y-3 mb-8">
            {extracted.map((e) => (
              <div key={e.label} className="flex justify-between gap-4 p-4 rounded-2xl bg-surface-container-low">
                <span className="text-on-surface-variant">{e.label}</span>
                <span className="font-bold text-primary text-right">{e.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1 text-center py-3 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors">
              Start monitoring
            </Link>
            <button onClick={() => { setFile(null); setStage("idle"); }} className="px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors">
              Upload another
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
}
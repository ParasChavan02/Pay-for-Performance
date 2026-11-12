"use client";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative isolate min-h-[92vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-28 pb-16 overflow-hidden bg-background">
      {/* Dynamic dot grid that adapts to theme */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(var(--dot-color) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* Atmospheric glowing orbs (light mode only, keeps pitch black in dark mode) */}
      <div className="absolute top-[12%] left-[10%] sm:left-[20%] w-60 sm:w-72 h-60 sm:h-72 rounded-full bg-secondary-container/40 dark:opacity-0 blur-3xl -z-10 animate-pulse pointer-events-none" />
      <div className="absolute top-[28%] right-[8%] sm:right-[18%] w-64 sm:w-80 h-64 sm:h-80 rounded-full bg-primary-container/30 dark:opacity-0 blur-3xl -z-10 animate-pulse pointer-events-none" />
      <div className="absolute bottom-[16%] left-[30%] sm:left-[38%] w-44 sm:w-56 h-44 sm:h-56 rounded-full bg-primary/20 dark:opacity-0 blur-3xl -z-10 pointer-events-none" />

      {/* Main Glass Panel */}
      <div className="relative max-w-4xl w-full rounded-[2rem] border border-outline-variant/60 dark:border-zinc-800 bg-surface-container-lowest/80 dark:bg-zinc-950/70 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] px-4 py-8 sm:px-12 sm:py-14 flex flex-col items-center">
        {/* Soft edge shine */}
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/10 dark:from-white/5 via-transparent to-transparent" />

        {/* Status Pill */}
        <div className="relative flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container/80 dark:bg-zinc-900 shadow-sm border border-outline-variant/50 dark:border-zinc-800 mb-6 sm:mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs sm:text-sm font-semibold text-primary flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-secondary" /> Verified settlements on PayPal
          </span>
        </div>

        {/* Headline */}
        <h1 className="relative font-headline font-bold text-primary tracking-tight text-3xl sm:text-5xl md:text-6xl leading-[1.15] max-w-3xl">
          Don&apos;t pay for promises. Pay for verified performance.
        </h1>

        {/* Subtitle */}
        <p className="relative mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-on-surface-variant max-w-xl px-2">
          Money that responds to real service quality. Auto-adjust payouts based on contractual SLA guarantees.
        </p>

        {/* Call to Actions */}
        <div className="relative mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-4 sm:px-0">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-primary text-on-primary font-bold hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition-all shadow-md active:scale-95"
          >
            Open control center <ArrowRight size={18} />
          </Link>
          <a
            href="#story"
            className="flex items-center justify-center px-7 py-3.5 rounded-full border border-outline-variant dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-900 hover:bg-surface-container dark:hover:bg-zinc-800 text-on-surface font-semibold transition-all active:scale-95"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* Mini Live Settlement Card */}
      <div className="mt-8 sm:mt-10 w-full max-w-2xl rounded-3xl bg-surface-container-lowest/90 dark:bg-zinc-950/80 backdrop-blur-xl border border-outline-variant/50 dark:border-zinc-800 shadow-xl p-4 sm:p-6 text-left">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            <span className="text-xs sm:text-sm font-bold text-primary">Settlement PAY-DEMO-001</span>
          </div>
          <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-error-container text-error border border-error/20">
            SLA breached · 97.0%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-container-low dark:bg-zinc-900/60 border border-transparent dark:border-zinc-800/60 text-center sm:text-left">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-on-surface-variant">Authorized</p>
            <p className="font-headline font-bold text-lg sm:text-2xl text-primary mt-0.5">$100</p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-2xl bg-secondary-container/20 border border-secondary/20 text-center sm:text-left">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-secondary">SLA credit</p>
            <p className="font-headline font-bold text-lg sm:text-2xl text-secondary mt-0.5">$25</p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-container dark:bg-zinc-900 border border-transparent dark:border-zinc-800 text-center sm:text-left">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase text-on-surface-variant">Capture</p>
            <p className="font-headline font-bold text-lg sm:text-2xl text-primary mt-0.5">$75</p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-surface-container dark:bg-zinc-800 overflow-hidden flex">
          <div className="h-full bg-secondary w-1/4 transition-all duration-1000" />
          <div className="h-full bg-primary dark:bg-white flex-1" />
        </div>
      </div>
    </section>
  );
}

"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen flex flex-col items-center justify-center text-center px-6 pt-28 pb-16 overflow-hidden">
      {/* dot grid that fades out at the edges */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(#c2c6d1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
        }}
      />

      {/* orbs drifting behind the glass */}
      <div className="absolute top-[14%] left-[20%] w-72 h-72 rounded-full bg-secondary-container/80 blur-2xl -z-10 animate-pulse" />
      <div className="absolute top-[30%] right-[18%] w-80 h-80 rounded-full bg-primary-container/30 blur-2xl -z-10 animate-pulse" />
      <div className="absolute bottom-[18%] left-[38%] w-48 h-48 rounded-full bg-on-primary-container/40 blur-2xl -z-10" />

      {/* glass panel */}
      <div className="relative max-w-4xl w-full rounded-[2rem] border border-white/25 bg-white/10 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,46,86,0.06)] px-6 py-10 md:px-16 md:py-14 flex flex-col items-center">
        {/* soft shine on the glass edge */}
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/20 via-transparent to-transparent" />

        <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 shadow-sm border border-white/80 mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-sm font-semibold text-primary">Verified settlements on PayPal</span>
        </div>

        <h1 className="relative font-headline font-bold text-primary tracking-tight text-4xl md:text-6xl leading-[1.1]">
          Don&apos;t pay for promises. Pay for verified performance.
        </h1>

        <p className="relative mt-6 text-lg md:text-xl text-on-surface-variant max-w-xl">
          Money that responds to service quality.
        </p>

        <div className="relative mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors shadow-sm"
          >
            Open dashboard <ArrowRight size={18} />
          </Link>
          <a
            href="#story"
            className="px-7 py-3.5 rounded-full border border-primary/20 bg-white/60 text-primary font-semibold hover:bg-white/90 transition-colors"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* mini live settlement card */}
      <div className="mt-10 w-full max-w-2xl rounded-3xl bg-surface-container-lowest/90 backdrop-blur border border-surface-container shadow-xl p-5 text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            <span className="text-sm font-bold text-primary">Settlement PAY-DEMO-001</span>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-error-container text-error">
            SLA breached · 97.0%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-surface-container-low">
            <p className="text-[11px] font-bold uppercase text-on-surface-variant">Authorized</p>
            <p className="font-headline font-bold text-2xl text-primary">$100</p>
          </div>
          <div className="p-3 rounded-2xl bg-secondary-container/30">
            <p className="text-[11px] font-bold uppercase text-secondary">SLA credit</p>
            <p className="font-headline font-bold text-2xl text-secondary">$25</p>
          </div>
          <div className="p-3 rounded-2xl bg-surface-container">
            <p className="text-[11px] font-bold uppercase text-on-surface-variant">Capture</p>
            <p className="font-headline font-bold text-2xl text-primary">$75</p>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-primary overflow-hidden flex">
          <div className="h-full bg-secondary w-1/4 transition-all duration-1000" />
        </div>
      </div>
    </section>
  );
}

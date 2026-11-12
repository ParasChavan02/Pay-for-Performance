"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

type P = MotionValue<number>;

const DAYS = 30;
const breaches = [5, 6, 13, 19, 20]; // which days have an outage

function Cell({ p, i }: { p: P; i: number }) {
  const k = breaches.indexOf(i);
  const appear = i * 0.004;
  const opacity = useTransform(p, [appear, appear + 0.05], [0.3, 1]);
  // outage days turn from green to red one after another
  const start = 0.18 + Math.max(k, 0) * 0.1;
  const bg = useTransform(p, [start, start + 0.05], ["#10b981", k >= 0 ? "#ef4444" : "#10b981"]);
  return <motion.div style={{ opacity, backgroundColor: bg }} className="aspect-square rounded-md sm:rounded-lg opacity-90 shadow-xs" />;
}

export default function Problem() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const up = useTransform(p, [0.18, 0.63], [99.9, 97]);
  const upText = useTransform(up, (v) => `${v.toFixed(1)}%`);

  const stampOpacity = useTransform(p, [0.7, 0.78], [0, 1]);
  const stampScale = useTransform(p, [0.7, 0.78], [1.5, 1]);
  const footOpacity = useTransform(p, [0.72, 0.8], [0, 1]);

  return (
    <section ref={ref} className="h-[250vh] sm:h-[300vh] relative">
      <div className="sticky top-0 min-h-screen pt-24 pb-12 flex items-center overflow-hidden">
        <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* left : the message */}
          <div>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary mb-3">The problem</p>
            <h2 className="font-headline font-bold text-3xl sm:text-5xl md:text-6xl tracking-tight text-primary leading-[1.15]">
              You pay for 99.9%.
              <br />
              You get <motion.span className="text-error font-extrabold">{upText}</motion.span>
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-on-surface-variant max-w-md">
              Outages happen, and the contract says you are owed a credit. But claiming it means
              support tickets, logs, and weeks of waiting—so contractual credits often go unclaimed.
            </p>
          </div>

          {/* right : glass card with the month grid */}
          <div className="relative mt-4 lg:mt-0">
            <div className="absolute -top-10 -left-10 w-48 sm:w-56 h-48 sm:h-56 rounded-full bg-secondary-container/30 dark:opacity-0 blur-3xl -z-10" />
            <div className="absolute -bottom-10 -right-6 w-52 sm:w-64 h-52 sm:h-64 rounded-full bg-primary-container/20 dark:opacity-0 blur-3xl -z-10" />

            <div className="relative rounded-3xl border border-outline-variant/50 dark:border-zinc-800 bg-surface-container-lowest/80 dark:bg-zinc-950/80 backdrop-blur-xl shadow-2xl p-5 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="font-headline font-bold text-base sm:text-lg text-primary">Your month</p>
                <span className="text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full bg-surface-container dark:bg-zinc-900 text-on-surface-variant border border-outline-variant/30 dark:border-zinc-800">
                  Contract: 99.9% uptime
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
                {Array.from({ length: DAYS }).map((_, i) => (
                  <Cell key={i} p={p} i={i} />
                ))}
              </div>

              <div className="flex gap-5 mt-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Service up
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-error" /> Outage
                </span>
              </div>

              <motion.div style={{ opacity: footOpacity }} className="mt-5 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-secondary-container/20 dark:bg-zinc-900/60 border border-secondary/20 dark:border-emerald-950">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase text-secondary">Credit owed</p>
                  <p className="font-headline font-bold text-xl sm:text-2xl text-secondary">$25</p>
                </div>
                <div className="p-3 rounded-2xl bg-error-container/40 dark:bg-zinc-900/60 border border-error/20 dark:border-red-950">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase text-error">Credit claimed</p>
                  <p className="font-headline font-bold text-xl sm:text-2xl text-error">$0</p>
                </div>
              </motion.div>

              {/* the stamp */}
              <motion.div
                style={{ opacity: stampOpacity, scale: stampScale, rotate: -8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-2xl border-4 border-error text-error font-headline font-black text-2xl sm:text-4xl tracking-widest bg-surface-container-lowest/95 dark:bg-black/95 backdrop-blur-md shadow-2xl">
                  UNCLAIMED
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "motion/react";

type P = MotionValue<number>;

const DAYS = 30;
const breaches = [5, 6, 13, 19, 20]; // which days have an outage

function Cell({ p, i }: { p: P; i: number }) {
  const k = breaches.indexOf(i);
  const appear = i * 0.004;
  const opacity = useTransform(p, [appear, appear + 0.05], [0, 1]);
  // outage days turn from green to red one after another
  const start = 0.18 + Math.max(k, 0) * 0.1;
  const bg = useTransform(p, [start, start + 0.05], ["#bff3cf", k >= 0 ? "#ba1a1a" : "#bff3cf"]);
  return <motion.div style={{ opacity, backgroundColor: bg }} className="aspect-square rounded-lg" />;
}

export default function Problem() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const up = useTransform(p, [0.18, 0.63], [99.9, 97]);
  const upText = useTransform(up, (v) => `${v.toFixed(1)}%`);

  const stampOpacity = useTransform(p, [0.7, 0.78], [0, 1]);
  const stampScale = useTransform(p, [0.7, 0.78], [1.7, 1]);
  const footOpacity = useTransform(p, [0.72, 0.8], [0, 1]);

  return (
    <section ref={ref} className="h-[300vh] relative">
      <div className="sticky top-0 h-screen pt-20 flex items-center overflow-hidden">
        <div className="w-full max-w-[1280px] mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* left : the message */}
          <div>
            <p className="text-sm font-bold uppercase text-secondary mb-4">The problem</p>
            <h2 className="font-headline font-bold text-4xl md:text-6xl tracking-tight text-primary leading-[1.1]">
              You pay for 99.9%.
              <br />
              You get <motion.span className="text-error">{upText}</motion.span>
            </h2>
            <p className="mt-6 text-lg text-on-surface-variant max-w-md">
              Outages happen, and the contract says you are owed a credit. But claiming it means
              tickets, logs and weeks of waiting, so credits often go unclaimed.
            </p>
          </div>

          {/* right : glass card with the month grid */}
          <div className="relative">
            <div className="absolute -top-10 -left-10 w-56 h-56 rounded-full bg-secondary-container/60 blur-3xl" />
            <div className="absolute -bottom-10 -right-6 w-64 h-64 rounded-full bg-primary-container/25 blur-3xl" />

            <div className="relative rounded-3xl border border-white/70 bg-white/50 backdrop-blur-xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-headline font-bold text-primary">Your month</p>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-container text-on-surface-variant">
                  Contract: 99.9% uptime
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: DAYS }).map((_, i) => (
                  <Cell key={i} p={p} i={i} />
                ))}
              </div>

              <div className="flex gap-5 mt-4 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#bff3cf]" /> Service up
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-error" /> Outage
                </span>
              </div>

              <motion.div style={{ opacity: footOpacity }} className="mt-5 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-secondary-container/40">
                  <p className="text-[11px] font-bold uppercase text-secondary">Credit owed</p>
                  <p className="font-headline font-bold text-2xl text-secondary">$25</p>
                </div>
                <div className="p-3 rounded-2xl bg-error-container/60">
                  <p className="text-[11px] font-bold uppercase text-error">Credit claimed</p>
                  <p className="font-headline font-bold text-2xl text-error">$0</p>
                </div>
              </motion.div>

              {/* the stamp */}
              <motion.div
                style={{ opacity: stampOpacity, scale: stampScale, rotate: -8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="px-6 py-3 rounded-xl border-4 border-error text-error font-headline font-bold text-3xl tracking-widest bg-white/70 backdrop-blur-sm">
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
"use client";
import Link from "next/link";
import { motion } from "motion/react";

const steps = [
  { n: "01", t: "Understand", d: "AI reads the SLA and extracts every promise." },
  { n: "02", t: "Verify", d: "Live monitoring proves what actually happened." },
  { n: "03", t: "Settle", d: "A rules engine, not an LLM, calculates the money." },
];

export default function Finale() {
  return (
    <section className="py-32 px-6 max-w-[1280px] mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="p-8 rounded-3xl bg-surface-container-lowest shadow-sm"
          >
            <p className="font-headline font-bold text-secondary text-sm mb-4">{s.n}</p>
            <h3 className="font-headline font-bold text-3xl text-primary mb-3">{s.t}</h3>
            <p className="text-on-surface-variant">{s.d}</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-32">
        <h2 className="font-headline font-bold text-5xl md:text-6xl text-primary mb-8">
          See it live.
        </h2>
        <Link
          href="/dashboard"
          className="inline-block px-8 py-4 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors"
        >
          Open dashboard
        </Link>
      </div>
    </section>
  );
}
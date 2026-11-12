"use client";
import { motion } from "motion/react";

const steps = [
  { t: "Buy", d: "The buyer agent buys a service with an SLA. The payment is authorized on PayPal, not captured." },
  { t: "Understand", d: "AI extracts the measurable promises from the SLA PDF as structured data." },
  { t: "Monitor", d: "Uptime, latency and incident data stream in and are checked against the contract." },
  { t: "Settle", d: "The rules engine calculates the outcome. Met means full capture, breached means partial." },
  { t: "Policy gate", d: "Act automatically, ask a human for approval, or block the payment." },
  { t: "Audit", d: "Every amount links to its clause, metric, calculation, reviewer and PayPal transaction ID." },
];

export default function Pipeline() {
  return (
    <section id="how" className="py-20 sm:py-32 px-4 sm:px-6 bg-surface-container-low/60 scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary mb-2 sm:mb-3">How it works</p>
        <h2 className="font-headline font-bold text-3xl sm:text-5xl text-primary tracking-tight mb-12 sm:mb-16">
          Six steps, from contract to cash.
        </h2>

        <div className="relative">
          <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-px bg-outline-variant/60" />
          {steps.map((s, i) => (
            <motion.div
              key={s.t}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative pl-12 sm:pl-16 pb-10 sm:pb-12 last:pb-0"
            >
              <div className="absolute left-0 top-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-on-primary font-headline font-bold text-sm sm:text-base flex items-center justify-center shadow-md">
                {i + 1}
              </div>
              <h3 className="font-headline font-bold text-xl sm:text-2xl text-primary mb-1">{s.t}</h3>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
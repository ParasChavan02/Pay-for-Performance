"use client";
import { motion } from "motion/react";
import { FileText, Activity, Calculator, ShieldCheck, CreditCard, ScrollText } from "lucide-react";

const features = [
  { icon: FileText, title: "AI reads the contract", desc: "Upload an SLA PDF. Uptime, latency and credit rules come out as structured data." },
  { icon: Activity, title: "Live monitoring", desc: "Uptime and latency stream in, and every breach is flagged against the promise." },
  { icon: Calculator, title: "Rules engine, not an LLM", desc: "Credits come from deterministic math that you can test and trust." },
  { icon: ShieldCheck, title: "Policy gate", desc: "Auto-approve, ask a human, or block. Risky payouts never move alone." },
  { icon: CreditCard, title: "PayPal settlement", desc: "Authorize first, then capture only what the vendor actually earned." },
  { icon: ScrollText, title: "Evidence audit trail", desc: "Every dollar links to its clause, metric, calculation, reviewer and transaction." },
];

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-32 px-4 sm:px-6 max-w-[1280px] mx-auto scroll-mt-20">
      <div className="max-w-2xl mb-12 sm:mb-16">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary mb-2 sm:mb-3">Features</p>
        <h2 className="font-headline font-bold text-3xl sm:text-5xl text-primary tracking-tight">
          Everything between a promise and a payment.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 3) * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm hover:border-outline-variant transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary-container/20 text-secondary flex items-center justify-center mb-5 sm:mb-6">
                <Icon size={24} />
              </div>
              <h3 className="font-headline font-bold text-xl sm:text-2xl text-primary mb-2">{f.title}</h3>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
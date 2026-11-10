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
    <section id="features" className="py-32 px-6 max-w-[1280px] mx-auto scroll-mt-20">
      <div className="max-w-2xl mb-16">
        <p className="text-sm font-bold uppercase text-secondary mb-3">Features</p>
        <h2 className="font-headline font-bold text-5xl text-primary tracking-tight">
          Everything between a promise and a payment.
        </h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: (i % 3) * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="p-8 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 text-secondary flex items-center justify-center mb-6">
                <Icon size={24} />
              </div>
              <h3 className="font-headline font-bold text-2xl text-primary mb-2">{f.title}</h3>
              <p className="text-on-surface-variant leading-relaxed">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
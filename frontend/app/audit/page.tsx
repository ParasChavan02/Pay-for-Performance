"use client";
import { motion } from "motion/react";
import { mockAuditEvents, mockSettlement } from "@/lib/mock";
import { toNumber, formatMoney } from "@/lib/money";

export default function AuditPage() {
  const s = mockSettlement;
  const cur = s.currency;

  return (
    <main className="pt-28 pb-24 px-6 max-w-3xl mx-auto">
      <h1 className="font-headline font-bold text-4xl text-primary">Audit trail</h1>
      <p className="text-on-surface-variant mt-1 mb-8">
        Payment {s.paymentId}: {formatMoney(toNumber(s.authorizedAmount), cur)} authorized,{" "}
        {formatMoney(toNumber(s.totalCredit), cur)} credited, {formatMoney(toNumber(s.finalPayableAmount), cur)} captured.
      </p>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant" />
        {mockAuditEvents.map((e, i) => (
          <motion.div
            key={e.title}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative pl-16 pb-8 last:pb-0"
          >
            <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-primary text-on-primary font-headline font-bold flex items-center justify-center">
              {i + 1}
            </div>
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container">
              <span className="text-[11px] font-bold uppercase text-secondary">{e.tag}</span>
              <h3 className="font-headline font-bold text-xl text-primary mt-1">{e.title}</h3>
              <p className="text-on-surface-variant mt-1">{e.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
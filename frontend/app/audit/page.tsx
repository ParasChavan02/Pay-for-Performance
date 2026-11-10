"use client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { mockAuditEvents, mockSettlement } from "@/lib/mock";
import { toNumber, formatMoney } from "@/lib/money";
import { api } from "@/lib/api";

interface AuditLogItem {
  id?: string;
  _id?: string;
  action: string;
  entityType?: string;
  description: string;
  actorId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export default function AuditPage() {
  const [s, setS] = useState(mockSettlement);
  const [logs, setLogs] = useState<
    Array<{ tag: string; title: string; detail: string; time?: string }>
  >(mockAuditEvents);
  const [live, setLive] = useState(false);

  useEffect(() => {
    // 1. Fetch live settlement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api<any>("/api/settlements")
      .then((d) => {
        const first = Array.isArray(d)
          ? d[0]
          : d?.data?.[0] ?? d?.settlements?.[0] ?? d;
        if (first && first.authorizedAmount !== undefined) {
          setS(first);
        }
      })
      .catch((e) => console.warn("Settlement fetch error:", e.message));

    // 2. Fetch live audit trail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api<any>("/api/audit")
      .then((d) => {
        const rawLogs: AuditLogItem[] = Array.isArray(d)
          ? d
          : d?.data ?? d?.items ?? [];
        if (rawLogs && rawLogs.length > 0) {
          const mapped = rawLogs.map((l) => ({
            tag: l.action.replace(/_/g, " "),
            title: l.description || l.action,
            detail: `Actor: ${l.actorId || "SYSTEM"} • ${new Date(
              l.timestamp
            ).toLocaleTimeString()} • ${
              l.metadata ? JSON.stringify(l.metadata) : ""
            }`,
            time: new Date(l.timestamp).toLocaleTimeString(),
          }));
          setLogs(mapped);
          setLive(true);
        }
      })
      .catch((e) => console.warn("Audit logs fetch fallback to mock:", e.message));
  }, []);

  const cur = s.currency || "USD";

  return (
    <main className="pt-28 pb-24 px-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-headline font-bold text-4xl text-primary">Audit trail</h1>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            live
              ? "bg-secondary-container text-secondary"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {live ? "● Live Ledger" : "○ Demo Ledger"}
        </span>
      </div>
      <p className="text-on-surface-variant mt-1 mb-8">
        Payment {s.paymentId}: {formatMoney(toNumber(s.authorizedAmount), cur)}{" "}
        authorized, {formatMoney(toNumber(s.totalCredit), cur)} credited,{" "}
        {formatMoney(toNumber(s.finalPayableAmount), cur)} captured.
      </p>

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant" />
        {logs.map((e, i) => (
          <motion.div
            key={i}
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
              <span className="text-[11px] font-bold uppercase text-secondary">
                {e.tag}
              </span>
              <h3 className="font-headline font-bold text-xl text-primary mt-1">
                {e.title}
              </h3>
              <p className="text-on-surface-variant mt-1 text-sm">{e.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}

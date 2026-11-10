"use client";
import { useState, useRef, useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import UptimeChart from "@/components/UptimeChart";
import ApprovalCard from "@/components/ApprovalCard";
import { mockSettlement, mockUptimeSeries } from "@/lib/mock";
import { toNumber, formatMoney } from "@/lib/money";
import { api } from "@/lib/api";

const START_POINTS = 2; // healthy points shown before the outage

export default function Dashboard() {
  const [s, setS] = useState(mockSettlement);
  const [live, setLive] = useState(false);

  // fetch real settlement from backend, fall back to mock if it fails
  const fetchSettlement = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api<any>("/api/settlements")
      .then((d) => {
        console.log("backend settlements:", d);
        const first = Array.isArray(d)
          ? d[0]
          : d?.data?.[0] ?? d?.settlements?.[0] ?? d?.items?.[0] ?? d;
        if (
          first &&
          first.authorizedAmount !== undefined &&
          first.calculationBreakdown?.length
        ) {
          setS(first);
          setLive(true);
        }
      })
      .catch((e) => console.error("backend fetch failed:", e.message));
  };

  useEffect(() => {
    fetchSettlement();
  }, []);

  const cur = s.currency;
  const target = s.calculationBreakdown[0].contractualThreshold;

  const [shown, setShown] = useState(START_POINTS);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const data = mockUptimeSeries.slice(0, shown);
  const breached = data.some((p) => p.uptime < target);
  const settled = shown >= mockUptimeSeries.length;

  const simulate = () => {
    setShown(START_POINTS);
    setRunId((r) => r + 1);
    setRunning(true);
    let n = START_POINTS;
    timer.current = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= mockUptimeSeries.length) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
      }
    }, 900);
  };

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    setShown(START_POINTS);
    setRunId((r) => r + 1);
  };

  // clean up the timer if we leave the page
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const status = settled ? s.status : breached ? "Breach detected" : "Healthy";

  const stats = [
    { label: "Authorized on PayPal", value: formatMoney(toNumber(s.authorizedAmount), cur), tone: "text-primary" },
    { label: "SLA credit", value: settled ? formatMoney(toNumber(s.totalCredit), cur) : "—", tone: "text-secondary" },
    { label: "To capture", value: settled ? formatMoney(toNumber(s.finalPayableAmount), cur) : "—", tone: "text-primary" },
    { label: "Status", value: status, tone: breached ? "text-error" : "text-secondary" },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-700 ${breached ? "bg-error-container/40" : ""}`}>
      <main className="pt-28 pb-24 px-6 max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-4xl text-primary">Control center</h1>
            <p className="text-on-surface-variant mt-1">
              Payment {s.paymentId}{" "}
              <span className={`ml-2 text-xs font-bold ${live ? "text-secondary" : "text-on-surface-variant"}`}>
                {live ? "● live backend data" : "○ demo data"}
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            {shown > START_POINTS && !running && (
              <button onClick={reset} className="flex items-center gap-2 px-5 py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors">
                <RotateCcw size={16} /> Reset
              </button>
            )}
            <button
              onClick={simulate}
              disabled={running}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-error text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <AlertTriangle size={18} />
              {running ? "Outage in progress…" : "Simulate outage"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((st) => (
            <div key={st.label} className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container">
              <p className="text-[11px] font-bold uppercase text-on-surface-variant mb-1">{st.label}</p>
              <p className={`font-headline font-bold text-2xl ${st.tone}`}>{st.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <UptimeChart data={data} target={target} />
          </div>
          <div className="lg:col-span-2">
            {settled ? (
              <ApprovalCard key={runId} settlement={s} onApproved={fetchSettlement} />
            ) : (
              <div className="rounded-3xl bg-surface-container-lowest border border-surface-container p-6 h-full flex flex-col justify-center">
                <h3 className="font-headline font-bold text-lg text-primary mb-1">Payment approval</h3>
                <p className="text-sm text-on-surface-variant">
                  {breached
                    ? "Calculating the credit from the SLA clause…"
                    : "Service is healthy. Nothing to approve."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
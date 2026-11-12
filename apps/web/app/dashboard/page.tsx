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
    <div className={`min-h-screen transition-colors duration-700 ${breached ? "bg-error-container/20 dark:bg-error-container/10" : ""}`}>
      <main className="pt-24 sm:pt-28 pb-24 px-4 sm:px-6 max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-3xl sm:text-4xl text-primary">Control center</h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-1 flex items-center flex-wrap gap-2">
              <span>Payment {s.paymentId}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${live ? "bg-secondary-container/30 text-secondary" : "bg-surface-container text-on-surface-variant"}`}>
                {live ? "● live backend data" : "○ demo data"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {shown > START_POINTS && !running && (
              <button
                onClick={reset}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors text-sm sm:text-base"
              >
                <RotateCcw size={16} /> Reset
              </button>
            )}
            <button
              onClick={simulate}
              disabled={running}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-error text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md text-sm sm:text-base"
            >
              <AlertTriangle size={18} />
              {running ? "Outage in progress…" : "Simulate outage"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((st) => (
            <div key={st.label} className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{st.label}</p>
              <p className={`font-headline font-bold text-lg sm:text-2xl truncate ${st.tone}`}>{st.value}</p>
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
import Navbar from "@/components/Navbar";
import UptimeChart from "@/components/UptimeChart";
import ApprovalCard from "@/components/ApprovalCard";
import { mockSettlement, mockUptimeSeries } from "@/lib/mock";
import { toNumber, formatMoney } from "@/lib/money";

export default function Dashboard() {
  const s = mockSettlement;
  const cur = s.currency;
  const breach = s.calculationBreakdown[0];

  const stats = [
    { label: "Authorized on PayPal", value: formatMoney(toNumber(s.authorizedAmount), cur), tone: "text-primary" },
    { label: "SLA credit", value: formatMoney(toNumber(s.totalCredit), cur), tone: "text-secondary" },
    { label: "To capture", value: formatMoney(toNumber(s.finalPayableAmount), cur), tone: "text-primary" },
    { label: "Status", value: s.status, tone: "text-error" },
  ];

  return (
    <>
      <Navbar />
      <main className="pt-28 pb-24 px-6 max-w-[1280px] mx-auto space-y-6">
        <div>
          <h1 className="font-headline font-bold text-4xl text-primary">Control center</h1>
          <p className="text-on-surface-variant mt-1">Payment {s.paymentId}</p>
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
            <UptimeChart data={mockUptimeSeries} target={breach.contractualThreshold} />
          </div>
          <div className="lg:col-span-2">
            <ApprovalCard settlement={s} />
          </div>
        </div>
      </main>
    </>
  );
}
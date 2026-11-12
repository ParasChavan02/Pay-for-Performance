"use client";
import { useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { ColDef } from "ag-grid-community";
import { mockTransactions } from "@/lib/mock";
import { api } from "@/lib/api";

ModuleRegistry.registerModules([AllCommunityModule]);

const columns: ColDef[] = [
  { field: "id", headerName: "Transaction ID", flex: 1.6 },
  { field: "type", headerName: "Type", flex: 1 },
  {
    field: "amount",
    headerName: "Amount",
    flex: 1,
    valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
  },
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    cellStyle: (p) => ({
      fontWeight: 700,
      color:
        p.value === "Completed"
          ? "#006d37"
          : p.value === "Held"
          ? "#00457c"
          : "#727781",
    }),
  },
  { field: "time", headerName: "Time", flex: 0.9 },
  { field: "ref", headerName: "Linked to", flex: 1.2 },
];

export default function TransactionsPage() {
  const [rows, setRows] = useState(mockTransactions);
  const [live, setLive] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api<any>("/api/transactions")
      .then((d) => {
        const txs = Array.isArray(d) ? d : d?.data ?? d?.items ?? [];
        if (txs && txs.length > 0) {
          const mapped = txs.map((tx: any) => ({
            id: tx.transactionId || tx.id || tx.orderId || tx.captureId,
            type: tx.type || (tx.captureId ? "Capture" : "Authorization"),
            amount: Number(
              tx.amount?.$numberDecimal ||
                tx.amount?.value ||
                tx.amount ||
                tx.capturedAmount ||
                75
            ),
            status: tx.status === "COMPLETED" || tx.status === "Paid" ? "Completed" : "Held",
            time: new Date(tx.createdAt || tx.timestamp || Date.now()).toLocaleTimeString(),
            ref: tx.paymentId || tx.orderId || "Payment hold",
          }));
          setRows(mapped);
          setLive(true);
        }
      })
      .catch((e) => console.warn("Live transactions fetch fallback:", e.message));
  }, []);

  return (
    <main className="pt-24 sm:pt-28 pb-24 px-4 sm:px-6 max-w-[1280px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <h1 className="font-headline font-bold text-3xl sm:text-4xl text-primary">Transactions</h1>
        <div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              live
                ? "bg-secondary-container/30 text-secondary border border-secondary/30"
                : "bg-surface-container text-on-surface-variant border border-outline-variant/30"
            }`}
          >
            {live ? "● Live PayPal Ledger" : "○ Demo Ledger"}
          </span>
        </div>
      </div>
      <p className="text-sm sm:text-base text-on-surface-variant mt-1 mb-6 sm:mb-8">
        Every PayPal action and ledger entry for SLA settlements.
      </p>
      <div
        style={{ height: 420, width: "100%" }}
        className="rounded-2xl sm:rounded-3xl overflow-hidden border border-outline-variant/40 shadow-sm"
      >
        <AgGridReact rowData={rows} columnDefs={columns} />
      </div>
    </main>
  );
}

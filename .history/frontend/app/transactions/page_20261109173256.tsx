"use client";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { ColDef } from "ag-grid-community";
import { mockTransactions } from "@/lib/mock";

ModuleRegistry.registerModules([AllCommunityModule]);

const columns: ColDef[] = [
  { field: "id", headerName: "Transaction ID", flex: 1.6 },
  { field: "type", headerName: "Type", flex: 1 },
  { field: "amount", headerName: "Amount", flex: 1, valueFormatter: (p) => `$${Number(p.value).toFixed(2)}` },
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    cellStyle: (p) => ({
      fontWeight: 700,
      color: p.value === "Completed" ? "#006d37" : p.value === "Held" ? "#00457c" : "#727781",
    }),
  },
  { field: "time", headerName: "Time", flex: 0.7 },
  { field: "ref", headerName: "Linked to", flex: 1.2 },
];

export default function TransactionsPage() {
  return (
    <main className="pt-28 pb-24 px-6 max-w-[1280px] mx-auto">
      <h1 className="font-headline font-bold text-4xl text-primary">Transactions</h1>
      <p className="text-on-surface-variant mt-1 mb-8">Every PayPal action for this settlement.</p>
      <div style={{ height: 360, width: "100%" }} className="rounded-3xl overflow-hidden border border-surface-container">
        <AgGridReact rowData={mockTransactions} columnDefs={columns} />
      </div>
    </main>
  );
}
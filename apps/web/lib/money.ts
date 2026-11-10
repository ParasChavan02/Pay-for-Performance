import type { Money } from "./types";

// turns { $numberDecimal: "75.00" } or "75.00" into 75
export function toNumber(m: Money): number {
  return Number(typeof m === "string" ? m : m.$numberDecimal);
}

// 75 -> "$75.00"
export function formatMoney(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

interface Point { t: string; uptime: number }

export default function UptimeChart({ data, target }: { data: Point[]; target: number }) {
  return (
    <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/40 p-4 sm:p-6 shadow-sm h-72 sm:h-80">
      <h3 className="font-headline font-bold text-base sm:text-lg text-primary mb-3 sm:mb-4">Live uptime</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis dataKey="t" stroke="var(--color-outline)" fontSize={11} tickLine={false} />
          <YAxis domain={[96, 100.5]} stroke="var(--color-outline)" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-container-lowest)",
              borderColor: "var(--color-outline-variant)",
              borderRadius: "12px",
              color: "var(--color-on-surface)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          />
          <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="4 4"
            label={{ value: `SLA ${target}%`, fill: "#ef4444", fontSize: 11 }} />
          <Line dataKey="uptime" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-primary)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

interface Point { t: string; uptime: number }

export default function UptimeChart({ data, target }: { data: Point[]; target: number }) {
  return (
    <div className="rounded-3xl bg-surface-container-lowest border border-surface-container p-6 shadow-sm h-80">
      <h3 className="font-headline font-bold text-lg text-primary mb-4">Live uptime</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis dataKey="t" stroke="#727781" fontSize={12} />
          <YAxis domain={[96, 100.5]} stroke="#727781" fontSize={12} />
          <Tooltip />
          <ReferenceLine y={target} stroke="#ba1a1a" strokeDasharray="4 4"
            label={{ value: `SLA ${target}%`, fill: "#ba1a1a", fontSize: 12 }} />
          <Line dataKey="uptime" stroke="#00457c" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
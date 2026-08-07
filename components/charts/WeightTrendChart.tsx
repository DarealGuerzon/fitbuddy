"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function WeightTrendChart({
  data,
  targetWeightKg,
}: {
  data: { date: string; weight_kg: number }[];
  targetWeightKg: number | null;
}) {
  const chartData = data.map((d) => ({ ...d, target: targetWeightKg }));

  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">Weight vs. target</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="weight_kg" stroke="var(--acc)" dot={false} strokeWidth={2} />
          {targetWeightKg != null && (
            <Line type="monotone" dataKey="target" stroke="var(--faint)" dot={false} strokeDasharray="4 4" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

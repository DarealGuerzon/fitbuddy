"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ConditioningTrendChart({
  data,
  modality,
  metricType,
}: {
  data: { date: string; value: number }[];
  modality: string;
  metricType: string;
}) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">
        {modality.replace("_", " ")} — {metricType}
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="value" stroke="var(--acc)" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

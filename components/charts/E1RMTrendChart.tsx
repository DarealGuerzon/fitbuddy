"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function E1RMTrendChart({
  data,
  exerciseName,
}: {
  data: { date: string; e1rm: number }[];
  exerciseName: string;
}) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">{exerciseName} — est. 1RM</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Line type="monotone" dataKey="e1rm" stroke="var(--acc)" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

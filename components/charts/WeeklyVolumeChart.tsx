"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function WeeklyVolumeChart({ data }: { data: { weekStart: string; volume: number }[] }) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4">
      <h2 className="font-medium mb-3">Weekly volume (reps x kg)</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="weekStart" stroke="var(--dim)" fontSize={12} />
          <YAxis stroke="var(--dim)" fontSize={12} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }} />
          <Bar dataKey="volume" fill="var(--acc)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

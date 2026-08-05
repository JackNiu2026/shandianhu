"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

interface TrendChartProps {
  data: { month: string; orders: number }[];
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#FFBE98"
          strokeWidth={2}
          dot={{ fill: "#FFBE98", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

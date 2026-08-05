"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface TrendChartProps {
  data: { month: string; orders: number }[];
}

/**
 * 月度预约趋势折线图
 * - 线条色 #967AE9，点色 #967AE9
 * - 自定义 Tooltip：border-2 border-ink rounded-lg shadow-nb bg-surface-paper
 */
export default function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#756E69" }}
          axisLine={{ stroke: "#151617" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#756E69" }}
          axisLine={{ stroke: "#151617" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            border: "2px solid #151617",
            borderRadius: "12px",
            boxShadow: "4px 4px 0px 0px #151617",
            background: "#FFFCF9",
            fontSize: "13px",
            fontWeight: 600,
          }}
          labelStyle={{ color: "#151617", fontWeight: 700 }}
          itemStyle={{ color: "#151617" }}
          formatter={(value: number) => [`${value} 单`, "预约数"]}
        />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#967AE9"
          strokeWidth={3}
          dot={{ fill: "#967AE9", r: 4 }}
          activeDot={{ r: 6, fill: "#967AE9", stroke: "#FFFCF9", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

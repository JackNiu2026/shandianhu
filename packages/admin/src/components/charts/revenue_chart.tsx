"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

/**
 * 月度收益柱状图
 * - 柱体色 #FFBE98，圆角顶部
 * - 自定义 Tooltip：border-2 border-ink rounded-lg shadow-nb bg-surface-paper
 */
export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
          tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
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
          formatter={(value: number) => [`¥${value.toLocaleString("zh-CN")}`, "收益"]}
        />
        <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#FFBE98" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

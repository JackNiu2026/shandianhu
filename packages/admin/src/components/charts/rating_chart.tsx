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

export interface RatingChartProps {
  data: { name: string; count: number }[];
}

/**
 * 评分分布柱状图
 * - 柱体色 #967AE9
 */
export default function RatingChart({ data }: RatingChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
        barSize={48}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: "#756E69" }}
          axisLine={{ stroke: "#151617" }}
          tickLine={false}
          tickFormatter={(v: string) => `${v}⭐`}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#756E69" }}
          axisLine={{ stroke: "#151617" }}
          tickLine={false}
          allowDecimals={false}
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
          formatter={(value: number) => [`${value} 位老师`, "评分人数"]}
          labelFormatter={(label: string) => `评分 ${label}`}
        />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#967AE9" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

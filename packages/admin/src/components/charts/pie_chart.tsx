"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface PieChartProps {
  data: { name: string; count: number }[];
}

const COLORS = ["#967AE9", "#FFBE98", "#4ECB71", "#D7A820", "#EF4444"];

/**
 * 科目分布饼图
 * - 颜色：["#967AE9", "#FFBE98", "#4ECB71", "#D7A820", "#EF4444"]
 * - 图例在右侧
 */
export default function PieChart({ data }: PieChartProps) {
  const chartData = data.filter((d) => d.count > 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsPieChart>
        <Pie
          data={chartData}
          cx="40%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="count"
          stroke="#151617"
          strokeWidth={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
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
          formatter={(value: number, name: string) => [`${value} 位老师`, name]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ fontSize: "13px", fontWeight: 600, color: "#151617" }}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

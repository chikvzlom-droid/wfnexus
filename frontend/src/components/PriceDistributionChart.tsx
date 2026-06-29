import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { OrderDistribution } from "../lib/api";

export default function PriceDistributionChart({ data }: { data: OrderDistribution }) {
  if (!data.buckets.length) {
    return <p className="text-gray-400 text-sm">No sell orders for distribution</p>;
  }

  const chartData = data.buckets.map((b) => ({
    range: `${b.range_start.toFixed(0)}-${b.range_end.toFixed(0)}`,
    mid: Math.round((b.range_start + b.range_end) / 2),
    count: b.count,
  }));

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">
        {data.sell_count} sell orders &middot; avg {data.avg_price?.toFixed(1)}p &middot; median {data.median_price?.toFixed(1)}p
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="mid" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v) => `${v}p`} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#F3F4F6" }}
            formatter={(value: number) => [value, "Orders"]}
            labelFormatter={(label: string) => `~${label}p`}
          />
          <Bar dataKey="count" fill="#10B981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

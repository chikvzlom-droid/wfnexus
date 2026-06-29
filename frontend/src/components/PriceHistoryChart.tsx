import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { PriceHistory } from "../lib/api";

export default function PriceHistoryChart({ data }: { data: PriceHistory }) {
  if (!data.points.length) {
    return (
      <p className="text-gray-400 text-sm">
        No history yet. Data is collected every 30 minutes for watched items.
      </p>
    );
  }

  const chartData = data.points.map((p) => ({
    time: new Date(p.recorded_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price: p.oracle_price,
    min: p.min_price,
    max: p.max_price,
    samples: p.sample_size,
  }));

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{data.points.length} data points</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#9CA3AF", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v) => `${v}p`} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#F3F4F6" }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { price: "Oracle", min: "Min", max: "Max" };
              return [`${value.toFixed(1)}p`, labels[name] || name];
            }}
          />
          <Line type="monotone" dataKey="max" stroke="#EF4444" strokeWidth={1} dot={false} opacity={0.4} />
          <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="min" stroke="#3B82F6" strokeWidth={1} dot={false} opacity={0.4} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

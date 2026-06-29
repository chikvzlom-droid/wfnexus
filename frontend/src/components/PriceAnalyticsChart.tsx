import { useState } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area,
} from "recharts";
import type { PriceHistory } from "../lib/api";

type MetricKey = "oracle_price" | "median_price" | "avg_price" | "wa_price" | "moving_avg" | "min_price" | "max_price" | "open_price" | "closed_price";

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: "oracle_price", label: "Oracle", color: "#10B981" },
  { key: "median_price", label: "Median", color: "#F59E0B" },
  { key: "avg_price", label: "Avg", color: "#8B5CF6" },
  { key: "wa_price", label: "WA", color: "#EC4899" },
  { key: "moving_avg", label: `SMA(12)`, color: "#06B6D4" },
  { key: "min_price", label: "Min", color: "#3B82F6" },
  { key: "max_price", label: "Max", color: "#EF4444" },
  { key: "open_price", label: "Open", color: "#84CC16" },
  { key: "closed_price", label: "Close", color: "#F97316" },
];

const DEFAULT_VISIBLE = ["oracle_price", "moving_avg", "min_price", "max_price"];

export default function PriceAnalyticsChart({ data }: { data: PriceHistory }) {
  const [visible, setVisible] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [showVolume, setShowVolume] = useState(false);
  const [showDonch, setShowDonch] = useState(false);

  if (!data.points.length) {
    return <p className="text-gray-400 text-sm">No history data yet.</p>;
  }

  const toggleMetric = (key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const chartData = data.points.map((p) => ({
    time: new Date(p.recorded_at).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
    oracle_price: p.oracle_price,
    min_price: p.min_price,
    max_price: p.max_price,
    open_price: p.open_price,
    closed_price: p.closed_price,
    avg_price: p.avg_price,
    wa_price: p.wa_price,
    median_price: p.median_price,
    moving_avg: p.moving_avg,
    donch_top: p.donch_top,
    donch_bot: p.donch_bot,
    volume: p.volume,
    supply: p.supply,
    demand: p.demand,
    sample_size: p.sample_size,
  }));

  const last = chartData[chartData.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                visible.has(m.key)
                  ? "bg-opacity-20 text-white"
                  : "bg-gray-800 text-gray-500 hover:text-gray-300"
              }`}
              style={visible.has(m.key) ? { backgroundColor: `${m.color}33`, color: m.color } : {}}
              onClick={() => toggleMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-[10px]">
          <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showVolume} onChange={() => setShowVolume((v) => !v)} className="accent-wf-primary" />
            Vol
          </label>
          <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showDonch} onChange={() => setShowDonch((v) => !v)} className="accent-wf-primary" />
            Donch
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#9CA3AF", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis yAxisId="price" tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v: number) => `${v}p`} domain={["auto", "auto"]} />
          {showVolume && (
            <YAxis yAxisId="vol" orientation="right" tick={{ fill: "#9CA3AF", fontSize: 9 }} domain={[0, "auto"]} hide />
          )}

          <Tooltip
            contentStyle={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12, maxHeight: 300, overflowY: "auto" }}
            labelStyle={{ color: "#F3F4F6", fontWeight: 600 }}
            formatter={(value: number, name: string) => {
              const m = METRICS.find((x) => x.key === name);
              const label = m?.label || name;
              if (name === "volume") return [value, "Volume"];
              if (name === "supply") return [value, "Supply"];
              if (name === "demand") return [value, "Demand"];
              if (name === "donch_top") return [`${value.toFixed(1)}p`, "Donch Top"];
              if (name === "donch_bot") return [`${value.toFixed(1)}p`, "Donch Bot"];
              return [`${value.toFixed(1)}p`, label];
            }}
          />

          {showDonch && (
            <>
              <Area yAxisId="price" type="monotone" dataKey="donch_top" stroke="#F59E0B" strokeWidth={1} fill="#F59E0B" fillOpacity={0.05} dot={false} />
              <Area yAxisId="price" type="monotone" dataKey="donch_bot" stroke="#F59E0B" strokeWidth={1} fill="#1F2937" fillOpacity={0.01} dot={false} />
            </>
          )}

          {showVolume && (
            <Bar yAxisId="vol" dataKey="volume" fill="#374151" opacity={0.5} barSize={4} />
          )}

          {METRICS.filter((m) => visible.has(m.key)).map((m) => (
            <Line
              key={m.key}
              yAxisId="price"
              type="monotone"
              dataKey={m.key}
              stroke={m.color}
              strokeWidth={m.key === "oracle_price" || m.key === "moving_avg" ? 2 : 1}
              dot={false}
              opacity={m.key === "oracle_price" ? 1 : 0.7}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
        <div className="bg-gray-800/50 rounded px-2 py-1">
          <span className="text-gray-500">Oracle</span>
          <p className="text-white font-medium">{last.oracle_price?.toFixed(1)}p</p>
        </div>
        <div className="bg-gray-800/50 rounded px-2 py-1">
          <span className="text-gray-500">SMA(12)</span>
          <p className="text-cyan-400 font-medium">{last.moving_avg?.toFixed(1)}p</p>
        </div>
        <div className="bg-gray-800/50 rounded px-2 py-1">
          <span className="text-gray-500">Vol / S/D</span>
          <p className="text-gray-300 font-medium">{last.volume} / {last.supply}/{last.demand}</p>
        </div>
        <div className="bg-gray-800/50 rounded px-2 py-1">
          <span className="text-gray-500">Donch</span>
          <p className="text-amber-400 font-medium">{last.donch_bot?.toFixed(0)}–{last.donch_top?.toFixed(0)}p</p>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, TrendingUp, TrendingDown, DollarSign, BarChart3, ShoppingCart, Activity, BadgePercent, PieChart, AreaChart } from "lucide-react";
import { AreaChart as RechartsArea, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { api } from "../lib/api";
import type { DashboardData, Transaction, Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const statCards = [
  { key: "total_profit", tKey: "dashboard.totalProfit", icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10", suffix: "p" },
  { key: "today_profit", tKey: "dashboard.today", icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10", suffix: "p" },
  { key: "total_transactions", tKey: "dashboard.trades", icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10", suffix: "" },
  { key: "total_revenue", tKey: "dashboard.revenue", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", suffix: "p" },
  { key: "total_expenses", tKey: "dashboard.expenses", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10", suffix: "p" },
] as const;

const COLORS = ["#22c55e", "#06b6d4", "#f59e0b", "#a855f7", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchItems(query);
      setResults(res.items);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const profitColor = (profit: number | null) => {
    if (profit === null || profit === undefined) return "text-gray-400";
    return profit >= 0 ? "text-green-400" : "text-red-400";
  };

  return (
    <div className="space-y-6">

      <div>
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">
          <span className="text-wf-primary">/</span> {t("dashboard.title", lang)}
        </h2>
        <p className="text-gray-500 text-sm mt-1">{t("dashboard.tradesOver14Days", lang)}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-800/50" />
          ))}
        </div>
      ) : data ? (
        <>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map(({ key, tKey, icon: Icon, color, bg, suffix }) => {
              const raw = data[key as keyof DashboardData] as number;
              return (
                <div key={key} className={`card border-t-2 ${key === "total_profit" ? "border-t-wf-gold" : "border-t-wf-primary/30"} ${bg}`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t(tKey, lang)}</p>
                    <div className="p-1.5 rounded-lg bg-white/5">
                      <Icon size={16} className={color} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>
                    {raw.toLocaleString()}{suffix ? ` ${suffix}` : ""}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <AreaChart size={16} className="text-wf-primary" />
                {t("dashboard.tradesOver14Days", lang)}
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsArea data={data.daily_profit}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                      labelFormatter={(v: string) => v}
                    />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#06b6d4" fill="url(#revenueGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#22c55e" fill="url(#profitGrad)" strokeWidth={2} />
                  </RechartsArea>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-wf-primary" />
                {t("dashboard.bestSeller", lang)}
              </h3>
              {data.best_seller_name ? (
                <div className="text-center py-4">
                  <p className="text-lg font-bold text-gray-100 truncate">{data.best_seller_name}</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">+{data.best_seller_profit}p</p>
                  <p className="text-sm text-gray-500 mt-1">{data.best_seller_count} {t("dashboard.items", lang)}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">{t("common.noData", lang)}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.categories.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <PieChart size={16} className="text-wf-primary" />
                  {t("dashboard.categoryBreakdown", lang)}
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={data.categories.map(c => ({ name: c.name, value: Math.abs(c.profit) }))}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {data.categories.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400">{cat.name}</span>
                      <span className={`font-medium ${cat.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {cat.profit >= 0 ? "+" : ""}{cat.profit}p
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.categories.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 size={16} className="text-wf-primary" />
                  Revenue / Expenses
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categories}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Activity size={16} className="text-wf-primary" />
                {t("dashboard.recentTrades", lang)}
              </h3>
              <button className="text-xs text-wf-primary hover:underline" onClick={() => navigate("/transactions")}>
                {t("common.next", lang)}
              </button>
            </div>
            {data.recent_transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">{t("dashboard.noData", lang)}</p>
            ) : (
              <div className="space-y-1">
                {data.recent_transactions.map((tx: Transaction) => (
                  <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.transaction_type === "sale" ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      {tx.transaction_type === "sale"
                        ? <TrendingUp size={14} className="text-green-400" />
                        : <TrendingDown size={14} className="text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate">{tx.item_name}</p>
                      <p className="text-xs text-gray-500">
                        {tx.user_name || "—"} &middot; {new Date(tx.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-100">{tx.price}p</p>
                      <p className={`text-xs font-medium ${profitColor(tx.profit)}`}>
                        {tx.profit !== null ? `${tx.profit >= 0 ? "+" : ""}${tx.profit}p` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-400 mb-2">{t("dashboard.noData", lang)}</p>
        </div>
      )}

      <div className="card">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="input pl-10"
              placeholder={t("items.searchPlaceholder", lang)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button className="btn-primary" onClick={handleSearch} disabled={searching}>
            {searching ? "..." : t("common.search", lang)}
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/items/${item.slug}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">
                    {item.category} {item.subcategory ? `/ ${item.subcategory}` : ""}
                  </p>
                </div>
                {item.ducats != null && (
                  <span className="text-xs bg-wf-gold/20 text-wf-gold px-2 py-1 rounded">
                    {item.ducats}d
                  </span>
                )}
                <button
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-wf-primary transition-colors"
                  title="Process Trade"
                  onClick={(e) => { e.stopPropagation(); navigate(`/process-trade?item=${item.slug}`); }}
                >
                  <BadgePercent size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

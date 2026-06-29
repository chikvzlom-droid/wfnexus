import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUp, ArrowDown, BarChart3, RefreshCw, Download, LineChart, Filter, X } from "lucide-react";
import { api } from "../lib/api";
import type { PriceAnalyticsItem, PriceHistory, SyncStatus } from "../lib/api";
import PriceAnalyticsChart from "../components/PriceAnalyticsChart";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const LIMIT = 25;

const COLUMNS: { key: string; labelKey: string; align?: string }[] = [
  { key: "item_name", labelKey: "marketAnalytics.name" },
  { key: "volume", labelKey: "marketAnalytics.volume", align: "text-right" },
  { key: "min_price", labelKey: "marketAnalytics.minPrice", align: "text-right" },
  { key: "max_price", labelKey: "marketAnalytics.maxPrice", align: "text-right" },
  { key: "open_price", labelKey: "marketAnalytics.openPrice", align: "text-right" },
  { key: "closed_price", labelKey: "marketAnalytics.closePrice", align: "text-right" },
  { key: "avg_price", labelKey: "marketAnalytics.avgPrice", align: "text-right" },
  { key: "wa_price", labelKey: "marketAnalytics.waPrice", align: "text-right" },
  { key: "median_price", labelKey: "marketAnalytics.median", align: "text-right" },
  { key: "moving_avg", labelKey: "marketAnalytics.movingAvg", align: "text-right" },
  { key: "donch_top", labelKey: "marketAnalytics.donchTop", align: "text-right" },
  { key: "donch_bot", labelKey: "marketAnalytics.donchBot", align: "text-right" },
  { key: "supply", labelKey: "marketAnalytics.supply", align: "text-right" },
  { key: "demand", labelKey: "marketAnalytics.demand", align: "text-right" },
  { key: "trading_tax", labelKey: "marketAnalytics.tradingTax", align: "text-right" },
];

const TAG_OPTIONS = ["mod", "prime", "set", "arcane_enhancement", "relic", "riven", "warframe", "pistol", "rifle", "shotgun", "melee"];

type MinMaxKey = "volume_gt" | "volume_lt" | "supply_gt" | "supply_lt" | "demand_gt" | "demand_lt" | "min_price_gt" | "min_price_lt" | "max_price_gt" | "max_price_lt";

const FILTER_FIELDS: { label: string; gt: MinMaxKey; lt: MinMaxKey }[] = [
  { label: "Volume", gt: "volume_gt", lt: "volume_lt" },
  { label: "Supply", gt: "supply_gt", lt: "supply_lt" },
  { label: "Demand", gt: "demand_gt", lt: "demand_lt" },
  { label: "Min Price", gt: "min_price_gt", lt: "min_price_lt" },
  { label: "Max Price", gt: "max_price_gt", lt: "max_price_lt" },
];

export default function MarketAnalyticsPage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [items, setItems] = useState<PriceAnalyticsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState("volume");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpened, setFilterOpened] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Record<string, PriceHistory>>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    api.getSyncStatus().then(setSyncStatus);
    const interval = setInterval(async () => {
      const s = await api.getSyncStatus();
      setSyncStatus(s);
      if (!s.running) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const buildParams = useCallback((p = page) => {
    const params: Record<string, any> = {
      page: p, limit: LIMIT,
      sort_by: sortBy, sort_order: sortOrder,
      q: searchQuery || undefined,
      tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    };
    for (const [key, val] of Object.entries(filters)) {
      if (val !== "") params[key] = Number(val);
    }
    return params;
  }, [page, sortBy, sortOrder, searchQuery, selectedTags, fromDate, toDate, filters]);

  const loadData = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const data = await api.getMarketAnalytics(buildParams(p) as any);
      setItems(data.results);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [buildParams, page]);

  const loadDataRef = useCallback(() => loadData(), [loadData]);

  useEffect(() => { loadDataRef(); }, [loadDataRef]);

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      await api.syncAllPrices();
    } catch { /* ignore */ }
    finally {
      setSyncing(false);
      setTimeout(() => loadData(), 1000);
    }
  };

  const toggleChart = async (slug: string, hasData: boolean) => {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      return;
    }
    setExpandedSlug(slug);
    if (!chartData[slug]) {
      try {
        const h = hasData
          ? await api.getPriceHistory(slug, 168)
          : await api.getLiveAnalytics(slug);
        setChartData((prev) => ({ ...prev, [slug]: h }));
      } catch { /* ignore */ }
    }
  };

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1);
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
    setFromDate("");
    setToDate("");
    setSelectedTags([]);
    setSearchQuery("");
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <span className="ml-1 opacity-20">↕</span>;
    return sortOrder === "asc"
      ? <ArrowUp size={12} className="ml-1 inline" />
      : <ArrowDown size={12} className="ml-1 inline" />;
  };

  const thClass = "py-2.5 px-1.5 font-medium cursor-pointer hover:text-white transition-colors select-none text-[11px]";
  const thAlign = (col: string) => COLUMNS.find((c) => c.key === col)?.align || "text-left";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("marketAnalytics.title", lang)}</h2>
        <div className="flex gap-2">
          <button className="btn-secondary p-2" onClick={loadDataRef} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5" onClick={handleSyncPrices} disabled={syncing}>
            <Download size={14} className={syncing ? "animate-bounce" : ""} />
            {syncing ? "Syncing..." : "Fetch from WFM"}
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className={`card px-4 py-2 ${syncStatus.running ? "border-l-2 border-yellow-500" : ""}`}>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-3">
              {syncStatus.running && (
                <span className="text-yellow-400 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  {syncStatus.total > 0 ? `Syncing ${syncStatus.done}/${syncStatus.total}` : "Preparing sync..."}
                </span>
              )}
              {syncStatus.running && syncStatus.total > 0 && (
                <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${(syncStatus.done / syncStatus.total) * 100}%` }} />
                </div>
              )}
              {syncStatus.items_with_snapshots > 0
                ? <span>{syncStatus.items_with_snapshots} items with data</span>
                : <span className="text-gray-500">No data yet — click "Fetch from WFM" or wait for auto-sync</span>}
              {syncStatus.last_full_sync && <span>Full: <time dateTime={syncStatus.last_full_sync}>{new Date(syncStatus.last_full_sync).toLocaleString()}</time></span>}
              {syncStatus.last_watchlist_sync && <span>Watchlist: <time dateTime={syncStatus.last_watchlist_sync}>{new Date(syncStatus.last_watchlist_sync).toLocaleString()}</time></span>}
            </div>
            {syncStatus.errors > 0 && <span className="text-red-400">{syncStatus.errors} errors</span>}
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="input pl-10"
              placeholder={t("marketAnalytics.searchPlaceholder", lang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); loadData(1); } }}
            />
          </div>
          <input type="date" className="input w-36 text-sm" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          <input type="date" className="input w-36 text-sm" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          <button
            className={`btn-secondary p-2 ${filterOpened ? "text-wf-primary" : ""}`}
            onClick={() => setFilterOpened((v) => !v)}
            title="Filters"
          >
            <Filter size={16} />
          </button>
        </div>

        {filterOpened && (
          <div className="grid grid-cols-5 gap-3 pt-2 pb-1">
            {FILTER_FIELDS.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{f.label}</span>
                <div className="flex gap-1 items-center">
                  <input
                    className="input w-full text-xs py-1"
                    placeholder="min"
                    value={filters[f.gt] || ""}
                    onChange={(e) => setFilter(f.gt, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); loadData(1); } }}
                  />
                  <span className="text-gray-600 text-xs">–</span>
                  <input
                    className="input w-full text-xs py-1"
                    placeholder="max"
                    value={filters[f.lt] || ""}
                    onChange={(e) => setFilter(f.lt, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); loadData(1); } }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-end pb-0.5">
              <button className="btn-secondary text-xs px-2 py-1" onClick={clearFilters}>
                <X size={12} className="inline mr-1" />Clear
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-wf-primary/20 text-wf-primary"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">{t("marketAnalytics.noData", lang)}</p>
            <p className="text-gray-500 text-xs mt-1">Click "Fetch from WFM" to load price data, or adjust filters above.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase tracking-wider">
                <th className={`${thClass} text-left sticky left-0 bg-wf-card z-10`}>
                  {t("marketAnalytics.name", lang)}
                </th>
                {COLUMNS.slice(1).map((col) => (
                  <th
                    key={col.key}
                    className={`${thClass} ${thAlign(col.key)}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {t(col.labelKey, lang)}
                    <SortIcon col={col.key} />
                  </th>
                ))}
                <th className="py-2.5 px-1.5 font-medium w-16 text-center">Chart</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isExpanded = expandedSlug === item.item_slug;
                return (
                  <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-2 px-1.5 sticky left-0 bg-wf-card z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                          {item.item_thumbnail ? <img src={item.item_thumbnail} alt="" className="w-full h-full object-contain" /> : "?"}
                        </div>
                        <span className="text-gray-100 font-medium truncate max-w-[140px]">{item.item_name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.volume}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.min_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.max_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.open_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.closed_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.avg_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.wa_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right font-medium text-white">{item.median_price?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.moving_avg?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-emerald-400">{item.donch_top?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-red-400">{item.donch_bot?.toFixed(1)}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.supply}</td>
                    <td className="py-2 px-1.5 text-right text-gray-300">{item.demand}</td>
                    <td className="py-2 px-1.5 text-right text-yellow-500">{item.trading_tax}</td>
                    <td className="py-2 px-1.5 text-center">
                      <button
                        className={`p-1 rounded transition-colors ${isExpanded ? "text-wf-primary bg-wf-primary/10" : "text-gray-400 hover:text-wf-primary hover:bg-gray-700"}`}
                        onClick={() => toggleChart(item.item_slug, item.volume > 0)}
                        title="Chart"
                      >
                        <BarChart3 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {expandedSlug && chartData[expandedSlug] && (
          <div className="border-t border-gray-700 pt-4 mt-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-sm font-medium text-gray-200">{expandedSlug}</span>
              <button
                className="text-[11px] text-wf-primary hover:underline"
                onClick={() => navigate(`/items/${expandedSlug}`)}
              >
                <LineChart size={12} className="inline mr-1" />Full detail
              </button>
            </div>
            <PriceAnalyticsChart data={chartData[expandedSlug]} />
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-800 mt-4">
            <p className="text-xs text-gray-500">{total} items</p>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                let pn: number;
                if (totalPages <= 10) pn = i + 1;
                else if (page <= 5) pn = i + 1;
                else if (page >= totalPages - 4) pn = totalPages - 9 + i;
                else pn = page - 5 + i;
                return (
                  <button
                    key={pn}
                    className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${
                      page === pn ? "bg-wf-primary/20 text-wf-primary" : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                    onClick={() => setPage(pn)}
                  >
                    {pn}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 text-center">
        Data collected every 30 min (watchlist) / 6h (all items). Click Chart per row to view OHLCV history.
      </p>
    </div>
  );
}

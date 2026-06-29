import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, DollarSign, Heart, Loader2, BarChart3, LineChart, BadgePercent, Activity } from "lucide-react";
import { api } from "../lib/api";
import type { Item, OraclePrice, OrderDistribution, PriceHistory } from "../lib/api";
import PriceDistributionChart from "../components/PriceDistributionChart";
import PriceAnalyticsChart from "../components/PriceAnalyticsChart";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

export default function ItemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [item, setItem] = useState<Item | null>(null);
  const [oracle, setOracle] = useState<OraclePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charts
  const [distribution, setDistribution] = useState<OrderDistribution | null>(null);
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [histFromDate, setHistFromDate] = useState("");
  const [histToDate, setHistToDate] = useState("");

  // Watchlist form
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!slug) return;
    try {
      const h = await api.getPriceHistory(slug, 168, histFromDate || undefined, histToDate || undefined);
      setHistory(h);
    } catch { /* ignore */ }
  }, [slug, histFromDate, histToDate]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getItem(slug),
      api.getOracle(slug),
      api.getOrderDistribution(slug).catch(() => null),
      api.getPriceHistory(slug).catch(() => null),
    ])
      .then(([itemData, oracleData, distData, histData]) => {
        setItem(itemData);
        setOracle(oracleData);
        setDistribution(distData);
        setHistory(histData);
        if (oracleData?.oracle_price != null) {
          setTargetPrice(String(Math.round(oracleData.oracle_price)));
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load item");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAddWatchlist = async () => {
    if (!item || !targetPrice) return;
    setAdding(true);
    setAddMsg(null);
    try {
      await api.addWatchlist({
        item_id: item.id,
        target_price: parseFloat(targetPrice),
        direction,
      });
      setAddMsg("Added!");
      setTimeout(() => setAddMsg(null), 2000);
    } catch (e: unknown) {
      setAddMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wf-primary"></div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">{error || t("items.noResults", lang)}</p>
        <Link to="/items" className="btn-secondary inline-block mt-4">
          {t("common.back", lang)}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/items" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        <ArrowLeft size={16} />
        {t("common.back", lang)}
      </Link>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-white">{item.name}</h2>
            <p className="text-sm text-gray-400">
              {item.category} {item.subcategory ? `/ ${item.subcategory}` : ""}
              {item.is_set ? " (Set)" : ""}
              {item.ducats != null && ` \u2022 ${item.ducats} Ducats`}
            </p>
          </div>
          <span className="text-xs text-gray-500">ID: {item.id}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-wf-primary mb-2">
            <DollarSign size={18} />
            <h3 className="font-semibold">Oracle Price</h3>
          </div>
          {oracle?.oracle_price != null ? (
            <div>
              <p className="text-3xl font-bold text-white">{oracle.oracle_price.toFixed(1)}p</p>
              <p className="text-xs text-gray-400 mt-1">
                Strategy: {oracle.strategy} | Confidence: {(oracle.confidence * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">Sample: {oracle.sample_size} orders</p>
            </div>
          ) : (
            <p className="text-gray-400">No data available</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-wf-gold mb-2">
            <TrendingUp size={18} />
            <h3 className="font-semibold">{t("items.addToWatchlist", lang)}</h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="Target price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-wf-primary"
              />
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "below" | "above")}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-wf-primary"
              >
                <option value="below">Below</option>
                <option value="above">Above</option>
              </select>
              <button
                onClick={handleAddWatchlist}
                disabled={adding || !targetPrice}
                className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />}
                {addMsg || t("common.add", lang)}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Get notified when price goes {direction} {targetPrice || "..."}p
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 text-wf-primary mb-3">
          <BarChart3 size={18} />
            <h3 className="font-semibold">{t("items.priceDistribution", lang)}</h3>
        </div>
        {distribution ? <PriceDistributionChart data={distribution} /> : <p className="text-gray-500 text-sm">Loading distribution...</p>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-wf-gold">
            <Activity size={18} />
            <h3 className="font-semibold">{t("items.priceHistory", lang)}</h3>
          </div>
          <div className="flex gap-2">
            <input type="date" className="input w-32 text-[11px] py-1" value={histFromDate} onChange={(e) => setHistFromDate(e.target.value)} />
            <input type="date" className="input w-32 text-[11px] py-1" value={histToDate} onChange={(e) => setHistToDate(e.target.value)} />
            <button className="btn-primary py-1 px-2 text-[11px]" onClick={loadHistory}>
              <LineChart size={12} className="inline mr-1" />Apply
            </button>
          </div>
        </div>
        {history ? <PriceAnalyticsChart data={history} /> : <p className="text-gray-500 text-sm">Loading history...</p>}
      </div>

      <div className="flex gap-2">
        <button className="btn-secondary text-sm flex items-center gap-1" onClick={() => navigate(`/process-trade?item=${slug}`)}>
          <BadgePercent size={14} /> {t("items.processTrade", lang)}
        </button>
        <button className="btn-secondary text-sm" onClick={() => navigate("/watchlist")}>
          {t("nav.watchlist", lang)}
        </button>
      </div>
    </div>
  );
}

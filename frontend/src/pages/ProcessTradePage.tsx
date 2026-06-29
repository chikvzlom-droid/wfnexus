import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Check, Loader2, Package } from "lucide-react";
import { api } from "../lib/api";
import type { Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

interface ProcessItem {
  item: Item;
  quantity: number;
  price: number;
  credits: number;
}

export default function ProcessTradePage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [searchParams] = useSearchParams();
  const [transactionType, setTransactionType] = useState<"sale" | "purchase">("sale");
  const [userName, setUserName] = useState("");
  const [items, setItems] = useState<ProcessItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const slug = searchParams.get("item");
    if (slug) {
      api.getItem(slug).then((item) => {
        if (!items.some((i) => i.item.id === item.id)) {
          setItems([{ item, quantity: 1, price: 0, credits: 0 }]);
        }
      }).catch(() => {});
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.searchItems(q, 10);
        setSearchResults(data.items);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, []);

  const addItem = (item: Item) => {
    if (items.some((i) => i.item.id === item.id)) return;
    setItems([...items, { item, quantity: 1, price: 0, credits: 0 }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ProcessItem, value: number) => {
    setItems((prev) => prev.map((i, n) => n === idx ? { ...i, [field]: value } : i));
  };

  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});

  const fetchMarketPrice = async (slug: string) => {
    if (loadingPrices[slug] || marketPrices[slug] !== undefined) return;
    setLoadingPrices((prev) => ({ ...prev, [slug]: true }));
    try {
      const orders = await api.getOrders(slug);
      const sellPrices = (orders.sell_orders as { platinum: number }[]).filter((o) => o.platinum > 0).map((o) => o.platinum);
      if (sellPrices.length > 0) {
        const sorted = [...sellPrices].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        setMarketPrices((prev) => ({ ...prev, [slug]: Math.round(median) }));
      }
    } catch {} finally {
      setLoadingPrices((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const handleConfirm = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      await api.processTrade({
        transaction_type: transactionType,
        user_name: userName,
        items: items.map((i) => ({
          item_id: i.item.id,
          quantity: i.quantity,
          price: i.price,
          credits: transactionType === "sale" ? i.credits : i.credits,
        })),
      });
      setDone(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save trade");
    } finally {
      setSaving(false);
    }
  };

  const totalTradePrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalMarketPrice = items.reduce((sum, i) => {
    const mp = marketPrices[i.item.slug];
    return sum + (mp ?? 0) * i.quantity;
  }, 0);
  const diff = transactionType === "sale"
    ? totalMarketPrice - totalTradePrice
    : totalTradePrice - totalMarketPrice;

  if (done) {
    return (
      <div className="card text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <Check size={32} className="text-green-400" />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("processTrade.success", lang, { count: items.length })}</h2>
        <p className="text-gray-400">{items.length} {t("processTrade.item", lang)}(s) {transactionType === "sale" ? t("processTrade.sale", lang) : t("processTrade.purchase", lang)}</p>
        <div className="flex justify-center gap-3 pt-2">
          <button className="btn-primary" onClick={() => { setItems([]); setDone(false); setUserName(""); }}>
            {t("processTrade.addItem", lang)}
          </button>
          <button className="btn-secondary" onClick={() => navigate("/transactions")}>
            {t("nav.history", lang)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("processTrade.title", lang)}</h2>
      </div>

      <div className="card space-y-4">
        <div className="flex gap-3 items-start">
          <div className="flex-1 space-y-1">
            <label className="block text-xs text-gray-500 font-medium">{t("trading.type", lang)}</label>
            <div className="flex gap-2">
              {(["sale", "purchase"] as const).map((type) => (
                <button
                  key={type}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    transactionType === type
                      ? type === "sale" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                  onClick={() => setTransactionType(type)}
                >
                  {type === "sale" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {type === "sale" ? t("processTrade.sale", lang) : t("processTrade.purchase", lang)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-xs text-gray-500 font-medium">{t("processTrade.buyerName", lang)}</label>
            <input
              className="input"
              placeholder={t("processTrade.buyerName", lang)}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <label className="block text-xs text-gray-500 font-medium">{t("processTrade.addItem", lang)}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="input pl-10"
            placeholder={t("processTrade.searchPlaceholder", lang)}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchLoading && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded-lg p-1">
            {searchResults.map((item) => {
              const alreadyAdded = items.some((i) => i.item.id === item.id);
              return (
                <button
                  key={item.id}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    alreadyAdded
                      ? "bg-gray-800/50 text-gray-500 cursor-not-allowed"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                  onClick={() => addItem(item)}
                >
                  <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                    {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-contain" /> : "?"}
                  </div>
                  <span className="flex-1 text-left">{item.name}</span>
                  {alreadyAdded && <Check size={14} className="text-green-400" />}
                  <Plus size={14} className="text-gray-400" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                  <th className="py-2.5 px-2 text-left font-medium">{t("processTrade.item", lang)}</th>
                  <th className="py-2.5 px-2 text-center font-medium w-20">{t("processTrade.quantity", lang)}</th>
                  <th className="py-2.5 px-2 text-right font-medium w-24">{t("processTrade.price", lang)}</th>
                  <th className="py-2.5 px-2 text-right font-medium w-24">{t("processTrade.totalTrade", lang)}</th>
                  <th className="py-2.5 px-2 text-right font-medium w-24">{t("processTrade.marketValue", lang)}</th>
                  <th className="py-2.5 px-2 text-right font-medium w-20">{t("processTrade.difference", lang)}</th>
                  <th className="py-2.5 px-2 text-center font-medium w-24">{t("processTrade.credits", lang)}</th>
                  <th className="py-2.5 px-2 text-center font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry, idx) => {
                  const mp = marketPrices[entry.item.slug];
                  const totalEntry = entry.price * entry.quantity;
                  const totalMP = mp != null ? mp * entry.quantity : null;
                  const entryDiff = mp != null
                    ? (transactionType === "sale" ? mp - entry.price : entry.price - mp)
                    : null;
                  if (entry.item.slug && marketPrices[entry.item.slug] === undefined) {
                    fetchMarketPrice(entry.item.slug);
                  }
                  return (
                    <tr key={entry.item.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                            {entry.item.thumbnail ? <img src={entry.item.thumbnail} alt="" className="w-full h-full object-contain" /> : "?"}
                          </div>
                          <span className="text-gray-100 font-medium truncate max-w-[180px]">{entry.item.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min={1}
                          className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white text-center focus:outline-none focus:border-wf-primary"
                          value={entry.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={1}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white text-right focus:outline-none focus:border-wf-primary"
                          value={entry.price || ""}
                          onChange={(e) => updateItem(idx, "price", Math.max(1, parseInt(e.target.value) || 0))}
                        />
                      </td>
                      <td className="py-2 px-2 text-right text-gray-100 font-medium">{totalEntry}p</td>
                      <td className="py-2 px-2 text-right text-gray-400">
                        {loadingPrices[entry.item.slug] ? (
                          <Loader2 size={14} className="inline animate-spin" />
                        ) : mp != null ? (
                          <span className="text-blue-400">{totalMP}p</span>
                        ) : (
                          <span className="text-gray-600">...</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {entryDiff != null ? (
                          <span className={entryDiff >= 0 ? "text-green-400" : "text-red-400"}>
                            {entryDiff >= 0 ? "+" : ""}{entryDiff}p
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white text-center focus:outline-none focus:border-wf-primary"
                          value={entry.credits}
                          onChange={(e) => updateItem(idx, "credits", Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{t("processTrade.item", lang)}s</p>
                <p className="text-lg font-bold text-white">{items.length}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{transactionType === "sale" ? t("processTrade.sale", lang) : t("processTrade.purchase", lang)} {t("processTrade.price", lang)}</p>
                <p className={`text-lg font-bold ${transactionType === "sale" ? "text-green-400" : "text-red-400"}`}>
                  {totalTradePrice}p
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{t("processTrade.marketValue", lang)}</p>
                <p className="text-lg font-bold text-blue-400">{totalMarketPrice || "..."}p</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{transactionType === "sale" ? "Underpriced" : "Overpaid"}</p>
                <p className={`text-lg font-bold ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {diff >= 0 ? "+" : ""}{diff}p
                </p>
              </div>
            </div>

            <button
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              onClick={handleConfirm}
              disabled={saving || items.length === 0}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {saving ? t("processTrade.submitting", lang) : t("processTrade.submit", lang)}
            </button>
          </div>
        </>
      )}

      {items.length === 0 && !searchQuery && (
        <div className="card text-center py-12 text-gray-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-base">{t("processTrade.noItems", lang)}</p>
          <p className="text-xs text-gray-600 mt-1">{t("common.loading", lang)}</p>
        </div>
      )}
    </div>
  );
}

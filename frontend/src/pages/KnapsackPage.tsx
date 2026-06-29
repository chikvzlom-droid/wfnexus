import { useState } from "react";
import { SlidersHorizontal, Plus, Trash2, TrendingUp } from "lucide-react";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";
import { api, KnapsackItem, KnapsackOut } from "../lib/api";

export default function KnapsackPage() {
  const { lang } = useLangStore();
  const [budget, setBudget] = useState("1000");
  const [items, setItems] = useState<KnapsackItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [maxQty, setMaxQty] = useState("5");
  const [result, setResult] = useState<KnapsackOut | null>(null);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    if (!itemName.trim() || !buyPrice || !sellPrice) return;
    setItems(prev => [...prev, {
      item_id: itemName.toLowerCase().replace(/\s+/g, "_"),
      item_name: itemName,
      buy_price: parseFloat(buyPrice),
      sell_price: parseFloat(sellPrice),
      max_quantity: parseInt(maxQty) || 1,
    }]);
    setItemName(""); setBuyPrice(""); setSellPrice(""); setMaxQty("5");
  };

  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleOptimize = async () => {
    if (!budget || items.length === 0) return;
    setLoading(true);
    try {
      const res = await api.knapsackOptimize({ budget: parseFloat(budget), items });
      setResult(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <SlidersHorizontal className="text-wf-primary" size={28} />
        <h1 className="text-2xl font-display font-bold text-white">{t("knapsack.title", lang)}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card space-y-4">
          <div>
            <label className="label">{t("knapsack.budget", lang)}</label>
            <input
              type="number"
              min={1}
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="label">{t("knapsack.itemName", lang)}</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="input w-full"
                  onKeyDown={e => e.key === "Enter" && addItem()}
                />
              </div>
              <div>
                <label className="label">{t("knapsack.buyPrice", lang)}</label>
                <input type="number" min={1} value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="label">{t("knapsack.sellPrice", lang)}</label>
                <input type="number" min={1} value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="label">{t("knapsack.maxQty", lang)}</label>
                <input type="number" min={1} value={maxQty} onChange={e => setMaxQty(e.target.value)} className="input w-full" />
              </div>
              <div className="flex items-end">
                <button onClick={addItem} className="btn-primary w-full flex items-center gap-1 justify-center" disabled={!itemName || !buyPrice || !sellPrice}>
                  <Plus size={14} /> {t("knapsack.addItem", lang)}
                </button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border-t border-white/5 pt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">{t("common.noData", lang)} ({items.length})</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-800 text-xs">
                    <span className="text-gray-200 truncate mr-2">{item.item_name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-red-400">{item.buy_price}p</span>
                      <span className="text-green-400">{item.sell_price}p</span>
                      <span className="text-gray-500">x{item.max_quantity}</span>
                      <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-white/10 text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleOptimize}
            disabled={loading || items.length === 0 || !budget}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? t("knapsack.optimizing", lang) : t("knapsack.optimize", lang)}
          </button>
        </div>

        {result && result.items.length > 0 && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-green-400" />
              {t("knapsack.result", lang)}
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">{t("knapsack.totalCost", lang)}</p>
                <p className="text-lg font-bold text-cyan-400">{result.total_cost}p</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">{t("knapsack.totalRevenue", lang)}</p>
                <p className="text-lg font-bold text-green-400">{result.total_revenue}p</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">{t("knapsack.totalProfit", lang)}</p>
                <p className="text-lg font-bold text-purple-400">{result.total_profit}p</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-white/5">
                    <th className="text-left py-2 px-1">{t("knapsack.itemName", lang)}</th>
                    <th className="text-right py-2 px-1">{t("knapsack.qty", lang)}</th>
                    <th className="text-right py-2 px-1">{t("knapsack.buyPrice", lang)}</th>
                    <th className="text-right py-2 px-1">{t("knapsack.cost", lang)}</th>
                    <th className="text-right py-2 px-1">{t("knapsack.profit", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 px-1 text-gray-200">{item.item_name}</td>
                      <td className="py-2 px-1 text-right text-gray-300">{item.quantity}</td>
                      <td className="py-2 px-1 text-right text-gray-400">{item.buy_price}p</td>
                      <td className="py-2 px-1 text-right text-gray-300">{item.total_cost}p</td>
                      <td className="py-2 px-1 text-right text-green-400">+{item.total_profit}p</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

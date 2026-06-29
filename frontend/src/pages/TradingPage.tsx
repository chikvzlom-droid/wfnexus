import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MinusCircle, RefreshCw, TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import type { Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

interface TradeOrder {
  id: number;
  item_id: string;
  wfm_id: string | null;
  order_type: "sell" | "buy";
  platinum: number;
  quantity: number;
  visible: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item: Item | null;
}

export default function TradingPage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, { platinum: string; quantity: string; order_type: string; visible: boolean }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.listTradeOrders();
      setOrders(data);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api.searchItems(searchQuery);
      setSearchResults(data.items);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const handleAdd = async (itemId: string) => {
    const fd = formData[itemId];
    if (!fd || !fd.platinum) return;
    setAdding(itemId);
    try {
      await api.createTradeOrder({
        item_id: itemId,
        order_type: fd.order_type || "sell",
        platinum: parseFloat(fd.platinum),
        quantity: parseInt(fd.quantity) || 1,
        visible: fd.visible !== false,
      });
      setSearchResults((prev) => prev.filter((i) => i.id !== itemId));
      await loadOrders();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add order");
    }
    finally { setAdding(null); }
  };

  const handleDelete = async (orderId: number) => {
    try {
      await api.deleteTradeOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch { alert("Failed to delete"); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await api.syncTradeWithWfm();
      const parts = [`Posted ${data.posted}`];
      if (data.imported > 0) parts.push(`Imported ${data.imported}`);
      if (data.errors.length) parts.push(`Errors: ${data.errors.join("; ")}`);
      setSyncResult(parts.join(" | "));
      await loadOrders();
    } catch (e: unknown) {
      setSyncResult(e instanceof Error ? e.message : "Sync failed");
    }
    finally { setSyncing(false); }
  };

  const updateForm = (itemId: string, field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId] || { platinum: "", quantity: "1", order_type: "sell", visible: true }, [field]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("trading.title", lang)}</h2>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? t("trading.syncing", lang) : t("trading.sync", lang)}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="card bg-wf-primary/10 border border-wf-primary/30 text-sm text-gray-300">
          {syncResult}
        </div>
      )}

      <div className="card">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="input pl-10"
              placeholder={t("trading.itemPlaceholder", lang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button className="btn-primary" onClick={handleSearch} disabled={searching}>
            {searching ? "..." : "Search"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input text-xs py-1 px-2 w-16"
                    value={formData[item.id]?.order_type || "sell"}
                    onChange={(e) => updateForm(item.id, "order_type", e.target.value)}
                  >
                    <option value="sell">Sell</option>
                    <option value="buy">Buy</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    placeholder="Plat"
                    className="input w-20 text-center"
                    value={formData[item.id]?.platinum || ""}
                    onChange={(e) => updateForm(item.id, "platinum", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    defaultValue={1}
                    className="input w-14 text-center"
                    value={formData[item.id]?.quantity || "1"}
                    onChange={(e) => updateForm(item.id, "quantity", e.target.value)}
                  />
                  <button
                    className={formData[item.id]?.visible !== false ? "text-gray-400" : "text-gray-600"}
                    onClick={() => updateForm(item.id, "visible", formData[item.id]?.visible === false)}
                  >
                    {formData[item.id]?.visible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    className="btn-primary text-xs py-1 px-3"
                    onClick={() => handleAdd(item.id)}
                    disabled={adding === item.id}
                  >
                    <Plus size={14} className="inline mr-1" />
                    {adding === item.id ? "..." : "Order"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold text-white mb-3">My Orders ({orders.length})</h3>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500 text-sm">No orders. Search above to create one.</p>
        ) : (
          <div className="space-y-1">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800">
                <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                  {order.item?.thumbnail ? (
                    <img src={order.item.thumbnail} alt="" className="w-full h-full object-contain" />
                  ) : order.order_type === "sell" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => order.item && navigate(`/items/${order.item.slug}`)}
                >
                  <p className="text-sm font-medium text-gray-100 truncate">{order.item?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">
                    <span className={order.order_type === "sell" ? "text-green-400" : "text-red-400"}>
                      {order.order_type.toUpperCase()}
                    </span>{" "}
                    {order.platinum}pl × {order.quantity}
                    {order.wfm_id && <span className="ml-2 text-wf-primary">live</span>}
                    {!order.visible && <span className="ml-2 text-gray-600">hidden</span>}
                  </p>
                  {order.notes && <p className="text-xs text-gray-600 truncate">{order.notes}</p>}
                </div>
                <button className="text-gray-500 hover:text-red-400 transition-colors" onClick={() => handleDelete(order.id)}>
                  <MinusCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

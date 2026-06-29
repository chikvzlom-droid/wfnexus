import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, Edit2, RefreshCw, TrendingUp, TrendingDown, BarChart3, X, Lock, Unlock, ArrowUp, ArrowDown, Package } from "lucide-react";
import { api } from "../lib/api";
import type { Transaction, TransactionReport, Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const LIMIT = 50;

type SortDir = "asc" | "desc";

interface SortState {
  by: string;
  dir: SortDir;
}

const COLUMNS: { key: string; label: string; align?: string }[] = [
  { key: "item_name", label: "Item" },
  { key: "item_type", label: "Type" },
  { key: "user_name", label: "User" },
  { key: "quantity", label: "Qty", align: "text-right" },
  { key: "price", label: "Price", align: "text-right" },
  { key: "profit", label: "Profit", align: "text-right" },
  { key: "credits", label: "Credits", align: "text-right" },
  { key: "created_at", label: "Date" },
];

export default function TransactionsPage() {
  const { lang } = useLangStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ by: "created_at", dir: "desc" });
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<TransactionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<Item[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addForm, setAddForm] = useState<{
    item_id: string; item_name: string; transaction_type: string;
    price: string; quantity: string; user_name: string; credits: string;
  }>({ item_id: "", item_name: "", transaction_type: "sale", price: "", quantity: "1", user_name: "", credits: "0" });
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState<{ id: number; price: string; quantity: string; user_name: string; credits: string } | null>(null);

  const loadTransactions = useCallback(async (p = page, s = sort) => {
    setLoading(true);
    try {
      const data = await api.listTransactions({
        page: p, limit: LIMIT, transaction_type: filterType,
        q: searchQuery || undefined,
        from_date: undefined,
        to_date: undefined,
        sort_by: s.by === "created_at" ? undefined : s.by,
        sort_order: s.by === "created_at" && s.dir === "desc" ? undefined : s.dir,
      });
      setTransactions(data.results);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  }, [page, filterType, searchQuery, sort]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.getTransactionReport();
      setReport(data);
    } catch {}
    finally { setReportLoading(false); }
  };

  useEffect(() => {
    if (showReport) loadReport();
  }, [showReport]);

  const handleSort = (key: string) => {
    setSort((prev) => ({
      by: key,
      dir: prev.by === key && prev.dir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sort.by !== col) return <span className="ml-1 opacity-20">↕</span>;
    return sort.dir === "asc"
      ? <ArrowUp size={12} className="ml-1 inline" />
      : <ArrowDown size={12} className="ml-1 inline" />;
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch { alert("Failed to delete"); }
  };

  const handleEdit = async () => {
    if (!editForm) return;
    try {
      const updated = await api.updateTransaction(editForm.id, {
        price: parseInt(editForm.price) || 0,
        quantity: parseInt(editForm.quantity) || 1,
        user_name: editForm.user_name,
        credits: parseInt(editForm.credits) || 0,
      });
      setTransactions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setEditForm(null);
    } catch { alert("Failed to update"); }
  };

  const handleLockToggle = async (tx: Transaction) => {
    try {
      const updated = await api.updateTransaction(tx.id, { is_locked: !tx.is_locked });
      setTransactions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } catch { alert("Failed to toggle lock"); }
  };

  const handleAddSearch = async () => {
    if (!addSearch.trim()) return;
    setAddSearching(true);
    try {
      const data = await api.searchItems(addSearch);
      setAddResults(data.items);
    } catch { setAddResults([]); }
    finally { setAddSearching(false); }
  };

  const handleSelectItem = async (item: Item) => {
    setAddForm({ ...addForm, item_id: item.id, item_name: item.name });
    setLivePrice(null);
    setAddResults([]);
    setLivePriceLoading(true);
    try {
      const orders = await api.getOrders(item.slug);
      const sellOrders = (orders.sell_orders as { platinum: number }[]).filter((o) => o.platinum > 0);
      if (sellOrders.length > 0) {
        const minP = Math.min(...sellOrders.map((o) => o.platinum));
        setLivePrice(minP);
      }
    } catch {} finally { setLivePriceLoading(false); }
  };

  const handleAdd = async () => {
    if (!addForm.item_id || !addForm.price) return;
    setSaving(true);
    try {
      const tx = await api.createTransaction({
        item_id: addForm.item_id,
        transaction_type: addForm.transaction_type,
        price: parseInt(addForm.price),
        quantity: parseInt(addForm.quantity) || 1,
        user_name: addForm.user_name,
        credits: parseInt(addForm.credits) || 0,
      });
      setTransactions((prev) => [tx, ...prev]);
      setShowAddModal(false);
      setAddResults([]);
      setAddSearch("");
      setAddForm({ item_id: "", item_name: "", transaction_type: "sale", price: "", quantity: "1", user_name: "", credits: "0" });
      setLivePrice(null);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const profitColor = (profit: number | null) => {
    if (profit === null || profit === undefined) return "text-gray-400";
    return profit >= 0 ? "text-green-400" : "text-red-400";
  };

  const thClass = "py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors select-none";
  const thAlign = (col: string) => COLUMNS.find((c) => c.key === col)?.align || "text-left";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("history.title", lang)}</h2>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => { setShowReport(!showReport); if (!showReport) setShowAddModal(false); }}>
            <BarChart3 size={16} />
            {showReport ? t("history.hideReport", lang) : t("history.report", lang)}
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => { setShowAddModal(true); setShowReport(false); }}>
            <Plus size={16} /> {t("history.addTrade", lang)}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="input pl-10"
              placeholder={t("history.searchPlaceholder", lang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadTransactions()}
            />
          </div>
          <div className="flex gap-1">
            {[
              { value: undefined, label: t("history.filterAll", lang) },
              { value: "sale", label: t("history.filterSales", lang) },
              { value: "purchase", label: t("history.filterPurchases", lang) },
            ].map((f) => (
              <button
                key={f.value || "all"}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === f.value ? "bg-wf-primary/20 text-wf-primary" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
                onClick={() => { setFilterType(f.value); setPage(1); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary p-2" onClick={() => loadTransactions()}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Financial Report */}
      {showReport && (
        <>
          <div className="card grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: t("history.labelTotal", lang), value: report?.total_transactions ?? "..." },
              { label: t("history.labelSales", lang), value: report?.sale_count ?? "..." },
              { label: t("history.labelPurchases", lang), value: report?.purchases_count ?? "..." },
              { label: t("history.labelRevenue", lang), value: report?.revenue ?? "...", suffix: "p" },
              { label: t("history.labelExpenses", lang), value: report?.expenses ?? "...", suffix: "p" },
              { label: t("history.labelProfit", lang), value: report?.total_profit ?? "...", suffix: "p", color: (report?.total_profit ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
              { label: t("history.labelAvgProfit", lang), value: report?.average_profit ?? "...", suffix: "p" },
              { label: t("history.labelMargin", lang), value: report?.profit_margin ?? "...", suffix: "x" },
              { label: t("history.labelROI", lang), value: report?.roi ?? "...", suffix: "%" },
              { label: t("history.labelBestSale", lang), value: report?.highest_revenue ?? "...", suffix: "p" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color || "text-white"}`}>
                  {reportLoading ? "..." : `${s.value}${s.suffix ? " " + s.suffix : ""}`}
                </p>
              </div>
            ))}
          </div>
          {report?.categories && report.categories.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Package size={16} className="text-wf-primary" />
                {t("dashboard.categoryBreakdown", lang)}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {report.categories.map((cat) => (
                  <div key={cat.name} className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{cat.name}</p>
                    <p className={`text-lg font-bold ${cat.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {cat.profit >= 0 ? "+" : ""}{cat.profit}p
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {cat.revenue}p / {cat.expenses}p
                    </p>
                    <p className="text-[10px] text-gray-600">{cat.count} tx &middot; {cat.profit_margin}x</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-gray-500 text-sm py-8 text-center">{t("common.loading", lang)}</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">{t("history.noTrades", lang)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${thClass} ${thAlign(col.key)}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon col={col.key} />
                  </th>
                ))}
                <th className="text-center py-3 px-2 font-medium w-20">{t("history.actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${tx.is_locked ? "opacity-70" : ""}`}>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      {tx.transaction_type === "sale"
                        ? <TrendingUp size={14} className="text-green-500 shrink-0" />
                        : <TrendingDown size={14} className="text-red-500 shrink-0" />
                      }
                      <span className="text-gray-100 font-medium truncate max-w-[200px]">{tx.item_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-gray-400 text-xs">{tx.item_type}</td>
                  <td className="py-2.5 px-2 text-gray-300">{tx.user_name || "-"}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{tx.quantity}</td>
                  <td className="py-2.5 px-2 text-right text-gray-100 font-medium">{tx.price}p</td>
                  <td className={`py-2.5 px-2 text-right font-medium ${profitColor(tx.profit)}`}>
                    {tx.profit !== null && tx.profit !== undefined ? `${tx.profit >= 0 ? "+" : ""}${tx.profit}p` : "N/A"}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-400 text-xs">{tx.credits.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex justify-center gap-1">
                      <button
                        className={`p-1.5 rounded transition-colors ${
                          tx.is_locked ? "text-yellow-500 hover:text-yellow-400" : "text-gray-500 hover:text-gray-300"
                        }`}
                        title={tx.is_locked ? "Unlock" : "Lock"}
                        onClick={() => handleLockToggle(tx)}
                      >
                        {tx.is_locked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        disabled={tx.is_locked}
                        onClick={() => !tx.is_locked && setEditForm({ id: tx.id, price: String(tx.price), quantity: String(tx.quantity), user_name: tx.user_name, credits: String(tx.credits) })}
                      >
                        <Edit2 size={14} className={tx.is_locked ? "opacity-30" : ""} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                        disabled={tx.is_locked}
                        onClick={() => !tx.is_locked && handleDelete(tx.id)}
                      >
                        <Trash2 size={14} className={tx.is_locked ? "opacity-30" : ""} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-800 mt-4">
            <p className="text-xs text-gray-500">{t("history.totalTrades", lang, { n: total })}</p>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 10) pageNum = i + 1;
                else if (page <= 5) pageNum = i + 1;
                else if (page >= totalPages - 4) pageNum = totalPages - 9 + i;
                else pageNum = page - 5 + i;
                return (
                  <button
                    key={pageNum}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      page === pageNum ? "bg-wf-primary/20 text-wf-primary" : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{t("history.addModalTitle", lang)}</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input className="input flex-1" placeholder={t("history.searchItem", lang)} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSearch()} />
                <button className="btn-primary text-sm" onClick={handleAddSearch} disabled={addSearching}>
                  {addSearching ? "..." : t("common.search", lang)}
                </button>
              </div>

              {addResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {addResults.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        addForm.item_id === item.id ? "bg-wf-primary/20 text-wf-primary" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                      onClick={() => handleSelectItem(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {addForm.item_name && (
                <p className="text-sm text-wf-primary font-medium">{addForm.item_name}</p>
              )}

              {/* Live price indicator + use button */}
              {livePriceLoading && <p className="text-xs text-gray-500">{t("history.fetchPrice", lang)}</p>}
              {livePrice !== null && (
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 text-xs items-center">
                    <span className="text-green-400">{t("history.live", lang, { price: livePrice })}</span>
                    <button
                      className="text-[11px] text-wf-primary hover:underline"
                      onClick={() => setAddForm({ ...addForm, price: String(livePrice) })}
                    >
                      Use
                    </button>
                    {addForm.transaction_type === "sale" && parseInt(addForm.price) > 0 && (
                      <span className="text-gray-400">
                        {t("history.profit", lang, { diff: parseInt(addForm.price) - livePrice })}
                      </span>
                    )}
                    {addForm.transaction_type === "purchase" && parseInt(addForm.price) > 0 && (
                      <span className="text-gray-400">
                        {t("history.vsMarket", lang, { diff: livePrice - parseInt(addForm.price) })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {(["sale", "purchase"] as const).map((type) => (
                  <button
                    key={type}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addForm.transaction_type === type
                        ? type === "sale" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                    onClick={() => setAddForm({ ...addForm, transaction_type: type })}
                  >
                    {type === "sale" ? t("processTrade.sale", lang) : t("processTrade.purchase", lang)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.priceLabel", lang)}</label>
                  <input type="number" min={1} className="input" placeholder="e.g. 30" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.quantityLabel", lang)}</label>
                  <input type="number" min={1} className="input" value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.buyerSeller", lang)}</label>
                  <input className="input" placeholder="username" value={addForm.user_name} onChange={(e) => setAddForm({ ...addForm, user_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.creditsTax", lang)}</label>
                  <input type="number" min={0} className="input" value={addForm.credits} onChange={(e) => setAddForm({ ...addForm, credits: e.target.value })} />
                </div>
              </div>

              <button className="btn-primary w-full" onClick={handleAdd} disabled={saving || !addForm.item_id || !addForm.price}>
                {saving ? t("history.adding", lang) : t("history.addTrade", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditForm(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{t("history.editModalTitle", lang)}</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setEditForm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.price", lang)}</label>
                  <input type="number" className="input" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("history.quantity", lang)}</label>
                  <input type="number" className="input" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("history.user", lang)}</label>
                <input className="input" value={editForm.user_name} onChange={(e) => setEditForm({ ...editForm, user_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("history.credits", lang)}</label>
                <input type="number" className="input" value={editForm.credits} onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setEditForm(null)}>{t("history.cancel", lang)}</button>
                <button className="btn-primary flex-1" onClick={handleEdit}>{t("history.save", lang)}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
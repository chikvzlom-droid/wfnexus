import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, RefreshCw, Copy, Check, X, MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import type { TradeEntryItem, Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const LIMIT = 100;

export default function TradeEntriesPage() {
  const { lang } = useLangStore();
  const [entries, setEntries] = useState<TradeEntryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<string | undefined>();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState<Item[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addForm, setAddForm] = useState<{
    item_id: string; item_name: string; group: string; price: string; quantity: string; tags: string;
  }>({ item_id: "", item_name: "", group: "item", price: "", quantity: "1", tags: "" });
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState<{ id: number; price: string; quantity: string; tags: string } | null>(null);

  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadEntries = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const data = await api.listTradeEntries({ page: p, limit: LIMIT, group: filterGroup });
      setEntries(data.results);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [page, filterGroup]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTradeEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch { alert("Failed to delete"); }
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

  const handleAdd = async () => {
    if (!addForm.price) return;
    setSaving(true);
    try {
      const entry = await api.createTradeEntry({
        item_id: addForm.item_id || undefined,
        item_name: addForm.item_name || addSearch,
        price: parseInt(addForm.price),
        quantity: parseInt(addForm.quantity) || 1,
        group: addForm.group,
        tags: addForm.tags,
      });
      setEntries((prev) => [entry, ...prev]);
      setShowAddModal(false);
      setAddResults([]);
      setAddSearch("");
      setAddForm({ item_id: "", item_name: "", group: "item", price: "", quantity: "1", tags: "" });
    } catch { alert("Failed"); }
    finally { setSaving(false); }
  };

  const handleGenerateMessage = async () => {
    if (selectedIds.size === 0) return;
    try {
      const data = await api.generateTradeMessage(Array.from(selectedIds));
      setGeneratedMsg(data.message);
    } catch { alert("Failed to generate"); }
  };

  const copyToClipboard = () => {
    if (generatedMsg) {
      navigator.clipboard.writeText(generatedMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white"><span className="text-wf-primary">/</span> {t("tradeEntries.title", lang)}</h2>
        <div className="flex gap-2">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleGenerateMessage}
            disabled={selectedIds.size === 0}
          >
            <MessageSquare size={16} />
            {t("tradeEntries.generateMessage", lang)} ({selectedIds.size})
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> {t("common.add", lang)}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex gap-2 items-center">
        <div className="flex gap-1">
          {[
            { value: undefined, label: t("history.filterAll", lang) },
            { value: "item", label: t("tradeEntries.item", lang) === "Item" ? "Items" : "Предметы" },
            { value: "custom", label: t("tradeEntries.item", lang) === "Item" ? "Custom" : "Своё" },
          ].map((f) => (
            <button
              key={f.value || "all"}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterGroup === f.value ? "bg-wf-primary/20 text-wf-primary" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
              onClick={() => { setFilterGroup(f.value); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="btn-secondary p-2" onClick={() => loadEntries()}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Generated Message Banner */}
      {generatedMsg && (
        <div className="card border border-wf-primary/30">
          <div className="flex items-start justify-between gap-2">
            <pre className="font-mono text-sm text-gray-100 whitespace-pre-wrap flex-1">{generatedMsg}</pre>
            <div className="flex gap-1 shrink-0">
              <button className="btn-primary p-2" onClick={copyToClipboard} title={t("common.copy", lang)}>
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
              <button className="btn-secondary p-2" onClick={() => setGeneratedMsg(null)}>
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-gray-500 text-sm py-8 text-center">{t("common.loading", lang)}</p>
        ) : entries.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">{t("tradeEntries.noEntries", lang)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left py-3 px-2 w-8">
                  <input type="checkbox" className="accent-wf-primary" checked={selectedIds.size === entries.length && entries.length > 0} onChange={selectAll} />
                </th>
                <th className="text-left py-3 px-2 font-medium">{t("tradeEntries.item", lang)}</th>
                <th className="text-left py-3 px-2 font-medium">{t("tradeEntries.type", lang)}</th>
                <th className="text-right py-3 px-2 font-medium">{t("tradeEntries.price", lang)}</th>
                <th className="text-right py-3 px-2 font-medium">Min</th>
                <th className="text-right py-3 px-2 font-medium">{t("tradeEntries.generateMessage", lang)}</th>
                <th className="text-left py-3 px-2 font-medium">{t("tradeEntries.note", lang)}</th>
                <th className="text-center py-3 px-2 font-medium w-20">{t("tradeEntries.actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="py-2.5 px-2">
                    <input
                      type="checkbox"
                      className="accent-wf-primary"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-100 font-medium truncate max-w-[200px]">{entry.item_name}</span>
                      {entry.quantity > 1 && <span className="text-xs text-gray-500">x{entry.quantity}</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      entry.group === "item" ? "bg-blue-500/10 text-blue-400" :
                      entry.group === "custom" ? "bg-purple-500/10 text-purple-400" :
                      "bg-orange-500/10 text-orange-400"
                    }`}>
                      {entry.group}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-100 font-medium">{entry.price}p</td>
                  <td className="py-2.5 px-2 text-right text-gray-400">
                    {entry.min_price !== null && entry.min_price !== undefined ? `${entry.min_price}p` : "—"}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {entry.potential_profit !== null && entry.potential_profit !== undefined ? (
                      <span className="text-green-400 font-medium">+{entry.potential_profit}p</span>
                    ) : entry.min_price !== null ? (
                      <span className="text-red-400 text-xs">overpriced</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-gray-500 text-xs max-w-[120px] truncate">{entry.tags || "—"}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex justify-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        onClick={() => setEditForm({ id: entry.id, price: String(entry.price), quantity: String(entry.quantity), tags: entry.tags })}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{t("tradeEntries.addEntry", lang)}</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {["item", "custom"].map((g) => (
                  <button
                    key={g}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addForm.group === g
                        ? "bg-wf-primary/20 text-wf-primary"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                    onClick={() => setAddForm({ ...addForm, group: g, item_id: "", item_name: "" })}
                  >
                    {g === "item" ? "From Catalogue" : "Custom"}
                  </button>
                ))}
              </div>

              {addForm.group === "item" && (
                <>
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder={t("tradeEntries.searchPlaceholder", lang)} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSearch()} />
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
                          onClick={() => setAddForm({ ...addForm, item_id: item.id, item_name: item.name })}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {addForm.item_name && <p className="text-sm text-wf-primary font-medium">{addForm.item_name}</p>}
                </>
              )}

              {addForm.group === "custom" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Item name / description</label>
                  <input className="input" placeholder="e.g. WTS Rubico Prime Set" value={addForm.item_name} onChange={(e) => setAddForm({ ...addForm, item_name: e.target.value })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("processTrade.price", lang)}</label>
                  <input type="number" min={1} className="input" placeholder="e.g. 30" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("processTrade.quantity", lang)}</label>
                  <input type="number" min={1} className="input" value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("tradeEntries.note", lang)}</label>
                <input className="input" placeholder="prime, set, mod (comma separated)" value={addForm.tags} onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })} />
              </div>

              <button className="btn-primary w-full" onClick={handleAdd} disabled={saving || !addForm.price}>
                {saving ? "..." : t("common.add", lang)}
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
              <h3 className="text-lg font-bold text-white">{t("tradeEntries.editEntry", lang)}</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setEditForm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("processTrade.price", lang)}</label>
                  <input type="number" className="input" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("processTrade.quantity", lang)}</label>
                  <input type="number" className="input" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("tradeEntries.note", lang)}</label>
                <input className="input" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setEditForm(null)}>{t("common.cancel", lang)}</button>
                <button className="btn-primary flex-1" onClick={async () => {
                  try {
                    await api.updateTradeEntry(editForm.id, {
                      price: parseInt(editForm.price) || 0,
                      quantity: parseInt(editForm.quantity) || 1,
                      tags: editForm.tags,
                    });
                    setEditForm(null);
                    loadEntries();
                  } catch { alert("Failed"); }
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

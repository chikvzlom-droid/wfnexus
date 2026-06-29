import { useEffect, useState } from "react";
import { Package, Plus, Search, Pencil, Trash2, X, FileText, DollarSign } from "lucide-react";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";
import { api, InventoryItem, PaginatedInventory, Item, AppraisalOut } from "../lib/api";

type ModalMode = "add" | "edit";

export default function InventoryPage() {
  const { lang } = useLangStore();
  const [data, setData] = useState<PaginatedInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ item_name: "", item_id: "", quantity: 1, acquired_price: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [appraisalOpen, setAppraisalOpen] = useState(false);
  const [appraisal, setAppraisal] = useState<AppraisalOut | null>(null);
  const [appraising, setAppraising] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: string[] } | null>(null);
  const [bulking, setBulking] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await api.listInventory({ page, limit: 50, q: q || undefined });
      setData(result);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page, q]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.fuzzySearchItems(searchQuery, 10);
        setSearchResults(res.results.map(r => r.item));
      } catch { setSearchResults([]); }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openAdd = () => {
    setModalMode("add");
    setEditId(null);
    setForm({ item_name: "", item_id: "", quantity: 1, acquired_price: "", location: "", notes: "" });
    setSearchResults([]);
    setSearchQuery("");
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setModalMode("edit");
    setEditId(item.id);
    setForm({
      item_name: item.item_name,
      item_id: item.item_id || "",
      quantity: item.quantity,
      acquired_price: item.acquired_price?.toString() || "",
      location: item.location || "",
      notes: item.notes || "",
    });
    setSearchResults([]);
    setSearchQuery("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        item_name: form.item_name.trim(),
        item_id: form.item_id || undefined,
        quantity: form.quantity,
        acquired_price: form.acquired_price ? parseFloat(form.acquired_price) : undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
      };
      if (modalMode === "add") {
        await api.createInventoryItem(payload as any);
      } else {
        await api.updateInventoryItem(editId!, payload as any);
      }
      setModalOpen(false);
      fetchData();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("inventory.deleteConfirm", lang))) return;
    try {
      await api.deleteInventoryItem(id);
      fetchData();
    } catch { /* ignore */ }
  };

  const selectItem = (item: Item) => {
    setForm(prev => ({ ...prev, item_name: item.name, item_id: item.id }));
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAppraisal = async () => {
    setAppraising(true);
    try {
      const result = await api.getAppraisal();
      setAppraisal(result);
      setAppraisalOpen(true);
    } catch { /* ignore */ }
    setAppraising(false);
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setBulking(true);
    setBulkResult(null);
    try {
      const result = await api.bulkImportInventory(bulkText, bulkLocation || undefined);
      setBulkResult(result);
      fetchData();
    } catch { /* ignore */ }
    setBulking(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="text-wf-primary" size={28} />
          <h1 className="text-2xl font-display font-bold text-white">{t("inventory.title", lang)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkOpen(true)} className="btn-secondary flex items-center gap-2">
            <FileText size={16} /> {t("inventory.bulkImport", lang)}
          </button>
          <button onClick={handleAppraisal} disabled={appraising} className="btn-secondary flex items-center gap-2">
            <DollarSign size={16} /> {appraising ? t("inventory.appraising", lang) : t("inventory.appraisal", lang)}
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {t("inventory.add", lang)}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder={t("inventory.searchPlaceholder", lang)}
            className="input pl-9 w-full"
          />
          {q && (
            <button onClick={() => { setQ(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-gray-400">{t("common.loading", lang)}</p>}

      {data && data.results.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-12">{t("inventory.empty", lang)}</p>
      )}

      {data && data.results.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/5">
                  <th className="text-left py-3 px-2 font-medium">{t("inventory.item", lang)}</th>
                  <th className="text-right py-3 px-2 font-medium">{t("inventory.qty", lang)}</th>
                  <th className="text-right py-3 px-2 font-medium">{t("inventory.acquiredPrice", lang)}</th>
                  <th className="text-left py-3 px-2 font-medium">{t("inventory.location", lang)}</th>
                  <th className="text-left py-3 px-2 font-medium">{t("inventory.notes", lang)}</th>
                  <th className="text-right py-3 px-2 font-medium">{t("inventory.actions", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map(item => (
                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {item.item?.thumbnail && (
                          <img src={item.item.thumbnail} alt="" className="w-8 h-8 rounded object-contain" />
                        )}
                        <span className="text-white font-medium">{item.item_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-white">{item.quantity}</td>
                    <td className="py-3 px-2 text-right">
                      {item.acquired_price != null ? (
                        <span className="text-wf-primary">{item.acquired_price}p</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-300">{item.location || <span className="text-gray-500">—</span>}</td>
                    <td className="py-3 px-2 text-gray-400 max-w-[200px] truncate">{item.notes || <span className="text-gray-500">—</span>}</td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title={t("common.edit", lang)}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors" title={t("common.delete", lang)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-30">
                {t("common.previous", lang)}
              </button>
              <span className="text-gray-400 text-sm">{t("common.page", lang, { n: page })} {t("common.of", lang, { n: data.total_pages })}</span>
              <button disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-30">
                {t("common.next", lang)}
              </button>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-wf-card border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-white">
                {modalMode === "add" ? t("inventory.addTitle", lang) : t("inventory.editTitle", lang)}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">{t("inventory.item", lang)}</label>
                <input
                  type="text"
                  value={form.item_name}
                  onChange={e => { setForm(p => ({ ...p, item_name: e.target.value })); setSearchQuery(e.target.value); }}
                  className="input w-full"
                  placeholder={t("inventory.itemPlaceholder", lang)}
                />
                {searchResults.length > 0 && (
                  <div className="mt-1 bg-wf-card border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm text-gray-300 hover:text-white flex items-center gap-2"
                      >
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-6 h-6 rounded object-contain" />}
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("inventory.qty", lang)}</label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="label">{t("inventory.acquiredPrice", lang)}</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.acquired_price}
                    onChange={e => setForm(p => ({ ...p, acquired_price: e.target.value }))}
                    className="input w-full"
                    placeholder={t("inventory.pricePlaceholder", lang)}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t("inventory.location", lang)}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="input w-full"
                  placeholder={t("inventory.locationPlaceholder", lang)}
                />
              </div>

              <div>
                <label className="label">{t("inventory.notes", lang)}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="input w-full resize-none"
                  rows={2}
                  placeholder={t("inventory.notesPlaceholder", lang)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">
                {t("common.cancel", lang)}
              </button>
              <button onClick={handleSave} disabled={saving || !form.item_name.trim()} className="btn-primary disabled:opacity-50">
                {saving ? t("common.saving", lang) : t("common.save", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {appraisalOpen && appraisal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-wf-card border border-white/10 rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-wf-primary" />
                {t("inventory.appraisalTitle", lang)}
              </h2>
              <button onClick={() => setAppraisalOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{t("inventory.totalValue", lang)}</p>
                <p className="text-2xl font-bold text-green-400">{appraisal.total_estimated_value.toLocaleString()}p</p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{t("inventory.totalProfit", lang)}</p>
                <p className="text-2xl font-bold text-cyan-400">{appraisal.total_potential_profit.toLocaleString()}p</p>
              </div>
            </div>

            {appraisal.items.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t("inventory.noItems", lang)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/5">
                      <th className="text-left py-2 px-1 font-medium">{t("inventory.item", lang)}</th>
                      <th className="text-right py-2 px-1 font-medium">{t("inventory.qty", lang)}</th>
                      <th className="text-right py-2 px-1 font-medium">{t("inventory.acquiredPrice", lang)}</th>
                      <th className="text-right py-2 px-1 font-medium">{t("inventory.estimatedValue", lang)}</th>
                      <th className="text-right py-2 px-1 font-medium">{t("inventory.potentialProfit", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appraisal.items.map(item => (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="py-2 px-1 text-white">{item.item_name}</td>
                        <td className="py-2 px-1 text-right text-gray-300">{item.quantity}</td>
                        <td className="py-2 px-1 text-right">{item.acquired_price != null ? <span className="text-wf-primary">{item.acquired_price}p</span> : <span className="text-gray-500">—</span>}</td>
                        <td className="py-2 px-1 text-right">{item.estimated_value != null ? <span className="text-green-400">{item.estimated_value}p</span> : <span className="text-gray-500">—</span>}</td>
                        <td className="py-2 px-1 text-right">
                          {item.potential_profit != null ? (
                            <span className={item.potential_profit >= 0 ? "text-green-400" : "text-red-400"}>
                              {item.potential_profit >= 0 ? "+" : ""}{item.potential_profit}p
                            </span>
                          ) : <span className="text-gray-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-wf-card border border-white/10 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-wf-primary" />
                {t("inventory.bulkImportTitle", lang)}
              </h2>
              <button onClick={() => { setBulkOpen(false); setBulkResult(null); }} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {bulkResult ? (
              <div className="text-center py-4">
                <p className="text-green-400 text-lg font-bold mb-2">{t("common.save", lang)} — {bulkResult.created} items</p>
                {bulkResult.failed.length > 0 && (
                  <p className="text-red-400 text-sm">{bulkResult.failed.length} failed</p>
                )}
                <button onClick={() => { setBulkOpen(false); setBulkResult(null); setBulkText(""); }} className="btn-primary mt-4">
                  {t("common.close", lang)}
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-3">{t("inventory.bulkImportDesc", lang)}</p>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  className="input w-full resize-none font-mono text-sm"
                  rows={8}
                  placeholder={t("inventory.bulkImportPlaceholder", lang)}
                />
                <div className="mt-3">
                  <label className="label">{t("inventory.location", lang)}</label>
                  <input
                    type="text"
                    value={bulkLocation}
                    onChange={e => setBulkLocation(e.target.value)}
                    className="input w-full"
                    placeholder={t("inventory.locationPlaceholder", lang)}
                  />
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button onClick={() => { setBulkOpen(false); setBulkResult(null); }} className="btn-secondary">
                    {t("common.cancel", lang)}
                  </button>
                  <button onClick={handleBulkImport} disabled={bulking || !bulkText.trim()} className="btn-primary disabled:opacity-50">
                    {bulking ? t("inventory.bulkImporting", lang) : t("inventory.bulkImport", lang)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

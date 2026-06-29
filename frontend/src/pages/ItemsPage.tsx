import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, RotateCw, BadgePercent } from "lucide-react";
import { api } from "../lib/api";
import type { Item } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

export default function ItemsPage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await api.searchItems(q);
      setResults(data.items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearchParams({ q: query });
    doSearch(query);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await api.syncCatalogue();
      alert(data.message);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("common.error", lang, { msg: "Sync failed" });
      alert(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">
          <span className="text-wf-primary">/</span> {t("items.title", lang)}
        </h2>
        <button className="btn-secondary flex items-center gap-2" onClick={handleSync} disabled={syncing}>
          <RotateCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

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
          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? "..." : t("items.searchButton", lang)}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <p className="text-sm text-gray-400 mb-3">{results.length} items</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/items/${item.slug}`)}
              >
                <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-full h-full object-contain" />
                  ) : (
                    "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.category || "unknown"}
                    {item.is_set ? " [Set]" : ""}
                  </p>
                </div>
                {item.ducats != null && (
                  <span className="text-xs bg-wf-gold/20 text-wf-gold px-2 py-1 rounded">{item.ducats}d</span>
                )}
                <button
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-wf-primary transition-colors"
                  title={t("items.processTrade", lang)}
                  onClick={(e) => { e.stopPropagation(); navigate(`/process-trade?item=${item.slug}`); }}
                >
                  <BadgePercent size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="card text-center py-8 text-gray-500">{t("items.noResults", lang)} "{query}"</div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Trash2, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import type { WatchlistEntry } from "../lib/api";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

export default function WatchlistPage() {
  const navigate = useNavigate();
  const { lang } = useLangStore();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const data = await api.getWatchlist();
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleRemove = async (id: number) => {
    try {
      await api.removeWatchlist(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wf-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white flex items-center gap-2"><span className="text-wf-primary">/</span>
          <Heart size={24} className="text-wf-primary" />
          {t("watchlist.title", lang)}
        </h2>
      </div>

      {error && (
        <div className="card flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card text-center py-12">
          <Heart className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-400 mb-2">{t("watchlist.empty", lang)}</p>
          <p className="text-sm text-gray-500">{t("watchlist.empty", lang)}</p>
          <button className="btn-primary mt-4" onClick={() => navigate("/items")}>
            {t("items.title", lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="card flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <button
                  className="text-sm font-medium text-gray-100 hover:text-wf-primary transition-colors truncate block"
                  onClick={() => entry.item && navigate(`/items/${entry.item.slug}`)}
                >
                  {entry.item?.name ?? entry.item_id}
                </button>
                <p className="text-xs text-gray-400">
                  Alert when price goes {entry.direction}{" "}
                  <span className="text-wf-gold">{entry.target_price}p</span>
                </p>
              </div>
              <button
                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                onClick={() => handleRemove(entry.id)}
                title={t("watchlist.remove", lang)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

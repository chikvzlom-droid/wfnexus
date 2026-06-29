import { useEffect, useState } from "react";
import { Globe, MapPin, Package, AlertTriangle, Swords, Sun, Snowflake, Bug, Radio } from "lucide-react";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";
import { api, WorldState } from "../lib/api";

const tierColors: Record<string, string> = {
  lith: "text-yellow-400", meso: "text-orange-400", neo: "text-red-400", axi: "text-purple-400",
};

const tierBadge: Record<string, string> = {
  lith: "bg-yellow-500/20", meso: "bg-orange-500/20", neo: "bg-red-500/20", axi: "bg-purple-500/20",
};

export default function WorldStatePage() {
  const { lang } = useLangStore();
  const [ws, setWs] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWorldState()
      .then(setWs)
      .catch(() => setError("Failed to fetch world state"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">{t("common.loading", lang)}</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!ws) return <p className="text-gray-500">{t("common.noData", lang)}</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="text-wf-primary" size={28} />
        <h1 className="text-2xl font-display font-bold text-white">{t("worldstate.title", lang)}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Fissures */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Radio size={16} className="text-wf-primary" />
            {t("worldstate.fissures", lang)} <span className="text-xs text-gray-500">({ws.fissures.length})</span>
          </h2>
          {ws.fissures.length === 0 ? (
            <p className="text-gray-500 text-sm">{t("worldstate.noFissures", lang)}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ws.fissures.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tierBadge[f.tier.toLowerCase()] || "bg-gray-700"}`}>
                    <span className={`text-xs font-bold ${tierColors[f.tier.toLowerCase()] || "text-gray-300"}`}>
                      {f.tier.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{f.node}</p>
                    <p className="text-xs text-gray-400">{f.mission_type} &middot; {f.mission}</p>
                  </div>
                  <span className="text-xs text-cyan-400 font-mono whitespace-nowrap">{f.eta}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cycles */}
        <div className="space-y-4">
          {ws.cetus_cycle && (
            <div className="card">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2 text-sm">
                <Sun size={14} className="text-wf-primary" />
                {t("worldstate.cetus", lang)}
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ws.cetus_cycle.is_day ? "bg-yellow-400" : "bg-blue-400"}`} />
                <span className="text-sm text-gray-300">{ws.cetus_cycle.state}</span>
                <span className="text-xs text-gray-500 ml-auto">{ws.cetus_cycle.time_left}</span>
              </div>
            </div>
          )}
          {ws.vallis_cycle && (
            <div className="card">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2 text-sm">
                <Snowflake size={14} className="text-cyan-400" />
                {t("worldstate.vallis", lang)}
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ws.vallis_cycle.is_day ? "bg-yellow-400" : "bg-blue-400"}`} />
                <span className="text-sm text-gray-300">{ws.vallis_cycle.state}</span>
                <span className="text-xs text-gray-500 ml-auto">{ws.vallis_cycle.time_left}</span>
              </div>
            </div>
          )}
          {ws.cambion_cycle && (
            <div className="card">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2 text-sm">
                <Bug size={14} className="text-green-400" />
                {t("worldstate.cambion", lang)}
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ws.cambion_cycle.is_day ? "bg-yellow-400" : "bg-blue-400"}`} />
                <span className="text-sm text-gray-300">{ws.cambion_cycle.state}</span>
                <span className="text-xs text-gray-500 ml-auto">{ws.cambion_cycle.time_left}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">

        {/* Void Trader */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Package size={16} className="text-wf-gold" />
            {t("worldstate.voidTrader", lang)}
          </h2>
          {ws.void_trader ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={12} className="text-gray-400" />
                <span className="text-sm text-gray-300">{ws.void_trader.location}</span>
                {ws.void_trader.active && <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Active</span>}
              </div>
              {ws.void_trader.inventory.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {ws.void_trader.inventory.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-800/50 text-xs">
                      <span className="text-gray-200 truncate mr-2">{item.item || item.name || "?"}</span>
                      <div className="flex gap-2 shrink-0">
                        <span className="text-wf-gold">{item.ducats || 0}d</span>
                        <span className="text-wf-primary">{item.platinum || 0}p</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">{t("worldstate.notAvailable", lang)}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">{t("worldstate.notAvailable", lang)}</p>
          )}
        </div>

        {/* Sortie */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Swords size={16} className="text-orange-400" />
            {t("worldstate.sortie", lang)}
          </h2>
          {ws.sortie ? (
            <div>
              <p className="text-sm text-gray-300 mb-2">{ws.sortie.boss} — {ws.sortie.faction}</p>
              <div className="space-y-1">
                {(ws.sortie as any).variants?.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-800/50 text-xs">
                    <span className="text-gray-300">{v.node || v.missionType || "?"}</span>
                    <span className="text-gray-500">{v.modifier || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">{t("worldstate.notAvailable", lang)}</p>
          )}
        </div>

        {/* Alerts */}
        <div className="card">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            {t("worldstate.alerts", lang)}
          </h2>
          {ws.alerts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t("worldstate.noAlerts", lang)}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {ws.alerts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded bg-gray-800/50 text-xs">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-gray-200 truncate">{a.mission || "?"}</p>
                    {a.reward && <p className="text-gray-500 truncate">{a.reward}</p>}
                  </div>
                  <span className="text-cyan-400 font-mono shrink-0">{a.eta}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Nightwave */}
      {ws.nightwave.length > 0 && (
        <div className="card mt-4">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Radio size={16} className="text-purple-400" />
            {t("worldstate.nightwave", lang)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(ws.nightwave as any[]).map((ch: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-gray-800/50 text-sm">
                <p className="text-gray-200">{ch.title || ch.name || "?"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ch.reputation || ""}{ch.reputation ? " standing" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

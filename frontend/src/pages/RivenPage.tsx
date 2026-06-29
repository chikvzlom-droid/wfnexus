import { useState } from "react";
import { Diamond, TrendingUp } from "lucide-react";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";
import { api, RivenPriceOut } from "../lib/api";

const DISPOSITIONS = ["strong", "above_average", "average", "below_average", "weak"];

const COMMON_STATS = [
  "Damage", "Multishot", "CriticalChance", "CriticalDamage", "StatusChance",
  "FireRate", "ReloadSpeed", "MagazineCapacity", "Range", "FlightSpeed",
  "PunchThrough", "Recoil", "AmmoMaximum",
  "ToxinDamage", "ElectricDamage", "HeatDamage", "ColdDamage",
  "ImpactDamage", "SlashDamage", "PunctureDamage",
];

export default function RivenPage() {
  const { lang } = useLangStore();
  const [weaponName, setWeaponName] = useState("");
  const [weaponPrice, setWeaponPrice] = useState("");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [hasNegative, setHasNegative] = useState(false);
  const [disposition, setDisposition] = useState("average");
  const [result, setResult] = useState<RivenPriceOut | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleStat = (stat: string) => {
    setSelectedStats(prev =>
      prev.includes(stat) ? prev.filter(s => s !== stat) : prev.length < 4 ? [...prev, stat] : prev
    );
  };

  const handleEstimate = async () => {
    if (!weaponName.trim() || !weaponPrice || selectedStats.length < 2) return;
    setLoading(true);
    try {
      const res = await api.estimateRiven({
        weapon_name: weaponName,
        weapon_base_price: parseFloat(weaponPrice),
        stats: selectedStats,
        has_negative: hasNegative,
        disposition,
      });
      setResult(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Diamond className="text-purple-400" size={28} />
        <h1 className="text-2xl font-display font-bold text-white">{t("riven.title", lang)}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card space-y-4">
          <div>
            <label className="label">{t("riven.weaponName", lang)}</label>
            <input
              type="text"
              value={weaponName}
              onChange={e => setWeaponName(e.target.value)}
              className="input w-full"
              placeholder={t("riven.weaponPlaceholder", lang)}
            />
          </div>

          <div>
            <label className="label">{t("riven.weaponPrice", lang)}</label>
            <input
              type="number"
              min={1}
              value={weaponPrice}
              onChange={e => setWeaponPrice(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="label">{t("riven.disposition", lang)}</label>
            <select
              value={disposition}
              onChange={e => setDisposition(e.target.value)}
              className="input w-full"
            >
              {DISPOSITIONS.map(d => (
                <option key={d} value={d}>{t(`riven.${d}`, lang)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t("riven.stats", lang)} ({selectedStats.length}/4)</label>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {COMMON_STATS.map(stat => (
                <button
                  key={stat}
                  onClick={() => toggleStat(stat)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    selectedStats.includes(stat)
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent"
                  }`}
                >
                  {stat}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasNegative}
              onChange={e => setHasNegative(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-wf-primary focus:ring-wf-primary"
            />
            <span className="text-sm text-gray-300">{t("riven.hasNegative", lang)}</span>
          </label>

          <button
            onClick={handleEstimate}
            disabled={loading || !weaponName || !weaponPrice || selectedStats.length < 2}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? t("riven.estimating", lang) : t("riven.estimate", lang)}
          </button>
        </div>

        {result && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-400" />
              {t("riven.estimatedPrice", lang)}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">{result.estimated_price}p</p>
                <p className="text-xs text-gray-500 mt-1">{t("riven.estimatedPrice", lang)}</p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 text-center">
                <p className="text-lg font-bold text-cyan-400">{result.price_range[0]}p — {result.price_range[1]}p</p>
                <p className="text-xs text-gray-500 mt-1">{t("riven.priceRange", lang)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-xs">{t("riven.deviation", lang)}</p>
                <p className="text-white font-medium">{result.deviation}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-xs">{t("riven.uplevelMult", lang)}</p>
                <p className="text-white font-medium">{result.uplevel_mult}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-xs">{t("riven.disposition", lang)}</p>
                <p className="text-white font-medium">{result.disposition_mult}x</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">{t("riven.statDetail", lang)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="text-left py-2 px-1">{t("riven.property", lang)}</th>
                      <th className="text-right py-2 px-1">{t("riven.baseValue", lang)}</th>
                      <th className="text-right py-2 px-1">{t("riven.range", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stats.map((s, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 px-1 text-gray-200">{s.property}</td>
                        <td className="py-2 px-1 text-right text-gray-300">{s.base_value}</td>
                        <td className="py-2 px-1 text-right text-gray-400">{s.range[0]} — {s.range[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

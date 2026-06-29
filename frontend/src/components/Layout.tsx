import { Outlet, NavLink } from "react-router-dom";
import { Hexagon, LayoutDashboard, Heart, Search, ArrowUpDown, Settings, History, MessageSquare, BadgePercent, BarChart3, Package, Globe, Diamond, SlidersHorizontal, FileUp, Sun, Moon } from "lucide-react";
import { useThemeStore } from "../stores/useThemeStore";
import { useLangStore } from "../stores/useLangStore";
import { t } from "../lib/i18n";

const navItems = [
  { to: "/", icon: LayoutDashboard, key: "dashboard" },
  { to: "/items", icon: Search, key: "items" },
  { to: "/trading", icon: ArrowUpDown, key: "trading" },
  { to: "/market-analytics", icon: BarChart3, key: "market" },
  { to: "/trade-entries", icon: MessageSquare, key: "tradeChat" },
  { to: "/process-trade", icon: BadgePercent, key: "process" },
  { to: "/transactions", icon: History, key: "history" },
  { to: "/inventory", icon: Package, key: "inventory" },
  { to: "/watchlist", icon: Heart, key: "watchlist" },
  { to: "/worldstate", icon: Globe, key: "worldstate" },
  { to: "/riven", icon: Diamond, key: "riven" },
  { to: "/knapsack", icon: SlidersHorizontal, key: "optimizer" },
  { to: "/gdpr-import", icon: FileUp, key: "gdpr" },
  { to: "/settings", icon: Settings, key: "settings" },
];

export default function Layout() {
  const { theme, toggle } = useThemeStore();
  const { lang } = useLangStore();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-wf-card border-b border-white/5 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Hexagon className="text-wf-primary" size={24} fill="rgba(0,212,255,0.1)" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-wf-primary shadow-glow" />
              </div>
            </div>
            <h1 className="font-display text-lg font-bold tracking-wider text-white">
              WARFRAME <span className="text-wf-primary">NEXUS</span>
            </h1>
          </div>
          <div className="flex items-center gap-1 overflow-hidden">
            <nav className="flex gap-1 overflow-x-auto scrollbar-none">
              {navItems.map(({ to, icon: Icon, key }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-wf-primary/10 text-wf-primary shadow-glow"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <Icon size={16} />
                  {t(`nav.${key}`, lang)}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors ml-2"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <Outlet />
      </main>
    </div>
  );
}

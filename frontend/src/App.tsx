import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ItemsPage from "./pages/ItemsPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import WatchlistPage from "./pages/WatchlistPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import TradingPage from "./pages/TradingPage";
import TransactionsPage from "./pages/TransactionsPage";
import TradeEntriesPage from "./pages/TradeEntriesPage";
import ProcessTradePage from "./pages/ProcessTradePage";
import MarketAnalyticsPage from "./pages/MarketAnalyticsPage";
import InventoryPage from "./pages/InventoryPage";
import WorldStatePage from "./pages/WorldStatePage";
import RivenPage from "./pages/RivenPage";
import KnapsackPage from "./pages/KnapsackPage";
import GdprImportPage from "./pages/GdprImportPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/items/:slug" element={<ItemDetailPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/trading" element={<TradingPage />} />
        <Route path="/trade-entries" element={<TradeEntriesPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/process-trade" element={<ProcessTradePage />} />
        <Route path="/market-analytics" element={<MarketAnalyticsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/worldstate" element={<WorldStatePage />} />
        <Route path="/riven" element={<RivenPage />} />
        <Route path="/knapsack" element={<KnapsackPage />} />
        <Route path="/gdpr-import" element={<GdprImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

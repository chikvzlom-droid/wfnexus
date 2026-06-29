const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export interface Item {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  subcategory: string | null;
  ducats: number | null;
  mod_rank: number | null;
  is_set: boolean;
  thumbnail: string | null;
}

export interface ItemSearchResult {
  query: string;
  total: number;
  items: Item[];
}

export interface OraclePrice {
  item_id: string;
  oracle_price: number | null;
  strategy: string;
  confidence: number;
  sample_size: number;
}

export interface PriceHistoryPoint {
  recorded_at: string;
  oracle_price: number | null;
  min_price: number | null;
  max_price: number | null;
  open_price: number | null;
  closed_price: number | null;
  avg_price: number | null;
  wa_price: number | null;
  median_price: number | null;
  moving_avg: number | null;
  donch_top: number | null;
  donch_bot: number | null;
  sample_size: number;
  volume: number;
  sell_count: number;
  buy_count: number;
  supply: number;
  demand: number;
}

export interface PriceDistributionBucket {
  range_start: number;
  range_end: number;
  count: number;
}

export interface OrderDistribution {
  slug: string;
  sell_count: number;
  buy_count: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  median_price: number | null;
  buckets: PriceDistributionBucket[];
}

export interface PriceHistory {
  slug: string;
  points: PriceHistoryPoint[];
}

export interface WatchlistEntry {
  id: number;
  item_id: string;
  target_price: number;
  direction: "above" | "below";
  notify: boolean;
  item: Item | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(detail.detail || resp.statusText);
  }
  return resp.json();
}

export interface RivenProperty {
  name: string;
  base: number;
  min: number;
  max: number;
}

export interface RivenStatDetail {
  property: string;
  base_value: number;
  range: number[];
}

export interface RivenPriceOut {
  weapon_name: string;
  estimated_price: number;
  deviation: number;
  disposition: string;
  disposition_mult: number;
  uplevel_mult: number;
  negative_mult: number;
  n_stats: number;
  has_negative: boolean;
  stats: RivenStatDetail[];
  price_range: number[];
}

export interface KnapsackItem {
  item_id: string;
  item_name: string;
  buy_price: number;
  sell_price: number;
  max_quantity: number;
}

export interface KnapsackResultItem {
  item_id: string;
  item_name: string;
  buy_price: number;
  sell_price: number;
  quantity: number;
  total_cost: number;
  total_profit: number;
}

export interface KnapsackOut {
  total_cost: number;
  total_profit: number;
  total_revenue: number;
  items: KnapsackResultItem[];
}

export interface GdprImportResult {
  created: number;
  errors: string[];
}

export const api = {
  // Items
  searchItems: (q: string, limit = 50) =>
    request<ItemSearchResult>(`/market/items?q=${encodeURIComponent(q)}&limit=${limit}`),

  fuzzySearchItems: (q: string, limit = 20) =>
    request<FuzzySearchOut>(`/market/items/fuzzy?q=${encodeURIComponent(q)}&limit=${limit}`),

  getItem: (slug: string) => request<Item>(`/market/items/${slug}`),

  // Orders
  getOrders: (slug: string) => request<{ sell_orders: unknown[]; buy_orders: unknown[] }>(`/market/items/${slug}/orders`),

  // Oracle
  getOracle: (slug: string, strategy = "dynamic") =>
    request<OraclePrice>(`/market/items/${slug}/oracle?strategy=${strategy}`),

  // Orders distribution (histogram)
  getOrderDistribution: (slug: string) =>
    request<OrderDistribution>(`/market/items/${slug}/orders/distribution`),

  // Price history
  getLiveAnalytics: (slug: string) =>
    request<PriceHistory>(`/market/items/${slug}/live-analytics`),

  getPriceHistory: (slug: string, limit = 168, from_date?: string, to_date?: string) => {
    const sp = new URLSearchParams({ limit: String(limit) });
    if (from_date) sp.set("from_date", from_date);
    if (to_date) sp.set("to_date", to_date);
    return request<PriceHistory>(`/market/items/${slug}/history?${sp}`);
  },

  // Sync
  syncCatalogue: () => request<{ synced: number; message: string }>("/market/sync", { method: "POST" }),

  syncAllPrices: () => request<{ started: boolean; message: string }>("/market/sync-all-prices", { method: "POST" }),

  // Market Analytics
  getMarketAnalytics: (params?: {
    page?: number; limit?: number; sort_by?: string; sort_order?: string;
    q?: string; tags?: string; from_date?: string; to_date?: string;
    volume_gt?: number; volume_lt?: number;
    supply_gt?: number; supply_lt?: number;
    demand_gt?: number; demand_lt?: number;
    min_price_gt?: number; min_price_lt?: number;
    max_price_gt?: number; max_price_lt?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.sort_by) sp.set("sort_by", params.sort_by);
    if (params?.sort_order) sp.set("sort_order", params.sort_order);
    if (params?.q) sp.set("q", params.q);
    if (params?.tags) sp.set("tags", params.tags);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    if (params?.volume_gt !== undefined) sp.set("volume_gt", String(params.volume_gt));
    if (params?.volume_lt !== undefined) sp.set("volume_lt", String(params.volume_lt));
    if (params?.supply_gt !== undefined) sp.set("supply_gt", String(params.supply_gt));
    if (params?.supply_lt !== undefined) sp.set("supply_lt", String(params.supply_lt));
    if (params?.demand_gt !== undefined) sp.set("demand_gt", String(params.demand_gt));
    if (params?.demand_lt !== undefined) sp.set("demand_lt", String(params.demand_lt));
    if (params?.min_price_gt !== undefined) sp.set("min_price_gt", String(params.min_price_gt));
    if (params?.min_price_lt !== undefined) sp.set("min_price_lt", String(params.min_price_lt));
    if (params?.max_price_gt !== undefined) sp.set("max_price_gt", String(params.max_price_gt));
    if (params?.max_price_lt !== undefined) sp.set("max_price_lt", String(params.max_price_lt));
    return request<PaginatedAnalytics>(`/market/analytics?${sp}`);
  },

  // Watchlist
  getWatchlist: () => request<WatchlistEntry[]>("/market/watchlist"),

  addWatchlist: (data: { item_id: string; target_price: number; direction: string }) =>
    request<WatchlistEntry>("/market/watchlist", { method: "POST", body: JSON.stringify(data) }),

  removeWatchlist: (id: number) =>
    fetch(`${API_BASE}/market/watchlist/${id}`, { method: "DELETE" }),

  // Trading
  listTradeOrders: () => request<TradeOrder[]>("/trading/orders"),

  createTradeOrder: (data: { item_id: string; order_type: string; platinum: number; quantity: number; visible: boolean }) =>
    request<TradeOrder>("/trading/orders", { method: "POST", body: JSON.stringify(data) }),

  deleteTradeOrder: (id: number) =>
    fetch(`${API_BASE}/trading/orders/${id}`, { method: "DELETE" }),

  syncTradeWithWfm: () => request<{ posted: number; deleted: number; imported: number; errors: string[] }>(
    "/trading/sync", { method: "POST" }
  ),

  // Transactions
  listTransactions: (params?: { page?: number; limit?: number; transaction_type?: string; item_type?: string; q?: string; from_date?: string; to_date?: string; sort_by?: string; sort_order?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.transaction_type) sp.set("transaction_type", params.transaction_type);
    if (params?.item_type) sp.set("item_type", params.item_type);
    if (params?.q) sp.set("q", params.q);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    if (params?.sort_by) sp.set("sort_by", params.sort_by);
    if (params?.sort_order) sp.set("sort_order", params.sort_order);
    return request<PaginatedTransactions>(`/trading/transactions?${sp}`);
  },

  createTransaction: (data: { item_id: string; transaction_type: string; price: number; quantity?: number; user_name?: string; credits?: number; notes?: string }) =>
    request<Transaction>("/trading/transactions", { method: "POST", body: JSON.stringify(data) }),

  updateTransaction: (id: number, data: { price?: number; quantity?: number; user_name?: string; credits?: number; notes?: string; is_locked?: boolean }) =>
    request<Transaction>(`/trading/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTransaction: (id: number) =>
    fetch(`${API_BASE}/trading/transactions/${id}`, { method: "DELETE" }),

  getTransactionReport: () => request<TransactionReport>("/trading/transactions/report"),

  getDashboard: () => request<DashboardData>("/trading/dashboard"),

  // Process Trade (batch)
  processTrade: (data: { transaction_type: string; user_name: string; items: { item_id: string; quantity: number; price: number; credits?: number; notes?: string }[] }) =>
    request<Transaction[]>("/trading/process", { method: "POST", body: JSON.stringify(data) }),

  // Trade Entries
  listTradeEntries: (params?: { page?: number; limit?: number; group?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.group) sp.set("group", params.group);
    if (params?.q) sp.set("q", params.q);
    return request<PaginatedTradeEntries>(`/trading/trade-entries?${sp}`);
  },

  createTradeEntry: (data: { item_id?: string; item_name?: string; price: number; quantity?: number; group?: string; tags?: string; notes?: string }) =>
    request<TradeEntryItem>("/trading/trade-entries", { method: "POST", body: JSON.stringify(data) }),

  updateTradeEntry: (id: number, data: { price?: number; quantity?: number; tags?: string; notes?: string }) =>
    request<TradeEntryItem>(`/trading/trade-entries/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTradeEntry: (id: number) =>
    fetch(`${API_BASE}/trading/trade-entries/${id}`, { method: "DELETE" }),

  generateTradeMessage: (ids: number[]) =>
    request<{ message: string; count: number }>("/trading/trade-entries/generate-message", { method: "POST", body: JSON.stringify({ ids }) }),

  // Inventory
  listInventory: (params?: { page?: number; limit?: number; q?: string; location?: string; sort_by?: string; sort_order?: string }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.q) sp.set("q", params.q);
    if (params?.location) sp.set("location", params.location);
    if (params?.sort_by) sp.set("sort_by", params.sort_by);
    if (params?.sort_order) sp.set("sort_order", params.sort_order);
    return request<PaginatedInventory>(`/inventory?${sp}`);
  },

  createInventoryItem: (data: { item_name: string; quantity?: number; acquired_price?: number; location?: string; notes?: string }) =>
    request<InventoryItem>("/inventory", { method: "POST", body: JSON.stringify(data) }),

  updateInventoryItem: (id: number, data: { item_name?: string; quantity?: number; acquired_price?: number; location?: string; notes?: string }) =>
    request<InventoryItem>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteInventoryItem: (id: number) =>
    fetch(`${API_BASE}/inventory/${id}`, { method: "DELETE" }),

  bulkImportInventory: (text: string, location?: string) =>
    request<BulkImportResult>("/inventory/bulk-import", { method: "POST", body: JSON.stringify({ text, location }) }),

  getAppraisal: () => request<AppraisalOut>("/inventory/appraisal"),

  // World State
  getWorldState: () => request<WorldState>("/worldstate"),

  // Sync status
  getSyncStatus: () => request<SyncStatus>("/market/sync-status"),

  // Settings
  getNotificationSettings: () => request<NotificationSettings>("/settings/notifications"),

  updateNotificationSettings: (data: { ntfy_topic?: string; discord_webhook_url?: string }) =>
    request<NotificationSettings>("/settings/notifications", { method: "PUT", body: JSON.stringify(data) }),

  testNotificationSettings: () => request<{ sent: string[]; configured: Record<string, boolean> }>(
    "/settings/notifications/test", { method: "POST" }
  ),

  // Riven
  listRivenProperties: () => request<RivenProperty[]>("/riven/properties"),

  estimateRiven: (data: { weapon_name: string; weapon_base_price: number; stats: string[]; has_negative: boolean; disposition: string }) =>
    request<RivenPriceOut>("/riven/estimate", { method: "POST", body: JSON.stringify(data) }),

  // GDPR Import
  importGdpr: (data: Record<string, unknown>) =>
    request<GdprImportResult>("/trading/import-gdpr", { method: "POST", body: JSON.stringify(data) }),

  // Knapsack
  knapsackOptimize: (data: { budget: number; items: KnapsackItem[] }) =>
    request<KnapsackOut>("/trading/knapsack", { method: "POST", body: JSON.stringify(data) }),
};

export interface TradeOrder {
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

export interface Transaction {
  id: number;
  item_id: string;
  wfm_id: string | null;
  wfm_url: string | null;
  item_name: string;
  item_unique_name: string | null;
  item_type: string;
  transaction_type: string;
  price: number;
  quantity: number;
  profit: number | null;
  credits: number;
  user_name: string;
  tags: string;
  notes: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  item: Item | null;
}

export interface PaginatedTransactions {
  results: Transaction[];
  total: number;
  page: number;
  total_pages: number;
}

export interface TradeEntryItem {
  id: number;
  item_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
  group: string;
  tags: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item: Item | null;
  potential_profit: number | null;
  min_price: number | null;
  market_price: number | null;
}

export interface PaginatedTradeEntries {
  results: TradeEntryItem[];
  total: number;
  page: number;
  total_pages: number;
}

export interface NotificationSettings {
  ntfy_topic: string;
  discord_webhook_url: string;
}

export interface CategoryReport {
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  count: number;
  profit_margin: number;
}

export interface TransactionReport {
  total_transactions: number;
  sale_count: number;
  purchases_count: number;
  revenue: number;
  expenses: number;
  total_profit: number;
  average_profit: number;
  profit_margin: number;
  roi: number;
  highest_revenue: number;
  highest_expense: number;
  categories: CategoryReport[];
}

export interface DailyProfit {
  date: string;
  profit: number;
  sales: number;
  purchases: number;
}

export interface PriceAnalyticsItem {
  id: number;
  item_id: string;
  item_name: string;
  item_slug: string;
  item_category: string | null;
  item_thumbnail: string | null;
  tags: string[];
  oracle_price: number | null;
  min_price: number | null;
  max_price: number | null;
  open_price: number | null;
  closed_price: number | null;
  avg_price: number | null;
  wa_price: number | null;
  median_price: number | null;
  moving_avg: number | null;
  donch_top: number | null;
  donch_bot: number | null;
  sample_size: number;
  volume: number;
  sell_count: number;
  buy_count: number;
  supply: number;
  demand: number;
  trading_tax: number;
  recorded_at: string | null;
}

export interface PaginatedAnalytics {
  results: PriceAnalyticsItem[];
  total: number;
  page: number;
  total_pages: number;
}

export interface SyncStatus {
  running: boolean;
  total: number;
  done: number;
  errors: number;
  last_full_sync: string | null;
  last_watchlist_sync: string | null;
  items_with_snapshots: number;
}

export interface InventoryItem {
  id: number;
  item_id: string | null;
  item_name: string;
  quantity: number;
  acquired_price: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item: Item | null;
}

export interface PaginatedInventory {
  results: InventoryItem[];
  total: number;
  page: number;
  total_pages: number;
}

export interface FuzzySearchResult {
  item: Item;
  score: number;
}

export interface FuzzySearchOut {
  query: string;
  results: FuzzySearchResult[];
}

export interface AppraisalItem {
  id: number;
  item_name: string;
  quantity: number;
  acquired_price: number | null;
  oracle_price: number | null;
  estimated_value: number | null;
  potential_profit: number | null;
  item: Item | null;
}

export interface AppraisalOut {
  total_estimated_value: number;
  total_potential_profit: number;
  total_items: number;
  items: AppraisalItem[];
}

export interface BulkImportResult {
  created: number;
  failed: string[];
}

export interface Fissure {
  id: string;
  node: string;
  mission_type: string;
  mission: string;
  tier: string;
  tier_num: number;
  eta: string;
}

export interface VoidTrader {
  id: string;
  location: string;
  inventory: { item: string; ducats: number; platinum: number }[];
  active: boolean;
}

export interface Cycle {
  id: string;
  state: string;
  time_left: string;
  is_day: boolean | null;
}

export interface WorldState {
  fissures: Fissure[];
  void_trader: VoidTrader | null;
  alerts: { id: string; mission: string | null; reward: string | null; eta: string }[];
  sortie: { id: string; boss: string; faction: string } | null;
  cetus_cycle: Cycle | null;
  vallis_cycle: Cycle | null;
  cambion_cycle: Cycle | null;
  nightwave: unknown[];
}

export interface DashboardData {
  total_transactions: number;
  total_revenue: number;
  total_expenses: number;
  total_profit: number;
  today_transactions: number;
  today_profit: number;
  best_seller_name: string;
  best_seller_profit: number;
  best_seller_count: number;
  daily_profit: DailyProfit[];
  recent_transactions: Transaction[];
  categories: CategoryReport[];
}



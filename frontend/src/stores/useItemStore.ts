import { create } from "zustand";
import type { Item, OraclePrice } from "../lib/api";

interface ItemStore {
  searchQuery: string;
  results: Item[];
  selectedItem: Item | null;
  oracle: OraclePrice | null;
  loading: boolean;
  error: string | null;
  setSearchQuery: (q: string) => void;
  setResults: (items: Item[]) => void;
  setSelectedItem: (item: Item | null) => void;
  setOracle: (oracle: OraclePrice | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useItemStore = create<ItemStore>((set) => ({
  searchQuery: "",
  results: [],
  selectedItem: null,
  oracle: null,
  loading: false,
  error: null,
  setSearchQuery: (q) => set({ searchQuery: q }),
  setResults: (items) => set({ results: items }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setOracle: (oracle) => set({ oracle }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
}));

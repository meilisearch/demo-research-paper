"use client";

import { create } from "zustand";
import type { SearchRequest, SortOption } from "@/lib/types";

type FilterKey = "primaryCategory" | "topics" | "authors";

interface SearchState extends SearchRequest {
  setQ: (q: string) => void;
  setSemanticRatio: (r: number) => void;
  setSort: (s: SortOption) => void;
  setPage: (p: number) => void;
  toggleFilter: (key: FilterKey, value: string) => void;
  setYears: (min?: number, max?: number) => void;
  reset: () => void;
}

const EMPTY_FILTERS: SearchRequest["filters"] = { primaryCategory: [], topics: [], authors: [] };

export const useSearch = create<SearchState>()((set) => ({
  q: "",
  semanticRatio: 0.5,
  page: 1,
  sort: "relevance",
  filters: EMPTY_FILTERS,
  setQ: (q) => set({ q, page: 1 }),
  setSemanticRatio: (semanticRatio) => set({ semanticRatio, page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  toggleFilter: (key, value) =>
    set((s) => {
      const current = s.filters[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { filters: { ...s.filters, [key]: next }, page: 1 };
    }),
  setYears: (yearMin, yearMax) => set((s) => ({ filters: { ...s.filters, yearMin, yearMax }, page: 1 })),
  reset: () => set({ filters: EMPTY_FILTERS, page: 1 }),
}));

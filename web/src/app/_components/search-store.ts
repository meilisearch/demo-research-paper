"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { SearchRequest, SortOption } from "@/lib/types";

export type FilterKey = "primaryCategory" | "topics" | "authors";

interface SearchState extends SearchRequest {
  /** The paper open in the side sheet. */
  paper: string | null;
  setQ: (q: string) => void;
  setSort: (s: SortOption) => void;
  setPage: (p: number) => void;
  setPaper: (id: string | null) => void;
  toggleFilter: (key: FilterKey, value: string) => void;
  setYears: (min?: number, max?: number) => void;
  reset: () => void;
}

const EMPTY_FILTERS: SearchRequest["filters"] = { primaryCategory: [], topics: [], authors: [] };
const SORTS: SortOption[] = ["relevance", "newest", "oldest", "citations"];

export const useSearch = create<SearchState>()((set) => ({
  q: "",
  page: 1,
  sort: "relevance",
  filters: EMPTY_FILTERS,
  paper: null,
  setQ: (q) => set({ q, page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  setPaper: (paper) => set({ paper }),
  toggleFilter: (key, value) =>
    set((s) => {
      const current = s.filters[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { filters: { ...s.filters, [key]: next }, page: 1 };
    }),
  setYears: (yearMin, yearMax) => set((s) => ({ filters: { ...s.filters, yearMin, yearMax }, page: 1 })),
  reset: () => set({ filters: EMPTY_FILTERS, page: 1 }),
}));

export const activeFilterCount = (f: SearchRequest["filters"]) =>
  f.primaryCategory.length +
  f.topics.length +
  f.authors.length +
  (f.yearMin !== undefined || f.yearMax !== undefined ? 1 : 0);

// ---- URL state: every search and open paper is a shareable link ------------

const LIST_PARAMS: Record<FilterKey, string> = { primaryCategory: "category", topics: "topic", authors: "author" };

function toParams(s: SearchState) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  for (const [key, name] of Object.entries(LIST_PARAMS)) for (const v of s.filters[key as FilterKey]) p.append(name, v);
  if (s.filters.yearMin !== undefined) p.set("from", String(s.filters.yearMin));
  if (s.filters.yearMax !== undefined) p.set("to", String(s.filters.yearMax));
  if (s.sort !== "relevance") p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  if (s.paper) p.set("paper", s.paper);
  return p.toString();
}

function fromParams(p: URLSearchParams): Partial<SearchState> {
  const int = (name: string) => {
    const n = Number.parseInt(p.get(name) ?? "", 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const sort = p.get("sort") as SortOption | null;
  return {
    q: p.get("q") ?? "",
    filters: {
      primaryCategory: p.getAll(LIST_PARAMS.primaryCategory),
      topics: p.getAll(LIST_PARAMS.topics),
      authors: p.getAll(LIST_PARAMS.authors),
      yearMin: int("from"),
      yearMax: int("to"),
    },
    sort: sort && SORTS.includes(sort) ? sort : "relevance",
    page: Math.max(1, int("page") ?? 1),
    paper: p.get("paper"),
  };
}

/** Two-way sync between the search store and the query string. */
export function useSearchUrlSync() {
  useEffect(() => {
    const read = () => useSearch.setState(fromParams(new URLSearchParams(window.location.search)));
    read();
    window.addEventListener("popstate", read);
    const unsubscribe = useSearch.subscribe((s, prev) => {
      const next = toParams(s);
      if (next === window.location.search.replace(/^\?/, "")) return;
      const url = next ? `?${next}` : window.location.pathname;
      // Opening a paper is a navigation (Back closes it); typing and filtering only replace the entry.
      if (s.paper && s.paper !== prev.paper) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    });
    return () => {
      unsubscribe();
      window.removeEventListener("popstate", read);
    };
  }, []);
}

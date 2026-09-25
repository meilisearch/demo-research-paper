"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ReadingListItem {
  id: string;
  title: string;
  arxivId: string;
  year: number;
}

interface ReadingListState {
  items: ReadingListItem[];
  toggle: (item: ReadingListItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useReadingList = create<ReadingListState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (item) =>
        set((s) =>
          s.items.some((i) => i.id === item.id)
            ? { items: s.items.filter((i) => i.id !== item.id) }
            : { items: [...s.items, item] },
        ),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "paperscope-reading-list" },
  ),
);

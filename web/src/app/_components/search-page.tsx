"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Search, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EMBEDDER_MODEL, getPaperCount, SEMANTIC_RATIO, searchPapers, WEAK_MATCH_SCORE } from "@/lib/search-api";
import type { SortOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { categoryName, formatCount } from "./categories";
import { FacetsPanel } from "./facets-panel";
import { isSemantic, PaperCard } from "./paper-card";
import { PaperSheet } from "./paper-sheet";
import { activeFilterCount, type FilterKey, useSearch, useSearchUrlSync } from "./search-store";

const SORTS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "citations", label: "Most cited" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const EXAMPLES = [
  "attention is all you need",
  "Geoffrey Hinton",
  "reduce hallucinations with retrieval",
  "robots that learn by watching humans",
  "tranformer for images", // typo on purpose
  "making neural networks small enough to run on a phone",
];

/** Every keystroke of a hybrid search embeds the query on the server: wait for a short pause. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** The filters in effect, as removable chips right above the results. */
function ActiveFilters() {
  const filters = useSearch((s) => s.filters);
  const toggle = useSearch((s) => s.toggleFilter);
  const setYears = useSearch((s) => s.setYears);
  const reset = useSearch((s) => s.reset);
  if (activeFilterCount(filters) === 0) return null;

  const chips: { key: string; label: string; remove: () => void }[] = [];
  const add = (facet: FilterKey, label: (v: string) => string) =>
    filters[facet].forEach((v) => chips.push({ key: `${facet}:${v}`, label: label(v), remove: () => toggle(facet, v) }));
  add("authors", (v) => v);
  add("primaryCategory", categoryName);
  add("topics", (v) => v);
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
    chips.push({
      key: "years",
      label: `${filters.yearMin ?? "…"}–${filters.yearMax ?? "today"}`,
      remove: () => setYears(undefined, undefined),
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Filtered to</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.remove}
          aria-label={`Remove filter ${c.label}`}
          className="flex items-center gap-1 rounded-sm border border-arxiv/30 bg-arxiv/5 px-2 py-0.5 text-foreground hover:border-arxiv hover:bg-arxiv/10"
        >
          {c.label} <X className="size-3 text-muted-foreground" />
        </button>
      ))}
      {chips.length > 1 && (
        <button onClick={reset} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
}

export function SearchPage() {
  useSearchUrlSync();
  const state = useSearch();
  const [showFilters, setShowFilters] = useState(false);
  const q = useDebounced(state.q, 150);
  const request = { q, page: state.page, sort: state.sort, filters: state.filters };

  const { data: paperCount } = useQuery({ queryKey: ["paper-count"], queryFn: getPaperCount });
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", request],
    queryFn: ({ signal }) => searchPapers(request, signal),
    placeholderData: keepPreviousData,
  });

  // Semantic search ranks every paper, so the total count isn't meaningful: cap paging instead.
  const semantic = !!request.q.trim();
  const totalPages = data ? (semantic ? Math.min(data.totalPages, 10) : data.totalPages) : 0;
  // No keyword matched anything and the closest meaning is far off: say so rather than show "89% match" as a hit.
  const weak =
    semantic &&
    !!data &&
    data.page === 1 &&
    data.hits.length > 0 &&
    data.hits.every(isSemantic) &&
    (data.hits[0]._rankingScore ?? 0) < WEAK_MATCH_SCORE;
  const filterCount = activeFilterCount(state.filters);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20">
      <section className="max-w-4xl pt-10 pb-8">
        <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-[44px]">
          Search {paperCount ? paperCount.toLocaleString("en-US") : "…"} AI research papers
        </h1>
        <p className="mt-2 max-w-2xl font-serif text-lg text-muted-foreground">
          Type a title, an author, or describe an idea in your own words. Meilisearch matches both the words and
          the meaning.
        </p>

        <div className="relative mt-6">
          <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={state.q}
            onChange={(e) => state.setQ(e.target.value)}
            placeholder="Search by title, idea, method, author…"
            aria-label="Search papers"
            className="h-14 rounded-sm border-foreground/50 bg-background pr-20 pl-12 font-serif text-lg placeholder:italic focus-visible:border-arxiv focus-visible:ring-arxiv/15 md:text-lg dark:bg-background"
          />
          {data && (
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
              {data.processingTimeMs} ms
            </span>
          )}
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Sparkles className="size-3.5 text-arxiv" />
          <span>
            Hybrid search: keyword relevance and meaning, leaning slightly towards keywords. Hover a match score to see how
            Meilisearch ranked the paper.
          </span>
          <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            semanticRatio: {SEMANTIC_RATIO} · {EMBEDDER_MODEL}
          </code>
        </p>

        {!state.q && (
          <p className="mt-4 font-serif text-[15px] leading-relaxed">
            <span className="text-muted-foreground italic">Try </span>
            {EXAMPLES.map((ex, i) => (
              <span key={ex}>
                <button
                  onClick={() => state.setQ(ex)}
                  className="underline decoration-foreground/25 underline-offset-[3px] hover:text-arxiv hover:decoration-arxiv"
                >
                  {ex}
                </button>
                {i < EXAMPLES.length - 1 && <span className="text-muted-foreground">, </span>}
              </span>
            ))}
          </p>
        )}
      </section>

      <div className="grid gap-6 border-t pt-6 lg:grid-cols-[220px_1fr] lg:gap-10">
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start lg:hidden"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal /> {showFilters ? "Hide filters" : "Filters"}
          {filterCount > 0 && <span className="text-arxiv tabular-nums">({filterCount})</span>}
        </Button>
        {/* On small screens the filters fold away so the results come right after the search box. */}
        <div className={cn("lg:block", !showFilters && "hidden")}>
          <FacetsPanel data={data} />
        </div>

        <section className="min-w-0">
          <ActiveFilters />
          {data && data.authors.length > 0 && (
            <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 rounded-sm bg-muted/60 px-4 py-3">
              <span className="font-serif text-sm text-muted-foreground italic">Authors matching “{state.q}”</span>
              {data.authors.map((a) => (
                <button
                  key={a.id}
                  onClick={() => state.toggleFilter("authors", a.name)}
                  className="group flex items-baseline gap-1.5 text-sm"
                >
                  <UserRound className="size-3.5 self-center text-muted-foreground" />
                  <span className="font-medium group-hover:text-arxiv group-hover:underline">{a.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {a.paperCount} papers, cited {formatCount(a.citationCount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
            <p className="text-sm text-muted-foreground">
              {data ? (
                semantic ? (
                  <>
                    Best matches by meaning and keywords
                    {data.semanticHitCount !== undefined && (
                      <>
                        , <span className="text-foreground tabular-nums">{data.semanticHitCount}</span> of them ranked
                        by meaning
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground tabular-nums">{data.totalHits.toLocaleString("en-US")}</span>{" "}
                    papers
                  </>
                )
              ) : (
                "Searching…"
              )}
            </p>
            <div className="flex items-baseline gap-4 text-sm" role="group" aria-label="Sort by">
              <span className="text-muted-foreground">Sort by</span>
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => state.setSort(s.value)}
                  aria-pressed={state.sort === s.value}
                  className={cn(
                    "text-muted-foreground underline-offset-[5px] transition-colors hover:text-foreground",
                    state.sort === s.value && "text-foreground underline decoration-arxiv decoration-2",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {isError && <p className="py-6 text-sm text-destructive">Search failed: Meilisearch did not answer. Try again in a few seconds.</p>}

          {weak && (
            <p className="mt-4 flex gap-2 rounded-sm bg-muted/60 px-4 py-3 font-serif text-[15px] text-muted-foreground">
              <Info className="mt-1 size-4 shrink-0" />
              <span>
                No paper contains these words, and none is close in meaning either. These are the nearest papers by
                meaning, but they are only loosely related. Try other words, or{" "}
                <Link href="/chat" className="text-foreground underline underline-offset-2 hover:text-arxiv">
                  ask the papers
                </Link>
                .
              </span>
            </p>
          )}

          <div className={cn("divide-y transition-opacity", isFetching && "opacity-60")}>
            {!data
              ? Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="space-y-2 py-6 pl-10">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ))
              : data.hits.map((hit) => <PaperCard key={hit.id} hit={hit} onOpen={state.setPaper} />)}
          </div>
          {data && data.hits.length === 0 && (
            <p className="py-16 text-center font-serif text-lg text-muted-foreground">
              No papers match. Try fewer filters, or describe the idea in other words.
            </p>
          )}

          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 border-t pt-6">
              <Button variant="outline" size="sm" disabled={state.page <= 1} onClick={() => state.setPage(state.page - 1)}>
                <ChevronLeft /> Previous
              </Button>
              <span className="font-serif text-sm text-muted-foreground tabular-nums">
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={state.page >= totalPages}
                onClick={() => state.setPage(state.page + 1)}
              >
                Next <ChevronRight />
              </Button>
            </div>
          )}
        </section>
      </div>

      <PaperSheet
        paperId={state.paper}
        onOpenChange={(open) => !open && state.setPaper(null)}
        onOpenPaper={state.setPaper}
        onAuthor={(name) => {
          state.toggleFilter("authors", name);
          state.setPaper(null);
        }}
      />
    </main>
  );
}

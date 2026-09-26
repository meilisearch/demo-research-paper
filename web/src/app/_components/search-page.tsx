"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, UserRound } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { getPaperCount, searchPapers } from "@/lib/search-api";
import type { SortOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCount } from "./categories";
import { FacetsPanel } from "./facets-panel";
import { PaperCard } from "./paper-card";
import { PaperSheet } from "./paper-sheet";
import { useSearch } from "./search-store";

const SORTS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "citations", label: "Most cited" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const EXAMPLES = [
  "attention is all you need",
  "how to make LLMs follow instructions",
  "reduce hallucinations with retrieval",
  "robots learning from videos",
  "tranformer for images", // typo on purpose
  "cheap fine-tuning of big models",
];

function modeLabel(ratio: number) {
  if (ratio === 0) return "Keyword";
  if (ratio === 1) return "Semantic";
  return "Hybrid";
}

export function SearchPage() {
  const state = useSearch();
  const [openId, setOpenId] = useState<string | null>(null);
  const request = useDeferredValue({
    q: state.q,
    semanticRatio: state.semanticRatio,
    page: state.page,
    sort: state.sort,
    filters: state.filters,
  });

  const { data: paperCount } = useQuery({ queryKey: ["paper-count"], queryFn: getPaperCount });
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", request],
    queryFn: ({ signal }) => searchPapers(request, signal),
    placeholderData: keepPreviousData,
  });

  // Semantic search ranks every paper, so the total count isn't meaningful: cap paging instead.
  const semantic = !!request.q.trim() && request.semanticRatio > 0;
  const totalPages = data ? (semantic ? Math.min(data.totalPages, 10) : data.totalPages) : 0;

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

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm whitespace-nowrap">
          <div className="flex items-center gap-3">
            <span className={cn("text-muted-foreground", state.semanticRatio === 0 && "text-foreground")}>
              Exact words
            </span>
            <Slider
              className="data-horizontal:w-32 sm:data-horizontal:w-40"
              aria-label="Balance between keyword and semantic search"
              min={0}
              max={1}
              step={0.1}
              value={[state.semanticRatio]}
              onValueChange={(v) => state.setSemanticRatio((v as number[])[0])}
            />
            <span className={cn("text-muted-foreground", state.semanticRatio === 1 && "text-foreground")}>
              Meaning
            </span>
          </div>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
            {modeLabel(state.semanticRatio)}{" "}
            <code className="font-mono text-[11px] text-muted-foreground">
              semanticRatio: {state.semanticRatio.toFixed(1)}
            </code>
          </span>
        </div>

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

      <div className="grid gap-10 border-t pt-6 lg:grid-cols-[220px_1fr]">
        <FacetsPanel data={data} />

        <section className="min-w-0">
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
                        , <span className="text-foreground tabular-nums">{data.semanticHitCount}</span> of them found
                        only by meaning
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
              : data.hits.map((hit) => <PaperCard key={hit.id} hit={hit} onOpen={setOpenId} />)}
          </div>
          {data && data.hits.length === 0 && (
            <p className="py-16 text-center font-serif text-lg text-muted-foreground">
              No papers match. Move the slider toward <span className="text-foreground">Meaning</span> to search by
              idea instead of exact words.
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
        paperId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
        onOpenPaper={setOpenId}
        onAuthor={(name) => {
          state.toggleFilter("authors", name);
          setOpenId(null);
        }}
      />
    </main>
  );
}

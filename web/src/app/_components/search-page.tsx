"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, Sparkles, Type, UserRound } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import type { SearchResponse, SortOption } from "@/lib/types";
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

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: async (): Promise<{ paperCount: number }> => (await fetch("/api/status")).json(),
  });
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", request],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await fetch("/api/search", { method: "POST", body: JSON.stringify(request) });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  // Semantic search ranks every paper, so the total count isn't meaningful: cap paging instead.
  const semantic = !!request.q.trim() && request.semanticRatio > 0;
  const totalPages = data ? (semantic ? Math.min(data.totalPages, 10) : data.totalPages) : 0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16">
      <section className="py-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Explore {status ? status.paperCount.toLocaleString() : "…"} AI research papers
        </h1>
        <p className="mt-1 text-muted-foreground">
          Hybrid search, recommendations and chat over arXiv — every part of it served by Meilisearch.
        </p>

        <div className="relative mt-5">
          <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={state.q}
            onChange={(e) => state.setQ(e.target.value)}
            placeholder="Search by title, idea, method, author…"
            className="h-12 rounded-xl pl-12 text-base shadow-sm md:text-base"
          />
          {data && (
            <span className="absolute top-1/2 right-4 -translate-y-1/2 font-mono text-xs text-muted-foreground">
              {data.processingTimeMs} ms
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-72 items-center gap-3">
            <Type className="size-4 text-muted-foreground" />
            <Slider
              className="w-40"
              min={0}
              max={1}
              step={0.1}
              value={[state.semanticRatio]}
              onValueChange={(v) => state.setSemanticRatio((v as number[])[0])}
            />
            <Sparkles className="size-4 text-[var(--brand)]" />
            <span className="text-sm">
              <span className="font-medium">{modeLabel(state.semanticRatio)}</span>
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                semanticRatio={state.semanticRatio.toFixed(1)}
              </span>
            </span>
          </div>
          {!state.q && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => state.setQ(ex)}
                  className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <FacetsPanel data={data} />

        <section className="min-w-0 space-y-4">
          {data && data.authors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
              <span className="text-xs text-muted-foreground">Authors matching “{state.q}”</span>
              {data.authors.map((a) => (
                <button
                  key={a.id}
                  onClick={() => state.toggleFilter("authors", a.name)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                >
                  <UserRound className="size-3" />
                  {a.name}
                  <span className="text-muted-foreground">
                    {a.paperCount} papers · {formatCount(a.citationCount)} cites
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {data ? (
                <>
                  {semantic ? (
                    <>Best matches, ranked by meaning + keywords</>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{data.totalHits.toLocaleString()}</span> results
                    </>
                  )}
                  {semantic && data.semanticHitCount !== undefined && (
                    <> · {data.semanticHitCount} on this page came from semantic search</>
                  )}
                </>
              ) : (
                "Searching…"
              )}
            </p>
            <div className="flex rounded-lg border p-0.5">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => state.setSort(s.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors",
                    state.sort === s.value && "bg-muted text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {isError && <p className="text-sm text-destructive">Search failed. Is Meilisearch running?</p>}

          <div className={cn("grid gap-3 transition-opacity", isFetching && "opacity-60")}>
            {!data
              ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
              : data.hits.map((hit) => <PaperCard key={hit.id} hit={hit} onOpen={setOpenId} />)}
            {data && data.hits.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No papers found. Try the semantic mode.</p>
            )}
          </div>

          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={state.page <= 1} onClick={() => state.setPage(state.page - 1)}>
                <ChevronLeft /> Previous
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                {data.page} / {totalPages}
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

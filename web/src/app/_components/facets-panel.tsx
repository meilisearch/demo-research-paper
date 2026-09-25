"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { SearchResponse } from "@/lib/types";
import { categoryName } from "./categories";
import { useSearch } from "./search-store";

type FilterKey = "primaryCategory" | "topics" | "authors";

function FacetList({
  title,
  facet,
  distribution,
  selected,
  limit = 8,
  label = (v: string) => v,
}: {
  title: string;
  facet: FilterKey;
  distribution: Record<string, number> | undefined;
  selected: string[];
  limit?: number;
  label?: (v: string) => string;
}) {
  const toggle = useSearch((s) => s.toggleFilter);
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(distribution ?? {});
  // Keep selected values visible even when they fall out of the distribution.
  for (const s of selected) if (!entries.some(([v]) => v === s)) entries.unshift([s, 0]);
  const shown = expanded ? entries : entries.slice(0, limit);

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <ul className="space-y-1">
        {shown.map(([value, count]) => (
          <li key={value}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted">
              <Checkbox checked={selected.includes(value)} onCheckedChange={() => toggle(facet, value)} />
              <span className="flex-1 truncate" title={value}>
                {label(value)}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
            </label>
          </li>
        ))}
      </ul>
      {entries.length > limit && (
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show ${entries.length - limit} more`}
        </button>
      )}
    </section>
  );
}

/** Author filter backed by Meilisearch facet search (type-ahead over thousands of values). */
function AuthorFacet({ distribution, selected }: { distribution?: Record<string, number>; selected: string[] }) {
  const q = useSearch((s) => s.q);
  const toggle = useSearch((s) => s.toggleFilter);
  const [facetQuery, setFacetQuery] = useState("");
  const deferred = useDeferredValue(facetQuery);
  const { data } = useQuery({
    queryKey: ["facet-search", "authors", deferred, q],
    queryFn: async (): Promise<{ value: string; count: number }[]> =>
      (
        await fetch("/api/facet-search", {
          method: "POST",
          body: JSON.stringify({ facetName: "authors", facetQuery: deferred, q }),
        })
      ).json(),
    enabled: deferred.length > 0,
  });

  return (
    <section className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={facetQuery}
          onChange={(e) => setFacetQuery(e.target.value)}
          placeholder="Find an author…"
          className="h-7 pl-7 text-xs"
        />
      </div>
      {deferred ? (
        <ul className="space-y-1">
          {(data ?? []).map(({ value, count }) => (
            <li key={value}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted">
                <Checkbox checked={selected.includes(value)} onCheckedChange={() => toggle("authors", value)} />
                <span className="flex-1 truncate">{value}</span>
                <span className="font-mono text-xs text-muted-foreground">{count}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <FacetList title="Top in results" facet="authors" distribution={distribution} selected={selected} limit={6} />
      )}
    </section>
  );
}

function YearFacet({ stats }: { stats?: { min: number; max: number } }) {
  const { yearMin, yearMax } = useSearch((s) => s.filters);
  const setYears = useSearch((s) => s.setYears);
  const min = 2000;
  const max = new Date().getFullYear();
  const value = [yearMin ?? min, yearMax ?? max];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Year</h4>
        <span className="font-mono text-xs">
          {value[0]}–{value[1]}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={value}
        onValueChange={(v) => {
          const [a, b] = v as number[];
          setYears(a === min ? undefined : a, b === max ? undefined : b);
        }}
      />
      {stats && (
        <p className="text-[11px] text-muted-foreground">
          Results span {stats.min}–{stats.max}
        </p>
      )}
    </section>
  );
}

export function FacetsPanel({ data }: { data: SearchResponse | undefined }) {
  const filters = useSearch((s) => s.filters);
  const reset = useSearch((s) => s.reset);
  const active =
    filters.primaryCategory.length + filters.topics.length + filters.authors.length +
    (filters.yearMin !== undefined || filters.yearMax !== undefined ? 1 : 0);

  return (
    <aside className="space-y-6">
      {active > 0 && (
        <Button variant="outline" size="sm" onClick={reset} className="w-full">
          <X /> Clear {active} filter{active > 1 && "s"}
        </Button>
      )}
      <FacetList
        title="Category"
        facet="primaryCategory"
        distribution={data?.facetDistribution.primaryCategory}
        selected={filters.primaryCategory}
        label={(v) => `${categoryName(v)}`}
      />
      <YearFacet stats={data?.facetStats.year} />
      <FacetList title="Topic" facet="topics" distribution={data?.facetDistribution.topics} selected={filters.topics} />
      <div className="space-y-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Authors</h4>
        <AuthorFacet distribution={data?.facetDistribution.authors} selected={filters.authors} />
      </div>
    </aside>
  );
}

import { NextResponse } from "next/server";
import type { MultiSearchResponse } from "meilisearch";
import { AUTHORS_INDEX, EMBEDDER, meili, PAPERS_INDEX, quote } from "@/lib/meili";
import type { AuthorHit, PaperHit, SearchRequest, SearchResponse } from "@/lib/types";

const HITS_PER_PAGE = 12;
const FACETS = ["primaryCategory", "topics", "authors", "year", "citationCount"];

const SORTS: Record<SearchRequest["sort"], string[] | undefined> = {
  relevance: undefined,
  newest: ["publishedAt:desc"],
  oldest: ["publishedAt:asc"],
  citations: ["citationCount:desc"],
};

function buildFilter({ filters }: SearchRequest): string[] {
  const out: string[] = [];
  if (filters.primaryCategory.length) out.push(`primaryCategory IN [${filters.primaryCategory.map(quote).join(", ")}]`);
  // topics / authors are AND-ed: each selected value must match.
  for (const t of filters.topics) out.push(`topics = ${quote(t)}`);
  for (const a of filters.authors) out.push(`authors = ${quote(a)}`);
  if (filters.yearMin !== undefined) out.push(`year >= ${filters.yearMin}`);
  if (filters.yearMax !== undefined) out.push(`year <= ${filters.yearMax}`);
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json()) as SearchRequest;
  const q = body.q.trim();
  const filter = buildFilter(body);
  const hybrid = q && body.semanticRatio > 0 ? { embedder: EMBEDDER, semanticRatio: body.semanticRatio } : undefined;

  // One round-trip: papers (hybrid + facets) and matching authors.
  const { results } = (await meili.multiSearch({
    queries: [
      {
        indexUid: PAPERS_INDEX,
        q,
        filter,
        sort: SORTS[body.sort],
        facets: FACETS,
        hitsPerPage: HITS_PER_PAGE,
        page: body.page,
        hybrid,
        attributesToHighlight: ["title", "abstract", "tldr", "authors"],
        attributesToCrop: ["abstract:48"],
        highlightPreTag: "__HL__",
        highlightPostTag: "__/HL__",
        showRankingScore: true,
      },
      ...(q ? [{ indexUid: AUTHORS_INDEX, q, limit: 4, attributesToSearchOn: ["name"], rankingScoreThreshold: 0.85 }] : []),
    ],
  })) as MultiSearchResponse;

  const papers = results[0];
  const response: SearchResponse = {
    hits: papers.hits as PaperHit[],
    totalHits: papers.totalHits ?? papers.estimatedTotalHits ?? 0,
    totalPages: papers.totalPages ?? 1,
    page: papers.page ?? 1,
    processingTimeMs: papers.processingTimeMs,
    facetDistribution: papers.facetDistribution ?? {},
    facetStats: papers.facetStats ?? {},
    semanticHitCount: (papers as { semanticHitCount?: number }).semanticHitCount,
    authors: (results[1]?.hits ?? []) as AuthorHit[],
  };
  return NextResponse.json(response);
}

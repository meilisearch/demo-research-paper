import { Meilisearch, type MultiSearchResponse } from "meilisearch";
import type { AuthorHit, Paper, PaperHit, SearchRequest, SearchResponse } from "./types";

// The browser queries Meilisearch directly with a search-only key scoped to the
// papers and authors indexes. It is public by design: it ships in the bundle.
export const MEILI_URL = process.env.NEXT_PUBLIC_MEILI_URL ?? "http://localhost:7700";
const SEARCH_KEY = process.env.NEXT_PUBLIC_MEILI_SEARCH_KEY ?? "";

export const PAPERS_INDEX = "papers";
export const AUTHORS_INDEX = "authors";
export const EMBEDDER = "bge";

const client = new Meilisearch({ host: MEILI_URL, apiKey: SEARCH_KEY });
const papers = client.index<Paper>(PAPERS_INDEX);

export const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

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

/** One round-trip: papers (hybrid + facets) and matching authors. */
export async function searchPapers(body: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
  const q = body.q.trim();
  const hybrid = q && body.semanticRatio > 0 ? { embedder: EMBEDDER, semanticRatio: body.semanticRatio } : undefined;

  const { results } = (await client.multiSearch(
    {
      queries: [
        {
          indexUid: PAPERS_INDEX,
          q,
          filter: buildFilter(body),
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
        ...(q
          ? [{ indexUid: AUTHORS_INDEX, q, limit: 4, attributesToSearchOn: ["name"], rankingScoreThreshold: 0.85 }]
          : []),
      ],
    },
    { signal },
  )) as MultiSearchResponse;

  const res = results[0];
  return {
    hits: res.hits as PaperHit[],
    totalHits: res.totalHits ?? res.estimatedTotalHits ?? 0,
    totalPages: res.totalPages ?? 1,
    page: res.page ?? 1,
    processingTimeMs: res.processingTimeMs,
    facetDistribution: res.facetDistribution ?? {},
    facetStats: res.facetStats ?? {},
    semanticHitCount: (res as { semanticHitCount?: number }).semanticHitCount,
    authors: (results[1]?.hits ?? []) as AuthorHit[],
  };
}

export interface PaperDetail {
  paper: Paper;
  similar: PaperHit[];
  processingTimeMs: number;
}

/**
 * A paper plus its recommendations from the /similar endpoint. The paper is
 * fetched through search (filter on id) so a search-only key is enough.
 */
export async function getPaper(id: string, sameCategory = false): Promise<PaperDetail> {
  const { hits } = await papers.search("", { filter: `id = ${quote(id)}`, limit: 1 });
  const paper = hits[0];
  if (!paper) throw new Error("Paper not found");

  const similar = await papers.searchSimilarDocuments<PaperHit>({
    id,
    embedder: EMBEDDER,
    limit: 8,
    showRankingScore: true,
    filter: sameCategory ? `primaryCategory = ${quote(paper.primaryCategory)}` : undefined,
  });
  return { paper, similar: similar.hits, processingTimeMs: similar.processingTimeMs };
}

/** Type-ahead inside facet values (e.g. find an author among thousands). */
export async function searchFacetValues(facetName: string, facetQuery: string, q: string) {
  const res = await papers.searchForFacetValues({ facetName, facetQuery, q });
  return res.facetHits.slice(0, 10);
}

export async function getPaperCount() {
  const res = await papers.search("", { hitsPerPage: 0 });
  return res.totalHits ?? 0;
}

export interface Paper {
  id: string;
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  primaryCategory: string;
  categories: string[];
  topics: string[];
  publishedAt: number;
  publishedDate: string;
  year: number;
  updatedAt: number;
  comment: string | null;
  journalRef: string | null;
  doi: string | null;
  absUrl: string;
  pdfUrl: string;
  citationCount: number;
  influentialCitationCount: number;
  venue: string | null;
  tldr: string | null;
}

interface RuleScore {
  order: number;
  score: number;
}

/** `_rankingScoreDetails`: one entry per ranking rule that ranked the hit. */
export interface RankingScoreDetails {
  words?: RuleScore & { matchingWords: number; maxMatchingWords: number };
  typo?: RuleScore & { typoCount: number; maxTypoCount: number };
  proximity?: RuleScore;
  attribute?: RuleScore;
  exactness?: RuleScore & { matchType: string };
  /** Present when the hit came from the semantic (vector) side of a hybrid search. */
  vectorSort?: { order: number; similarity: number; value?: unknown };
  [rule: string]: { order: number; score?: number; value?: unknown } | undefined;
}

export type PaperHit = Paper & {
  _formatted?: Partial<Record<keyof Paper, string | string[]>>;
  _rankingScore?: number;
  _rankingScoreDetails?: RankingScoreDetails;
};

export type SortOption = "relevance" | "newest" | "oldest" | "citations";

export interface SearchRequest {
  q: string;
  page: number;
  sort: SortOption;
  filters: {
    primaryCategory: string[];
    topics: string[];
    authors: string[];
    yearMin?: number;
    yearMax?: number;
  };
}

export interface SearchResponse {
  hits: PaperHit[];
  totalHits: number;
  totalPages: number;
  page: number;
  processingTimeMs: number;
  facetDistribution: Record<string, Record<string, number>>;
  facetStats: Record<string, { min: number; max: number }>;
  semanticHitCount?: number;
  authors: AuthorHit[];
}

export interface AuthorHit {
  id: string;
  name: string;
  paperCount: number;
  citationCount: number;
  topics: string[];
}

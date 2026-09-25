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

export type PaperHit = Paper & {
  _formatted?: Partial<Record<keyof Paper, string | string[]>>;
  _rankingScore?: number;
  _semanticScore?: number;
};

export type SortOption = "relevance" | "newest" | "oldest" | "citations";

export interface SearchRequest {
  q: string;
  semanticRatio: number;
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

"use client";

import { BookmarkCheck, BookmarkPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EMBEDDER_MODEL } from "@/lib/search-api";
import type { Paper, PaperHit, RankingScoreDetails } from "@/lib/types";
import { cn } from "@/lib/utils";
import { categoryName, formatArxivDate, formatCount, initials } from "./categories";
import { Highlight } from "./highlight";
import { useReadingList } from "./reading-list-store";

function authorsLine(hit: PaperHit, max = 4) {
  const names = (hit._formatted?.authors as string[] | undefined) ?? hit.authors;
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}, and ${names.length - max} more` : shown;
}

/** The grey vertical line arXiv stamps down the left margin of a preprint. */
export function ArxivStamp({ paper, className }: { paper: Paper; className?: string }) {
  return (
    <div aria-hidden className={cn("arxiv-stamp", className)}>
      arXiv:{paper.arxivId}&ensp;[{paper.primaryCategory}]&ensp;{formatArxivDate(paper.publishedDate)}
    </div>
  );
}

export function ReadingListButton({ paper, size = "icon-sm" }: { paper: PaperHit; size?: "icon-sm" | "sm" }) {
  const saved = useReadingList((s) => s.items.some((i) => i.id === paper.id));
  const toggle = useReadingList((s) => s.toggle);
  const Icon = saved ? BookmarkCheck : BookmarkPlus;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={size === "sm" ? "outline" : "ghost"}
            size={size}
            aria-label={saved ? "Remove from reading list" : "Add to reading list"}
            onClick={(e) => {
              e.stopPropagation();
              toggle({ id: paper.id, title: paper.title, arxivId: paper.arxivId, year: paper.year });
            }}
          />
        }
      >
        <Icon className={cn(saved && "text-arxiv")} />
        {size === "sm" && (saved ? "In reading list" : "Add to reading list")}
      </TooltipTrigger>
      <TooltipContent>{saved ? "Remove from reading list" : "Add to reading list (to chat with it)"}</TooltipContent>
    </Tooltip>
  );
}

/** In a hybrid search, a hit ranked by its bge embedding carries a `vectorSort` detail instead of keyword rules. */
function isSemantic(hit: PaperHit) {
  return hit._rankingScoreDetails?.vectorSort !== undefined;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

const KEYWORD_RULES: Record<string, (d: NonNullable<RankingScoreDetails[string]>) => string> = {
  words: (d) => {
    const w = d as NonNullable<RankingScoreDetails["words"]>;
    return `${w.matchingWords} of ${w.maxMatchingWords} query words`;
  },
  typo: (d) => {
    const t = d as NonNullable<RankingScoreDetails["typo"]>;
    return t.typoCount === 0 ? "no typos" : `${t.typoCount} typo${t.typoCount > 1 ? "s" : ""}`;
  },
  proximity: () => "query words close together",
  attribute: () => "matched in title, TL;DR or abstract",
  exactness: (d) => `${(d as NonNullable<RankingScoreDetails["exactness"]>).matchType.replace(/([A-Z])/g, " $1").toLowerCase()}`,
};

const RULE_NAMES: Record<string, string> = {
  words: "Words",
  typo: "Typo",
  proximity: "Proximity",
  attribute: "Attribute",
  exactness: "Exactness",
  "citationCount:desc": "Citations",
};

function RankingDetails({ hit, similar }: { hit: PaperHit; similar: boolean }) {
  const details = hit._rankingScoreDetails;
  if (!details) return null;
  if (details.vectorSort) {
    return (
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="size-3.5" /> Ranked by meaning
        </p>
        <p className="text-background/75">
          The paper&apos;s <span className="font-mono">{EMBEDDER_MODEL}</span> embedding is{" "}
          <span className="text-background">{pct(details.vectorSort.similarity)}</span> similar to{" "}
          {similar ? "this paper's" : "your query, even where the words differ"}.
        </p>
      </div>
    );
  }
  const rules = Object.entries(details)
    .filter((e): e is [string, NonNullable<RankingScoreDetails[string]>] => !!e[1])
    .sort(([, a], [, b]) => a.order - b.order);
  return (
    <div className="space-y-1.5">
      <p className="font-medium">Ranked by keywords</p>
      <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5">
        {rules.map(([name, d]) => (
          <div key={name} className="contents">
            <dt className="text-background/60">{RULE_NAMES[name] ?? name}</dt>
            <dd className="text-background/85">
              {KEYWORD_RULES[name]?.(d) ?? (d.value !== undefined ? formatCount(Number(d.value)) : "")}
            </dd>
            <dd className="text-right tabular-nums">{d.score !== undefined ? pct(d.score) : ""}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The ranking score, with how Meilisearch got there on hover. `similar`: a /similar
 * hit, where every result is ranked by meaning, so the badge would only be noise.
 */
function MatchScore({ hit, similar = false }: { hit: PaperHit; similar?: boolean }) {
  if (hit._rankingScore === undefined) return null;
  const semantic = isSemantic(hit);
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 cursor-help items-center gap-1.5 text-xs text-muted-foreground tabular-nums underline decoration-dotted decoration-foreground/30 underline-offset-[3px]"
      >
        {!similar && semantic && (
          <span className="flex items-center gap-1 rounded-sm bg-arxiv/10 px-1.5 py-px text-arxiv no-underline">
            <Sparkles className="size-3" /> by meaning
          </span>
        )}
        {pct(hit._rankingScore)} match
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="block max-w-xs p-3 text-xs leading-snug">
        <RankingDetails hit={hit} similar={similar} />
        <p className="mt-2 border-t border-background/20 pt-1.5 font-mono text-[10.5px] text-background/60">
          _rankingScore: {hit._rankingScore.toFixed(3)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** A search result, laid out like the top of a preprint's first page. */
export function PaperCard({ hit, onOpen }: { hit: PaperHit; onOpen: (id: string) => void }) {
  const f = hit._formatted;
  return (
    <article
      onClick={() => onOpen(hit.id)}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(hit.id)}
      tabIndex={0}
      className="group relative cursor-pointer py-6 pl-9 outline-none focus-visible:ring-2 focus-visible:ring-arxiv/40 sm:pl-12"
    >
      <ArxivStamp
        paper={hit}
        className="absolute top-1/2 left-0 -translate-y-1/2 text-[11.5px] transition-colors group-hover:text-arxiv sm:left-1 sm:text-[12.5px]"
      />

      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {categoryName(hit.primaryCategory)}
              {hit.venue && <span className="text-foreground/70">, {hit.venue}</span>}
            </p>
            <h3 className="mt-1 font-serif text-[19px] leading-snug font-semibold text-balance group-hover:text-arxiv">
              <Highlight value={(f?.title as string) ?? hit.title} />
            </h3>
            <p className="mt-1 truncate font-serif text-[15px] text-foreground/75 italic">
              <Highlight value={authorsLine(hit)} />
            </p>
          </div>
          <ReadingListButton paper={hit} />
        </div>

        <p className="typeset mt-3 line-clamp-3 font-serif text-[15px] leading-[1.55] text-foreground/85">
          <Highlight value={(f?.abstract as string) ?? hit.abstract} />
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span className="text-cite tabular-nums">Cited by {formatCount(hit.citationCount)}</span>
          {hit.topics.length > 0 && (
            <span className="min-w-0 truncate text-muted-foreground">
              <span className="font-serif text-[13px] italic">Keywords:</span> {hit.topics.slice(0, 3).join(", ")}
            </span>
          )}
          <span className="ml-auto">
            <MatchScore hit={hit} />
          </span>
        </div>
      </div>
    </article>
  );
}

/** A similar paper, formatted as a numbered bibliography entry. */
export function PaperReference({ hit, index, onOpen }: { hit: PaperHit; index: number; onOpen: (id: string) => void }) {
  const authors = hit.authors.slice(0, 3).map(initials).join(", ") + (hit.authors.length > 3 ? ", et al." : "");
  return (
    <li className="group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-2">
      <span className="font-serif text-[15px] text-muted-foreground tabular-nums">[{index}]</span>
      <button onClick={() => onOpen(hit.id)} className="min-w-0 text-left font-serif text-[15px] leading-snug">
        {authors.endsWith(".") ? authors : `${authors}.`}{" "}
        <span className="text-foreground underline-offset-2 group-hover:text-arxiv group-hover:underline">
          {hit.title}.
        </span>{" "}
        <span className="text-muted-foreground italic">{hit.venue ?? `arXiv:${hit.arxivId}`}</span>, {hit.year}.{" "}
        <span className="font-sans text-xs whitespace-nowrap text-cite tabular-nums">Cited by {formatCount(hit.citationCount)}</span>
      </button>
      <MatchScore hit={hit} similar />
    </li>
  );
}

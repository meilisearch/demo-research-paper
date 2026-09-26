"use client";

import { BookmarkCheck, BookmarkPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Paper, PaperHit } from "@/lib/types";
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

function MatchScore({ hit }: { hit: PaperHit }) {
  if (hit._rankingScore === undefined) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums"
      title={hit._semanticScore !== undefined ? "Found by semantic search" : "Found by keyword search"}
    >
      {hit._semanticScore !== undefined && <Sparkles className="size-3" />}
      {(hit._rankingScore * 100).toFixed(0)}% match
    </span>
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
      <MatchScore hit={hit} />
    </li>
  );
}

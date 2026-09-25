"use client";

import { BookmarkCheck, BookmarkPlus, Quote, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PaperHit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { categoryName, formatCount } from "./categories";
import { Highlight } from "./highlight";
import { useReadingList } from "./reading-list-store";

function authorsLine(hit: PaperHit, max = 4) {
  const names = (hit._formatted?.authors as string[] | undefined) ?? hit.authors;
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
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
            variant={saved ? "secondary" : "ghost"}
            size={size}
            aria-label={saved ? "Remove from reading list" : "Add to reading list"}
            onClick={(e) => {
              e.stopPropagation();
              toggle({ id: paper.id, title: paper.title, arxivId: paper.arxivId, year: paper.year });
            }}
          />
        }
      >
        <Icon className={cn(saved && "text-[var(--brand)]")} />
        {size === "sm" && (saved ? "In reading list" : "Add to reading list")}
      </TooltipTrigger>
      <TooltipContent>{saved ? "Remove from reading list" : "Add to reading list (to chat with it)"}</TooltipContent>
    </Tooltip>
  );
}

export function PaperCard({
  hit,
  onOpen,
  compact = false,
}: {
  hit: PaperHit;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const f = hit._formatted;
  return (
    <article
      onClick={() => onOpen(hit.id)}
      className="group cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{hit.year}</span>
            <span>·</span>
            <span>{categoryName(hit.primaryCategory)}</span>
            {hit.venue && (
              <>
                <span>·</span>
                <span className="truncate">{hit.venue}</span>
              </>
            )}
          </div>
          <h3 className="font-serif text-[17px] leading-snug font-semibold group-hover:text-[var(--brand)]">
            <Highlight value={(f?.title as string) ?? hit.title} />
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            <Highlight value={authorsLine(hit)} />
          </p>
        </div>
        <ReadingListButton paper={hit} />
      </div>

      {!compact && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/80">
          <Highlight value={(f?.abstract as string) ?? hit.abstract} />
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="gap-1 font-normal">
          <Quote className="size-3" />
          {formatCount(hit.citationCount)} citations
        </Badge>
        {hit.topics.slice(0, compact ? 1 : 3).map((t) => (
          <Badge key={t} variant="secondary" className="font-normal">
            {t}
          </Badge>
        ))}
        {hit._rankingScore !== undefined && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            {hit._semanticScore !== undefined && <Sparkles className="size-3" />}
            {(hit._rankingScore * 100).toFixed(0)}% match
          </span>
        )}
      </div>
    </article>
  );
}

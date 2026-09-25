"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileText, MessagesSquare, Quote, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Paper, PaperHit } from "@/lib/types";
import { categoryName, formatCount } from "./categories";
import { PaperCard, ReadingListButton } from "./paper-card";

interface PaperDetail {
  paper: Paper;
  similar: PaperHit[];
  processingTimeMs: number;
}

export function PaperSheet({
  paperId,
  onOpenChange,
  onOpenPaper,
  onAuthor,
}: {
  paperId: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenPaper: (id: string) => void;
  onAuthor: (name: string) => void;
}) {
  const [sameCategory, setSameCategory] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["paper", paperId, sameCategory],
    queryFn: async (): Promise<PaperDetail> => {
      const res = await fetch(`/api/papers/${paperId}?sameCategory=${sameCategory ? 1 : 0}`);
      if (!res.ok) throw new Error("Failed to load paper");
      return res.json();
    },
    enabled: !!paperId,
  });
  const paper = data?.paper;

  return (
    <Sheet open={!!paperId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
        {isLoading || !paper ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-2 p-6 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">arXiv:{paper.arxivId}</span>
                <span>·</span>
                <span>{paper.publishedDate}</span>
                <span>·</span>
                <span>{categoryName(paper.primaryCategory)}</span>
              </div>
              <SheetTitle className="pr-8 font-serif text-2xl leading-tight">{paper.title}</SheetTitle>
              <SheetDescription render={<div />} className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm">
                {paper.authors.map((a, i) => (
                  <button
                    key={a}
                    onClick={() => onAuthor(a)}
                    className="text-foreground/80 underline-offset-2 hover:text-[var(--brand)] hover:underline"
                  >
                    {a}
                    {i < paper.authors.length - 1 && ","}
                  </button>
                ))}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <ReadingListButton paper={paper} size="sm" />
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/chat?paper=${paper.id}`} />}
                  nativeButton={false}
                >
                  <MessagesSquare /> Ask about this paper
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  render={<a href={paper.pdfUrl} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                >
                  <FileText /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  render={<a href={paper.absUrl} target="_blank" rel="noreferrer" />}
                  nativeButton={false}
                >
                  arXiv <ArrowUpRight />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-4 px-6 pb-6">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="gap-1 font-normal">
                  <Quote className="size-3" /> {formatCount(paper.citationCount)} citations
                </Badge>
                {paper.influentialCitationCount > 0 && (
                  <Badge variant="outline" className="font-normal">
                    {formatCount(paper.influentialCitationCount)} influential
                  </Badge>
                )}
                {paper.venue && <Badge variant="outline" className="font-normal">{paper.venue}</Badge>}
                {paper.topics.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                ))}
              </div>

              {paper.tldr && (
                <div className="rounded-lg border-l-2 border-[var(--brand)] bg-muted/50 px-4 py-3 text-sm">
                  <span className="mr-1 font-semibold">TL;DR</span>
                  {paper.tldr}
                </div>
              )}

              <p className="text-[15px] leading-relaxed text-foreground/85">{paper.abstract}</p>
              {paper.comment && <p className="text-xs text-muted-foreground">{paper.comment}</p>}
            </div>

            <Separator />

            <section className="space-y-3 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="flex items-center gap-2 font-serif text-lg font-semibold">
                    <Sparkles className="size-4 text-[var(--brand)]" /> Similar papers
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Meilisearch <code className="font-mono">/similar</code> · nearest neighbours in embedding space
                    {data && ` · ${data.processingTimeMs} ms`}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sameCategory} onCheckedChange={(v) => setSameCategory(v === true)} />
                  Only {paper.primaryCategory}
                </label>
              </div>
              <div className="grid gap-2">
                {data.similar.map((s) => (
                  <PaperCard key={s.id} hit={s} onOpen={onOpenPaper} compact />
                ))}
              </div>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

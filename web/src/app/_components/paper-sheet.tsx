"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileText, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaper } from "@/lib/search-api";
import { categoryName, formatArxivDate, formatCount } from "./categories";
import { ArxivStamp, PaperReference, ReadingListButton } from "./paper-card";

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
    queryFn: () => getPaper(paperId as string, sameCategory),
    enabled: !!paperId,
  });
  const paper = data?.paper;

  return (
    <Sheet open={!!paperId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-3xl">
        {isLoading || !paper ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="relative">
            <ArxivStamp
              paper={paper}
              className="absolute top-24 left-3 hidden text-[20px] sm:block"
            />

            <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3 pr-12 sm:pl-14">
              <ReadingListButton paper={paper} size="sm" />
              <Button size="sm" variant="outline" render={<Link href={`/chat?paper=${paper.id}`} />} nativeButton={false}>
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
                arXiv page <ArrowUpRight />
              </Button>
            </div>

            <SheetHeader className="items-center gap-3 px-6 pt-10 pb-6 text-center sm:px-14">
              <p className="text-xs text-muted-foreground sm:hidden">arXiv:{paper.arxivId}</p>
              <SheetTitle className="font-serif text-[26px] leading-tight font-semibold text-balance">
                {paper.title}
              </SheetTitle>
              <SheetDescription
                render={<div />}
                className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 font-serif text-[15px] text-foreground"
              >
                {paper.authors.map((a, i) => (
                  <button
                    key={a}
                    onClick={() => onAuthor(a)}
                    title={`Show papers by ${a}`}
                    className="underline-offset-2 hover:text-arxiv hover:underline"
                  >
                    {a}
                    {i < paper.authors.length - 1 && ","}
                  </button>
                ))}
              </SheetDescription>
              <p className="font-serif text-sm text-muted-foreground italic">
                {categoryName(paper.primaryCategory)}
                {paper.venue && `, ${paper.venue}`}, {formatArxivDate(paper.publishedDate)}
              </p>
            </SheetHeader>

            <div className="px-6 pb-8 sm:px-20">
              <h4 className="text-center font-serif text-[15px] font-bold">Abstract</h4>
              <p className="typeset mt-2 font-serif text-[15.5px] leading-[1.6]">{paper.abstract}</p>
              {paper.tldr && (
                <p className="mt-4 font-serif text-[15px] leading-relaxed">
                  <span className="font-bold">TL;DR. </span>
                  <span className="bg-[linear-gradient(transparent_68%,var(--highlight)_68%)]">{paper.tldr}</span>
                </p>
              )}
              {paper.topics.length > 0 && (
                <p className="mt-4 font-serif text-[15px]">
                  <span className="italic">Keywords: </span>
                  {paper.topics.join(", ")}
                </p>
              )}
              <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span className="text-cite tabular-nums">Cited by {formatCount(paper.citationCount)}</span>
                {paper.influentialCitationCount > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    {formatCount(paper.influentialCitationCount)} influential citations
                  </span>
                )}
                {paper.comment && <span className="text-muted-foreground">{paper.comment}</span>}
              </p>
            </div>

            <section className="border-t px-6 py-6 sm:px-14">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="flex items-center gap-2 font-serif text-lg font-bold">
                  <Sparkles className="size-4 self-center text-arxiv" /> Similar papers
                </h4>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sameCategory} onCheckedChange={(v) => setSameCategory(v === true)} />
                  Only {categoryName(paper.primaryCategory)}
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Nearest neighbours in embedding space, from Meilisearch <code className="font-mono">/similar</code>
                {data && <span className="tabular-nums"> in {data.processingTimeMs} ms</span>}
              </p>
              <ol className="mt-4 space-y-3">
                {data.similar.map((s, i) => (
                  <PaperReference key={s.id} hit={s} index={i + 1} onOpen={onOpenPaper} />
                ))}
              </ol>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

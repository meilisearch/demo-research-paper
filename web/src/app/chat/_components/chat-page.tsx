"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, BookMarked, ChevronRight, Globe, Loader2, RotateCcw, Search, Square, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ChatSearchStep, ChatSource, ChatTurn } from "@/lib/chat-types";
import { getPaperCount, getPaper } from "@/lib/search-api";
import { cn } from "@/lib/utils";
import { useReadingList } from "../../_components/reading-list-store";
import { useMeiliChat } from "./use-meili-chat";

type Scope = "all" | "list" | "paper";

interface Status {
  chatEnabled: boolean;
  chatModel: string;
}

const SUGGESTIONS: Record<Scope, string[]> = {
  all: [
    "What are the main approaches to reduce hallucinations in LLMs?",
    "Compare LoRA with other parameter-efficient fine-tuning methods",
    "Which papers introduced diffusion models for image generation?",
    "What's new in state space models since 2023?",
  ],
  list: [
    "Summarise each paper of my reading list in one sentence",
    "What do these papers have in common, and how do they differ?",
    "Which of these papers should I read first and why?",
  ],
  paper: [
    "Explain this paper like I'm a software engineer",
    "What problem does it solve and what are the key results?",
    "What are the limitations of this approach?",
  ],
};

interface ScopedPaper {
  title: string;
  arxivId: string;
  year: number;
}

/** Tells the LLM which papers the tenant token limits its search tool to. */
function scopeContext(scope: Scope, papers: ScopedPaper[]) {
  if (scope === "all" || papers.length === 0) return undefined;
  const what = scope === "list" ? `their reading list (${papers.length} papers)` : "a single paper";
  return [
    `The user is chatting with ${what}:`,
    ...papers.map((p) => `- "${p.title}" (arXiv:${p.arxivId}, ${p.year})`),
    `Your search tool is restricted to ${scope === "list" ? "exactly these papers" : "this paper"}: every search only returns papers from this list.`,
    `When the user says "my reading list", "these papers" or "this paper", they mean ${scope === "list" ? "these" : "this one"}. Search for them by title or topic before answering, and never ask the user which papers they mean.`,
  ].join("\n");
}

function SearchSteps({ searches, active }: { searches: ChatSearchStep[]; active: boolean }) {
  const last = searches[searches.length - 1];
  const found = searches.reduce((n, s) => n + (s.results ?? 0), 0);
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        {active ? <Loader2 className="size-3.5 animate-spin text-arxiv" /> : <Search className="size-3.5" />}
        {active ? (
          <span>
            Searching <span className="text-foreground">&ldquo;{last.q || "all papers"}&rdquo;</span>…
          </span>
        ) : (
          <span>
            Searched the papers {searches.length === 1 ? "once" : `${searches.length} times`}
            {found > 0 && <span className="text-muted-foreground/80"> · {found} results</span>}
          </span>
        )}
        <ChevronRight className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 ml-1.5 space-y-2 border-l pl-3.5 font-mono text-[12.5px] leading-relaxed">
          {searches.map((s) => (
            <li key={s.callId}>
              <div className="break-words">
                <span className="text-arxiv">●</span> Search(
                <span className="text-foreground">&quot;{s.q || "*"}&quot;</span>
                {s.filter && (
                  <>
                    , filter: <span className="text-arxiv">{s.filter}</span>
                  </>
                )}
                )
              </div>
              <div className="pl-4 text-muted-foreground">
                ⎿ {s.results === undefined ? "searching…" : `${s.results} ${s.results === 1 ? "paper" : "papers"}`}
              </div>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function References({ sources }: { sources: ChatSource[] }) {
  return (
    <Collapsible className="border-t pt-3">
      <CollapsibleTrigger className="group flex items-center gap-2 text-left">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" />
        <span className="font-serif text-[15px] font-bold group-hover:text-arxiv">References</span>
        <span className="text-xs text-muted-foreground">{sources.length} papers retrieved by Meilisearch</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 space-y-1">
          {sources.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[2rem_1fr] items-baseline font-serif text-[14.5px] leading-snug">
              <span className="text-muted-foreground tabular-nums">[{i + 1}]</span>
              <a
                href={`https://arxiv.org/abs/${s.arxivId ?? s.id}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:text-arxiv hover:underline"
              >
                {s.title}
                {s.year && <span className="text-muted-foreground">, {s.year}</span>}
              </a>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssistantTurn({ turn, streaming }: { turn: ChatTurn; streaming: boolean }) {
  return (
    <div className="space-y-3">
      {turn.searches.length > 0 && <SearchSteps searches={turn.searches} active={streaming && !turn.content} />}
      {turn.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{turn.error}</p>
      ) : turn.content ? (
        <div className="prose-chat text-[16.5px] leading-[1.65]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
        </div>
      ) : (
        streaming &&
        turn.searches.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Searching Meilisearch…
          </p>
        )
      )}
      {turn.sources.length > 0 && <References sources={turn.sources} />}
    </div>
  );
}

export function ChatPage({ initialScope, paperId }: { initialScope: Scope; paperId?: string }) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const readingList = useReadingList((s) => s.items);
  const removeFromList = useReadingList((s) => s.remove);
  const clearList = useReadingList((s) => s.clear);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: async (): Promise<Status> => (await fetch("/api/status")).json(),
  });
  const { data: paperCount } = useQuery({ queryKey: ["paper-count"], queryFn: getPaperCount });
  const { data: focusPaper } = useQuery({
    queryKey: ["paper", paperId, false],
    queryFn: () => getPaper(paperId as string),
    enabled: !!paperId,
  });

  const scopeIds = useMemo(() => {
    if (scope === "paper" && paperId) return [paperId];
    if (scope === "list") return readingList.map((i) => i.id);
    return undefined;
  }, [scope, paperId, readingList]);

  const context = useMemo(() => {
    if (scope === "paper") return focusPaper ? scopeContext(scope, [focusPaper.paper]) : undefined;
    return scopeContext(scope, readingList);
  }, [scope, focusPaper, readingList]);

  const { turns, isStreaming, send, reset, stop } = useMeiliChat(scopeIds, context);
  const listEmpty = scope === "list" && readingList.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const changeScope = (s: Scope) => {
    setScope(s);
    reset();
  };

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || isStreaming || listEmpty) return;
    setInput("");
    void send(t);
  };

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-6">
        <div className="space-y-2">
          <h4 className="smallcaps text-[15px] font-semibold">Ask about</h4>
          <div className="grid gap-1.5">
            {(
              [
                { value: "all", label: `All papers`, hint: `${paperCount?.toLocaleString("en-US") ?? "…"} papers`, icon: Globe },
                { value: "list", label: "My reading list", hint: `${readingList.length} papers`, icon: BookMarked },
                ...(paperId
                  ? [{ value: "paper" as const, label: "This paper", hint: focusPaper?.paper.title ?? "…", icon: Search }]
                  : []),
              ] as const
            ).map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                onClick={() => changeScope(value)}
                className={cn(
                  "flex items-start gap-2.5 rounded-sm border border-transparent border-l-2 p-2.5 text-left transition-colors hover:bg-muted/60",
                  scope === value && "border-l-arxiv bg-muted",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 text-muted-foreground", scope === value && "text-arxiv")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="smallcaps text-[15px] font-semibold">Reading list</h4>
            {readingList.length > 0 && (
              <button onClick={clearList} className="text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="inline size-3" /> Clear
              </button>
            )}
          </div>
          {readingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bookmark papers from <Link href="/" className="underline">search</Link> to chat with a selection.
            </p>
          ) : (
            <ul className="space-y-1">
              {readingList.map((i) => (
                <li key={i.id} className="group flex items-start gap-2 rounded-sm p-1 font-serif text-[14.5px] hover:bg-muted">
                  <span className="min-w-0 flex-1 leading-snug">
                    {i.title} <span className="text-xs text-muted-foreground">{i.year}</span>
                  </span>
                  <button
                    aria-label="Remove"
                    onClick={() => removeFromList(i.id)}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          Answers come from Meilisearch&apos;s <code className="font-mono">/chats</code> API: the LLM calls a hybrid search
          tool on the <code className="font-mono">papers</code> index. Scoping to a list uses a{" "}
          <strong>tenant token</strong> whose search rule filters <code className="font-mono">id IN […]</code>.
          {status && (
            <span className="mt-1 block">
              Model: <code className="font-mono">{status.chatModel}</code>
            </span>
          )}
        </div>
      </aside>

      <section className="flex min-h-[70vh] min-w-0 flex-col">
        {status && !status.chatEnabled && (
          <div className="mb-4 rounded-sm border-l-2 border-arxiv bg-muted p-3 text-sm">
            Chat isn&apos;t configured yet: add <code className="font-mono">CHAT_API_KEY</code> to <code>.env</code>, then
            run <code className="font-mono">pnpm data:setup</code>.
          </div>
        )}

        <div className="flex-1 space-y-8">
          {turns.length === 0 ? (
            <div className="pt-8">
              <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance">
                {scope === "all" && "Ask anything about AI research"}
                {scope === "list" && "Chat with your reading list"}
                {scope === "paper" && (focusPaper?.paper.title ?? "Chat with this paper")}
              </h1>
              <p className="mt-2 font-serif text-lg text-muted-foreground">
                {scope === "list" && listEmpty
                  ? "Your reading list is empty — bookmark a few papers first."
                  : "Grounded answers, with the papers Meilisearch retrieved as sources."}
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS[scope].map((s) => (
                  <button
                    key={s}
                    disabled={listEmpty}
                    onClick={() => submit(s)}
                    className="rounded-sm border-l-2 bg-muted/50 px-4 py-3 text-left font-serif text-[15.5px] italic transition-colors hover:border-l-arxiv hover:bg-muted disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t, i) =>
              t.role === "user" ? (
                <div key={t.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-sm border-r-2 border-arxiv bg-muted px-4 py-2.5 font-serif text-[16px] italic">
                    {t.content}
                  </p>
                </div>
              ) : (
                <AssistantTurn key={t.id} turn={t} streaming={isStreaming && i === turns.length - 1} />
              ),
            )
          )}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-4 mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-end gap-2 rounded-sm border border-foreground/50 bg-background p-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] focus-within:border-arxiv"
          >
            {scope !== "all" && (
              <Badge variant="secondary" className="mb-1.5 ml-1 shrink-0">
                {scope === "list" ? `${readingList.length} papers` : "1 paper"}
              </Badge>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder="Ask a question about the papers…"
              aria-label="Your question"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 font-serif text-[16px] outline-none placeholder:italic"
            />
            {turns.length > 0 && !isStreaming && (
              <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="New conversation">
                <RotateCcw />
              </Button>
            )}
            {isStreaming ? (
              <Button type="button" size="icon" onClick={stop} aria-label="Stop">
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim() || listEmpty} aria-label="Send">
                <ArrowUp />
              </Button>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

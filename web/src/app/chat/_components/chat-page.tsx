"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, BookMarked, Globe, Loader2, RotateCcw, Search, Square, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatTurn } from "@/lib/chat-types";
import type { Paper } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useReadingList } from "../../_components/reading-list-store";
import { useMeiliChat } from "./use-meili-chat";

type Scope = "all" | "list" | "paper";

interface Status {
  chatEnabled: boolean;
  chatModel: string;
  paperCount: number;
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

function AssistantTurn({ turn, streaming }: { turn: ChatTurn; streaming: boolean }) {
  return (
    <div className="space-y-3">
      {turn.searches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {turn.searches.map((s) => (
            <span
              key={s.callId}
              className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
            >
              <Search className="size-3" />
              {s.q || "(browse)"}
              {s.filter && <span className="text-[var(--brand)]">· {s.filter}</span>}
            </span>
          ))}
        </div>
      )}
      {turn.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{turn.error}</p>
      ) : turn.content ? (
        <div className="prose-chat text-[15px] leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
        </div>
      ) : (
        streaming && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {turn.searches.length ? "Reading papers…" : "Searching Meilisearch…"}
          </p>
        )
      )}
      {turn.sources.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sources · {turn.sources.length} papers retrieved
          </p>
          <div className="flex flex-wrap gap-1.5">
            {turn.sources.map((s) => (
              <a
                key={s.id}
                href={`https://arxiv.org/abs/${s.arxivId ?? s.id}`}
                target="_blank"
                rel="noreferrer"
                className="max-w-full truncate rounded-md border px-2 py-1 text-xs hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                {s.title}
                {s.year && <span className="ml-1 text-muted-foreground">{s.year}</span>}
              </a>
            ))}
          </div>
        </div>
      )}
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
  const { data: focusPaper } = useQuery({
    queryKey: ["paper", paperId, false],
    queryFn: async (): Promise<{ paper: Paper }> => (await fetch(`/api/papers/${paperId}`)).json(),
    enabled: !!paperId,
  });

  const scopeIds = useMemo(() => {
    if (scope === "paper" && paperId) return [paperId];
    if (scope === "list") return readingList.map((i) => i.id);
    return undefined;
  }, [scope, paperId, readingList]);

  const { turns, isStreaming, send, reset, stop } = useMeiliChat(scopeIds);
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
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Chat with</h4>
          <div className="grid gap-1.5">
            {(
              [
                { value: "all", label: `All papers`, hint: `${status?.paperCount.toLocaleString() ?? "…"} papers`, icon: Globe },
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
                  "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50",
                  scope === value && "border-[var(--brand)] bg-muted/40",
                )}
              >
                <Icon className={cn("mt-0.5 size-4", scope === value && "text-[var(--brand)]")} />
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
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reading list</h4>
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
                <li key={i.id} className="group flex items-start gap-2 rounded-md p-1 text-sm hover:bg-muted">
                  <span className="min-w-0 flex-1 leading-snug">
                    {i.title} <span className="text-xs text-muted-foreground">{i.year}</span>
                  </span>
                  <button
                    aria-label="Remove"
                    onClick={() => removeFromList(i.id)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
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
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Chat isn&apos;t configured yet: add <code className="font-mono">CHAT_API_KEY</code> to <code>.env</code>, then
            run <code className="font-mono">pnpm data:setup</code>.
          </div>
        )}

        <div className="flex-1 space-y-8">
          {turns.length === 0 ? (
            <div className="pt-8">
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                {scope === "all" && "Ask anything about AI research"}
                {scope === "list" && "Chat with your reading list"}
                {scope === "paper" && (focusPaper?.paper.title ?? "Chat with this paper")}
              </h1>
              <p className="mt-1 text-muted-foreground">
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
                    className="rounded-xl border p-3 text-left text-sm transition-colors hover:border-[var(--brand)] disabled:opacity-50"
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
                  <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2.5 text-[15px] text-background">
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
            className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-lg"
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
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none"
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

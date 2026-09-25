// Configures Meilisearch (indexes, settings, embedder, chat workspace) and
// imports ../data/papers.json.
//
//   node scripts/setup-meilisearch.ts
import { Meilisearch } from "meilisearch";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Paper } from "../src/lib/types.ts";
import { loadEnv } from "./env.ts";

loadEnv();

const host = process.env.MEILI_HOST ?? "http://localhost:7700";
const apiKey = process.env.MEILI_MASTER_KEY ?? "research-papers-master-key-change-me";
const client = new Meilisearch({ host, apiKey });

const PAPERS = "papers";
const AUTHORS = "authors";
const EMBEDDER = "bge";
const WORKSPACE = "papers";

async function meili(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${host}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${pathname} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function waitTask(taskUid: number, label: string) {
  const started = Date.now();
  const task = await client.tasks.waitForTask(taskUid, { timeout: 60 * 60 * 1000, interval: 2000 });
  if (task.status !== "succeeded") throw new Error(`${label} failed: ${JSON.stringify(task.error)}`);
  console.log(`✓ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

async function main() {
  const papers: Paper[] = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../../data/papers.json"), "utf8"));
  console.log(`Loaded ${papers.length} papers`);

  await meili("/experimental-features", {
    method: "PATCH",
    body: JSON.stringify({ chatCompletions: true, containsFilter: true }),
  });
  console.log("✓ experimental features: chatCompletions, containsFilter");

  // ---- papers index -------------------------------------------------------
  await client.createIndex(PAPERS, { primaryKey: "id" }).waitTask().catch(() => undefined);
  const papersIndex = client.index<Paper>(PAPERS);

  const settingsTask = await papersIndex.updateSettings({
    searchableAttributes: ["title", "tldr", "abstract", "authors", "topics", "venue"],
    displayedAttributes: ["*"],
    filterableAttributes: [
      "id",
      "primaryCategory",
      "categories",
      "topics",
      "authors",
      "year",
      "publishedAt",
      "citationCount",
      "venue",
    ],
    sortableAttributes: ["publishedAt", "citationCount"],
    // Custom ranking: after textual relevance, favour highly-cited papers.
    rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness", "citationCount:desc"],
    synonyms: {
      llm: ["large language model"],
      llms: ["large language models"],
      "large language model": ["llm"],
      rag: ["retrieval augmented generation"],
      "retrieval augmented generation": ["rag"],
      rl: ["reinforcement learning"],
      rlhf: ["reinforcement learning from human feedback"],
      gan: ["generative adversarial network"],
      gans: ["generative adversarial networks"],
      gnn: ["graph neural network"],
      vit: ["vision transformer"],
      moe: ["mixture of experts"],
      nlp: ["natural language processing"],
      cv: ["computer vision"],
      cot: ["chain of thought"],
      nerf: ["neural radiance field"],
      vae: ["variational autoencoder"],
      lora: ["low-rank adaptation"],
    },
    stopWords: ["a", "an", "the", "is", "are", "of", "for", "to", "in", "on", "and", "with", "how", "what", "which", "by"],
    typoTolerance: { disableOnNumbers: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    faceting: { maxValuesPerFacet: 300, sortFacetValuesBy: { "*": "count" } },
    pagination: { maxTotalHits: 2000 },
    embedders: {
      [EMBEDDER]: {
        source: "huggingFace",
        model: "BAAI/bge-small-en-v1.5",
        documentTemplate: "{{doc.title}}. {{doc.abstract | truncatewords: 180}}",
        documentTemplateMaxBytes: 2000,
      },
    },
    chat: {
      description:
        "Research papers about artificial intelligence and machine learning from arXiv (LLMs, transformers, RL, computer vision, IR, robotics...). Each paper has a title, authors, abstract, publication year, arXiv categories and citation count.",
      documentTemplate:
        "Paper \"{{doc.title}}\" (arXiv:{{doc.arxivId}}, {{doc.year}}) by {{doc.authors | slice: 0, 5 | join: ', '}}. Categories: {{doc.categories | join: ', '}}. Citations: {{doc.citationCount}}.{% if doc.tldr %} TL;DR: {{doc.tldr}}{% endif %} Abstract: {{doc.abstract}}",
      documentTemplateMaxBytes: 1500,
      searchParameters: {
        hybrid: { embedder: EMBEDDER, semanticRatio: 0.7 },
        limit: 8,
      },
    },
  } as Parameters<typeof papersIndex.updateSettings>[0]);
  await waitTask(settingsTask.taskUid, "papers settings");

  const addTask = await papersIndex.addDocuments(papers, { primaryKey: "id" });
  console.log("… importing + embedding papers locally with BAAI/bge-small-en-v1.5 (a few minutes on CPU)");
  await waitTask(addTask.taskUid, `papers documents (${papers.length})`);

  // ---- authors index (for multi-search) ----------------------------------
  const authors = new Map<string, { id: string; name: string; paperCount: number; citationCount: number; topics: Set<string>; categories: Set<string> }>();
  for (const p of papers) {
    for (const name of p.authors) {
      const id = name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "unknown";
      const a = authors.get(id) ?? { id, name, paperCount: 0, citationCount: 0, topics: new Set(), categories: new Set() };
      a.paperCount += 1;
      a.citationCount += p.citationCount;
      p.topics.forEach((t) => a.topics.add(t));
      a.categories.add(p.primaryCategory);
      authors.set(id, a);
    }
  }
  await client.createIndex(AUTHORS, { primaryKey: "id" }).waitTask().catch(() => undefined);
  const authorsIndex = client.index(AUTHORS);
  await waitTask(
    (
      await authorsIndex.updateSettings({
        searchableAttributes: ["name", "topics"],
        rankingRules: ["words", "typo", "proximity", "attribute", "exactness", "citationCount:desc"],
        sortableAttributes: ["citationCount", "paperCount"],
      })
    ).taskUid,
    "authors settings",
  );
  await waitTask(
    (
      await authorsIndex.addDocuments(
        [...authors.values()].map((a) => ({ ...a, topics: [...a.topics], categories: [...a.categories] })),
      )
    ).taskUid,
    `authors documents (${authors.size})`,
  );

  // ---- chat workspace ----------------------------------------------------
  const chatKey = process.env.CHAT_API_KEY;
  const source = process.env.CHAT_SOURCE ?? "openAi";
  if (chatKey || source === "vLlm") {
    await meili(`/chats/${WORKSPACE}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        source,
        apiKey: chatKey || undefined,
        baseUrl: process.env.CHAT_BASE_URL || undefined,
        prompts: {
          system:
            "You are a research assistant helping people explore AI research papers. Answer using ONLY the papers returned by your search tool. Always cite papers by their exact title and arXiv id, e.g. \"Attention Is All You Need\" (arXiv:1706.03762). Compare methods, summarise findings and point out differences when several papers are relevant. If the papers do not contain the answer, say so. Use concise Markdown.",
          searchDescription:
            "Search the AI research papers index. Use it for any question about papers, methods, authors, datasets or results.",
          searchQParam: "Search query: key technical terms describing what the user is looking for.",
          searchFilterParam:
            "Optional Meilisearch filter, e.g. `year >= 2023`, `primaryCategory = \"cs.CL\"`, `authors = \"Geoffrey Hinton\"`, `citationCount > 1000`. Leave empty when unsure.",
          searchIndexUidParam: "Index to search. Use `papers`.",
        },
      }),
    });
    console.log(`✓ chat workspace "${WORKSPACE}" (${source})`);
  } else {
    console.log("! CHAT_API_KEY not set: chat workspace skipped (search + similar papers still work)");
  }

  const stats = await client.getStats();
  console.log(JSON.stringify(stats.indexes, null, 2));
}

await main();

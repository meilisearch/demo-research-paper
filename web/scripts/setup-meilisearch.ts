// Configures Meilisearch (indexes, settings, embedder, chat workspace, API keys)
// and imports ../data/papers.json.
//
//   node scripts/setup-meilisearch.ts
//
// VECTORS_FROM_HOST / VECTORS_FROM_KEY: copy the `bge` embeddings from another
// Meilisearch (e.g. your local one) instead of computing them again on the target.
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

// Fixed uids: a key's value is derived from its uid and the master key, so
// re-running this script finds the same keys instead of piling up new ones.
const SEARCH_KEY_UID = "7dbdf598-3e28-4236-9e10-3a5032b8ee19";
const CHAT_KEY_UID = "aaea7803-0890-4396-b0e5-1a630e1a3dc9";

/** Embeddings already computed elsewhere, keyed by paper id. */
async function fetchVectors(): Promise<Map<string, number[]> | null> {
  const from = process.env.VECTORS_FROM_HOST;
  if (!from) return null;
  const key = process.env.VECTORS_FROM_KEY ?? "research-papers-master-key-change-me";
  const vectors = new Map<string, number[]>();
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${from}/indexes/${PAPERS}/documents/fetch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ offset, limit: 1000, fields: ["id"], retrieveVectors: true }),
    });
    if (!res.ok) throw new Error(`fetch vectors -> ${res.status} ${await res.text()}`);
    const page = (await res.json()) as { results: { id: string; _vectors?: Record<string, { embeddings: number[][] }> }[] };
    for (const d of page.results) {
      const embedding = d._vectors?.[EMBEDDER]?.embeddings?.[0];
      if (embedding) vectors.set(d.id, embedding);
    }
    if (page.results.length < 1000) break;
  }
  console.log(`✓ ${vectors.size} embeddings copied from ${from}`);
  return vectors;
}

async function ensureKey(uid: string, body: { name: string; description: string; actions: string[]; indexes: string[] }) {
  const existing = await fetch(`${host}/keys/${uid}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (existing.ok) {
    await meili(`/keys/${uid}`, { method: "PATCH", body: JSON.stringify({ name: body.name, description: body.description }) });
    return (await existing.json()) as { key: string; uid: string };
  }
  return (await meili("/keys", { method: "POST", body: JSON.stringify({ uid, ...body, expiresAt: null }) })) as {
    key: string;
    uid: string;
  };
}

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
    body: JSON.stringify({ chatCompletions: true }),
  });
  console.log("✓ experimental features: chatCompletions");

  // ---- papers index -------------------------------------------------------
  await client.createIndex(PAPERS, { primaryKey: "id" }).waitTask().catch(() => undefined);
  const papersIndex = client.index<Paper>(PAPERS);

  const settingsTask = await papersIndex.updateSettings({
    // arXiv IDs ("1706.03762") and author names rank right after titles: a query that names
    // a paper or a person should beat a paper that merely mentions the words in its abstract.
    searchableAttributes: ["title", "arxivId", "authors", "tldr", "abstract", "topics", "venue"],
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
    // `attributeRank` before `proximity`: a match in the title beats the same words close
    // together in an abstract. Custom ranking last: favour highly-cited papers.
    rankingRules: [
      "words",
      "typo",
      "attributeRank",
      "proximity",
      "sort",
      "wordPosition",
      "exactness",
      "citationCount:desc",
    ],
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

  const vectors = await fetchVectors();
  const docs = papers.map((p) => {
    const embedding = vectors?.get(p.id);
    return embedding ? { ...p, _vectors: { [EMBEDDER]: { embeddings: embedding, regenerate: false } } } : p;
  });
  console.log(
    vectors
      ? `… importing papers (${docs.length - vectors.size} still need embedding)`
      : "… importing + embedding papers locally with BAAI/bge-small-en-v1.5 (a few minutes on CPU)",
  );
  for (let i = 0; i < docs.length; i += 1000) {
    const task = await papersIndex.addDocuments(docs.slice(i, i + 1000), { primaryKey: "id" });
    await waitTask(task.taskUid, `papers documents ${i + 1}–${Math.min(i + 1000, docs.length)}`);
  }

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

  // ---- API keys ----------------------------------------------------------
  // Public: ships in the browser bundle, so it can only search these two indexes.
  const searchKey = await ensureKey(SEARCH_KEY_UID, {
    name: "Paperscope search (public)",
    description: "Browser search key for the Paperscope demo: search on papers + authors only.",
    actions: ["search"],
    indexes: [PAPERS, AUTHORS],
  });
  // Server-only: signs the tenant tokens handed to the browser for /chats.
  const chatApiKey = await ensureKey(CHAT_KEY_UID, {
    name: "Paperscope chat (server)",
    description: "Server key for the Paperscope demo: signs tenant tokens for /chats on the papers index.",
    actions: ["search", "chatCompletions"],
    indexes: [PAPERS],
  });
  console.log(`✓ keys\n  NEXT_PUBLIC_MEILI_SEARCH_KEY=${searchKey.key}\n  MEILI_CHAT_KEY_UID=${chatApiKey.uid}`);
  console.log("  MEILI_CHAT_KEY is not printed: read it with GET /keys/" + CHAT_KEY_UID);

  const stats = await client.getStats();
  console.log(JSON.stringify(stats.indexes, null, 2));
}

await main();

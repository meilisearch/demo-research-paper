// Fetches a subset of AI papers from the arXiv API (plus citation data from
// Semantic Scholar) and writes them to ../data/papers.json.
//
//   node scripts/fetch-arxiv.ts            # default subset (~5-6k papers)
//   PER_TOPIC=50 node scripts/fetch-arxiv.ts   # quicker, smaller subset
//   node scripts/fetch-arxiv.ts --landmarks-only   # only (re)add the landmark papers to the existing file
import { XMLParser } from "fast-xml-parser";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Paper } from "../src/lib/types.ts";

const OUT = path.resolve(import.meta.dirname, "../../data/papers.json");
const PER_TOPIC = Number(process.env.PER_TOPIC ?? 120);
const RECENT_PER_CATEGORY = Number(process.env.RECENT_PER_CATEGORY ?? 400);

const AI_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.IR", "cs.RO", "cs.MA", "cs.NE", "stat.ML"];
const CAT_FILTER = `(${AI_CATEGORIES.map((c) => `cat:${c}`).join(" OR ")})`;

// Topic queries sorted by relevance: they pull in the well-known papers.
const TOPICS: Record<string, string> = {
  Transformers: 'ti:transformer OR ti:"self-attention"',
  "Large Language Models": 'ti:"large language model" OR ti:LLM',
  "Retrieval-Augmented Generation": 'ti:"retrieval augmented" OR ti:"retrieval-augmented" OR abs:RAG',
  "Diffusion Models": 'ti:diffusion AND (abs:image OR abs:generative)',
  GANs: 'ti:"generative adversarial"',
  "Reinforcement Learning": 'ti:"reinforcement learning"',
  RLHF: 'abs:"human feedback" OR ti:"preference optimization"',
  "Graph Neural Networks": 'ti:"graph neural" OR ti:"graph convolutional"',
  "Computer Vision": 'ti:"object detection" OR ti:"image segmentation"',
  "Vision Transformers": 'ti:"vision transformer"',
  "Multimodal Models": 'ti:multimodal OR ti:"vision-language"',
  "Speech Recognition": 'ti:"speech recognition"',
  "Machine Translation": 'ti:"machine translation"',
  "Embeddings & Representation Learning": 'ti:"representation learning" OR ti:embeddings',
  "Contrastive Learning": 'ti:contrastive',
  "Self-Supervised Learning": 'ti:"self-supervised"',
  "Information Retrieval": 'ti:"dense retrieval" OR ti:"neural ranking" OR ti:"learning to rank"',
  "Recommender Systems": 'ti:recommendation OR ti:recommender',
  "Optimization": 'ti:"stochastic gradient" OR ti:optimizer OR ti:"adam"',
  "Federated Learning": 'ti:"federated learning"',
  "Explainability": 'ti:explainable OR ti:interpretability',
  "AI Safety & Alignment": 'ti:alignment OR ti:"AI safety" OR ti:jailbreak',
  "Agents & Tool Use": 'ti:agent AND (abs:"language model" OR abs:tool)',
  "Reasoning & Chain-of-Thought": 'ti:reasoning OR ti:"chain-of-thought"',
  "Code Generation": 'ti:"code generation" OR ti:"program synthesis"',
  "Robotics": 'ti:robot AND abs:learning',
  "Autonomous Driving": 'ti:"autonomous driving"',
  "Neural Architecture Search": 'ti:"neural architecture search"',
  "Model Compression": 'ti:quantization OR ti:pruning OR ti:distillation',
  "Efficient Fine-Tuning": 'ti:"low-rank adaptation" OR ti:"parameter-efficient" OR ti:LoRA',
  "Mixture of Experts": 'ti:"mixture of experts" OR ti:"mixture-of-experts"',
  "Time Series": 'ti:"time series" AND abs:forecasting',
  "Question Answering": 'ti:"question answering"',
  "Summarization": 'ti:summarization',
  "Knowledge Graphs": 'ti:"knowledge graph"',
  "Meta-Learning & Few-Shot": 'ti:"meta-learning" OR ti:"few-shot"',
  "Adversarial Robustness": 'ti:adversarial AND abs:robustness',
  "Normalizing Flows & VAEs": 'ti:"variational autoencoder" OR ti:"normalizing flow"',
  "Neural Radiance Fields & 3D": 'ti:"neural radiance" OR ti:"gaussian splatting"',
  "State Space Models": 'ti:"state space model" OR ti:mamba',
};

// Landmark papers that topic queries can miss (titles without the topic keywords).
const LANDMARKS = [
  "1706.03762", "1810.04805", "2005.14165", "1512.03385", "2010.11929", "2103.00020", "2006.11239", "2112.10752",
  "2203.02155", "2005.11401", "2302.13971", "2307.09288", "2303.08774", "1301.3781", "1409.3215", "1409.0473",
  "1502.03167", "1406.2661", "1312.6114", "1312.5602", "1707.06347", "1910.10683", "1907.11692", "2001.08361",
  "2203.15556", "2312.00752", "2401.04088", "2004.04906", "2004.12832", "1908.10084", "1505.04597", "1506.02640",
  "1506.01497", "1703.06870", "1901.02860", "2302.04761", "2210.03629", "2203.11171", "2212.08073", "2205.14135",
  "2305.14314", "2003.08934", "2103.14030", "2304.02643", "2104.14294", "2002.05709", "1911.05722", "1609.02907",
  "1710.10903", "1503.02531", "1701.06538", "2101.03961", "2212.04356", "2006.11477", "2312.11805", "2501.12948",
  "2308.04079", "1412.6980", "2106.09685", "2201.11903", "2305.18290", "1606.08415", "1607.06450", "2104.09864",
];

interface AtomEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  updated: string;
  author: { name: string } | { name: string }[];
  category: { "@_term": string } | { "@_term": string }[];
  "arxiv:primary_category"?: { "@_term": string };
  "arxiv:comment"?: string;
  "arxiv:journal_ref"?: string;
  "arxiv:doi"?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

async function arxivByIds(ids: string[]): Promise<AtomEntry[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("id_list", ids.join(","));
  url.searchParams.set("max_results", String(ids.length));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arXiv id_list HTTP ${res.status}`);
  return arr<AtomEntry>(parser.parse(await res.text()).feed?.entry);
}

async function arxivQuery(searchQuery: string, sortBy: "relevance" | "submittedDate", max: number): Promise<AtomEntry[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("sortBy", sortBy);
  url.searchParams.set("sortOrder", "descending");
  url.searchParams.set("max_results", String(max));
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const feed = parser.parse(await res.text()).feed;
      const entries = arr<AtomEntry>(feed?.entry);
      if (entries.length > 0 || attempt === 5) return entries;
    }
    // arXiv asks for >= 3s between calls; back off harder on failure/empty pages.
    await sleep(3000 * attempt * 2);
  }
  return [];
}

function toPaper(e: AtomEntry, topic: string | null): Paper | null {
  const m = /abs\/(.+?)(v\d+)?$/.exec(String(e.id));
  if (!m) return null;
  const arxivId = m[1];
  const categories = arr(e.category).map((c) => c["@_term"]);
  const published = new Date(e.published);
  return {
    id: arxivId.replace(/[^a-zA-Z0-9-_]/g, "_"),
    arxivId,
    title: clean(String(e.title)),
    abstract: clean(String(e.summary)),
    authors: arr(e.author).map((a) => clean(String(a.name))),
    primaryCategory: e["arxiv:primary_category"]?.["@_term"] ?? categories[0],
    categories,
    topics: topic ? [topic] : [],
    publishedAt: Math.floor(published.getTime() / 1000),
    publishedDate: published.toISOString().slice(0, 10),
    year: published.getUTCFullYear(),
    updatedAt: Math.floor(new Date(e.updated).getTime() / 1000),
    comment: e["arxiv:comment"] ? clean(String(e["arxiv:comment"])) : null,
    journalRef: e["arxiv:journal_ref"] ? clean(String(e["arxiv:journal_ref"])) : null,
    doi: e["arxiv:doi"] ? String(e["arxiv:doi"]) : null,
    absUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
    citationCount: 0,
    influentialCitationCount: 0,
    venue: null,
    tldr: null,
  };
}

interface S2Paper {
  citationCount?: number;
  influentialCitationCount?: number;
  venue?: string;
  tldr?: { text?: string } | null;
}

async function enrichWithSemanticScholar(papers: Map<string, Paper>) {
  const list = [...papers.values()];
  for (let i = 0; i < list.length; i += 400) {
    const batch = list.slice(i, i + 400);
    for (let attempt = 1; attempt <= 6; attempt++) {
      const res = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount,influentialCitationCount,venue,tldr",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch.map((p) => `ARXIV:${p.arxivId}`) }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as (S2Paper | null)[];
        data.forEach((s2, j) => {
          if (!s2) return;
          const p = batch[j];
          p.citationCount = s2.citationCount ?? 0;
          p.influentialCitationCount = s2.influentialCitationCount ?? 0;
          p.venue = s2.venue || null;
          p.tldr = s2.tldr?.text ?? null;
        });
        console.log(`  semantic scholar ${i + batch.length}/${list.length}`);
        break;
      }
      console.log(`  semantic scholar HTTP ${res.status}, retry ${attempt}`);
      await sleep(5000 * attempt);
    }
    await sleep(1500);
  }
}

async function main() {
  const papers = new Map<string, Paper>();
  const landmarksOnly = process.argv.includes("--landmarks-only");
  if (landmarksOnly && existsSync(OUT)) {
    for (const p of JSON.parse(await readFile(OUT, "utf8")) as Paper[]) papers.set(p.id, p);
  }
  const add = (entries: AtomEntry[], topic: string | null) => {
    for (const e of entries) {
      const p = toPaper(e, topic);
      if (!p) continue;
      const existing = papers.get(p.id);
      if (existing) {
        if (topic && !existing.topics.includes(topic)) existing.topics.push(topic);
      } else {
        papers.set(p.id, p);
      }
    }
  };

  const before = papers.size;
  add(await arxivByIds(LANDMARKS), "Landmark papers");
  console.log(`Landmark papers                          +${papers.size - before}  (total ${papers.size})`);
  await sleep(3100);

  for (const [topic, q] of landmarksOnly ? [] : Object.entries(TOPICS)) {
    const entries = await arxivQuery(`(${q}) AND ${CAT_FILTER}`, "relevance", PER_TOPIC);
    add(entries, topic);
    console.log(`${topic.padEnd(40)} +${entries.length}  (total ${papers.size})`);
    await sleep(3100);
  }
  for (const cat of landmarksOnly ? [] : ["cs.AI", "cs.LG", "cs.CL", "cs.CV"]) {
    const entries = await arxivQuery(`cat:${cat}`, "submittedDate", RECENT_PER_CATEGORY);
    add(entries, null);
    console.log(`recent ${cat.padEnd(33)} +${entries.length}  (total ${papers.size})`);
    await sleep(3100);
  }

  console.log("Enriching with Semantic Scholar citations + TL;DRs...");
  await enrichWithSemanticScholar(
    landmarksOnly ? new Map([...papers].filter(([, p]) => p.topics.includes("Landmark papers"))) : papers,
  );

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify([...papers.values()]));
  console.log(`Wrote ${papers.size} papers to ${OUT}`);
}

await main();

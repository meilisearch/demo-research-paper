import "server-only";
import { Meilisearch } from "meilisearch";

export const MEILI_HOST = process.env.MEILI_HOST ?? "http://localhost:7700";
// URL the browser uses to reach Meilisearch (the container talks to http://meilisearch:7700).
export const MEILI_PUBLIC_URL = process.env.MEILI_PUBLIC_URL ?? "http://localhost:7700";
export const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? "research-papers-master-key-change-me";

export const PAPERS_INDEX = "papers";
export const AUTHORS_INDEX = "authors";
export const EMBEDDER = "bge";
export const CHAT_WORKSPACE = "papers";
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";

export const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_MASTER_KEY });

export const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

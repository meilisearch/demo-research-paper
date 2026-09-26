import "server-only";
import { Meilisearch } from "meilisearch";

// Server-side only. In production this is the chat key (chatCompletions + search
// on `papers`): the server never holds the master key, it only signs tenant tokens.
// Locally, the master key is used to look the chat key up instead.
export const MEILI_HOST = process.env.MEILI_HOST ?? "http://localhost:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY;
export const MEILI_CHAT_KEY = process.env.MEILI_CHAT_KEY;
export const MEILI_CHAT_KEY_UID = process.env.MEILI_CHAT_KEY_UID;

export const PAPERS_INDEX = "papers";
export const CHAT_WORKSPACE = "papers";
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";

export const meili = new Meilisearch({
  host: MEILI_HOST,
  apiKey: MEILI_CHAT_KEY ?? MEILI_MASTER_KEY ?? "research-papers-master-key-change-me",
});

export const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

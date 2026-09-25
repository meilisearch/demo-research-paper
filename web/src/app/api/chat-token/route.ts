import { generateTenantToken } from "meilisearch/token";
import { CHAT_MODEL, CHAT_WORKSPACE, MEILI_PUBLIC_URL, meili, PAPERS_INDEX, quote } from "@/lib/meili";
import type { ChatSession } from "@/lib/chat-types";

let chatKeyCache: { key: string; uid: string } | null = null;

async function getChatKey() {
  if (chatKeyCache) return chatKeyCache;
  const { results } = await meili.getKeys({ limit: 100 });
  const key = results.find((k) => k.actions.includes("chatCompletions") && k.actions.includes("search"));
  if (!key) throw new Error("No chat API key found (expected the 'Default Chat API Key')");
  chatKeyCache = { key: key.key, uid: key.uid };
  return chatKeyCache;
}

/**
 * Hands the browser what it needs to call Meilisearch `/chats` directly: a
 * short-lived tenant token derived from the Default Chat API Key. Its search
 * rules restrict the chat to the papers index and, optionally, to a list of
 * papers — the LLM can only retrieve those.
 */
export async function POST(req: Request) {
  const { paperIds } = (await req.json()) as { paperIds?: string[] };

  const configured = await meili.getChatWorkspace(CHAT_WORKSPACE).then(() => true, () => false);
  if (!configured) {
    return Response.json(
      { error: "Chat is not configured. Set CHAT_API_KEY in .env and run `pnpm data:setup`." },
      { status: 503 },
    );
  }

  const { key, uid } = await getChatKey();
  const token = await generateTenantToken({
    apiKey: key,
    apiKeyUid: uid,
    searchRules: {
      [PAPERS_INDEX]: paperIds?.length ? { filter: `id IN [${paperIds.map(quote).join(", ")}]` } : {},
    },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const session: ChatSession = { host: MEILI_PUBLIC_URL, workspace: CHAT_WORKSPACE, model: CHAT_MODEL, token };
  return Response.json(session);
}

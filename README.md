# Paperscope — AI research papers on Meilisearch

Demo: search ~6,000 AI/ML arXiv papers, get recommendations for any paper, and chat with
the whole corpus, your reading list, or a single paper.

| Feature | Meilisearch capability |
|---|---|
| Search bar with keyword ↔ semantic slider | **Hybrid search** (`hybrid.semanticRatio`) with a local **HuggingFace embedder** (`BAAI/bge-small-en-v1.5`) |
| "tranformer" still finds transformers | **Typo tolerance** |
| "LLM", "RAG", "LoRA"… | **Synonyms** |
| Category / topic / year / author filters with counts | **Filters**, **facets**, `facetStats` |
| "Find an author…" box | **Facet search** |
| Most cited / newest / oldest | **Sort** + custom ranking rule `citationCount:desc` |
| Bold matches and abstract snippets | **Highlighting** + **cropping** |
| Author chips above the results | **Multi-search** (`papers` + `authors` indexes in one request) |
| "Similar papers" in the paper panel (optionally same category) | **`/similar`** endpoint (+ filter) |
| Chat page | **`/chats` conversational search** (LLM calls a hybrid-search tool, streams progress + sources) |
| Chat with a reading list / one paper | **Tenant token** with a search rule `id IN [...]` |

## Run it

Requires Docker (OrbStack) and Node 24.

```bash
cp .env.example .env              # add CHAT_API_KEY for the chat page
docker compose up -d meilisearch
cd web && pnpm install
pnpm data:fetch                    # arXiv + Semantic Scholar -> data/papers.json (~5 min)
pnpm data:setup                    # index settings, embeddings, chat workspace (~15 min on CPU)
cd .. && docker compose watch      # web app with live sync
```

- App: http://localhost:3100 (or `http://web.research-papers.orb.local:3000`)
- Meilisearch: http://localhost:7700 (or `http://meilisearch.research-papers.orb.local:7700`), master key in `.env`

### Chat LLM

The `/chats` workspace needs an LLM provider. Set these in `.env`, then re-run `pnpm data:setup`
(the documents are already indexed, so it goes fast):

```
CHAT_SOURCE=openAi        # openAi | mistral | vLlm
CHAT_API_KEY=sk-...
CHAT_MODEL=gpt-4o-mini
CHAT_BASE_URL=            # required for mistral (https://api.mistral.ai/v1) and vLlm
```

### Smaller or bigger subset

`PER_TOPIC=50 RECENT_PER_CATEGORY=100 pnpm data:fetch` gives ~2k papers.
Topics and categories are listed in `web/scripts/fetch-arxiv.ts`.

## Layout

```
compose.yaml                 meilisearch + web (Next.js dev server, compose watch)
data/papers.json             fetched dataset (git-ignored)
web/scripts/fetch-arxiv.ts   dataset builder (arXiv API, Semantic Scholar citations + TL;DRs)
web/scripts/setup-meilisearch.ts  all Meilisearch configuration lives here
web/src/lib/search-api.ts    browser-side search: multi-search, /similar, facet search (search-only key)
web/src/app/api/*            server routes: chat-token (signs a tenant token; the browser calls /chats directly), status
web/src/app/                 UI (search page, paper sheet, chat page)
```

## Production

| Piece | Where |
|---|---|
| Front | Vercel, team **meili**, project `paperscope`: https://paperscope-one.vercel.app |
| Meilisearch | The main instance on qdq-server (v1.54), `papers` + `authors` indexes, reached at `https://search.qdq.meilisearch.com` |
| Chat LLM | LUMEN on the same box, via its public URL `https://lumen.meilisearch.com/v1` (Meilisearch rejects private IPs such as `127.0.0.1` as a chat `baseUrl`), model `claude-sonnet-4-5`, virtual key `paperscope-demo-chat` ($25 hard budget, 60 rpm) |

The browser talks to Meilisearch directly: Caddy rate-limits per client IP, so proxying
search through Vercel would put every visitor in one bucket.

Keys (created by `setup-meilisearch.ts` with fixed uids, so re-runs find them again):

| Key | uid | Actions | Indexes | Lives in |
|---|---|---|---|---|
| Paperscope search (public) | `7dbdf598-3e28-4236-9e10-3a5032b8ee19` | `search` | `papers`, `authors` | `NEXT_PUBLIC_MEILI_SEARCH_KEY` (browser bundle) |
| Paperscope chat (server) | `aaea7803-0890-4396-b0e5-1a630e1a3dc9` | `search`, `chatCompletions` | `papers` | `MEILI_CHAT_KEY` + `MEILI_CHAT_KEY_UID` (Vercel, server only) |

The chat key never reaches the browser: `/api/chat-token` signs a 30-minute tenant token with it.
The LUMEN key is stored on the box in `/etc/meilisearch/paperscope-lumen-key.json` (0600) and in
the `papers` chat workspace settings.

Re-import into production over an SSH tunnel, copying the embeddings from your local
instance so the box does not compute them:

```bash
ssh -f -N -L 17700:127.0.0.1:7700 root@62.210.158.50
cd web
MEILI_HOST=http://localhost:17700 \
MEILI_MASTER_KEY="$(ssh root@62.210.158.50 'sed -n "s/^MEILI_MASTER_KEY=//p" /etc/meilisearch/meilisearch.env')" \
CHAT_API_KEY="$(ssh root@62.210.158.50 'python3 -c "import json;print(json.load(open(\"/etc/meilisearch/paperscope-lumen-key.json\"))[\"key\"])"')" \
CHAT_BASE_URL=https://lumen.meilisearch.com/v1 \
VECTORS_FROM_HOST=http://localhost:7700 \
node scripts/setup-meilisearch.ts
```

Deploy the front with `vercel deploy --prod --scope meili` from `web/`.

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
web/src/app/api/*            server routes: search (multi-search), papers/[id] (/similar), chat-token (tenant token; the browser calls /chats directly)
web/src/app/                 UI (search page, paper sheet, chat page)
```

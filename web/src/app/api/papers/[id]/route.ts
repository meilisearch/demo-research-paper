import { NextResponse } from "next/server";
import { EMBEDDER, meili, PAPERS_INDEX } from "@/lib/meili";
import type { Paper, PaperHit } from "@/lib/types";

/** A paper plus its recommendations from the /similar endpoint. */
export async function GET(req: Request, ctx: RouteContext<"/api/papers/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const sameCategory = url.searchParams.get("sameCategory") === "1";
  const index = meili.index<Paper>(PAPERS_INDEX);

  let paper: Paper;
  try {
    paper = await index.getDocument(id);
  } catch {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const similar = await index.searchSimilarDocuments<PaperHit>({
    id,
    embedder: EMBEDDER,
    limit: 8,
    showRankingScore: true,
    filter: sameCategory ? `primaryCategory = "${paper.primaryCategory}"` : undefined,
  });

  return NextResponse.json({ paper, similar: similar.hits, processingTimeMs: similar.processingTimeMs });
}

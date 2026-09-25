import { NextResponse } from "next/server";
import { meili, PAPERS_INDEX } from "@/lib/meili";

/** Type-ahead inside facet values (e.g. find an author among thousands). */
export async function POST(req: Request) {
  const { facetName, facetQuery, q } = (await req.json()) as { facetName: string; facetQuery: string; q: string };
  const res = await meili.index(PAPERS_INDEX).searchForFacetValues({ facetName, facetQuery, q });
  return NextResponse.json(res.facetHits.slice(0, 10));
}

import { NextResponse } from "next/server";
import { CHAT_MODEL, CHAT_WORKSPACE, meili, PAPERS_INDEX } from "@/lib/meili";

export async function GET() {
  const [chatEnabled, stats] = await Promise.all([
    meili.getChatWorkspace(CHAT_WORKSPACE).then(() => true, () => false),
    meili.index(PAPERS_INDEX).getStats().catch(() => null),
  ]);
  return NextResponse.json({ chatEnabled, chatModel: CHAT_MODEL, paperCount: stats?.numberOfDocuments ?? 0 });
}

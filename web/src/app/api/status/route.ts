import { NextResponse } from "next/server";
import { CHAT_MODEL, CHAT_WORKSPACE, MEILI_CHAT_KEY, meili } from "@/lib/meili";

export async function GET() {
  // The production chat key is index-scoped, so it cannot read workspaces: its presence is the signal.
  const chatEnabled =
    !!MEILI_CHAT_KEY ||
    (await meili.getChatWorkspace(CHAT_WORKSPACE).then(
      () => true,
      () => false,
    ));
  return NextResponse.json({ chatEnabled, chatModel: CHAT_MODEL });
}

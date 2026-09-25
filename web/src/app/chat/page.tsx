import { ChatPage } from "./_components/chat-page";

export default async function Chat({ searchParams }: PageProps<"/chat">) {
  const params = await searchParams;
  const paperId = typeof params.paper === "string" ? params.paper : undefined;
  const scope = paperId ? "paper" : params.scope === "list" ? "list" : "all";
  return <ChatPage key={paperId ?? scope} initialScope={scope} paperId={paperId} />;
}

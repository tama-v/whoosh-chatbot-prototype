import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Chat",
  description: "Ngobrol dengan Heiser untuk info boarding, bagasi, tiket, dan fasilitas stasiun.",
};

export default function ChatPage() {
  return (
    <WorkspaceShell title="Chat" kicker="Penumpang" fill>
      <ChatWorkspace />
    </WorkspaceShell>
  );
}

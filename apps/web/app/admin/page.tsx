import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard demo untuk analytics, keluhan, dan knowledge base Whoosh AI.",
};

export default function AdminPage() {
  return (
    <WorkspaceShell title="Dashboard" kicker="Admin">
      <AdminGate>
        <AdminWorkspace />
      </AdminGate>
    </WorkspaceShell>
  );
}

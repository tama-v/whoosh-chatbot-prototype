import type { Metadata } from "next";
import { ComplaintWorkspace } from "@/components/complaints/complaint-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Laporan",
  description: "Susun dan lacak laporan perjalanan pada sistem simulasi Whoosh AI.",
};

export default function ComplaintsPage() {
  return (
    <WorkspaceShell title="Laporan" kicker="Penumpang">
      <ComplaintWorkspace />
    </WorkspaceShell>
  );
}

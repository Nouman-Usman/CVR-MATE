import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/sidebar";
import { DocsHeader } from "@/components/docs/header";

export const metadata: Metadata = {
  title: "Documentation — CVR-MATE",
  description: "Complete guide to using the CVR-MATE B2B lead intelligence platform.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <DocsSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <DocsHeader />
        {children}
      </div>
    </div>
  );
}

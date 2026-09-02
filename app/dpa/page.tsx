import type { Metadata } from "next";
import { DpaContent } from "./dpa-content";

export const metadata: Metadata = {
  title: "Databehandleraftale | Data Processing Agreement | CVR-MATE",
  description:
    "Databehandleraftale for CVR-MATE i henhold til GDPR artikel 28. Data Processing Agreement for CVR-MATE pursuant to GDPR Article 28.",
};

export default function DpaPage() {
  return <DpaContent />;
}

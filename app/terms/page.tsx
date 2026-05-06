import type { Metadata } from "next";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: "Vilkår & Betingelser | Terms & Conditions | CVR-MATE",
  description:
    "Vilkår og betingelser for brug af CVR-MATE platformen. Terms and conditions for using the CVR-MATE platform.",
};

export default function TermsPage() {
  return <TermsContent />;
}

import type { Metadata } from "next";
import { DataSecurityContent } from "./data-security-content";

export const metadata: Metadata = {
  title: "Datasikkerhed | Data Security | CVR-MATE",
  description:
    "Sådan sikrer CVR-MATE dine data — kryptering, adgangskontrol og compliance. How CVR-MATE protects your data — encryption, access control, and compliance.",
};

export default function DataSecurityPage() {
  return <DataSecurityContent />;
}

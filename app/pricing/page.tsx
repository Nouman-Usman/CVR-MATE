import type { Metadata } from "next";
import { PricingContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "Pricing — CVR-MATE",
  description:
    "Simple, transparent pricing for CVR-MATE. Start free, upgrade as you grow. No hidden fees.",
};

export default function PricingPage() {
  return <PricingContent />;
}

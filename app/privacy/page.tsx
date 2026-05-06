import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Privatlivspolitik | Privacy Policy | CVR-MATE",
  description:
    "Privatlivspolitik for CVR-MATE — hvordan vi indsamler, bruger og beskytter dine data. Privacy policy for CVR-MATE — how we collect, use and protect your data.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}

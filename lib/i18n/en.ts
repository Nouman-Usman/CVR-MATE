import type { Dictionary } from "./da";

const en: Dictionary = {
  nav: {
    home: "Home",
    howItWorks: "How it works",
    integrations: "Integrations",
    pricing: "Pricing",
    aboutAiMate: "About AI-MATE",
    login: "Log in",
    getStarted: "Get started",
  },
  hero: {
    badge: "B2B Lead Intelligence",
    headline: "Find new customers — before they start looking for you.",
    description:
      "CVR-MATE transforms raw data into actionable insights. Identify purchase-ready companies in real time and boost your sales pipeline.",
    bookDemo: "Book a demo",
    explorePlatform: "Explore the platform",
    pills: [
      "Live CVR updates",
      "AI-powered lead scoring",
      "Direct CRM export",
      "No lock-in period",
    ],
    stat: "Lead Conversion Velocity",
    dashNewLeads: "New Leads",
    dashGrowth: "Growth",
    dashExport: "Export",
    dashAutoSync: "Auto-sync active",
    dashTopCompanies: "Top Companies",
    dashSeeAll: "SEE ALL",
  },
  features: {
    title: "More than company data: Full company intelligence",
    subtitle: "We connect the dots between data and sales potential.",
    card1Title: "Full company intelligence",
    card1Desc:
      "Go deeper than just name and address. Get insights into financials, management changes, and growth curves automatically presented to you.",
    card2Title: "Real-time lead identification",
    card2Desc:
      "Get notified the moment a company shows buying signals. Our radar monitors the Danish market 24/7 for you.",
  },
  products: {
    title: "Two ways to use CVR-MATE",
    go: {
      name: "CVR-MATE GO",
      badge: "Standard platform",
      features: [
        "Access to 800,000+ active Danish CVR numbers",
        "Advanced search and filter engine",
        "CSV/Excel list exports",
      ],
      cta: "Start now",
    },
    flow: {
      name: "CVR-MATE FLOW",
      badge: "Premium Automation",
      features: [
        "Full CRM integration (HubSpot, Salesforce)",
        "AI-powered Lead Discovery (Auto-find)",
        "Real-time notifications on warm leads",
        "Dedicated Data Success Manager",
      ],
      cta: "Request a demo",
    },
  },
  benefits: {
    title: "Built for modern B2B sales teams",
    items: [
      {
        icon: "bolt",
        title: "Quick implementation",
        desc: "Get started in under 5 minutes. No complex IT projects required.",
      },
      {
        icon: "security",
        title: "GDPR compliance",
        desc: "We comply with all EU data protection regulations to the letter.",
      },
      {
        icon: "hub",
        title: "Open API",
        desc: "Connect CVR-MATE to your existing tech stack without issues.",
      },
      {
        icon: "verified",
        title: "Validated data",
        desc: "Our data is cross-checked against 14 different sources daily.",
      },
      {
        icon: "groups",
        title: "Team collaboration",
        desc: "Share lists, notes, and insights across your entire organization.",
      },
      {
        icon: "query_stats",
        title: "Predictive analytics",
        desc: "See which companies are likely to hire next month.",
      },
    ],
    quote:
      "CVR-MATE has reduced our time on lead research by 70%, while doubling the number of booked meetings.",
    quoteName: "Morten Jensen",
    quoteRole: "Head of Sales, NordicTech",
  },
  howItWorks: {
    title: "The Path to Intelligence",
    subtitle: "Four steps to a fully automated lead machine.",
    steps: [
      {
        num: "01",
        title: "Identify",
        desc: "The system monitors all Danish businesses for signals and changes.",
      },
      {
        num: "02",
        title: "Filter",
        desc: "Your specific ICP (Ideal Customer Profile) criteria are applied automatically.",
      },
      {
        num: "03",
        title: "Deliver",
        desc: "Enriched leads with contact info and context are sent directly to your dashboard.",
      },
      {
        num: "04",
        title: "Activate",
        desc: "Export to CRM or start your outreach with a single click.",
      },
    ],
  },
  comparison: {
    title: "CVR-MATE vs. traditional tools",
    feature: "Feature",
    traditional: "Traditional",
    cvrmate: "CVR-MATE",
    rows: [
      { feature: "Updated CVR data", traditional: "close" },
      { feature: "Real-time monitoring", traditional: "close" },
      { feature: "Smart Lead Scoring", traditional: "close" },
      { feature: "Direct CRM Export", traditional: "close" },
      { feature: "Automated workflows", traditional: "close" },
    ],
  },
  pricing: {
    title: "Simple, transparent pricing",
    subtitle: "Choose the solution that fits your company's growth stage.",
    go: {
      name: "CVR-MATE GO",
      price: "2,999",
      period: "DKK/mo",
      features: [
        "5,000 lead exposures",
        "All standard filters",
        "Excel/CSV export",
        "2 users",
      ],
      cta: "Start 14-day free trial",
    },
    flow: {
      name: "CVR-MATE FLOW",
      recommended: "Recommended",
      price: "From 20k",
      period: "DKK/mo",
      setup: "+ Setup 30k DKK",
      features: [
        "Unlimited lead data",
        "Full CRM integration",
        "Custom AI scoring models",
        "Priority support",
        "Enterprise SLA",
      ],
      featureHighlight: "Unlimited lead data",
      cta: "Contact us for a quote",
    },
  },
  trust: {
    items: [
      {
        icon: "api",
        title: "Licensed CVR API",
        desc: "Direct access to the Danish Business Authority source.",
      },
      {
        icon: "database",
        title: "Reliable Data",
        desc: "99.9% uptime on all data streams.",
      },
      {
        icon: "workflow",
        title: "Commercial Workflows",
        desc: "Designed specifically for Nordic sales culture.",
      },
    ],
  },
  cta: {
    title: "Build a smarter B2B pipeline today.",
    subtitle:
      "Join over 500 Danish companies already using CVR-MATE to win the market.",
    button1: "Create your account now",
    button2: "Book a walkthrough",
    note: "No credit card required • 14-day free trial",
  },
  footer: {
    tagline:
      "The Nordics' leading AI platform for B2B lead generation and company insights.",
    platform: "Platform",
    platformLinks: ["Features", "Integrations", "Pricing", "Case studies"],
    resources: "Resources",
    resourceLinks: ["Blog", "Help center", "API Documentation", "Data security"],
    contact: "Contact",
    rights: "© 2026 CVR-MATE. All rights reserved.",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
  },
};

export default en;

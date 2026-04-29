import { db } from "@/db";
import { features } from "@/db/schema";

const FEATURES = [
  { key: "search", name: "Company Search", route: "/search" },
  { key: "triggers", name: "Lead Triggers", route: "/triggers" },
  { key: "dashboard", name: "Dashboard", route: "/dashboard" },
  { key: "exports", name: "Exports", route: "/exports" },
];

async function seed() {
  try {
    console.log("Seeding features...");

    for (const feature of FEATURES) {
      await db.insert(features).values(feature).onConflictDoNothing();
    }

    console.log("✓ Features seeded");
    const all = await db.query.features.findMany();
    console.log(`Total features: ${all.length}`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();

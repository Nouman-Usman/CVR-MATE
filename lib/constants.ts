export const CONTACT_EMAIL = "dev@fourmates.dk"

// Remove a key here to "turn on" the feature when it's ready
export const COMING_SOON_FEATURES = new Set([
  "team",
  "crm",
] as const)

export type ComingSoonFeature = "team" | "crm"

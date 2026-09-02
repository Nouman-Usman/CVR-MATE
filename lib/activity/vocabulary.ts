/**
 * The activity vocabularies, in a client-safe module.
 *
 * These live apart from `lib/activity/log.ts` because that module is
 * `server-only` (it holds a database handle) and the audit page's filter
 * controls are a client component. Importing the logger there would fail the
 * build, and duplicating the lists would guarantee they drift.
 *
 * They are `const` arrays with types derived from them rather than standalone
 * unions, because the feed endpoint validates `entityType`/`action` off a query
 * string and a type alone cannot be checked at runtime.
 */

export const ACTIVITY_ENTITY_TYPES = [
  "company",
  // A followed CVR participant. Distinct from "contact": a person here is a
  // register identity the user subscribes to, not a CRM record they own.
  "person",
  "todo",
  "note",
  "contact",
  "interaction",
  "contract",
  "segment",
  "product",
  "quote",
  "order",
  "deal",
  "pipeline",
  "stage",
  "trigger",
  "crm_sync",
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "synced",
  "exported",
  "saved",
  "unsaved",
  // Following is a subscription, not a bookmark: it schedules future alerts.
  // Reusing "saved" would make the two indistinguishable in the history.
  "followed",
  "unfollowed",
  "stage_changed",
  "won",
  "lost",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

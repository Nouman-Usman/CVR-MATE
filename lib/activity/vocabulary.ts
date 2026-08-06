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
  "stage_changed",
  "won",
  "lost",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

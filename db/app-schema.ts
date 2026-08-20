import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  numeric,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  date,
  check,
} from "drizzle-orm/pg-core";
import { user, session, account, organization } from "./auth-schema";

// ─── COMPANY (CVR data cache) ───────────────────────────────────────────────

export const company = pgTable(
  "company",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vat: text("vat").notNull().unique(),
    name: text("name").notNull(),
    rawData: jsonb("raw_data").default({}).notNull(),

    // Denormalized for fast filtering/display (sourced from rawData)
    address: text("address"),
    zipcode: text("zipcode"),
    city: text("city"),
    municipality: text("municipality"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    industryCode: text("industry_code"),
    industryName: text("industry_name"),
    companyType: text("company_type"),
    companyStatus: text("company_status"),
    founded: text("founded"),
    employees: integer("employees"),
    capital: numeric("capital"),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("company_vat_idx").on(table.vat),
    index("company_industry_code_idx").on(table.industryCode),
    index("company_city_idx").on(table.city),
    index("company_status_idx").on(table.companyStatus),
    index("company_founded_idx").on(table.founded),
    index("company_employees_idx").on(table.employees),
    index("company_name_idx").on(table.name),
    index("company_type_idx").on(table.companyType),
  ]
).enableRLS();

// ─── COMPANY METRICS (employee / financial history for growth tracking) ─────

export const companyMetrics = pgTable(
  "company_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    employees: integer("employees"),
    revenue: numeric("revenue"),
    profit: numeric("profit"),
    equity: numeric("equity"),
    /**
     * The fiscal period these figures describe — the END of the accounting
     * period, matching `accounting.documents[].end` from the CVR payload.
     *
     * `recordedAt` says when WE looked; only `periodEnd` says which financial
     * year the numbers belong to, which is what a chart or a year-over-year
     * comparison needs. Nullable because manual/import rows may have no
     * period, and Postgres treats NULLs as distinct so those never collide in
     * the unique index below.
     */
    periodEnd: date("period_end"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    source: text("source").default("cvr_api").notNull(), // 'cvr_api' | 'manual' | 'import'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("company_metrics_company_idx").on(table.companyId),
    index("company_metrics_recorded_idx").on(table.companyId, table.recordedAt),
    /**
     * State, not log: one row per company per fiscal period per source.
     *
     * Without this, every re-poll of an unchanged report inserts a duplicate
     * year and the series silently doubles. It is also what lets a refiling
     * UPDATE the figures — a corrected annual report must overwrite the period
     * it corrects, unlike `annualReportEvent`, which must NOT re-fire.
     */
    uniqueIndex("company_metrics_period_uq").on(
      table.companyId,
      table.periodEnd,
      table.source
    ),
  ]
).enableRLS();

// ─── SAVED COMPANY (user bookmarks) ─────────────────────────────────────────

export const savedCompany = pgTable(
  "saved_company",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    cvr: text("cvr").notNull(),
    note: text("note"),
    tags: jsonb("tags").default([]), // string[] — e.g. ["hot lead", "partner"]
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("saved_company_user_cvr_idx").on(table.userId, table.cvr),
    index("saved_company_user_idx").on(table.userId),
    index("saved_company_cvr_idx").on(table.cvr),
    index("saved_company_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── SAVED SEARCH ───────────────────────────────────────────────────────────

export const savedSearch = pgTable(
  "saved_search",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    filters: jsonb("filters").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("saved_search_user_idx").on(table.userId),
    index("saved_search_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── LEAD TRIGGER ───────────────────────────────────────────────────────────

export const leadTrigger = pgTable(
  "lead_trigger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    filters: jsonb("filters").default({}).notNull(),
    frequency: text("frequency").default("daily").notNull(), // 'daily' | 'weekly' | 'custom'
    isActive: boolean("is_active").default(true).notNull(),
    notificationChannels: jsonb("notification_channels")
      .default(["in_app"])
      .notNull(),
    // Extracted filter fields for fast query acceleration
    industryCode: text("filter_industry_code"),
    minEmployees: integer("filter_min_employees"),
    maxEmployees: integer("filter_max_employees"),
    // ─── Cron scheduling fields ───
    cronExpression: text("cron_expression"),
    scheduledHour: integer("scheduled_hour").default(8).notNull(),
    scheduledMinute: integer("scheduled_minute").default(0).notNull(),
    scheduledDayOfWeek: integer("scheduled_day_of_week"),
    timezone: text("timezone").default("Europe/Copenhagen").notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("lead_trigger_user_idx").on(table.userId),
    index("lead_trigger_active_idx").on(table.userId, table.isActive),
    index("lead_trigger_next_run_idx").on(table.nextRunAt),
    index("lead_trigger_org_idx").on(table.organizationId),
    index("lead_trigger_industry_idx").on(table.industryCode),
  ]
).enableRLS();

// ─── TRIGGER RESULT ─────────────────────────────────────────────────────────

export const triggerResult = pgTable(
  "trigger_result",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    triggerId: uuid("trigger_id")
      .notNull()
      .references(() => leadTrigger.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companies: jsonb("companies").default([]).notNull(),
    matchCount: integer("match_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("trigger_result_trigger_idx").on(table.triggerId),
    index("trigger_result_user_idx").on(table.userId),
    index("trigger_result_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── NOTIFICATION ───────────────────────────────────────────────────────────

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * Which workspace the notification belongs to. NULL = personal.
     *
     * `userId` answers *who to tell*; this answers *what it is about*, and those
     * stopped being the same question once organizations existed. Without it a
     * contract-renewal alert — a contract being org-only data — appeared while
     * the user was in their personal workspace and linked to a page the CRM
     * guard then refused, so the notification could be seen but never acted on.
     */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    type: text("type").default("system").notNull(), // 'trigger' | 'system' | 'export' | 'crm_sync'
    title: text("title").notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false).notNull(),
    link: text("link"),
    priority: text("priority").default("normal").notNull(), // 'low' | 'normal' | 'high' | 'urgent'
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId),
    index("notification_user_unread_idx").on(table.userId, table.isRead),
    index("notification_created_idx").on(table.createdAt),
    index("notification_type_idx").on(table.userId, table.type),
    index("notification_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── TODO ───────────────────────────────────────────────────────────────────

export const todo = pgTable(
  "todo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    isCompleted: boolean("is_completed").default(false).notNull(),
    priority: text("priority").default("medium").notNull(), // 'low' | 'medium' | 'high'
    companyId: uuid("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
    assignedUserId: text("assigned_user_id").references(() => user.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    // Set when this todo is the follow-up of an interaction (P3). Nullable FK —
    // manual todos have none; on interaction hard-delete the link clears.
    interactionId: uuid("interaction_id").references(() => interaction.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("todo_user_idx").on(table.userId),
    index("todo_user_completed_idx").on(table.userId, table.isCompleted),
    index("todo_due_date_idx").on(table.dueDate),
    index("todo_company_idx").on(table.companyId),
    index("todo_org_idx").on(table.organizationId),
    index("todo_priority_idx").on(table.userId, table.priority),
    index("todo_assigned_idx").on(table.assignedUserId),
    index("todo_interaction_idx").on(table.interactionId),
    // At most one live follow-up per interaction. syncFollowUpTodo used to
    // find-then-insert, so two concurrent PATCHes of the same interaction could
    // each create a todo; this makes the database the arbiter.
    uniqueIndex("todo_interaction_live_uq")
      .on(table.interactionId)
      .where(sql`${table.interactionId} is not null and ${table.deletedAt} is null`),
  ]
).enableRLS();

// ─── COMPANY NOTE ───────────────────────────────────────────────────────────

export const companyNote = pgTable(
  "company_note",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("company_note_company_idx").on(table.companyId),
    index("company_note_user_idx").on(table.userId),
    index("company_note_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── ORG AUDIT LOG (team management audit trail) ───────────────────────────

export const orgAuditLog = pgTable(
  "org_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    // Actions: org_created | org_renamed | org_deleted
    //          member_invited | invitation_accepted | invitation_declined | invite_revoked
    //          member_removed | member_left
    //          role_changed | ownership_transferred
    //          seat_limit_reached | permission_denied
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_org_idx").on(t.organizationId),
    index("audit_actor_idx").on(t.actorId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_action_idx").on(t.organizationId, t.action),
  ]
).enableRLS();

// ─── ADMIN AUDIT LOG (super-admin action trail) ─────────────────────────────
// Records every mutating action taken from the super-admin console. The actor
// is the super-admin email (independent of Better Auth) so there is no user FK.

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    // Actions: user_verify_resent | user_force_verified | user_sessions_revoked
    //          user_plan_changed | user_trial_extended | user_deleted
    //          subscription_canceled | trigger_run | changefeed_lock_cleared
    //          inquiry_marked_handled
    targetType: text("target_type"), // 'user' | 'subscription' | 'trigger' | 'inquiry' | ...
    targetId: text("target_id"),
    metadata: jsonb("metadata").default({}),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_audit_actor_idx").on(t.actorEmail),
    index("admin_audit_action_idx").on(t.action),
    index("admin_audit_created_idx").on(t.createdAt),
    index("admin_audit_target_idx").on(t.targetType, t.targetId),
  ]
).enableRLS();

// ─── ENTERPRISE INQUIRY ─────────────────────────────────────────────────────

export const enterpriseInquiry = pgTable("enterprise_inquiry", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone"),
  message: text("message"),
  // Admin inbox triage — set when a super-admin marks the lead as handled.
  handledAt: timestamp("handled_at", { withTimezone: true }),
  handledBy: text("handled_by"), // super-admin email
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

// ─── USER BRAND (onboarding company profile for AI personalization) ─────────

export const userBrand = pgTable(
  "user_brand",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    cvr: text("cvr"),
    industry: text("industry"),
    industryCode: text("industry_code"),
    companySize: text("company_size"),
    employees: integer("employees"),
    website: text("website"),
    products: text("products").notNull(),
    targetAudience: text("target_audience"),
    tone: text("tone").default("formal").notNull(),
    preferredEmailClient: text("preferred_email_client").default("default").notNull(), // 'default' | 'gmail' | 'outlook'
    emailNotificationsEnabled: boolean("email_notifications_enabled").default(true).notNull(),
    dailyLeadEmails: boolean("daily_lead_emails").default(true).notNull(),
    weeklySummaryEmails: boolean("weekly_summary_emails").default(true).notNull(),
    /** Opt-out for the annual-report digest. In-app alerts are unaffected. */
    annualReportEmails: boolean("annual_report_emails").default(true).notNull(),
    emailNotificationHour: integer("email_notification_hour").default(8).notNull(), // 0–23
    aiEnrichment: jsonb("ai_enrichment"), // BrandAiEnrichment | null
    writingInstructions: text("writing_instructions"),
    aiDos: jsonb("ai_dos").default([]).notNull(),
    aiDonts: jsonb("ai_donts").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_brand_user_idx").on(table.userId),
  ]
).enableRLS();

// ─── EMAIL LOG (outbound email audit trail) ──────────────────────────────────

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    templateId: text("template_id"), // EmailTemplateId
    provider: text("provider"), // 'resend' | null on failure
    messageId: text("message_id"), // Resend email ID (used by webhook to correlate events)
    status: text("status").default("sent").notNull(), // 'sent' | 'failed'
    deliveryStatus: text("delivery_status"), // updated by Resend webhook: 'delivered' | 'bounced' | 'deferred' | 'opened' | 'clicked' | 'spam'
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("email_log_user_idx").on(t.userId),
    index("email_log_message_id_idx").on(t.messageId),
    index("email_log_status_idx").on(t.status),
    index("email_log_created_idx").on(t.createdAt),
    index("email_log_template_idx").on(t.templateId),
  ]
).enableRLS();

// ─── COMPANY BRIEFING (persisted AI-generated briefings) ─────────────────────

export const companyBriefing = pgTable(
  "company_briefing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyVat: text("company_vat").notNull(),
    companyName: text("company_name").notNull(),
    briefing: text("briefing").notNull(),
    keyInsights: jsonb("key_insights").default([]).notNull(),
    suggestedApproach: text("suggested_approach").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("company_briefing_user_idx").on(table.userId),
    index("company_briefing_user_vat_idx").on(table.userId, table.companyVat),
    index("company_briefing_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── OUTREACH MESSAGE (persisted AI-generated outreach drafts) ───────────────

export const outreachMessage = pgTable(
  "outreach_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyVat: text("company_vat").notNull(),
    companyName: text("company_name").notNull(),
    type: text("type").notNull(), // 'email' | 'linkedin' | 'phone_script'
    tone: text("tone").notNull(), // 'formal' | 'casual'
    subject: text("subject"),
    message: text("message").notNull(),
    followUp: text("follow_up").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("outreach_message_user_idx").on(table.userId),
    index("outreach_message_user_vat_idx").on(table.userId, table.companyVat),
    index("outreach_message_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── PROFILE ENRICHMENT (AI-generated intelligence for companies & people) ──

export const profileEnrichment = pgTable(
  "profile_enrichment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'company' | 'person'
    entityId: text("entity_id").notNull(), // CVR number or participant number
    entityName: text("entity_name").notNull(),
    enrichmentData: jsonb("enrichment_data").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("profile_enrichment_user_idx").on(table.userId),
    index("profile_enrichment_entity_idx").on(table.userId, table.entityType, table.entityId),
    index("profile_enrichment_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── ACTIVITY TIMELINE (unified audit trail) ────────────────────────────────

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(), // 'company' | 'todo' | 'note' | 'trigger' | 'crm_sync'
    entityId: uuid("entity_id"),
    action: text("action").notNull(), // 'created' | 'updated' | 'deleted' | 'synced' | 'exported' | 'saved' | 'unsaved'
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_user_idx").on(table.userId),
    index("activity_entity_idx").on(table.entityType, table.entityId),
    index("activity_org_idx").on(table.organizationId),
    index("activity_created_idx").on(table.createdAt),
    // The org-wide audit feed filters by org and sorts by time. Neither
    // single-column index serves that: `activity_org_idx` returns every row the
    // org ever produced and then sorts them, which is the one table guaranteed
    // to grow forever. Descending matches the query's ORDER BY exactly.
    index("activity_org_created_idx").on(table.organizationId, table.createdAt.desc()),
    index("activity_user_type_idx").on(table.userId, table.entityType),
  ]
).enableRLS();

// ─── COMPANY WORKSPACE (org-level company ownership + tags) ──────────────────

export const companyWorkspace = pgTable(
  "company_workspace",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    status: text("status").default("prospect").notNull(), // 'prospect' | 'lead' | 'qualified' | 'customer' | 'churned'
    tags: jsonb("tags").default([]),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("company_workspace_org_company_idx").on(table.organizationId, table.companyId),
    index("company_workspace_org_idx").on(table.organizationId),
    index("company_workspace_status_idx").on(table.organizationId, table.status),
    index("company_workspace_assigned_idx").on(table.assignedUserId),
    index("company_workspace_company_idx").on(table.companyId),
  ]
).enableRLS();

// ─── CONTACT (native CRM sales contact — PII encrypted at rest) ──────────────
// Org-scoped (Enterprise/team-only). Distinct from the read-only CVR "people"
// registry data. Directly-contactable identifiers (email/phone/linkedin) and
// freeform notes are stored AES-256-GCM encrypted; `emailHash` is an HMAC blind
// index enabling dedup/exact lookup without decryption. `name`/`title` remain
// plaintext so lists/pipeline cards can render and sort without N-row decrypt.

export const contact = pgTable(
  "contact",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Creator — set null on user deletion so org-owned data survives.
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title"),
    // Encrypted PII (format: iv:tag:ciphertext, base64)
    emailEnc: text("email_enc"),
    phoneEnc: text("phone_enc"),
    linkedinEnc: text("linkedin_enc"),
    notesEnc: text("notes_enc"),
    // HMAC-SHA256 blind index of the normalized email (dedup / exact match)
    emailHash: text("email_hash"),
    // HMAC-SHA256 blind index of the normalized phone (own-records exact search)
    phoneHash: text("phone_hash"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    // GDPR lawful basis + provenance
    lawfulBasis: text("lawful_basis").default("legitimate_interest").notNull(), // 'legitimate_interest' | 'consent' | 'contract'
    source: text("source").default("manual").notNull(), // 'manual' | 'cvr' | 'import'
    consentAt: timestamp("consent_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("contact_company_idx").on(table.companyId),
    index("contact_org_idx").on(table.organizationId),
    index("contact_created_by_idx").on(table.createdBy),
    index("contact_email_hash_idx").on(table.organizationId, table.emailHash),
    index("contact_phone_hash_idx")
      .on(table.organizationId, table.phoneHash)
      .where(sql`${table.phoneHash} is not null`),
    // One live contact per (org, company, email). Partial: ignores soft-deleted
    // rows and contacts without an email.
    uniqueIndex("contact_org_company_email_uq")
      .on(table.organizationId, table.companyId, table.emailHash)
      .where(sql`${table.deletedAt} is null and ${table.emailHash} is not null`),
    check(
      "contact_lawful_basis_check",
      sql`${table.lawfulBasis} in ('legitimate_interest','consent','contract')`
    ),
    check("contact_source_check", sql`${table.source} in ('manual','cvr','import')`),
  ]
).enableRLS();

// ─── INTERACTION (typed CRM touchpoint — meeting/visit/call/email/note) ──────
// Org-scoped, and DISTINCT from the append-only `activity` audit log: an
// interaction is user-authored content (what was discussed, next steps), not a
// system event. `subject` stays plaintext so the timeline renders without
// decrypting; `bodyEnc` is AES-256-GCM encrypted. A next-step spawns a linked
// follow-up `todo` (todo.interactionId). Email/import provenance is reserved for
// a later mailbox phase; for now everything is source='manual'.

export const interaction = pgTable(
  "interaction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contact.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(), // 'meeting' | 'visit' | 'call' | 'email' | 'note'
    direction: text("direction").default("outbound").notNull(), // 'inbound' | 'outbound' | 'internal'
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    subject: text("subject"), // plaintext — rendered in the timeline without decrypt
    bodyEnc: text("body_enc"), // AES-256-GCM encrypted freeform body
    topics: jsonb("topics").default([]), // string[]
    nextStep: text("next_step"),
    nextStepAt: date("next_step_at"),
    source: text("source").default("manual").notNull(), // 'manual' | 'email' | 'import'
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("interaction_org_idx").on(table.organizationId),
    index("interaction_company_idx").on(table.companyId),
    index("interaction_org_company_idx").on(table.organizationId, table.companyId),
    // Was a bare global (occurred_at) index, which no org-scoped query could
    // use — pure write overhead. The timeline always filters by org first.
    index("interaction_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("interaction_deal_idx").on(table.dealId),
    index("interaction_created_by_idx").on(table.createdBy),
    index("interaction_contact_idx").on(table.contactId),
    check(
      "interaction_type_check",
      sql`${table.type} in ('meeting','visit','call','email','note')`
    ),
    check(
      "interaction_direction_check",
      sql`${table.direction} in ('inbound','outbound','internal')`
    ),
    check("interaction_source_check", sql`${table.source} in ('manual','email','import')`),
  ]
).enableRLS();

// ─── INTERACTION ATTACHMENT (the "materials provided" deferred in P3) ─────────
// Files live in a PRIVATE Supabase bucket; this table is the metadata + the
// authorization boundary. `storagePath` is generated server-side and never
// accepted from a client — a client-supplied path is a directory-traversal hole
// straight into another org's files. Downloads go through a short-lived signed
// URL minted per request, so a leaked link expires instead of being permanent.

export const interactionAttachment = pgTable(
  "interaction_attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    interactionId: uuid("interaction_id")
      .notNull()
      .references(() => interaction.id, { onDelete: "cascade" }),
    // Path within the bucket. Unique so a replayed "confirm upload" cannot
    // register the same object twice under two rows.
    storagePath: text("storage_path").notNull(),
    /** Original name, shown to users. Never used to build the storage path. */
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("interaction_attachment_path_uq").on(table.storagePath),
    index("interaction_attachment_interaction_idx").on(table.interactionId),
    index("interaction_attachment_org_idx").on(table.organizationId),
    index("interaction_attachment_uploaded_by_idx").on(table.uploadedBy),
    check("interaction_attachment_size_check", sql`${table.sizeBytes} > 0`),
  ]
).enableRLS();

// ─── CONTRACT (agreement with a company; drives renewal reminders + reporting) ─
// Org-scoped. `value` is WHOLE DKK (kroner) to match deal.amount + formatDKK —
// bigint only for range headroom, not sub-krone precision. A renewal cron
// notifies when expiry enters the notice window; `renewalNotifiedAt` makes that
// idempotent.

export const contract = pgTable(
  "contract",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // RESTRICT, not CASCADE: `company` is the shared, org-agnostic CVR cache
    // (see the company table) — it is not org-owned data, and a cache-cleanup or
    // dedupe job against it must never be able to delete another org's
    // commercial records, which carry bookkeeping-retention obligations.
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    status: text("status").default("active").notNull(), // 'draft' | 'active' | 'expired' | 'cancelled' | 'renewed'
    startDate: date("start_date"),
    expiryDate: date("expiry_date"),
    value: bigint("value", { mode: "number" }), // INTEGER ØRE, nullable
    currency: text("currency").default("DKK").notNull(),
    renewalNoticeDays: integer("renewal_notice_days").default(30).notNull(),
    autoRenew: boolean("auto_renew").default(false).notNull(),
    externalRef: text("external_ref"),
    notes: text("notes"),
    renewalNotifiedAt: timestamp("renewal_notified_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("contract_org_idx").on(table.organizationId),
    index("contract_company_idx").on(table.companyId),
    index("contract_org_expiry_idx").on(table.organizationId, table.expiryDate),
    index("contract_org_status_idx").on(table.organizationId, table.status),
    index("contract_deal_idx").on(table.dealId),
    index("contract_created_by_idx").on(table.createdBy),
    check(
      "contract_status_check",
      sql`${table.status} in ('draft','active','expired','cancelled','renewed')`
    ),
  ]
).enableRLS();

// ─── SEGMENT (normalized partner grouping — a reporting axis) ─────────────────
// Distinct from freeform `companyWorkspace.tags`: a segment is a first-class,
// named, colored group companies are assigned to via `company_segment`.

export const segment = pgTable(
  "segment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#94a3b8").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("segment_org_idx").on(table.organizationId),
    uniqueIndex("segment_org_name_idx").on(table.organizationId, table.name),
    index("segment_created_by_idx").on(table.createdBy),
  ]
).enableRLS();

export const companySegment = pgTable(
  "company_segment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segment.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("company_segment_uq").on(table.segmentId, table.companyId),
    index("company_segment_org_idx").on(table.organizationId),
    index("company_segment_company_idx").on(table.companyId),
    index("company_segment_segment_idx").on(table.segmentId),
  ]
).enableRLS();

// ─── QUOTATION / ORDER ENGINE (built-in commercial documents) ────────────────
// MONEY UNIT — the whole CRM stores money as INTEGER ØRE (1 DKK = 100 øre):
// quote/sales_order totals and lines, contract.value, and deal.amount. Exact
// per-line VAT rounding needs sub-krone precision, and a single unit is what
// keeps a report that joins contract value against order revenue from being
// silently 100x wrong on one side. Render with formatOre, never formatDKK.
// quantity / vatRate / discountPct stay numeric (read back as string →
// Number() at the boundary). Server ALWAYS recomputes stored totals via
// lib/quotes/totals.ts; client-sent totals are never trusted. Document numbers
// are assigned atomically per org via `document_sequence`.

export const product = pgTable(
  "product",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    unitPrice: bigint("unit_price", { mode: "number" }).default(0).notNull(), // øre
    vatRate: numeric("vat_rate").default("25").notNull(), // percent
    unit: text("unit"), // e.g. 'stk', 'hour', 'month'
    active: boolean("active").default(true).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("product_org_idx").on(table.organizationId),
    index("product_org_active_idx").on(table.organizationId, table.active),
    index("product_created_by_idx").on(table.createdBy),
  ]
).enableRLS();

// Atomic monotonic counter per (org, docType). Assigned via INSERT .. ON
// CONFLICT DO UPDATE nextNumber+1 RETURNING nextNumber — race-safe.
export const documentSequence = pgTable(
  "document_sequence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull(), // 'quote' | 'order'
    nextNumber: bigint("next_number", { mode: "number" }).default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_sequence_org_type_idx").on(table.organizationId, table.docType),
  ]
).enableRLS();

export const quote = pgTable(
  "quote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // RESTRICT — see the note on contract.companyId. A quote is a commercial
    // document; the shared company cache must not be able to delete it.
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: text("status").default("draft").notNull(), // draft|sent|accepted|rejected|expired|converted
    currency: text("currency").default("DKK").notNull(),
    issueDate: date("issue_date"),
    validUntil: date("valid_until"),
    subtotal: bigint("subtotal", { mode: "number" }).default(0).notNull(), // øre, net
    discountTotal: bigint("discount_total", { mode: "number" }).default(0).notNull(),
    vatTotal: bigint("vat_total", { mode: "number" }).default(0).notNull(),
    total: bigint("total", { mode: "number" }).default(0).notNull(),
    terms: text("terms"),
    notes: text("notes"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    // ── Customer-facing delivery ────────────────────────────────────────────
    // Frozen copy of the document as the customer received it: seller identity,
    // customer details, every line, and the totals. A quote's legal meaning is
    // the version that was sent, so the public page and the PDF both render
    // from this — never from live rows, which drift as the price list changes.
    // Written once when the quote is sent; never updated afterwards.
    snapshot: jsonb("snapshot"),
    // High-entropy capability token for the public accept page. Deliberately
    // NOT the quote id: the id appears in internal URLs and logs, and a
    // guessable token would expose one org's pricing to anyone.
    publicToken: text("public_token"),
    // Evidence of who acted on the public link, for a document with commercial
    // standing. Best-effort — a proxy header, not an identity.
    respondedIp: text("responded_ip"),
    convertedOrderId: uuid("converted_order_id"), // plain uuid — no FK, avoids quote↔order cycle
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("quote_org_idx").on(table.organizationId),
    index("quote_company_idx").on(table.companyId),
    index("quote_org_status_idx").on(table.organizationId, table.status),
    index("quote_deal_idx").on(table.dealId),
    index("quote_created_by_idx").on(table.createdBy),
    // The list page sorts createdAt DESC under an org filter; without the
    // composite that is an index scan followed by a sort.
    index("quote_org_created_idx").on(table.organizationId, table.createdAt),
    uniqueIndex("quote_org_number_idx").on(table.organizationId, table.number),
    // Unique so a collision can never silently point one customer's link at
    // another org's quote; partial so the many un-sent drafts (all NULL) do not
    // occupy the index.
    uniqueIndex("quote_public_token_idx")
      .on(table.publicToken)
      .where(sql`${table.publicToken} is not null`),
    check(
      "quote_status_check",
      sql`${table.status} in ('draft','sent','accepted','rejected','expired','converted')`
    ),
  ]
).enableRLS();

export const quoteLine = pgTable(
  "quote_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quote.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: numeric("quantity").default("1").notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).default(0).notNull(), // øre
    discountPct: numeric("discount_pct").default("0").notNull(),
    vatRate: numeric("vat_rate").default("25").notNull(),
    lineSubtotal: bigint("line_subtotal", { mode: "number" }).default(0).notNull(),
    lineDiscount: bigint("line_discount", { mode: "number" }).default(0).notNull(),
    lineVat: bigint("line_vat", { mode: "number" }).default(0).notNull(),
    lineTotal: bigint("line_total", { mode: "number" }).default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("quote_line_quote_idx").on(table.quoteId),
    index("quote_line_org_idx").on(table.organizationId),
    // Deleting a product fires SET NULL against every line table.
    index("quote_line_product_idx").on(table.productId),
  ]
).enableRLS();

export const salesOrder = pgTable(
  "sales_order",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // RESTRICT — see the note on contract.companyId.
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    dealId: uuid("deal_id").references(() => deal.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quote.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: text("status").default("open").notNull(), // open|confirmed|fulfilled|cancelled
    currency: text("currency").default("DKK").notNull(),
    orderDate: date("order_date"),
    expectedDelivery: date("expected_delivery"),
    subtotal: bigint("subtotal", { mode: "number" }).default(0).notNull(),
    discountTotal: bigint("discount_total", { mode: "number" }).default(0).notNull(),
    vatTotal: bigint("vat_total", { mode: "number" }).default(0).notNull(),
    total: bigint("total", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sales_order_org_idx").on(table.organizationId),
    index("sales_order_company_idx").on(table.companyId),
    index("sales_order_org_status_idx").on(table.organizationId, table.status),
    index("sales_order_quote_idx").on(table.quoteId),
    index("sales_order_deal_idx").on(table.dealId),
    index("sales_order_created_by_idx").on(table.createdBy),
    index("sales_order_org_created_idx").on(table.organizationId, table.createdAt),
    uniqueIndex("sales_order_org_number_idx").on(table.organizationId, table.number),
    check(
      "sales_order_status_check",
      sql`${table.status} in ('open','confirmed','fulfilled','cancelled')`
    ),
  ]
).enableRLS();

export const salesOrderLine = pgTable(
  "sales_order_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrder.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => product.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: numeric("quantity").default("1").notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).default(0).notNull(),
    discountPct: numeric("discount_pct").default("0").notNull(),
    vatRate: numeric("vat_rate").default("25").notNull(),
    lineSubtotal: bigint("line_subtotal", { mode: "number" }).default(0).notNull(),
    lineDiscount: bigint("line_discount", { mode: "number" }).default(0).notNull(),
    lineVat: bigint("line_vat", { mode: "number" }).default(0).notNull(),
    lineTotal: bigint("line_total", { mode: "number" }).default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_order_line_order_idx").on(table.orderId),
    index("sales_order_line_org_idx").on(table.organizationId),
    index("sales_order_line_product_idx").on(table.productId),
  ]
).enableRLS();

// ─── PIPELINE (custom deal pipeline, one per org can be default) ─────────────

export const pipeline = pgTable(
  "pipeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("pipeline_org_idx").on(table.organizationId),
    // At most one default pipeline per org.
    uniqueIndex("pipeline_org_default_uq")
      .on(table.organizationId)
      .where(sql`${table.isDefault}`),
  ]
).enableRLS();

// ─── PIPELINE STAGE (ordered columns of a pipeline) ─────────────────────────
// `position` is application-managed (rewritten in a transaction on reorder) and
// intentionally NOT unique-constrained to avoid mid-reorder collisions.

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipeline.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    color: text("color"),
    isWon: boolean("is_won").default(false).notNull(),
    isLost: boolean("is_lost").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("pipeline_stage_pipeline_idx").on(table.pipelineId),
    index("pipeline_stage_org_idx").on(table.organizationId),
    index("pipeline_stage_position_idx").on(table.pipelineId, table.position),
  ]
).enableRLS();

// ─── DEAL (an opportunity; a company may have several) ──────────────────────

export const deal = pgTable(
  "deal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipeline.id, { onDelete: "cascade" }),
    // restrict: a stage with deals cannot be deleted (app requires reassignment).
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStage.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    // INTEGER ØRE — one money unit across the whole CRM (see the money note on
    // the quote table). Was numeric whole-kroner, which meant any report joining
    // deal value against quote/order totals was silently 100x wrong on one side.
    amount: bigint("amount", { mode: "number" }),
    currency: text("currency").default("DKK").notNull(),
    closeDate: date("close_date"),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    primaryContactId: uuid("primary_contact_id").references(() => contact.id, {
      onDelete: "set null",
    }),
    status: text("status").default("open").notNull(), // 'open' | 'won' | 'lost' (derived from stage flags)
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("deal_org_idx").on(table.organizationId),
    index("deal_company_idx").on(table.companyId),
    index("deal_pipeline_idx").on(table.pipelineId),
    index("deal_stage_idx").on(table.stageId),
    index("deal_assigned_idx").on(table.assignedUserId),
    index("deal_org_status_idx").on(table.organizationId, table.status),
    index("deal_created_by_idx").on(table.createdBy),
    index("deal_primary_contact_idx").on(table.primaryContactId),
    check("deal_status_check", sql`${table.status} in ('open','won','lost')`),
  ]
).enableRLS();

// ─── FOLLOWED PERSON (user follows a CVR participant for change tracking) ───

export const followedPerson = pgTable(
  "followed_person",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    participantNumber: text("participant_number").notNull(),
    personName: text("person_name").notNull(),
    fromVat: text("from_vat"), // originating company VAT — needed to fetch company relations
    note: text("note"),
    isActive: boolean("is_active").default(true).notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("followed_person_user_participant_idx").on(table.userId, table.participantNumber),
    index("followed_person_user_idx").on(table.userId),
    index("followed_person_participant_idx").on(table.participantNumber),
    index("followed_person_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── PERSON ↔ COMPANY INDEX (reverse index for change feed filtering) ───────
// Self-healing: cron worker inserts new rows when a followed participant appears in a new company.

export const personCompanyIndex = pgTable(
  "person_company_index",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantNumber: text("participant_number").notNull(),
    companyVat: text("company_vat").notNull(),
    companyName: text("company_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("person_company_idx").on(table.participantNumber, table.companyVat),
    index("person_company_participant_idx").on(table.participantNumber),
    index("person_company_vat_idx").on(table.companyVat),
  ]
).enableRLS();

// ─── PERSON ROLE SNAPSHOT (last-known state for change diffing) ─────────────
// Shared across users — keyed on (participantNumber, companyVat), NOT per-user.
// rolesJson stores structured roles with soft-delete semantics:
//   { type: string, start: string|null, end: string|null, title: string|null,
//     owner_percent: number|null, owner_voting_percent: number|null }[]
// When a role is removed, `end` is set (not deleted from array) to preserve history.

export const personRoleSnapshot = pgTable(
  "person_role_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantNumber: text("participant_number").notNull(),
    companyVat: text("company_vat").notNull(),
    rolesJson: jsonb("roles_json").default([]).notNull(),
    companyName: text("company_name"),
    companyStatus: text("company_status"),
    companyBankrupt: boolean("company_bankrupt").default(false),
    companyIndustry: text("company_industry"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("person_role_snapshot_unique_idx").on(table.participantNumber, table.companyVat),
    index("person_role_snapshot_participant_idx").on(table.participantNumber),
  ]
).enableRLS();

// ─── PERSON ROLE EVENT (immutable change log — audit trail + notifications) ──
// Events are GLOBAL (not per-user). Resolve per-user at query time via followedPerson join.
// eventHash prevents duplicate events from repeated processing.

export const personRoleEvent = pgTable(
  "person_role_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participantNumber: text("participant_number").notNull(),
    companyVat: text("company_vat").notNull(),
    companyName: text("company_name"),
    personName: text("person_name"),
    eventType: text("event_type").notNull(), // 'role_added' | 'role_removed' | 'role_updated' | 'company_status_changed' | 'company_bankrupt'
    eventCategory: text("event_category").notNull(), // 'role' | 'company' | 'ownership'
    role: jsonb("role"), // the role object involved (null for company-level events)
    previousValue: jsonb("previous_value"), // old state for updates
    newValue: jsonb("new_value"), // new state for updates
    importance: text("importance").default("normal").notNull(), // 'low' | 'normal' | 'high'
    eventHash: text("event_hash").notNull(), // deterministic hash for dedup: hash(participant + company + eventType + role + newValue)
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("person_role_event_hash_idx").on(table.eventHash),
    index("person_role_event_participant_idx").on(table.participantNumber),
    index("person_role_event_company_idx").on(table.companyVat),
    index("person_role_event_detected_idx").on(table.detectedAt),
    index("person_role_event_type_idx").on(table.eventType),
    index("person_role_event_category_idx").on(table.eventCategory),
  ]
).enableRLS();

// ─── FOLLOWED COMPANY (annual-report + status watch) ────────────────────────

/**
 * A company a user has subscribed to alerts for.
 *
 * Deliberately NOT `savedCompany`: saving is a bookmark, following is a
 * subscription. Mirrors `followedPerson` field for field, because the daily
 * cron that drives it follows the same shape.
 */
export const followedCompany = pgTable(
  "followed_company",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    cvr: text("cvr").notNull(),
    companyName: text("company_name").notNull(),
    note: text("note"),
    isActive: boolean("is_active").default(true).notNull(),
    /**
     * NULL means FIRST SIGHT: the next poll seeds every observed period and
     * emits no notifications. Without it, switching the feature on announces
     * annual reports filed months ago and the alerts read as untimely.
     * Stamped on every poll, whether or not anything was filed.
     */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("followed_company_user_cvr_idx").on(table.userId, table.cvr),
    index("followed_company_user_idx").on(table.userId),
    index("followed_company_cvr_idx").on(table.cvr),
    index("followed_company_org_idx").on(table.organizationId),
    // The cron's own query: active follows, one lookup per distinct CVR.
    index("followed_company_active_idx").on(table.isActive, table.cvr),
  ]
).enableRLS();

/**
 * Per-user claim slot for the annual-report digest.
 *
 * Exists so "did this user already get today's digest?" is answered by a
 * conditional UPDATE rather than by counting emails: the claim and the send
 * cannot then interleave across two workers. Same claim-before-send idiom the
 * contract-renewal cron uses.
 */
export const annualReportDigest = pgTable(
  "annual_report_digest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** UTC date of the last digest actually claimed. */
    lastDigestOn: date("last_digest_on"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("annual_report_digest_user_uq").on(table.userId)]
).enableRLS();

// ─── ANNUAL REPORT EVENT ────────────────────────────────────────────────────

/**
 * One row per annual-report PERIOD we have observed for a company.
 *
 * Annual-report invariants
 *
 *  1. Only AARSRAPPORT documents participate in annual-report detection.
 *  2. (cvr, period_end, source) is the canonical report identity.
 *  3. period_end determines financial ordering; publicdate never does.
 *  4. Detection is set membership, never a "latest period" watermark.
 *  5. Every AARSRAPPORT period must be offered to the event insert.
 *  6. Multiple documents with the same period_end represent ONE financial period.
 *  7. For a period with multiple documents, the highest publicdate is the
 *     current revision.
 *  8. Refilings update the existing period but never create a new notification
 *     event in v1.
 *  9. [0] and [1] mean the latest two distinct period_end VALUES, never the
 *     latest two documents.
 * 10. First sight seeds all observed periods but emits no notifications.
 * 11. Notification audience is org owners ∪ org admins ∪ follower, deduplicated.
 * 12. publicdate remains available for late-filing intelligence but never
 *     affects identity, ordering, or detection.
 *
 * Why period_end and not publicdate: Novo Nordisk's FY2000 annual report was
 * filed 2004-07-19, AFTER FY2001, FY2002 and FY2003. Ordering by filing date
 * would call a 2000 report "the latest"; a watermark on the newest period would
 * never notice it arriving at all.
 *
 * This is an OBSERVATION table — it records that a period became known.
 * `companyMetrics` is the STATE of that period. That is why this one is
 * ON CONFLICT DO NOTHING (a refiling is not a new observation) while metrics
 * are ON CONFLICT DO UPDATE (a refiling corrects the figures).
 */
export const annualReportEvent = pgTable(
  "annual_report_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cvr: text("cvr").notNull(),
    companyName: text("company_name"),
    /** Canonical identity and chronology. Never publicdate. */
    periodEnd: date("period_end").notNull(),
    periodStart: date("period_start"),
    source: text("source").default("cvr_api").notNull(),
    /** METADATA ONLY — enables "filed N years late", never ordering. */
    publicdate: date("publicdate"),
    documentUrl: text("document_url"),
    /** The report's financial summary as returned by CVR. */
    summaryJson: jsonb("summary_json"),
    /** Bumped when a further document appears for an already-known period. */
    revisionCount: integer("revision_count").default(0).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * THE DETECTION MECHANISM, not merely a constraint.
     *
     *   INSERT ... ON CONFLICT (cvr, period_end, source) DO NOTHING RETURNING *
     *
     * The returned rows ARE the genuinely-new periods, which makes the pipeline
     * idempotent across retries, restarts and concurrent cron runs by
     * construction — no application-side "seen" set to drift.
     */
    uniqueIndex("annual_report_event_identity_uq").on(
      table.cvr,
      table.periodEnd,
      table.source
    ),
    index("annual_report_event_cvr_idx").on(table.cvr, table.periodEnd),
    index("annual_report_event_seen_idx").on(table.firstSeenAt),
  ]
).enableRLS();

// ─── CHANGE FEED CURSOR (global cursor for CVR company change feed) ─────────
// isProcessing + processingStartedAt provide a simple distributed lock.
// Stale lock detection: if isProcessing=true but processingStartedAt > 30min ago, treat as stale.

export const changeFeedCursor = pgTable(
  "change_feed_cursor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedType: text("feed_type").notNull(),
    lastChangeId: text("last_change_id").notNull(),
    isProcessing: boolean("is_processing").default(false).notNull(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("change_feed_cursor_type_idx").on(table.feedType),
  ]
).enableRLS();

// ─── CRM CONNECTION ─────────────────────────────────────────────────────────

export const crmConnection = pgTable(
  "crm_connection",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(), // 'hubspot' | 'leadconnector' | 'pipedrive'
    accessToken: text("access_token").notNull(), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    instanceUrl: text("instance_url"), // LeadConnector locationId / provider-specific URL
    scopes: text("scopes"),
    isActive: boolean("is_active").default(true).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("crm_connection_user_provider_idx").on(table.userId, table.provider),
    index("crm_connection_user_idx").on(table.userId),
    index("crm_connection_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── CRM SYNC MAPPING ───────────────────────────────────────────────────────

export const crmSyncMapping = pgTable(
  "crm_sync_mapping",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => crmConnection.id, { onDelete: "cascade" }),
    localEntityType: text("local_entity_type").notNull(), // 'company' | 'todo' | 'note'
    localEntityId: uuid("local_entity_id").notNull(),
    crmEntityType: text("crm_entity_type").notNull(),
    crmEntityId: text("crm_entity_id").notNull(),
    // Sync tracking
    syncDirection: text("sync_direction").default("push").notNull(), // 'push' | 'pull' | 'bidirectional'
    version: integer("version").default(1).notNull(),
    lastLocalUpdate: timestamp("last_local_update", { withTimezone: true }),
    lastRemoteUpdate: timestamp("last_remote_update", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    syncStatus: text("sync_status").default("synced").notNull(), // 'synced' | 'pending' | 'error' | 'conflict'
    syncError: text("sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("crm_sync_mapping_unique_idx").on(
      table.connectionId,
      table.localEntityType,
      table.localEntityId
    ),
    index("crm_sync_mapping_connection_idx").on(table.connectionId),
    index("crm_sync_mapping_local_idx").on(table.localEntityType, table.localEntityId),
    index("crm_sync_mapping_status_idx").on(table.connectionId, table.syncStatus),
  ]
).enableRLS();

// ─── CRM SYNC LOG ────────────────────────────────────────────────────────────

export const crmSyncLog = pgTable(
  "crm_sync_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => crmConnection.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // 'push_company' | 'push_bulk' | 'update_company' | 'pull_company'
    localEntityType: text("local_entity_type"),
    localEntityId: uuid("local_entity_id"),
    crmEntityId: text("crm_entity_id"),
    status: text("status").notNull(), // 'success' | 'error' | 'skipped' | 'conflict'
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("crm_sync_log_connection_idx").on(table.connectionId),
    index("crm_sync_log_user_idx").on(table.userId),
    index("crm_sync_log_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── SUBSCRIPTION (Stripe billing) ──────────────────────────────────────────

export const subscription = pgTable(
  "subscription",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    plan: text("plan").default("free").notNull(), // 'free' | 'starter' | 'professional' | 'enterprise'
    status: text("status").default("active").notNull(), // 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'trialing'
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    pendingPlanChange: text("pending_plan_change"), // null when no change pending; set by change-plan, cleared by webhook
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("subscription_user_idx").on(table.userId),
    uniqueIndex("subscription_stripe_customer_idx").on(table.stripeCustomerId),
    uniqueIndex("subscription_stripe_sub_idx").on(table.stripeSubscriptionId),
    index("subscription_plan_idx").on(table.plan),
    index("subscription_status_idx").on(table.status),
  ]
).enableRLS();

// ─── CHAT LANDING SESSION (start.cvr-mate.dk ad-traffic chat) ──────────────

export const chatLandingSession = pgTable(
  "chat_landing_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transcript: jsonb("transcript").default([]).notNull(), // { role, content }[]
    qualifyingAnswers: jsonb("qualifying_answers").default({}).notNull(),
    recommendedPlan: text("recommended_plan"),
    locale: text("locale").default("da").notNull(), // 'da' | 'en' — language the visitor chatted in
    previewCompanyVats: jsonb("preview_company_vats").default([]), // number[]
    previewCompanySnapshot: jsonb("preview_company_snapshot"), // unmasked, server-only
    signupUserId: text("signup_user_id").references(() => user.id, { onDelete: "set null" }),
    signupEmail: text("signup_email"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    slackNotifiedAt: timestamp("slack_notified_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_landing_session_signup_user_idx").on(table.signupUserId),
    index("chat_landing_session_created_idx").on(table.createdAt),
  ]
).enableRLS();

// ─── AGENT SESSIONS (conversational search agent — /agent) ──────────────────

export const agentSession = pgTable(
  "agent_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Nullable, team-scoped like `todo`: personal rows are null, team rows carry the org.
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    title: text("title"), // derived from the first user message
    locale: text("locale").default("da").notNull(), // 'da' | 'en'
    status: text("status").default("active").notNull(), // 'active' | 'awaiting_confirmation' | 'archived'
    // Pending write-action awaiting user confirmation: { toolUseId, toolName, input }
    pendingInterrupt: jsonb("pending_interrupt"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_session_user_created_idx").on(table.userId, table.createdAt),
    index("agent_session_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── AGENT MESSAGES (agent transcript — Anthropic content blocks, verbatim) ──

export const agentMessage = pgTable(
  "agent_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSession.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'tool_result'
    // Anthropic ContentBlock[] stored verbatim (text / tool_use / tool_result) so
    // history rebuilds losslessly for the next messages.stream() call.
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_message_session_created_idx").on(table.sessionId, table.createdAt),
  ]
).enableRLS();

// ─── USAGE RECORDS (monthly quota tracking) ─────────────────────────────────

export const usageRecord = pgTable(
  "usage_record",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Who performed it. Kept for audit — "who did this" stays answerable even
    // when the cost is charged elsewhere.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * Which workspace the cost belongs to. NULL = personal.
     *
     * `userId` answered both *who did it* and *whose quota it spends*, which
     * were the same question until organizations existed. They are not: a
     * member drafting a follow-up for their team was drawing down their own
     * personal allowance, so someone on Pro could exhaust their month doing an
     * Enterprise org's work.
     *
     * Cascade rather than set-null: usage attributed to a deleted organization
     * has no bucket left to belong to, and keeping it would silently re-charge
     * the individual months later.
     */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    feature: text("feature").notNull(), // 'ai_usage' | 'company_search' | 'export'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_record_user_feature_created_idx").on(table.userId, table.feature, table.createdAt),
    // The org-scoped count runs the same shape of query as the personal one.
    index("usage_record_org_feature_created_idx").on(
      table.organizationId,
      table.feature,
      table.createdAt
    ),
  ]
).enableRLS();

// ─── FEATURES (video explainer registry) ────────────────────────────────────

export const features = pgTable(
  "features",
  {
    key: text("key").primaryKey(),
    name: text("name").notNull(),
    route: text("route").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("features_route_idx").on(table.route),
  ]
).enableRLS();

// ─── FEATURE VIDEO (versioned video metadata) ──────────────────────────────

export const featureVideo = pgTable(
  "feature_video",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    featureKey: text("feature_key")
      .notNull()
      .references(() => features.key, { onDelete: "restrict" }),
    locale: text("locale").notNull(),
    version: integer("version").default(1).notNull(),
    status: text("status").default("draft").notNull(),
    isCurrent: boolean("is_current").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    videoPath: text("video_path").notNull(),
    thumbnailPath: text("thumbnail_path"),
    durationSeconds: integer("duration_seconds"),
    autoShow: boolean("auto_show").default(true).notNull(),
    triggerType: text("trigger_type").default("auto").notNull(),
    triggerConfig: jsonb("trigger_config"),
    goal: text("goal"),
    priority: integer("priority").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("feature_video_key_locale_version_idx").on(
      table.featureKey,
      table.locale,
      table.version
    ),
    index("feature_video_key_locale_current_idx").on(
      table.featureKey,
      table.locale,
      table.isCurrent
    ),
    check(
      "status_is_current_check",
      sql`(${table.status} = 'published' AND ${table.isCurrent} = true) OR (${table.isCurrent} = false)`
    ),
  ]
).enableRLS();

// ─── USER VIDEO VIEW (engagement tracking) ─────────────────────────────────

export const userVideoView = pgTable(
  "user_video_view",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    featureKey: text("feature_key")
      .notNull()
      .references(() => features.key, { onDelete: "restrict" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    viewCount: integer("view_count").default(1).notNull(),
    lastPositionSeconds: integer("last_position_seconds"),
    lastSeenVersion: integer("last_seen_version").notNull(),
    dismissed: boolean("dismissed").default(false).notNull(),
    totalWatchTimeSeconds: integer("total_watch_time_seconds").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("user_video_view_user_feature_idx").on(table.userId, table.featureKey),
    index("user_video_view_user_idx").on(table.userId),
  ]
).enableRLS();

// ─── MATCH FEED ITEM (daily matched leads: feed + exclusion set + feedback log) ─
export const matchFeedItem = pgTable(
  "match_feed_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    // nullable: ES-sourced candidates may have no canonical company row until accepted
    companyId: uuid("company_id").references(() => company.id, { onDelete: "set null" }),
    cvr: text("cvr").notNull(),
    // denormalized display snapshot so the feed renders without a join/ES refetch
    // shape: { name, city, industry, industryCode, founded, employees, form }
    companySnapshot: jsonb("company_snapshot"),
    feedDate: date("feed_date").notNull(), // local date this match was generated
    rank: integer("rank").notNull(),
    score: text("score").notNull(), // 'high' | 'medium' | 'low' (enforced in TS)
    reason: text("reason"), // LLM "why this fits you"
    status: text("status").default("pending").notNull(), // 'pending' | 'accepted' | 'rejected'
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // one row per user per company EVER — the "never reappear" mechanism.
    // Retrieval anti-joins this; inserts use onConflictDoNothing. Mirrors
    // saved_company_user_cvr_idx.
    uniqueIndex("match_feed_item_user_cvr_idx").on(table.userId, table.cvr),
    index("match_feed_item_user_date_status_idx").on(table.userId, table.feedDate, table.status),
    index("match_feed_item_user_status_idx").on(table.userId, table.status),
    index("match_feed_item_org_idx").on(table.organizationId),
  ]
).enableRLS();

// ─── MATCH PROFILE (per-user cached filters + learned preferences) ─────────────
export const matchProfile = pgTable(
  "match_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // TriggerFilter-shaped filters derived from the user's brand/KB (cached)
    cachedFilters: jsonb("cached_filters"),
    // compared against userBrand.updatedAt to detect staleness
    filtersComputedAt: timestamp("filters_computed_at", { withTimezone: true }),
    // learned weights: { industry: {code: weight}, size: {bucket: weight}, region: {region: weight} }
    preferences: jsonb("preferences").default({}).notNull(),
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("match_profile_user_idx").on(table.userId)]
).enableRLS();

// ─── ORGANIZATION PROFILE (the issuer identity on commercial documents) ──────
//
// The legal identity of the org, as it appears on quotes and orders.
//
// Deliberately a separate table rather than columns on `organization`: that one
// belongs to Better Auth, and putting commercial identity in it couples the CRM
// to a library's schema. Deliberately not `organization.metadata` either — that
// is an untyped `text` column, and values printed on a document that carries
// commercial weight need constraints.
//
// Replaces `userBrand` as the seller of record. Identity used to be read from
// the *issuing user's* brand profile, so two members of one org stamped
// different seller blocks on quotes to the same customer, and no address field
// existed anywhere — meaning every quote PDF went out without one.
export const organizationProfile = pgTable(
  "organization_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // The registered name, which is not always the name people call the org.
    // `organization.name` stays the display name shown in the app.
    legalName: text("legal_name").notNull(),
    // Nullable: the manual path exists for foreign entities and sole traders
    // that have no Danish CVR, and for when the registry is unreachable.
    cvr: text("cvr"),
    addressLine: text("address_line"),
    zipCode: text("zip_code"),
    city: text("city"),
    countryCode: text("country_code").default("DK").notNull(),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    // Hex, feeds SnapshotSeller.color for document accents.
    brandColor: text("brand_color"),
    // Provenance. A registry-verified address and a hand-typed one are worth
    // different amounts in a dispute, and without this the two are
    // indistinguishable — which makes any later re-verification unsafe, because
    // stale data cannot be told apart from a deliberate override.
    source: text("source").default("manual").notNull(), // 'cvr' | 'manual'
    cvrVerifiedAt: timestamp("cvr_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // One profile per org. Unique rather than a plain index so a race during
    // creation cannot leave an org with two identities.
    uniqueIndex("organization_profile_org_idx").on(table.organizationId),
    check("organization_profile_source_check", sql`${table.source} in ('cvr','manual')`),
    check("organization_profile_country_check", sql`length(${table.countryCode}) = 2`),
  ]
).enableRLS();

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const companyRelations = relations(company, ({ many }) => ({
  savedBy: many(savedCompany),
  notes: many(companyNote),
  todos: many(todo),
  metrics: many(companyMetrics),
  workspaces: many(companyWorkspace),
  contacts: many(contact),
  deals: many(deal),
}));

export const companyMetricsRelations = relations(companyMetrics, ({ one }) => ({
  company: one(company, {
    fields: [companyMetrics.companyId],
    references: [company.id],
  }),
}));

export const savedCompanyRelations = relations(savedCompany, ({ one }) => ({
  user: one(user, { fields: [savedCompany.userId], references: [user.id] }),
  company: one(company, {
    fields: [savedCompany.companyId],
    references: [company.id],
  }),
}));

export const savedSearchRelations = relations(savedSearch, ({ one }) => ({
  user: one(user, { fields: [savedSearch.userId], references: [user.id] }),
}));

export const matchFeedItemRelations = relations(matchFeedItem, ({ one }) => ({
  user: one(user, { fields: [matchFeedItem.userId], references: [user.id] }),
  organization: one(organization, {
    fields: [matchFeedItem.organizationId],
    references: [organization.id],
  }),
  company: one(company, { fields: [matchFeedItem.companyId], references: [company.id] }),
}));

export const matchProfileRelations = relations(matchProfile, ({ one }) => ({
  user: one(user, { fields: [matchProfile.userId], references: [user.id] }),
}));

export const leadTriggerRelations = relations(leadTrigger, ({ one, many }) => ({
  user: one(user, { fields: [leadTrigger.userId], references: [user.id] }),
  results: many(triggerResult),
}));

export const triggerResultRelations = relations(triggerResult, ({ one }) => ({
  trigger: one(leadTrigger, {
    fields: [triggerResult.triggerId],
    references: [leadTrigger.id],
  }),
  user: one(user, { fields: [triggerResult.userId], references: [user.id] }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));

export const todoRelations = relations(todo, ({ one }) => ({
  user: one(user, { fields: [todo.userId], references: [user.id] }),
  company: one(company, { fields: [todo.companyId], references: [company.id] }),
  assignedUser: one(user, { fields: [todo.assignedUserId], references: [user.id] }),
}));

export const companyNoteRelations = relations(companyNote, ({ one }) => ({
  company: one(company, {
    fields: [companyNote.companyId],
    references: [company.id],
  }),
  user: one(user, { fields: [companyNote.userId], references: [user.id] }),
}));

export const userBrandRelations = relations(userBrand, ({ one }) => ({
  user: one(user, { fields: [userBrand.userId], references: [user.id] }),
}));

export const organizationProfileRelations = relations(organizationProfile, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationProfile.organizationId],
    references: [organization.id],
  }),
}));

export const emailLogRelations = relations(emailLog, ({ one }) => ({
  user: one(user, { fields: [emailLog.userId], references: [user.id] }),
}));

export const orgAuditLogRelations = relations(orgAuditLog, ({ one }) => ({
  actor: one(user, { fields: [orgAuditLog.actorId], references: [user.id] }),
  targetUser: one(user, { fields: [orgAuditLog.targetUserId], references: [user.id] }),
}));

export const companyBriefingRelations = relations(companyBriefing, ({ one }) => ({
  user: one(user, { fields: [companyBriefing.userId], references: [user.id] }),
}));

export const outreachMessageRelations = relations(outreachMessage, ({ one }) => ({
  user: one(user, { fields: [outreachMessage.userId], references: [user.id] }),
}));

export const activityRelations = relations(activity, ({ one }) => ({
  user: one(user, { fields: [activity.userId], references: [user.id] }),
}));

export const companyWorkspaceRelations = relations(companyWorkspace, ({ one }) => ({
  company: one(company, {
    fields: [companyWorkspace.companyId],
    references: [company.id],
  }),
  assignedUser: one(user, {
    fields: [companyWorkspace.assignedUserId],
    references: [user.id],
  }),
}));

export const contactRelations = relations(contact, ({ one, many }) => ({
  company: one(company, { fields: [contact.companyId], references: [company.id] }),
  organization: one(organization, {
    fields: [contact.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, { fields: [contact.createdBy], references: [user.id] }),
  deals: many(deal),
}));

export const pipelineRelations = relations(pipeline, ({ one, many }) => ({
  organization: one(organization, {
    fields: [pipeline.organizationId],
    references: [organization.id],
  }),
  stages: many(pipelineStage),
  deals: many(deal),
}));

export const pipelineStageRelations = relations(pipelineStage, ({ one, many }) => ({
  pipeline: one(pipeline, {
    fields: [pipelineStage.pipelineId],
    references: [pipeline.id],
  }),
  deals: many(deal),
}));

export const dealRelations = relations(deal, ({ one }) => ({
  organization: one(organization, {
    fields: [deal.organizationId],
    references: [organization.id],
  }),
  company: one(company, { fields: [deal.companyId], references: [company.id] }),
  pipeline: one(pipeline, { fields: [deal.pipelineId], references: [pipeline.id] }),
  stage: one(pipelineStage, { fields: [deal.stageId], references: [pipelineStage.id] }),
  assignedUser: one(user, { fields: [deal.assignedUserId], references: [user.id] }),
  primaryContact: one(contact, {
    fields: [deal.primaryContactId],
    references: [contact.id],
  }),
  createdByUser: one(user, { fields: [deal.createdBy], references: [user.id] }),
}));

export const crmConnectionRelations = relations(crmConnection, ({ one, many }) => ({
  user: one(user, { fields: [crmConnection.userId], references: [user.id] }),
  syncMappings: many(crmSyncMapping),
  syncLogs: many(crmSyncLog),
}));

export const crmSyncMappingRelations = relations(crmSyncMapping, ({ one }) => ({
  connection: one(crmConnection, {
    fields: [crmSyncMapping.connectionId],
    references: [crmConnection.id],
  }),
}));

export const crmSyncLogRelations = relations(crmSyncLog, ({ one }) => ({
  connection: one(crmConnection, {
    fields: [crmSyncLog.connectionId],
    references: [crmConnection.id],
  }),
  user: one(user, { fields: [crmSyncLog.userId], references: [user.id] }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}));

export const usageRecordRelations = relations(usageRecord, ({ one }) => ({
  user: one(user, { fields: [usageRecord.userId], references: [user.id] }),
}));

export const agentSessionRelations = relations(agentSession, ({ one, many }) => ({
  user: one(user, { fields: [agentSession.userId], references: [user.id] }),
  messages: many(agentMessage),
}));

export const agentMessageRelations = relations(agentMessage, ({ one }) => ({
  session: one(agentSession, {
    fields: [agentMessage.sessionId],
    references: [agentSession.id],
  }),
}));

export const profileEnrichmentRelations = relations(profileEnrichment, ({ one }) => ({
  user: one(user, { fields: [profileEnrichment.userId], references: [user.id] }),
}));

export const followedPersonRelations = relations(followedPerson, ({ one }) => ({
  user: one(user, { fields: [followedPerson.userId], references: [user.id] }),
}));

export const followedCompanyRelations = relations(followedCompany, ({ one }) => ({
  user: one(user, { fields: [followedCompany.userId], references: [user.id] }),
}));

export const featuresRelations = relations(features, ({ many }) => ({
  videos: many(featureVideo),
  userViews: many(userVideoView),
}));

export const featureVideoRelations = relations(featureVideo, ({ one }) => ({
  feature: one(features, {
    fields: [featureVideo.featureKey],
    references: [features.key],
  }),
}));

export const userVideoViewRelations = relations(userVideoView, ({ one }) => ({
  user: one(user, { fields: [userVideoView.userId], references: [user.id] }),
  feature: one(features, {
    fields: [userVideoView.featureKey],
    references: [features.key],
  }),
}));

// Defined here (not in auth-schema.ts) to avoid circular imports
export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  brand: one(userBrand),
  subscription: one(subscription),
  crmConnections: many(crmConnection),
  activities: many(activity),
  usageRecords: many(usageRecord),
  followedPeople: many(followedPerson),
  followedCompanies: many(followedCompany),
  emailLogs: many(emailLog),
  agentSessions: many(agentSession),
}));

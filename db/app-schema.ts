import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
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
);

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
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    source: text("source").default("cvr_api").notNull(), // 'cvr_api' | 'manual' | 'import'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("company_metrics_company_idx").on(table.companyId),
    index("company_metrics_recorded_idx").on(table.companyId, table.recordedAt),
  ]
);

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
);

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
);

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
);

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
);

// ─── NOTIFICATION ───────────────────────────────────────────────────────────

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  ]
);

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
  ]
);

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
);

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
);

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
);

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
});

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
);

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
);

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
);

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
);

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
);

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
    index("activity_user_type_idx").on(table.userId, table.entityType),
  ]
);

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
  ]
);

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
);

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
);

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
);

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
    amount: numeric("amount"),
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
    check("deal_status_check", sql`${table.status} in ('open','won','lost')`),
  ]
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

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
);

// ─── USAGE RECORDS (monthly quota tracking) ─────────────────────────────────

export const usageRecord = pgTable(
  "usage_record",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(), // 'ai_usage' | 'company_search' | 'export'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_record_user_feature_created_idx").on(table.userId, table.feature, table.createdAt),
  ]
);

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
);

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
);

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
);

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
);

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
);

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
  emailLogs: many(emailLog),
  agentSessions: many(agentSession),
}));

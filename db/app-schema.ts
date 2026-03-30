import { relations } from "drizzle-orm";
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
} from "drizzle-orm/pg-core";
import { user, session, account, organization, member } from "./auth-schema";

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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    type: text("type").default("system").notNull(), // 'trigger' | 'system' | 'export' | 'crm_sync' | 'member' | 'mention'
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
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
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
    visibility: text("visibility").default("org").notNull(), // 'private' | 'team' | 'org'
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

// ─── ENTERPRISE INQUIRY ─────────────────────────────────────────────────────

export const enterpriseInquiry = pgTable("enterprise_inquiry", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone"),
  message: text("message"),
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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_brand_user_idx").on(table.userId),
    index("user_brand_org_idx").on(table.organizationId),
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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
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
    index("company_briefing_org_idx").on(table.organizationId),
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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
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
    index("outreach_message_org_idx").on(table.organizationId),
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
    entityType: text("entity_type").notNull(), // 'company' | 'todo' | 'note' | 'trigger' | 'crm_sync' | 'member' | 'organization' | 'billing' | 'api_key' | 'sso'
    entityId: uuid("entity_id"),
    action: text("action").notNull(), // 'created' | 'updated' | 'deleted' | 'synced' | 'exported' | 'saved' | 'unsaved' | 'invited' | 'removed' | 'role_changed' | 'login' | 'logout' | 'api_key_created' | 'api_key_revoked' | 'settings_changed'
    resource: text("resource"), // mirrors permission resources for filtering
    severity: text("severity").default("info").notNull(), // 'info' | 'warning' | 'critical'
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
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
    status: text("status").default("prospect").notNull(), // 'prospect' | 'lead' | 'qualified' | 'customer' | 'churned' (or custom via pipelineStage)
    pipelineStageId: uuid("pipeline_stage_id"), // references pipelineStage.id (added below)
    tags: jsonb("tags").default([]),
    priority: text("priority").default("medium").notNull(), // 'low' | 'medium' | 'high' | 'urgent'
    source: text("source"), // 'search' | 'trigger' | 'import' | 'crm_sync' | 'api'
    customFields: jsonb("custom_fields").default({}),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
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
    provider: text("provider").notNull(), // 'hubspot' | 'salesforce' | 'pipedrive'
    accessToken: text("access_token").notNull(), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    instanceUrl: text("instance_url"), // Salesforce instance URL
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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    plan: text("plan").default("free").notNull(), // 'free' | 'go' | 'flow' | 'enterprise'
    status: text("status").default("active").notNull(), // 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
    seatCount: integer("seat_count").default(1).notNull(),
    seatPriceId: text("seat_price_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
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
    index("subscription_org_idx").on(table.organizationId),
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
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    feature: text("feature").notNull(), // 'ai_usage' | 'company_search' | 'export'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_record_user_feature_created_idx").on(table.userId, table.feature, table.createdAt),
    index("usage_record_org_feature_created_idx").on(table.organizationId, table.feature, table.createdAt),
  ]
);

// ─── ORG PERMISSION (RBAC) ──────────────────────────────────────────────────

export const orgPermission = pgTable(
  "org_permission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
    resource: text("resource").notNull(), // 'company' | 'trigger' | 'todo' | 'note' | 'crm' | 'export' | 'settings' | 'billing' | 'members' | 'api_keys' | 'audit_log'
    actions: jsonb("actions").default([]).notNull(), // ['create', 'read', 'update', 'delete', 'export']
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("org_permission_org_idx").on(table.organizationId),
    uniqueIndex("org_permission_org_role_resource_idx").on(
      table.organizationId,
      table.role,
      table.resource
    ),
  ]
);

// ─── TEAM (departments within org) ──────────────────────────────────────────

export const team = pgTable(
  "team",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    leadUserId: text("lead_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    color: text("color"), // hex color for UI badges
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("team_org_idx").on(table.organizationId),
    uniqueIndex("team_org_name_idx").on(table.organizationId, table.name),
  ]
);

// ─── TEAM MEMBER ────────────────────────────────────────────────────────────

export const teamMember = pgTable(
  "team_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(), // 'lead' | 'member'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("team_member_team_idx").on(table.teamId),
    index("team_member_user_idx").on(table.userId),
    uniqueIndex("team_member_team_user_idx").on(table.teamId, table.userId),
  ]
);

// ─── COMPANY ASSIGNMENT (lead assignment history) ───────────────────────────

export const companyAssignment = pgTable(
  "company_assignment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyWorkspaceId: uuid("company_workspace_id")
      .notNull()
      .references(() => companyWorkspace.id, { onDelete: "cascade" }),
    assignedToUserId: text("assigned_to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("company_assignment_workspace_idx").on(table.companyWorkspaceId),
    index("company_assignment_assigned_to_idx").on(table.assignedToUserId),
  ]
);

// ─── MENTION (@mentions in notes) ───────────────────────────────────────────

export const mention = pgTable(
  "mention",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyNoteId: uuid("company_note_id")
      .notNull()
      .references(() => companyNote.id, { onDelete: "cascade" }),
    mentionedUserId: text("mentioned_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("mention_note_idx").on(table.companyNoteId),
    index("mention_user_idx").on(table.mentionedUserId),
  ]
);

// ─── PIPELINE STAGE (custom org pipeline) ───────────────────────────────────

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color"),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("pipeline_stage_org_idx").on(table.organizationId),
    uniqueIndex("pipeline_stage_org_slug_idx").on(table.organizationId, table.slug),
    index("pipeline_stage_position_idx").on(table.organizationId, table.position),
  ]
);

// ─── API KEY (org-level external API access) ────────────────────────────────

export const apiKey = pgTable(
  "api_key",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(), // SHA-256 hash; never store plaintext
    keyPrefix: text("key_prefix").notNull(), // first 8 chars for identification (e.g. "cvrm_abc1")
    scopes: jsonb("scopes").default(["read"]).notNull(), // ['read', 'write', 'admin']
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    rateLimit: integer("rate_limit").default(1000).notNull(), // requests per hour
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("api_key_org_idx").on(table.organizationId),
    uniqueIndex("api_key_hash_idx").on(table.keyHash),
    index("api_key_prefix_idx").on(table.keyPrefix),
  ]
);

// ─── WEBHOOK ────────────────────────────────────────────────────────────────

export const webhook = pgTable(
  "webhook",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // HMAC signing secret
    events: jsonb("events").default([]).notNull(), // ['company.saved', 'trigger.matched', 'crm.synced']
    isActive: boolean("is_active").default(true).notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("webhook_org_idx").on(table.organizationId),
    index("webhook_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ─── WEBHOOK DELIVERY (delivery log for debugging) ──────────────────────────

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhook.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload"),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    duration: integer("duration"), // ms
    status: text("status").default("pending").notNull(), // 'success' | 'failed' | 'pending'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("webhook_delivery_webhook_idx").on(table.webhookId),
    index("webhook_delivery_created_idx").on(table.createdAt),
    index("webhook_delivery_status_idx").on(table.webhookId, table.status),
  ]
);

// ─── SSO CONFIG ─────────────────────────────────────────────────────────────

export const ssoConfig = pgTable(
  "sso_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'okta' | 'azure_ad' | 'google_workspace' | 'custom_saml'
    entityId: text("entity_id"),
    ssoUrl: text("sso_url"),
    certificate: text("certificate"), // X.509 cert
    metadataUrl: text("metadata_url"),
    enforced: boolean("enforced").default(false).notNull(), // require SSO for all members
    allowedDomains: jsonb("allowed_domains").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("sso_config_org_idx").on(table.organizationId),
  ]
);

// ─── DATA RETENTION POLICY ──────────────────────────────────────────────────

export const dataRetentionPolicy = pgTable(
  "data_retention_policy",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    activityRetentionDays: integer("activity_retention_days").default(365).notNull(),
    auditLogRetentionDays: integer("audit_log_retention_days").default(730).notNull(),
    deletedDataRetentionDays: integer("deleted_data_retention_days").default(30).notNull(),
    exportRetentionDays: integer("export_retention_days").default(90).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("data_retention_policy_org_idx").on(table.organizationId),
  ]
);

// ─── DATA EXPORT REQUEST (GDPR) ────────────────────────────────────────────

export const dataExportRequest = pgTable(
  "data_export_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'gdpr_export' | 'bulk_export' | 'account_deletion'
    status: text("status").default("pending").notNull(), // 'pending' | 'processing' | 'ready' | 'expired'
    downloadUrl: text("download_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("data_export_request_org_idx").on(table.organizationId),
    index("data_export_request_status_idx").on(table.status),
  ]
);

// ─── IP ALLOWLIST ───────────────────────────────────────────────────────────

export const ipAllowlist = pgTable(
  "ip_allowlist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cidr: text("cidr").notNull(), // e.g. '192.168.1.0/24'
    description: text("description"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ip_allowlist_org_idx").on(table.organizationId),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const companyRelations = relations(company, ({ many }) => ({
  savedBy: many(savedCompany),
  notes: many(companyNote),
  todos: many(todo),
  metrics: many(companyMetrics),
  workspaces: many(companyWorkspace),
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
  assignedTo: one(user, { fields: [todo.assignedToUserId], references: [user.id], relationName: "assignedTodos" }),
  company: one(company, { fields: [todo.companyId], references: [company.id] }),
}));

export const companyNoteRelations = relations(companyNote, ({ one, many }) => ({
  company: one(company, {
    fields: [companyNote.companyId],
    references: [company.id],
  }),
  user: one(user, { fields: [companyNote.userId], references: [user.id] }),
  mentions: many(mention),
}));

export const userBrandRelations = relations(userBrand, ({ one }) => ({
  user: one(user, { fields: [userBrand.userId], references: [user.id] }),
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
  organization: one(organization, { fields: [subscription.organizationId], references: [organization.id] }),
}));

export const usageRecordRelations = relations(usageRecord, ({ one }) => ({
  user: one(user, { fields: [usageRecord.userId], references: [user.id] }),
  organization: one(organization, { fields: [usageRecord.organizationId], references: [organization.id] }),
}));

// ─── Enterprise table relations ─────────────────────────────────────────────

export const orgPermissionRelations = relations(orgPermission, ({ one }) => ({
  organization: one(organization, { fields: [orgPermission.organizationId], references: [organization.id] }),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  organization: one(organization, { fields: [team.organizationId], references: [organization.id] }),
  lead: one(user, { fields: [team.leadUserId], references: [user.id] }),
  members: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, { fields: [teamMember.teamId], references: [team.id] }),
  user: one(user, { fields: [teamMember.userId], references: [user.id] }),
}));

export const companyAssignmentRelations = relations(companyAssignment, ({ one }) => ({
  workspace: one(companyWorkspace, { fields: [companyAssignment.companyWorkspaceId], references: [companyWorkspace.id] }),
  assignedTo: one(user, { fields: [companyAssignment.assignedToUserId], references: [user.id], relationName: "assignedCompanies" }),
  assignedBy: one(user, { fields: [companyAssignment.assignedByUserId], references: [user.id], relationName: "companyAssignments" }),
}));

export const mentionRelations = relations(mention, ({ one }) => ({
  note: one(companyNote, { fields: [mention.companyNoteId], references: [companyNote.id] }),
  user: one(user, { fields: [mention.mentionedUserId], references: [user.id] }),
}));

export const pipelineStageRelations = relations(pipelineStage, ({ one }) => ({
  organization: one(organization, { fields: [pipelineStage.organizationId], references: [organization.id] }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  organization: one(organization, { fields: [apiKey.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [apiKey.createdByUserId], references: [user.id] }),
}));

export const webhookRelations = relations(webhook, ({ one, many }) => ({
  organization: one(organization, { fields: [webhook.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [webhook.createdByUserId], references: [user.id] }),
  deliveries: many(webhookDelivery),
}));

export const webhookDeliveryRelations = relations(webhookDelivery, ({ one }) => ({
  webhook: one(webhook, { fields: [webhookDelivery.webhookId], references: [webhook.id] }),
}));

export const ssoConfigRelations = relations(ssoConfig, ({ one }) => ({
  organization: one(organization, { fields: [ssoConfig.organizationId], references: [organization.id] }),
}));

export const dataRetentionPolicyRelations = relations(dataRetentionPolicy, ({ one }) => ({
  organization: one(organization, { fields: [dataRetentionPolicy.organizationId], references: [organization.id] }),
}));

export const dataExportRequestRelations = relations(dataExportRequest, ({ one }) => ({
  organization: one(organization, { fields: [dataExportRequest.organizationId], references: [organization.id] }),
  requestedBy: one(user, { fields: [dataExportRequest.requestedByUserId], references: [user.id] }),
}));

export const ipAllowlistRelations = relations(ipAllowlist, ({ one }) => ({
  organization: one(organization, { fields: [ipAllowlist.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [ipAllowlist.createdByUserId], references: [user.id] }),
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
  teamMemberships: many(teamMember),
  mentions: many(mention),
}));

export const organizationRelations = relations(organization, ({ one, many }) => ({
  owner: one(user, { fields: [organization.ownerId], references: [user.id] }),
  members: many(member),
  teams: many(team),
  permissions: many(orgPermission),
  pipelineStages: many(pipelineStage),
  apiKeys: many(apiKey),
  webhooks: many(webhook),
  ssoConfig: one(ssoConfig),
  dataRetentionPolicy: one(dataRetentionPolicy),
  subscriptions: many(subscription),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

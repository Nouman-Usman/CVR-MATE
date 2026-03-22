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
import { user } from "./auth-schema";

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
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    cvr: text("cvr").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("saved_company_user_cvr_idx").on(table.userId, table.cvr),
    index("saved_company_user_idx").on(table.userId),
    index("saved_company_cvr_idx").on(table.cvr),
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
    name: text("name").notNull(),
    filters: jsonb("filters").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("saved_search_user_idx").on(table.userId)]
);

// ─── LEAD TRIGGER ───────────────────────────────────────────────────────────

export const leadTrigger = pgTable(
  "lead_trigger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").default({}).notNull(),
    frequency: text("frequency").default("daily").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notificationChannels: jsonb("notification_channels")
      .default(["in_app"])
      .notNull(),
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
    type: text("type").default("system").notNull(), // 'trigger' | 'system' | 'export'
    title: text("title").notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false).notNull(),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId),
    index("notification_user_unread_idx").on(table.userId, table.isRead),
    index("notification_created_idx").on(table.createdAt),
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
    title: text("title").notNull(),
    description: text("description"),
    isCompleted: boolean("is_completed").default(false).notNull(),
    priority: text("priority").default("medium").notNull(), // 'low' | 'medium' | 'high'
    companyId: uuid("company_id").references(() => company.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
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
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("company_note_company_idx").on(table.companyId),
    index("company_note_user_idx").on(table.userId),
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

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const companyRelations = relations(company, ({ many }) => ({
  savedBy: many(savedCompany),
  notes: many(companyNote),
  todos: many(todo),
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
  company: one(company, { fields: [todo.companyId], references: [company.id] }),
}));

export const companyNoteRelations = relations(companyNote, ({ one }) => ({
  company: one(company, {
    fields: [companyNote.companyId],
    references: [company.id],
  }),
  user: one(user, { fields: [companyNote.userId], references: [user.id] }),
}));

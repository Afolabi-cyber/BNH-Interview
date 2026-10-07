import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ROLES = ["portfolio_manager", "chief_of_staff"] as const;
export type Role = (typeof ROLES)[number];

export const RAG_STATUSES = ["green", "amber", "red"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  createdAt: timestamp("created_at"),
});

/** A portfolio is owned by exactly one Portfolio Manager. */
export const portfolios = sqliteTable(
  "portfolios",
  {
    id: id(),
    name: text("name").notNull().unique(),
    managerId: text("manager_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at"),
  },
  (t) => [index("portfolios_manager_idx").on(t.managerId)],
);

/**
 * One update per portfolio per reporting month. Resubmitting for the same
 * month amends the existing record rather than creating a duplicate.
 */
export const monthlyUpdates = sqliteTable(
  "monthly_updates",
  {
    id: id(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    /** First-class month, stored as ISO "YYYY-MM" so it sorts lexically. */
    reportingMonth: text("reporting_month").notNull(),
    /** NGN held in kobo (1 NGN = 100 kobo) to avoid floating-point drift. */
    cashPositionKobo: integer("cash_position_kobo").notNull(),
    ragStatus: text("rag_status", { enum: RAG_STATUSES }).notNull(),
    executionBlocker: text("execution_blocker").notNull(),
    submittedById: text("submitted_by_id")
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp("submitted_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    uniqueIndex("monthly_updates_portfolio_month_uq").on(t.portfolioId, t.reportingMonth),
    index("monthly_updates_month_idx").on(t.reportingMonth),
  ],
);

export type User = typeof users.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type MonthlyUpdate = typeof monthlyUpdates.$inferSelect;

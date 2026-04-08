import {
  serial,
  pgTable,
  text,
  timestamp,
  varchar,
  numeric,
  json,
  integer,
} from "drizzle-orm/pg-core";

// 建立 enum 型別
const roleEnum = ["user", "admin"] as const;
const statusEnum = ["active", "inactive", "archived"] as const;
const actionTypeEnum = ["value_added", "non_value_added", "necessary_waste"] as const;

export const users = pgTable("pla_users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 生產線資料表
export const productionLines = pgTable("pla_production_lines", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetCycleTime: numeric("targetCycleTime", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ProductionLine = typeof productionLines.$inferSelect;
export type InsertProductionLine = typeof productionLines.$inferInsert;

// 工站資料表
export const workstations = pgTable("pla_workstations", {
  id: serial("id").primaryKey(),
  productionLineId: integer("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sequenceOrder: integer("sequenceOrder").notNull().default(0),
  cycleTime: numeric("cycleTime", { precision: 10, scale: 2 }).notNull(),
  manpower: integer("manpower").notNull().default(1),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Workstation = typeof workstations.$inferSelect;
export type InsertWorkstation = typeof workstations.$inferInsert;

// 動作步驟資料表
export const actionSteps = pgTable("pla_action_steps", {
  id: serial("id").primaryKey(),
  workstationId: integer("workstationId").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  stepOrder: integer("stepOrder").notNull().default(0),
  duration: numeric("duration", { precision: 10, scale: 2 }).notNull(),
  actionType: varchar("actionType", { length: 30 }).default("value_added").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ActionStep = typeof actionSteps.$inferSelect;
export type InsertActionStep = typeof actionSteps.$inferInsert;

// 分析快照資料表
export const analysisSnapshots = pgTable("pla_analysis_snapshots", {
  id: serial("id").primaryKey(),
  productionLineId: integer("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  note: text("note"),
  balanceRate: numeric("balanceRate", { precision: 6, scale: 2 }).notNull(),
  balanceLoss: numeric("balanceLoss", { precision: 6, scale: 2 }).notNull(),
  totalTime: numeric("totalTime", { precision: 10, scale: 2 }).notNull(),
  maxTime: numeric("maxTime", { precision: 10, scale: 2 }).notNull(),
  minTime: numeric("minTime", { precision: 10, scale: 2 }).notNull(),
  avgTime: numeric("avgTime", { precision: 10, scale: 2 }).notNull(),
  workstationCount: integer("workstationCount").notNull(),
  totalManpower: integer("totalManpower").notNull(),
  taktTime: numeric("taktTime", { precision: 10, scale: 2 }),
  taktPassRate: numeric("taktPassRate", { precision: 6, scale: 2 }),
  taktPassCount: integer("taktPassCount"),
  upph: numeric("upph", { precision: 10, scale: 4 }),
  workstationsData: json("workstationsData").notNull(),
  bottleneckName: varchar("bottleneckName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisSnapshot = typeof analysisSnapshots.$inferSelect;
export type InsertAnalysisSnapshot = typeof analysisSnapshots.$inferInsert;

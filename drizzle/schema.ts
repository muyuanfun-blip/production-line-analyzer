import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 生產線資料表
export const productionLines = mysqlTable("production_lines", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetCycleTime: decimal("targetCycleTime", { precision: 10, scale: 2 }), // 目標節拍時間（秒）
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionLine = typeof productionLines.$inferSelect;
export type InsertProductionLine = typeof productionLines.$inferInsert;

// 工站資料表
export const workstations = mysqlTable("workstations", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sequenceOrder: int("sequenceOrder").notNull().default(0), // 工站順序
  cycleTime: decimal("cycleTime", { precision: 10, scale: 2 }).notNull(), // 工序時間（秒）
  manpower: int("manpower").notNull().default(1), // 人員配置
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workstation = typeof workstations.$inferSelect;
export type InsertWorkstation = typeof workstations.$inferInsert;

// 動作步驟資料表
export const actionSteps = mysqlTable("action_steps", {
  id: int("id").autoincrement().primaryKey(),
  workstationId: int("workstationId").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  stepOrder: int("stepOrder").notNull().default(0),
  duration: decimal("duration", { precision: 10, scale: 2 }).notNull(), // 步驟時間（秒）
  actionType: mysqlEnum("actionType", [
    "value_added",    // 增值動作
    "non_value_added", // 非增值動作
    "necessary_waste", // 必要浪費
  ]).default("value_added").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActionStep = typeof actionSteps.$inferSelect;
export type InsertActionStep = typeof actionSteps.$inferInsert;

// 分析快照資料表
export const analysisSnapshots = mysqlTable("analysis_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),           // 快照名稱
  note: text("note"),                                          // 備註
  // 平衡指標
  balanceRate: decimal("balanceRate", { precision: 6, scale: 2 }).notNull(),
  balanceLoss: decimal("balanceLoss", { precision: 6, scale: 2 }).notNull(),
  totalTime: decimal("totalTime", { precision: 10, scale: 2 }).notNull(),
  maxTime: decimal("maxTime", { precision: 10, scale: 2 }).notNull(),
  minTime: decimal("minTime", { precision: 10, scale: 2 }).notNull(),
  avgTime: decimal("avgTime", { precision: 10, scale: 2 }).notNull(),
  workstationCount: int("workstationCount").notNull(),
  totalManpower: int("totalManpower").notNull(),
  // Takt Time 相關
  taktTime: decimal("taktTime", { precision: 10, scale: 2 }),
  taktPassRate: decimal("taktPassRate", { precision: 6, scale: 2 }),
  taktPassCount: int("taktPassCount"),
  // UPPH （Units Per Person Per Hour）
  upph: decimal("upph", { precision: 10, scale: 4 }),
  // 工站快照（JSON）
  workstationsData: json("workstationsData").notNull(),
  bottleneckName: varchar("bottleneckName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisSnapshot = typeof analysisSnapshots.$inferSelect;
export type InsertAnalysisSnapshot = typeof analysisSnapshots.$inferInsert;

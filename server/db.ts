import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users,
  productionLines, InsertProductionLine,
  workstations, InsertWorkstation,
  actionSteps, InsertActionStep,
  analysisSnapshots, InsertAnalysisSnapshot,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _sql = postgres(ENV.databaseUrl);
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    await db.insert(users).values(user).onConflictDoUpdate({
      target: users.openId,
      set: {
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
      }
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Production Lines ────────────────────────────────────────────────────────

export async function getAllProductionLines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productionLines).orderBy(desc(productionLines.createdAt));
}

export async function getProductionLineById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productionLines).where(eq(productionLines.id, id)).limit(1);
  return result[0];
}

export async function createProductionLine(data: InsertProductionLine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productionLines).values(data).returning();
  return result;
}

export async function updateProductionLine(id: number, data: Partial<InsertProductionLine>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(productionLines).set(data).where(eq(productionLines.id, id));
}

export async function deleteProductionLine(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related workstations and action steps first
  const ws = await db.select().from(workstations).where(eq(workstations.productionLineId, id));
  for (const w of ws) {
    await db.delete(actionSteps).where(eq(actionSteps.workstationId, w.id));
  }
  await db.delete(workstations).where(eq(workstations.productionLineId, id));
  return db.delete(productionLines).where(eq(productionLines.id, id));
}

// ─── Workstations ────────────────────────────────────────────────────────────

export async function getWorkstationsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workstations)
    .where(eq(workstations.productionLineId, productionLineId))
    .orderBy(asc(workstations.sequenceOrder));
}

export async function getWorkstationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workstations).where(eq(workstations.id, id)).limit(1);
  return result[0];
}

export async function createWorkstation(data: InsertWorkstation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(workstations).values(data).returning();
}

export async function updateWorkstation(id: number, data: Partial<InsertWorkstation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(workstations).set(data).where(eq(workstations.id, id));
}

export async function deleteWorkstation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(actionSteps).where(eq(actionSteps.workstationId, id));
  return db.delete(workstations).where(eq(workstations.id, id));
}

export async function bulkCreateWorkstations(data: InsertWorkstation[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(workstations).values(data);
}

// ─── Action Steps ────────────────────────────────────────────────────────────

export async function getActionStepsByWorkstation(workstationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionSteps)
    .where(eq(actionSteps.workstationId, workstationId))
    .orderBy(asc(actionSteps.stepOrder));
}

export async function createActionStep(data: InsertActionStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(actionSteps).values(data).returning();
}

export async function updateActionStep(id: number, data: Partial<InsertActionStep>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(actionSteps).set(data).where(eq(actionSteps.id, id));
}

export async function deleteActionStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(actionSteps).where(eq(actionSteps.id, id));
}

export async function bulkCreateActionSteps(data: InsertActionStep[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(actionSteps).values(data);
}

// ─── Analysis Snapshot Queries ──────────────────────────────────────────────────────
export async function getSnapshotsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(analysisSnapshots)
    .where(eq(analysisSnapshots.productionLineId, productionLineId))
    .orderBy(desc(analysisSnapshots.createdAt));
}

export async function getSnapshotById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSnapshot(data: InsertAnalysisSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(analysisSnapshots).values(data).returning();
}

export async function deleteSnapshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(analysisSnapshots).where(eq(analysisSnapshots.id, id));
}

/**
 * 取得所有產線的快照歷史（用於首頁歷史趨勢圖表）
 */
export async function getAllLinesSnapshotHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 取得所有產線
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];
  // 對每條產線取得所有快照（按時間排序）
  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id))
        .orderBy(asc(analysisSnapshots.createdAt));
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          name: s.name,
          balanceRate: Number(s.balanceRate),
          taktPassRate: s.taktPassRate ? Number(s.taktPassRate) : null,
          upph: s.upph ? Number(s.upph) : null,
          maxTime: Number(s.maxTime),
          avgTime: Number(s.avgTime),
          workstationCount: s.workstationCount,
          createdAt: s.createdAt,
        })),
      };
    })
  );
  // 只回傳有快照的產線
  return results.filter((r) => r.snapshots.length > 0);
}

/**
 * 取得所有產線的最新快照摘要（用於首頁並排比較圖表）
 */
export async function getAllLinesLatestSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 取得所有產線
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  // 對每條產線取得最新快照
  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id))
        .orderBy(desc(analysisSnapshots.createdAt))
        .limit(1);
      const latest = snapshots[0] ?? null;
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
        snapshot: latest ? {
          id: latest.id,
          name: latest.name,
          balanceRate: Number(latest.balanceRate),
          balanceLoss: Number(latest.balanceLoss),
          maxTime: Number(latest.maxTime),
          avgTime: Number(latest.avgTime),
          workstationCount: latest.workstationCount,
          totalManpower: latest.totalManpower,
          taktPassRate: latest.taktPassRate ? Number(latest.taktPassRate) : null,
          upph: latest.upph ? Number(latest.upph) : null,
          bottleneckName: latest.bottleneckName,
          createdAt: latest.createdAt,
        } : null,
      };
    })
  );
  return results;
}

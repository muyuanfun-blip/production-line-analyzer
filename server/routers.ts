import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllProductionLines, getProductionLineById, createProductionLine,
  updateProductionLine, deleteProductionLine,
  getWorkstationsByLine, getWorkstationById, createWorkstation,
  updateWorkstation, deleteWorkstation, bulkCreateWorkstations,
  getActionStepsByWorkstation, createActionStep, updateActionStep,
  deleteActionStep, bulkCreateActionSteps,
  getSnapshotsByLine, getSnapshotById, createSnapshot, deleteSnapshot,
  getAllLinesLatestSnapshot,
  getAllLinesSnapshotHistory,
} from "./db";
import { ENV } from "./_core/env";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const productionLineInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetCycleTime: z.number().positive().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

const workstationInput = z.object({
  productionLineId: z.number().int().positive(),
  name: z.string().min(1),
  sequenceOrder: z.number().int().min(0).optional(),
  cycleTime: z.number().positive(),
  manpower: z.number().int().positive().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const actionStepInput = z.object({
  workstationId: z.number().int().positive(),
  stepName: z.string().min(1),
  stepOrder: z.number().int().min(0).optional(),
  duration: z.number().positive(),
  actionType: z.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
  description: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Production Lines ───────────────────────────────────────────────────
  productionLine: router({
    list: publicProcedure.query(async () => {
      return getAllProductionLines();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getProductionLineById(input.id);
      }),

    create: publicProcedure
      .input(productionLineInput)
      .mutation(async ({ input }) => {
        const result = await createProductionLine({
          name: input.name,
          description: input.description ?? null,
          targetCycleTime: input.targetCycleTime?.toString() ?? null,
          status: input.status ?? "active",
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(productionLineInput.partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.targetCycleTime !== undefined) updateData.targetCycleTime = data.targetCycleTime.toString();
        if (data.status !== undefined) updateData.status = data.status;
        await updateProductionLine(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteProductionLine(input.id);
        return { success: true };
      }),
  }),

  // ─── Workstations ────────────────────────────────────────────────────────
  workstation: router({
    listByLine: publicProcedure
      .input(z.object({ productionLineId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getWorkstationsByLine(input.productionLineId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getWorkstationById(input.id);
      }),

    create: publicProcedure
      .input(workstationInput)
      .mutation(async ({ input }) => {
        const result = await createWorkstation({
          productionLineId: input.productionLineId,
          name: input.name,
          sequenceOrder: input.sequenceOrder ?? 0,
          cycleTime: input.cycleTime.toString(),
          manpower: input.manpower ?? 1,
          description: input.description ?? null,
          notes: input.notes ?? null,
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(workstationInput.omit({ productionLineId: true }).partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.sequenceOrder !== undefined) updateData.sequenceOrder = data.sequenceOrder;
        if (data.cycleTime !== undefined) updateData.cycleTime = data.cycleTime.toString();
        if (data.manpower !== undefined) updateData.manpower = data.manpower;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.notes !== undefined) updateData.notes = data.notes;
        await updateWorkstation(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteWorkstation(input.id);
        return { success: true };
      }),

    bulkImport: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        workstations: z.array(z.object({
          name: z.string().min(1),
          sequenceOrder: z.number().int().min(0),
          cycleTime: z.number().positive(),
          manpower: z.number().int().positive().optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const data = input.workstations.map(w => ({
          productionLineId: input.productionLineId,
          name: w.name,
          sequenceOrder: w.sequenceOrder,
          cycleTime: w.cycleTime.toString(),
          manpower: w.manpower ?? 1,
          description: w.description ?? null,
          notes: null,
        }));
        await bulkCreateWorkstations(data);
        return { success: true, count: data.length };
      }),
  }),

  // ─── Action Steps ────────────────────────────────────────────────────────
  actionStep: router({
    listByWorkstation: publicProcedure
      .input(z.object({ workstationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getActionStepsByWorkstation(input.workstationId);
      }),

    create: publicProcedure
      .input(actionStepInput)
      .mutation(async ({ input }) => {
        const result = await createActionStep({
          workstationId: input.workstationId,
          stepName: input.stepName,
          stepOrder: input.stepOrder ?? 0,
          duration: input.duration.toString(),
          actionType: input.actionType ?? "value_added",
          description: input.description ?? null,
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(actionStepInput.omit({ workstationId: true }).partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.stepName !== undefined) updateData.stepName = data.stepName;
        if (data.stepOrder !== undefined) updateData.stepOrder = data.stepOrder;
        if (data.duration !== undefined) updateData.duration = data.duration.toString();
        if (data.actionType !== undefined) updateData.actionType = data.actionType;
        if (data.description !== undefined) updateData.description = data.description;
        await updateActionStep(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteActionStep(input.id);
        return { success: true };
      }),

    bulkCreate: publicProcedure
      .input(z.object({
        workstationId: z.number().int().positive(),
        steps: z.array(z.object({
          stepName: z.string().min(1),
          stepOrder: z.number().int().min(0),
          duration: z.number().positive(),
          actionType: z.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const data = input.steps.map(s => ({
          workstationId: input.workstationId,
          stepName: s.stepName,
          stepOrder: s.stepOrder,
          duration: s.duration.toString(),
          actionType: s.actionType ?? ("value_added" as const),
          description: s.description ?? null,
        }));
        await bulkCreateActionSteps(data);
        return { success: true, count: data.length };
      }),
  }),

  // ─── AI Analysis ─────────────────────────────────────────────────────────
  analysis: router({
    aiSuggest: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        productionLineName: z.string(),
        targetCycleTime: z.number().optional(),
        workstations: z.array(z.object({
          name: z.string(),
          cycleTime: z.number(),
          manpower: z.number(),
          sequenceOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        const bottleneck = input.workstations.reduce((max, w) =>
          w.cycleTime > max.cycleTime ? w : max, input.workstations[0]);
        const totalTime = input.workstations.reduce((sum, w) => sum + w.cycleTime, 0);
        const avgTime = totalTime / input.workstations.length;
        const maxTime = Math.max(...input.workstations.map(w => w.cycleTime));
        const balanceRate = input.workstations.length > 0
          ? ((totalTime / (maxTime * input.workstations.length)) * 100).toFixed(1)
          : "0";

        const taktTimeInfo = input.targetCycleTime
          ? `\n**目標節拍時間（Takt Time）：** ${input.targetCycleTime}s（每小時目標產能：${Math.floor(3600 / input.targetCycleTime)} 件）`
          : "\n**目標節拍時間：** 未設定";

        const exceedStations = input.targetCycleTime
          ? input.workstations.filter(w => w.cycleTime > input.targetCycleTime!)
          : [];
        const passStations = input.targetCycleTime
          ? input.workstations.filter(w => w.cycleTime <= input.targetCycleTime!)
          : [];
        const taktPassRate = input.targetCycleTime && input.workstations.length > 0
          ? ((passStations.length / input.workstations.length) * 100).toFixed(1)
          : null;

        const workstationList = input.workstations
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map(w => {
            const taktStatus = input.targetCycleTime
              ? (w.cycleTime > input.targetCycleTime
                ? ` ⚠️ 超出 Takt Time +${(w.cycleTime - input.targetCycleTime).toFixed(1)}s`
                : ` ✓ 達標 (${((w.cycleTime / input.targetCycleTime) * 100).toFixed(0)}%)`)
              : "";
            return `  - ${w.name}：工序時間 ${w.cycleTime}s，人員 ${w.manpower} 人${taktStatus}`;
          })
          .join("\n");

        const taktSummary = input.targetCycleTime && taktPassRate
          ? `\n**Takt Time 達標率：** ${taktPassRate}% (${passStations.length}/${input.workstations.length} 工站達標)\n**超出 Takt Time 工站：** ${exceedStations.length > 0 ? exceedStations.map(w => `${w.name}(${w.cycleTime}s)`).join('、') : '無'}`
          : "";

        const prompt = `你是一位精通精實生產（Lean Manufacturing）和工業工程的專家顧問。請根據以下產線數據，提供專業的平衡優化建議：

**產線名稱：** ${input.productionLineName}${taktTimeInfo}
**工站數量：** ${input.workstations.length} 個
**瓶頸工站：** ${bottleneck?.name ?? "無"} (${bottleneck?.cycleTime ?? 0}s)
**平均工序時間：** ${avgTime.toFixed(1)}s
**產線平衡率：** ${balanceRate}%${taktSummary}

**各工站資料（含 Takt Time 達標狀態）：**
${workstationList}

請提供以下分析（使用繁體中文，格式清晰）：

## 1. 現況診斷
分析目前產線的主要問題和瓶頸，特別說明 Takt Time 達標情況（若有設定）。

## 2. Takt Time 達標改善方案
${input.targetCycleTime ? '針對超出 Takt Time 的工站，提出具體的工序壓縮或人員調配方案。' : '建議設定合理的 Takt Time，並說明如何依客戶需求計算。'}

## 3. 平衡優化建議
具體說明如何重新分配工序、調整人員配置以提升平衡率。

## 4. 瓶頸改善方案
針對瓶頸工站提出3-5個具體可行的改善措施。

## 5. 預期效益
估算優化後的平衡率提升、Takt Time 達標率改善和效率提升幅度。

## 6. 實施優先順序
按重要性排列改善項目的實施順序。`;

        // 呼叫 Ollama API（OpenAI 相容格式）
        const ollamaRes = await fetch(`${ENV.ollamaBaseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ENV.ollamaApiKey}`,
          },
          body: JSON.stringify({
            model: ENV.ollamaModel,
            messages: [
              { role: "system", content: "你是一位精通精實生產（Lean Manufacturing）和工業工程的專家顧問，擅長產線平衡分析和改善建議。請用繁體中文回答，格式清晰專業。" },
              { role: "user", content: prompt },
            ],
            stream: false,
          }),
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          throw new Error(`Ollama API 錯誤 (${ollamaRes.status}): ${errText}`);
        }

        const ollamaData = await ollamaRes.json() as {
          message?: { content?: string };
          error?: string;
        };

        const content = ollamaData.message?.content ?? "無法生成建議，請稍後再試。";
        return { suggestion: content };
      }),
  }),

  // ─── Snapshot Router ──────────────────────────────────────────────────────
  snapshot: router({
    listByLine: publicProcedure
      .input(z.object({ productionLineId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const rows = await getSnapshotsByLine(input.productionLineId);
        return rows.map(r => ({
          ...r,
          balanceRate: Number(r.balanceRate),
          balanceLoss: Number(r.balanceLoss),
          totalTime: Number(r.totalTime),
          maxTime: Number(r.maxTime),
          minTime: Number(r.minTime),
          avgTime: Number(r.avgTime),
          taktTime: r.taktTime ? Number(r.taktTime) : null,
          taktPassRate: r.taktPassRate ? Number(r.taktPassRate) : null,
          upph: r.upph ? Number(r.upph) : null,
        }));
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const row = await getSnapshotById(input.id);
        if (!row) throw new Error("Snapshot not found");
        return {
          ...row,
          balanceRate: Number(row.balanceRate),
          balanceLoss: Number(row.balanceLoss),
          totalTime: Number(row.totalTime),
          maxTime: Number(row.maxTime),
          minTime: Number(row.minTime),
          avgTime: Number(row.avgTime),
          taktTime: row.taktTime ? Number(row.taktTime) : null,
          taktPassRate: row.taktPassRate ? Number(row.taktPassRate) : null,
          upph: row.upph ? Number(row.upph) : null,
        };
      }),

    create: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        note: z.string().optional(),
        balanceRate: z.number(),
        balanceLoss: z.number(),
        totalTime: z.number(),
        maxTime: z.number(),
        minTime: z.number(),
        avgTime: z.number(),
        workstationCount: z.number().int(),
        totalManpower: z.number().int(),
        taktTime: z.number().optional(),
        taktPassRate: z.number().optional(),
        taktPassCount: z.number().int().optional(),
        workstationsData: z.array(z.object({
          id: z.number(),
          name: z.string(),
          cycleTime: z.number(),
          manpower: z.number(),
          sequenceOrder: z.number(),
          description: z.string().optional(),
        })),
        bottleneckName: z.string().optional(),
        upph: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // 自動查詢各工站的動作拆解資料並計算增値率
        const enrichedWorkstations = await Promise.all(
          input.workstationsData.map(async (ws) => {
            const steps = await getActionStepsByWorkstation(ws.id);
            const totalStepSec = steps.reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const valueAddedSec = steps
              .filter(s => s.actionType === 'value_added')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const nonValueAddedSec = steps
              .filter(s => s.actionType === 'non_value_added')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const necessaryWasteSec = steps
              .filter(s => s.actionType === 'necessary_waste')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const valueAddedRate = totalStepSec > 0
              ? parseFloat(((valueAddedSec / totalStepSec) * 100).toFixed(2))
              : null;
            return {
              ...ws,
              // 動作拆解摘要
              actionStepCount: steps.length,
              totalStepSec: parseFloat(totalStepSec.toFixed(2)),
              valueAddedSec: parseFloat(valueAddedSec.toFixed(2)),
              nonValueAddedSec: parseFloat(nonValueAddedSec.toFixed(2)),
              necessaryWasteSec: parseFloat(necessaryWasteSec.toFixed(2)),
              valueAddedRate,  // null 表示該工站無動作拆解資料
            };
          })
        );
        await createSnapshot({
          productionLineId: input.productionLineId,
          name: input.name,
          note: input.note ?? null,
          balanceRate: String(input.balanceRate),
          balanceLoss: String(input.balanceLoss),
          totalTime: String(input.totalTime),
          maxTime: String(input.maxTime),
          minTime: String(input.minTime),
          avgTime: String(input.avgTime),
          workstationCount: input.workstationCount,
          totalManpower: input.totalManpower,
          taktTime: input.taktTime != null ? String(input.taktTime) : null,
          taktPassRate: input.taktPassRate != null ? String(input.taktPassRate) : null,
          taktPassCount: input.taktPassCount ?? null,
          workstationsData: enrichedWorkstations,
          bottleneckName: input.bottleneckName ?? null,
          upph: input.upph != null ? String(input.upph) : null,
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteSnapshot(input.id);
        return { success: true };
      }),

    getAllLinesLatest: publicProcedure
      .query(async () => {
        const rows = await getAllLinesLatestSnapshot();
        return rows;
      }),
    getAllLinesHistory: publicProcedure
      .query(async () => {
        const rows = await getAllLinesSnapshotHistory();
        return rows;
      }),
  }),
});
export type AppRouter = typeof appRouter;

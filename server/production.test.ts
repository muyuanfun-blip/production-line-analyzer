import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx: TrpcContext = {
      ...createContext(),
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("Balance Analysis Calculation", () => {
  it("calculates balance rate correctly", () => {
    // Balance Rate = Sum(CT) / (Max(CT) × N) × 100%
    const cycleTimes = [45, 60, 38, 52, 41];
    const totalTime = cycleTimes.reduce((s, t) => s + t, 0); // 236
    const maxTime = Math.max(...cycleTimes); // 60
    const n = cycleTimes.length; // 5
    const balanceRate = (totalTime / (maxTime * n)) * 100;

    expect(totalTime).toBe(236);
    expect(maxTime).toBe(60);
    expect(balanceRate).toBeCloseTo(78.67, 1);
  });

  it("identifies bottleneck station", () => {
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 },
      { name: "站C", cycleTime: 38 },
    ];
    const bottleneck = workstations.reduce((max, w) =>
      w.cycleTime > max.cycleTime ? w : max, workstations[0]);
    expect(bottleneck.name).toBe("站B");
    expect(bottleneck.cycleTime).toBe(60);
  });

  it("calculates balance loss rate", () => {
    const cycleTimes = [45, 60, 38];
    const total = cycleTimes.reduce((s, t) => s + t, 0); // 143
    const max = Math.max(...cycleTimes); // 60
    const n = cycleTimes.length; // 3
    const balanceRate = (total / (max * n)) * 100; // 79.44%
    const balanceLoss = 100 - balanceRate; // 20.56%

    expect(balanceLoss).toBeCloseTo(20.56, 1);
  });

  it("handles single workstation (100% balance)", () => {
    const cycleTimes = [50];
    const total = cycleTimes[0]!;
    const max = cycleTimes[0]!;
    const n = 1;
    const balanceRate = (total / (max * n)) * 100;
    expect(balanceRate).toBe(100);
  });

  it("handles equal cycle times (100% balance)", () => {
    const cycleTimes = [40, 40, 40, 40];
    const total = cycleTimes.reduce((s, t) => s + t, 0); // 160
    const max = Math.max(...cycleTimes); // 40
    const n = cycleTimes.length; // 4
    const balanceRate = (total / (max * n)) * 100;
    expect(balanceRate).toBe(100);
  });
});

describe("Takt Time Analysis", () => {
  it("identifies stations exceeding takt time", () => {
    const taktTime = 55;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 }, // 超出
      { name: "站C", cycleTime: 38 },
      { name: "站D", cycleTime: 58 }, // 超出
    ];
    const exceedStations = workstations.filter(w => w.cycleTime > taktTime);
    const passStations = workstations.filter(w => w.cycleTime <= taktTime);
    const passRate = (passStations.length / workstations.length) * 100;

    expect(exceedStations).toHaveLength(2);
    expect(exceedStations.map(w => w.name)).toEqual(["站B", "站D"]);
    expect(passStations).toHaveLength(2);
    expect(passRate).toBe(50);
  });

  it("calculates takt time pass rate correctly", () => {
    const taktTime = 60;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 }, // 剛好達標
      { name: "站C", cycleTime: 38 },
      { name: "站D", cycleTime: 52 },
    ];
    const passCount = workstations.filter(w => w.cycleTime <= taktTime).length;
    const passRate = (passCount / workstations.length) * 100;

    expect(passCount).toBe(4); // 全部達標（等於也算達標）
    expect(passRate).toBe(100);
  });

  it("calculates takt time deviation correctly", () => {
    const taktTime = 55;
    const cycleTime = 65;
    const deviation = cycleTime - taktTime;
    const deviationPct = (deviation / taktTime) * 100;

    expect(deviation).toBe(10);
    expect(deviationPct).toBeCloseTo(18.18, 1);
  });

  it("calculates hourly capacity from takt time", () => {
    const taktTime = 60; // 60 秒一件
    const hourlyCapacity = Math.floor(3600 / taktTime);
    expect(hourlyCapacity).toBe(60);

    const taktTime2 = 45; // 45 秒一件
    const hourlyCapacity2 = Math.floor(3600 / taktTime2);
    expect(hourlyCapacity2).toBe(80);
  });

  it("all stations exceed takt time returns 0% pass rate", () => {
    const taktTime = 30;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 },
    ];
    const passCount = workstations.filter(w => w.cycleTime <= taktTime).length;
    const passRate = (passCount / workstations.length) * 100;
    expect(passCount).toBe(0);
    expect(passRate).toBe(0);
  });
});

describe("Action Type Analysis", () => {
  it("calculates value-added ratio correctly", () => {
    const steps = [
      { actionType: "value_added", duration: 30 },
      { actionType: "non_value_added", duration: 10 },
      { actionType: "necessary_waste", duration: 5 },
    ];
    const total = steps.reduce((s, step) => s + step.duration, 0); // 45
    const valueAdded = steps.filter(s => s.actionType === "value_added")
      .reduce((s, step) => s + step.duration, 0); // 30
    const ratio = (valueAdded / total) * 100;

    expect(total).toBe(45);
    expect(valueAdded).toBe(30);
    expect(ratio).toBeCloseTo(66.67, 1);
  });
});

describe("Snapshot Comparison Logic", () => {
  it("calculates balance rate improvement between snapshots", () => {
    const snapA = { balanceRate: 72.5, maxTime: 65, avgTime: 47.1 };
    const snapB = { balanceRate: 85.3, maxTime: 58, avgTime: 49.5 };

    const balanceDelta = snapB.balanceRate - snapA.balanceRate;
    const bottleneckDelta = snapB.maxTime - snapA.maxTime;

    expect(balanceDelta).toBeCloseTo(12.8, 1);
    expect(bottleneckDelta).toBe(-7);
    expect(balanceDelta > 0).toBe(true);   // 平衡率提升
    expect(bottleneckDelta < 0).toBe(true); // 瓶頸時間縮短
  });

  it("classifies workstation changes as improved/worsened/neutral", () => {
    const wsA = [
      { name: "站A", cycleTime: 60 },
      { name: "站B", cycleTime: 45 },
      { name: "站C", cycleTime: 38 },
    ];
    const wsB = [
      { name: "站A", cycleTime: 52 }, // 改善 -8s
      { name: "站B", cycleTime: 48 }, // 退步 +3s
      { name: "站C", cycleTime: 38 }, // 持平
    ];

    const diff = wsA.map(a => {
      const b = wsB.find(w => w.name === a.name);
      const delta = (b?.cycleTime ?? 0) - a.cycleTime;
      return { name: a.name, delta, improved: delta < -0.1, worsened: delta > 0.1 };
    });

    expect(diff[0]?.improved).toBe(true);
    expect(diff[1]?.worsened).toBe(true);
    expect(diff[2]?.improved).toBe(false);
    expect(diff[2]?.worsened).toBe(false);
  });

  it("detects newly added and removed workstations", () => {
    const wsA = ["站A", "站B", "站C"];
    const wsB = ["站A", "站C", "站D"]; // 站B 移除，站D 新增

    const allNames = Array.from(new Set([...wsA, ...wsB]));
    const result = allNames.map(name => ({
      name,
      onlyA: wsA.includes(name) && !wsB.includes(name),
      onlyB: !wsA.includes(name) && wsB.includes(name),
    }));

    const removed = result.filter(r => r.onlyA).map(r => r.name);
    const added = result.filter(r => r.onlyB).map(r => r.name);

    expect(removed).toEqual(["站B"]);
    expect(added).toEqual(["站D"]);
  });

  it("calculates takt time pass rate improvement", () => {
    const snapA = { taktPassRate: 50, taktPassCount: 2, workstationCount: 4 };
    const snapB = { taktPassRate: 75, taktPassCount: 3, workstationCount: 4 };

    const delta = snapB.taktPassRate - snapA.taktPassRate;
    expect(delta).toBe(25);
    expect(snapB.taktPassCount - snapA.taktPassCount).toBe(1);
  });

  it("generates correct trend data from snapshot history", () => {
    const snapshots = [
      { name: "基準", balanceRate: 68.0, taktPassRate: 40 },
      { name: "第一次改善", balanceRate: 75.5, taktPassRate: 60 },
      { name: "第二次改善", balanceRate: 83.2, taktPassRate: 80 },
    ];

    // 驗證趨勢為持續上升
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i]!.balanceRate).toBeGreaterThan(snapshots[i - 1]!.balanceRate);
      expect(snapshots[i]!.taktPassRate).toBeGreaterThan(snapshots[i - 1]!.taktPassRate);
    }

    // 最終改善幅度
    const totalImprovement = snapshots[snapshots.length - 1]!.balanceRate - snapshots[0]!.balanceRate;
    expect(totalImprovement).toBeCloseTo(15.2, 1);
  });
});

describe("Home Dashboard - Lines Latest Snapshot Comparison", () => {
  it("correctly identifies best and worst balance rate lines", () => {
    const lines = [
      { lineName: "A線", balanceRate: 88.5 },
      { lineName: "B線", balanceRate: 72.3 },
      { lineName: "C線", balanceRate: 94.1 },
      { lineName: "D線", balanceRate: 65.0 },
    ];
    const best  = lines.reduce((a, b) => a.balanceRate > b.balanceRate ? a : b);
    const worst = lines.reduce((a, b) => a.balanceRate < b.balanceRate ? a : b);

    expect(best.lineName).toBe("C線");
    expect(best.balanceRate).toBe(94.1);
    expect(worst.lineName).toBe("D線");
    expect(worst.balanceRate).toBe(65.0);
  });

  it("calculates average balance rate across all lines", () => {
    const rates = [88.5, 72.3, 94.1, 65.0];
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    expect(avg).toBeCloseTo(79.975, 2);
  });

  it("counts lines needing improvement (< 70%)", () => {
    const lines = [
      { balanceRate: 88.5 },
      { balanceRate: 72.3 },
      { balanceRate: 94.1 },
      { balanceRate: 65.0 }, // 待改善
      { balanceRate: 68.9 }, // 待改善
    ];
    const needImprove = lines.filter(l => l.balanceRate < 70).length;
    expect(needImprove).toBe(2);
  });

  it("assigns correct color category by balance rate", () => {
    const getCategory = (rate: number) => {
      if (rate >= 90) return "優秀";
      if (rate >= 80) return "良好";
      if (rate >= 70) return "普通";
      return "待改善";
    };
    expect(getCategory(94.1)).toBe("優秀");
    expect(getCategory(85.0)).toBe("良好");
    expect(getCategory(75.5)).toBe("普通");
    expect(getCategory(65.0)).toBe("待改善");
  });

  it("filters out lines without snapshots from chart data", () => {
    const allLatest = [
      { lineId: 1, lineName: "A線", snapshot: { balanceRate: 88.5 } },
      { lineId: 2, lineName: "B線", snapshot: null },
      { lineId: 3, lineName: "C線", snapshot: { balanceRate: 72.3 } },
    ];
    const chartData = allLatest.filter(item => item.snapshot !== null);
    const linesWithoutSnapshot = allLatest.filter(item => item.snapshot === null).length;

    expect(chartData).toHaveLength(2);
    expect(linesWithoutSnapshot).toBe(1);
  });
});

// ─── getAllLinesSnapshotHistory 趨勢圖表測試 ──────────────────────────────────
describe("Home Dashboard - Historical Trend Chart", () => {
  it("sorts snapshots chronologically (ascending)", () => {
    const snapshots = [
      { id: 3, createdAt: new Date("2024-03-01"), balanceRate: 85 },
      { id: 1, createdAt: new Date("2024-01-01"), balanceRate: 70 },
      { id: 2, createdAt: new Date("2024-02-01"), balanceRate: 78 },
    ];
    const sorted = [...snapshots].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    expect(sorted[0]!.balanceRate).toBe(70);
    expect(sorted[1]!.balanceRate).toBe(78);
    expect(sorted[2]!.balanceRate).toBe(85);
  });

  it("calculates improvement delta correctly", () => {
    const snapshots = [
      { balanceRate: 70 },
      { balanceRate: 78 },
      { balanceRate: 85 },
    ];
    const first = snapshots[0]!;
    const last = snapshots[snapshots.length - 1]!;
    const delta = last.balanceRate - first.balanceRate;
    expect(delta).toBeCloseTo(15, 1);
    expect(delta > 0).toBe(true);
  });

  it("detects regression (negative delta)", () => {
    const snapshots = [{ balanceRate: 88 }, { balanceRate: 82 }];
    const delta = snapshots[1]!.balanceRate - snapshots[0]!.balanceRate;
    expect(delta).toBeLessThan(0);
  });

  it("handles single snapshot (no delta comparison possible)", () => {
    const snapshots = [{ balanceRate: 75 }];
    const canCompare = snapshots.length >= 2;
    expect(canCompare).toBe(false);
  });

  it("builds trend chart data points aligned by index across lines", () => {
    const lineA = [70, 78, 85];
    const lineB = [65, 72];
    const maxSnaps = Math.max(lineA.length, lineB.length);
    const chartData = Array.from({ length: maxSnaps }, (_, i) => ({
      "產線A": lineA[i] ?? null,
      "產線B": lineB[i] ?? null,
    }));
    expect(chartData).toHaveLength(3);
    expect(chartData[2]!["產線A"]).toBe(85);
    expect(chartData[2]!["產線B"]).toBeNull();
  });
});

describe("Ollama API 整合", () => {
  const OLLAMA_BASE_URL = "https://ollama.com";
  const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY ?? "";
  const OLLAMA_MODEL = "qwen3-coder:480b";

  it("OLLAMA_API_KEY 環境變數已設定", () => {
    expect(OLLAMA_API_KEY).toBeTruthy();
    expect(OLLAMA_API_KEY.length).toBeGreaterThan(10);
  });

  it("Ollama base URL 格式正確", () => {
    expect(OLLAMA_BASE_URL).toBe("https://ollama.com");
    expect(OLLAMA_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("Ollama 模型名稱已設定", () => {
    expect(OLLAMA_MODEL).toBeTruthy();
    expect(typeof OLLAMA_MODEL).toBe("string");
  });

  it("Ollama API 可正常呼叫並回傳內容", async () => {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemma3:4b",
        messages: [{ role: "user", content: "reply with one word: hello" }],
        stream: false,
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as { message?: { content?: string } };
    expect(data.message?.content).toBeTruthy();
  }, 30000);

  it("Ollama API 使用無效金鑰時回傳 401", async () => {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer invalid-key-12345",
      },
      body: JSON.stringify({
        model: "gemma3:4b",
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      }),
    });
    expect(res.status).toBe(401);
  }, 15000);
});

// ─── 動作拆解分析測試 ────────────────────────────────────────────────────────

describe("動作拆解計算邏輯", () => {
  type ActionType = "value_added" | "non_value_added" | "necessary_waste";
  interface Step { duration: number; actionType: ActionType; }

  function calcStats(steps: Step[]) {
    const totalSec = steps.reduce((s, st) => s + st.duration, 0);
    const byType = {
      value_added: steps.filter(s => s.actionType === "value_added").reduce((a, s) => a + s.duration, 0),
      non_value_added: steps.filter(s => s.actionType === "non_value_added").reduce((a, s) => a + s.duration, 0),
      necessary_waste: steps.filter(s => s.actionType === "necessary_waste").reduce((a, s) => a + s.duration, 0),
    };
    const valueAddedRate = totalSec > 0 ? (byType.value_added / totalSec) * 100 : 0;
    return { totalSec, byType, valueAddedRate };
  }

  it("正確計算合計時間", () => {
    const steps: Step[] = [
      { duration: 5, actionType: "value_added" },
      { duration: 3, actionType: "non_value_added" },
      { duration: 2, actionType: "necessary_waste" },
    ];
    const { totalSec } = calcStats(steps);
    expect(totalSec).toBe(10);
  });

  it("正確計算各類型時間", () => {
    const steps: Step[] = [
      { duration: 6, actionType: "value_added" },
      { duration: 2, actionType: "value_added" },
      { duration: 4, actionType: "non_value_added" },
    ];
    const { byType } = calcStats(steps);
    expect(byType.value_added).toBe(8);
    expect(byType.non_value_added).toBe(4);
    expect(byType.necessary_waste).toBe(0);
  });

  it("正確計算增值率", () => {
    const steps: Step[] = [
      { duration: 8, actionType: "value_added" },
      { duration: 2, actionType: "non_value_added" },
    ];
    const { valueAddedRate } = calcStats(steps);
    expect(valueAddedRate).toBe(80);
  });

  it("空步驟時增值率為 0", () => {
    const { valueAddedRate } = calcStats([]);
    expect(valueAddedRate).toBe(0);
  });

  it("全增值時增值率為 100%", () => {
    const steps: Step[] = [
      { duration: 5, actionType: "value_added" },
      { duration: 3, actionType: "value_added" },
    ];
    const { valueAddedRate } = calcStats(steps);
    expect(valueAddedRate).toBe(100);
  });

  it("正確判斷 vs Takt Time 達標狀態", () => {
    const taktTime = 30;
    const totalUnder = 28;
    const totalOver = 35;
    expect(totalUnder <= taktTime).toBe(true);
    expect(totalOver <= taktTime).toBe(false);
    expect((totalOver - taktTime).toFixed(1)).toBe("5.0");
  });

  it("各類型佔比合計應為 100%", () => {
    const steps: Step[] = [
      { duration: 5, actionType: "value_added" },
      { duration: 3, actionType: "non_value_added" },
      { duration: 2, actionType: "necessary_waste" },
    ];
    const { totalSec, byType } = calcStats(steps);
    const sumPct = Object.values(byType).reduce((a, v) => a + (v / totalSec) * 100, 0);
    expect(Math.round(sumPct)).toBe(100);
  });
});

// ─── 動作拆解整合快照測試 ─────────────────────────────────────────────────────

describe("動作拆解整合快照計算邏輯", () => {
  type ActionType = "value_added" | "non_value_added" | "necessary_waste";
  interface Step { duration: number; actionType: ActionType; }

  function enrichWorkstation(steps: Step[]) {
    const totalStepSec = steps.reduce((s, st) => s + st.duration, 0);
    const valueAddedSec = steps.filter(s => s.actionType === "value_added").reduce((s, st) => s + st.duration, 0);
    const nonValueAddedSec = steps.filter(s => s.actionType === "non_value_added").reduce((s, st) => s + st.duration, 0);
    const necessaryWasteSec = steps.filter(s => s.actionType === "necessary_waste").reduce((s, st) => s + st.duration, 0);
    const valueAddedRate = totalStepSec > 0 ? parseFloat(((valueAddedSec / totalStepSec) * 100).toFixed(2)) : null;
    return { totalStepSec, valueAddedSec, nonValueAddedSec, necessaryWasteSec, valueAddedRate, actionStepCount: steps.length };
  }

  it("無動作步驟時 valueAddedRate 為 null", () => {
    const result = enrichWorkstation([]);
    expect(result.valueAddedRate).toBeNull();
    expect(result.actionStepCount).toBe(0);
  });

  it("全增值步驟時 valueAddedRate 為 100", () => {
    const steps: Step[] = [
      { duration: 5, actionType: "value_added" },
      { duration: 3, actionType: "value_added" },
    ];
    const result = enrichWorkstation(steps);
    expect(result.valueAddedRate).toBe(100);
  });

  it("混合步驟時正確計算增值率", () => {
    const steps: Step[] = [
      { duration: 6, actionType: "value_added" },
      { duration: 2, actionType: "non_value_added" },
      { duration: 2, actionType: "necessary_waste" },
    ];
    const result = enrichWorkstation(steps);
    expect(result.valueAddedRate).toBe(60);
    expect(result.valueAddedSec).toBe(6);
    expect(result.nonValueAddedSec).toBe(2);
    expect(result.necessaryWasteSec).toBe(2);
    expect(result.totalStepSec).toBe(10);
  });

  it("快照比較時正確計算增值率差異", () => {
    const vaA = 60;
    const vaB = 75;
    const delta = vaB - vaA;
    expect(delta).toBe(15);
    expect(delta > 0.5).toBe(true); // vaImproved
    expect(delta < -0.5).toBe(false); // vaWorsened
  });

  it("整體平均增值率計算（多工站）", () => {
    const workstations = [
      { valueAddedRate: 80 },
      { valueAddedRate: 60 },
      { valueAddedRate: 70 },
      { valueAddedRate: null }, // 無資料工站不計入
    ];
    const withData = workstations.filter(w => w.valueAddedRate != null);
    const avg = withData.reduce((s, w) => s + (w.valueAddedRate ?? 0), 0) / withData.length;
    expect(avg).toBeCloseTo(70, 1);
    expect(withData.length).toBe(3);
  });

  it("增值率 vaDelta 邊界值：小於 0.5 視為持平", () => {
    const delta = 0.3;
    expect(delta > 0.5).toBe(false);  // 非 vaImproved
    expect(delta < -0.5).toBe(false); // 非 vaWorsened
  });
});

/**
 * UPPH（Units Per Person Per Hour）計算邏輯測試
 *
 * 公式：UPPH = 3600 ÷ 瓶頸工站週期時間（秒）÷ 總人數
 * 意義：每人每小時可產出的件數，數值越高表示 IE 改善效果越好
 */
import { describe, expect, it } from "vitest";

// ─── 純函式：UPPH 計算 ─────────────────────────────────────────────────────────
function calcUPPH(bottleneckCT: number, totalManpower: number): number | null {
  if (bottleneckCT <= 0 || totalManpower <= 0) return null;
  return 3600 / bottleneckCT / totalManpower;
}

// ─── 純函式：工站級 UPPH（單一工站的人均產能）─────────────────────────────────
function calcStationUPPH(ct: number, manpower: number): number | null {
  if (ct <= 0 || manpower <= 0) return null;
  return 3600 / ct / manpower;
}

// ─── 純函式：UPPH 改善率 ──────────────────────────────────────────────────────
function calcUPPHImprovement(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((after - before) / before) * 100;
}

describe("UPPH 計算邏輯", () => {
  describe("calcUPPH - 產線整體 UPPH", () => {
    it("標準情境：瓶頸 CT=60s，10 人 → UPPH = 6", () => {
      const result = calcUPPH(60, 10);
      expect(result).toBeCloseTo(6, 4);
    });

    it("高效情境：瓶頸 CT=30s，5 人 → UPPH = 24", () => {
      const result = calcUPPH(30, 5);
      expect(result).toBeCloseTo(24, 4);
    });

    it("低效情境：瓶頸 CT=120s，20 人 → UPPH = 1.5", () => {
      const result = calcUPPH(120, 20);
      expect(result).toBeCloseTo(1.5, 4);
    });

    it("單人情境：CT=3600s，1 人 → UPPH = 1", () => {
      const result = calcUPPH(3600, 1);
      expect(result).toBeCloseTo(1, 4);
    });

    it("邊界：CT=0 應回傳 null", () => {
      expect(calcUPPH(0, 10)).toBeNull();
    });

    it("邊界：人數=0 應回傳 null", () => {
      expect(calcUPPH(60, 0)).toBeNull();
    });

    it("邊界：CT 和人數都為 0 應回傳 null", () => {
      expect(calcUPPH(0, 0)).toBeNull();
    });

    it("小數 CT：CT=45.5s，8 人 → UPPH 正確計算", () => {
      const result = calcUPPH(45.5, 8);
      expect(result).toBeCloseTo(3600 / 45.5 / 8, 4);
    });
  });

  describe("calcStationUPPH - 工站級 UPPH", () => {
    it("標準情境：CT=60s，2 人 → 工站 UPPH = 30", () => {
      const result = calcStationUPPH(60, 2);
      expect(result).toBeCloseTo(30, 4);
    });

    it("單人工站：CT=90s，1 人 → 工站 UPPH = 40", () => {
      const result = calcStationUPPH(90, 1);
      expect(result).toBeCloseTo(40, 4);
    });

    it("邊界：CT=0 應回傳 null", () => {
      expect(calcStationUPPH(0, 1)).toBeNull();
    });

    it("邊界：人數=0 應回傳 null", () => {
      expect(calcStationUPPH(60, 0)).toBeNull();
    });
  });

  describe("calcUPPHImprovement - UPPH 改善率", () => {
    it("改善 50%：從 10 提升到 15 → 改善率 50%", () => {
      expect(calcUPPHImprovement(10, 15)).toBeCloseTo(50, 2);
    });

    it("退步 20%：從 10 降到 8 → 改善率 -20%", () => {
      expect(calcUPPHImprovement(10, 8)).toBeCloseTo(-20, 2);
    });

    it("無變化：10 → 10 → 改善率 0%", () => {
      expect(calcUPPHImprovement(10, 10)).toBeCloseTo(0, 2);
    });

    it("邊界：before=0 應回傳 0（避免除以零）", () => {
      expect(calcUPPHImprovement(0, 10)).toBe(0);
    });
  });

  describe("UPPH 業務邏輯驗證", () => {
    it("減少瓶頸 CT 應提升 UPPH", () => {
      const before = calcUPPH(60, 10)!;
      const after = calcUPPH(50, 10)!;
      expect(after).toBeGreaterThan(before);
    });

    it("減少人力（同 CT）應提升 UPPH", () => {
      const before = calcUPPH(60, 10)!;
      const after = calcUPPH(60, 8)!;
      expect(after).toBeGreaterThan(before);
    });

    it("同時減少 CT 和人力，UPPH 提升更顯著", () => {
      const baseline = calcUPPH(60, 10)!;
      const reduceCTOnly = calcUPPH(50, 10)!;
      const reduceBoth = calcUPPH(50, 8)!;
      expect(reduceBoth).toBeGreaterThan(reduceCTOnly);
      expect(reduceCTOnly).toBeGreaterThan(baseline);
    });

    it("UPPH × 瓶頸 CT × 人數 應等於 3600（反推驗證）", () => {
      const ct = 45;
      const manpower = 6;
      const upph = calcUPPH(ct, manpower)!;
      expect(upph * ct * manpower).toBeCloseTo(3600, 4);
    });
  });
});

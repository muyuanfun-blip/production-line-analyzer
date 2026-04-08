/**
 * FormulaTooltip — 懸停顯示 KPI 計算公式說明
 * 讓新進工程師快速了解每個數字的計算方式與意義
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { ReactNode } from "react";

export type FormulaKey =
  | "balanceRate"
  | "balanceLoss"
  | "upph"
  | "taktPassRate"
  | "valueAddedRate"
  | "bottleneckTime"
  | "avgCycleTime"
  | "totalManpower"
  | "workstationCount"
  | "stationUpph";

interface FormulaInfo {
  name: string;
  formula: string;
  description: string;
  example: string;
  unit: string;
  tip?: string;
}

export const FORMULA_MAP: Record<FormulaKey, FormulaInfo> = {
  balanceRate: {
    name: "產線平衡率",
    formula: "Σ(各工站週期時間) ÷ (瓶頸時間 × 工站數) × 100%",
    description:
      "衡量各工站負荷分配的均勻程度。數值越高代表工站間等待浪費越少，產線越平衡。",
    example: "例：5 個工站總時間 250s，瓶頸 60s → 250 ÷ (60×5) × 100% = 83.3%",
    unit: "%",
    tip: "IE 目標：≥ 90% 為優秀，80–90% 良好，< 70% 需優化",
  },
  balanceLoss: {
    name: "平衡損失率",
    formula: "100% − 產線平衡率",
    description:
      "代表因工站負荷不均而損失的產能比例。數值越低越好，表示浪費越少。",
    example: "例：平衡率 83.3% → 平衡損失率 = 16.7%",
    unit: "%",
    tip: "平衡損失率即為可透過 IE 改善回收的潛在產能",
  },
  upph: {
    name: "UPPH（人均每小時產量）",
    formula: "3600 ÷ 瓶頸工站週期時間(s) ÷ 總人數",
    description:
      "Units Per Person Per Hour。衡量每位作業員每小時可產出的件數，是 IE 改善效果的核心績效指標。",
    example: "例：瓶頸 60s、總人數 10 人 → 3600 ÷ 60 ÷ 10 = 6 件/人/時",
    unit: "件/人/時",
    tip: "UPPH 越高代表人力效率越好；改善瓶頸或減少人數均可提升 UPPH",
  },
  taktPassRate: {
    name: "節拍達標率",
    formula: "週期時間 ≤ Takt Time 的工站數 ÷ 總工站數 × 100%",
    description:
      "衡量有多少工站的週期時間符合客戶需求節拍。達標率 100% 表示所有工站均可跟上客戶需求。",
    example: "例：8 個工站中 6 個 ≤ Takt Time → 6 ÷ 8 × 100% = 75%",
    unit: "%",
    tip: "Takt Time = 可用時間 ÷ 客戶需求數量，是產線設計的基準時間",
  },
  valueAddedRate: {
    name: "增值率",
    formula: "增值動作時間 ÷ 總動作時間 × 100%",
    description:
      "衡量作業員動作中真正為產品增加價值的比例。非增值動作（搬運、等待、尋找）是改善的主要目標。",
    example: "例：總動作 120s，增值動作 84s → 84 ÷ 120 × 100% = 70%",
    unit: "%",
    tip: "世界級製造目標：增值率 > 85%；< 50% 表示有大量改善空間",
  },
  bottleneckTime: {
    name: "瓶頸工站時間",
    formula: "max(各工站週期時間)",
    description:
      "產線中週期時間最長的工站，決定整條產線的最大產出速率。瓶頸工站是 IE 改善的首要目標。",
    example: "例：工站時間為 45s、60s、52s → 瓶頸 = 60s",
    unit: "秒",
    tip: "降低瓶頸時間是提升 UPPH 與平衡率最直接的方法",
  },
  avgCycleTime: {
    name: "平均週期時間",
    formula: "Σ(各工站週期時間) ÷ 工站數",
    description:
      "所有工站週期時間的算術平均值，反映整體工作量分配的基準水準。",
    example: "例：5 個工站總時間 250s → 平均 = 250 ÷ 5 = 50s",
    unit: "秒",
    tip: "平均時間與瓶頸時間的差距越小，代表平衡率越高",
  },
  totalManpower: {
    name: "總人數",
    formula: "Σ(各工站人員配置數)",
    description:
      "產線上所有工站的作業員人數總和，是計算 UPPH 的分母，也是人力成本的基礎。",
    example: "例：5 個工站各配 2 人 → 總人數 = 10 人",
    unit: "人",
    tip: "在維持產量不變的前提下，降低總人數可直接提升 UPPH",
  },
  workstationCount: {
    name: "工站數量",
    formula: "產線中的工站（工序）總數",
    description:
      "產線上的工站總數，影響平衡率計算的分母。工站數越多，平衡難度通常越高。",
    example: "例：A線有 8 個工站 → 工站數 = 8",
    unit: "站",
    tip: "合併相鄰輕負荷工站可減少工站數，有助於提升平衡率",
  },
  stationUpph: {
    name: "工站人均產能",
    formula: "3600 ÷ 工站週期時間(s) ÷ 工站人數",
    description:
      "單一工站在其週期時間下，每位作業員每小時可完成的件數。反映該工站的人力運用效率。",
    example: "例：工站時間 45s、2 人 → 3600 ÷ 45 ÷ 2 = 40 件/人/時",
    unit: "件/人/時",
    tip: "工站 UPPH 遠高於產線 UPPH 時，表示該工站人力有餘裕可調配",
  },
};

interface FormulaTooltipProps {
  formulaKey: FormulaKey;
  children: ReactNode;
  /** 是否顯示右上角的 ⓘ 圖示（預設 true） */
  showIcon?: boolean;
  /** 實際計算數值，可帶入公式範例中 */
  liveValues?: Record<string, string | number>;
}

/**
 * 包裝任意子元素，懸停時顯示公式說明卡片
 *
 * @example
 * <FormulaTooltip formulaKey="balanceRate">
 *   <span className="text-2xl font-bold">83.3%</span>
 * </FormulaTooltip>
 */
export function FormulaTooltip({
  formulaKey,
  children,
  showIcon = true,
  liveValues,
}: FormulaTooltipProps) {
  const info = FORMULA_MAP[formulaKey];
  if (!info) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-flex items-center gap-1 cursor-help group">
            {children}
            {showIcon && (
              <Info className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="max-w-xs p-0 bg-popover border border-border shadow-xl"
          sideOffset={8}
        >
          <div className="p-3 space-y-2">
            {/* 標題列 */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                {info.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {info.unit}
              </span>
            </div>

            {/* 公式 */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                計算公式
              </p>
              <p className="text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/30 rounded px-2 py-1 leading-relaxed">
                {info.formula}
              </p>
            </div>

            {/* 說明 */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {info.description}
            </p>

            {/* 範例 */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                計算範例
              </p>
              <p className="text-xs text-foreground/80 bg-muted/30 rounded px-2 py-1 leading-relaxed">
                {info.example}
              </p>
            </div>

            {/* IE 提示 */}
            {info.tip && (
              <div className="flex gap-1.5 pt-1 border-t border-border">
                <span className="text-[10px] text-amber-400 shrink-0 mt-0.5">
                  💡
                </span>
                <p className="text-[10px] text-amber-300/80 leading-relaxed">
                  {info.tip}
                </p>
              </div>
            )}

            {/* 即時數值（選填） */}
            {liveValues && Object.keys(liveValues).length > 0 && (
              <div className="pt-1 border-t border-border space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  本次數值
                </p>
                {Object.entries(liveValues).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

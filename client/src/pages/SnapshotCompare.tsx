import { useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  BarChart3, Camera, AlertTriangle, CheckCircle2, Zap
} from "lucide-react";

type WorkstationData = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
  // 動作拆解摘要（新快照才有）
  actionStepCount?: number;
  totalStepSec?: number;
  valueAddedSec?: number;
  nonValueAddedSec?: number;
  necessaryWasteSec?: number;
  valueAddedRate?: number | null;
};

type Snapshot = {
  id: number;
  name: string;
  note: string | null;
  balanceRate: number;
  balanceLoss: number;
  totalTime: number;
  maxTime: number;
  minTime: number;
  avgTime: number;
  workstationCount: number;
  totalManpower: number;
  taktTime: number | null;
  taktPassRate: number | null;
  taktPassCount: number | null;
  bottleneckName: string | null;
  upph: number | null;
  workstationsData: unknown;
  createdAt: Date;
};

function DeltaBadge({ a, b, unit = "", higherIsBetter = true }: {
  a: number; b: number; unit?: string; higherIsBetter?: boolean;
}) {
  const delta = b - a;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.05;
  if (neutral) return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      <Minus className="w-3 h-3" />無變化
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${improved ? "text-emerald-400" : "text-red-400"}`}>
      {improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}{unit}
    </span>
  );
}

const C = { a: "#22d3ee", b: "#a78bfa", va: "#34d399", nva: "#f87171", nw: "#fbbf24" };

export default function SnapshotCompare() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const search = useSearch();
  const sp = new URLSearchParams(search);
  const idA = parseInt(sp.get("a") ?? "0");
  const idB = parseInt(sp.get("b") ?? "0");

  const { data: snapA } = trpc.snapshot.getById.useQuery({ id: idA }, { enabled: idA > 0 });
  const { data: snapB } = trpc.snapshot.getById.useQuery({ id: idB }, { enabled: idB > 0 });
  const { data: allSnaps = [] } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: lineId }, { enabled: lineId > 0 }
  );

  const wsA = useMemo(() => {
    if (!snapA) return [] as WorkstationData[];
    return (snapA.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapA]);

  const wsB = useMemo(() => {
    if (!snapB) return [] as WorkstationData[];
    return (snapB.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapB]);

  // 工站差異比較資料（含增值率）
  const stationDiff = useMemo(() => {
    const allNames = Array.from(new Set([...wsA.map(w => w.name), ...wsB.map(w => w.name)]));
    return allNames.map(name => {
      const a = wsA.find(w => w.name === name);
      const b = wsB.find(w => w.name === name);
      const delta = (b?.cycleTime ?? 0) - (a?.cycleTime ?? 0);
      const vaA = a?.valueAddedRate ?? null;
      const vaB = b?.valueAddedRate ?? null;
      const vaDelta = vaA != null && vaB != null ? vaB - vaA : null;
      return {
        name,
        "A 週期時間": a?.cycleTime ?? null,
        "B 週期時間": b?.cycleTime ?? null,
        delta,
        improved: delta < -0.1,
        worsened: delta > 0.1,
        onlyA: !b,
        onlyB: !a,
        vaA,
        vaB,
        vaDelta,
        vaImproved: vaDelta != null ? vaDelta > 0.5 : null,
        vaWorsened: vaDelta != null ? vaDelta < -0.5 : null,
      };
    });
  }, [wsA, wsB]);

  // 增值率對比圖表資料（只取兩快照都有 valueAddedRate 的工站）
  const vaChartData = useMemo(() => {
    return stationDiff
      .filter(r => r.vaA != null || r.vaB != null)
      .map(r => ({
        name: r.name.length > 8 ? r.name.slice(0, 8) + "…" : r.name,
        "A 增值率": r.vaA,
        "B 增值率": r.vaB,
      }));
  }, [stationDiff]);

  // 整體增值率摘要（快照層級）
  const overallVA = useMemo(() => {
    const calcAvg = (ws: WorkstationData[]) => {
      const withData = ws.filter(w => w.valueAddedRate != null);
      if (withData.length === 0) return null;
      return withData.reduce((s, w) => s + (w.valueAddedRate ?? 0), 0) / withData.length;
    };
    return { a: calcAvg(wsA), b: calcAvg(wsB) };
  }, [wsA, wsB]);

  // 趨勢圖（所有快照按時間正序）
  const trendData = useMemo(() => {
    return [...(allSnaps as Snapshot[])].reverse().map(s => ({
      name: s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name,
      平衡率: s.balanceRate,
      達標率: s.taktPassRate ?? undefined,
      UPPH: s.upph != null ? parseFloat(Number(s.upph).toFixed(4)) : undefined,
    }));
  }, [allSnaps]);

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (!snapA || !snapB) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>載入快照資料中...</p>
        </div>
      </div>
    );
  }

  const A = snapA as Snapshot;
  const B = snapB as Snapshot;

  const kpis = [
    { label: "產線平衡率", a: A.balanceRate, b: B.balanceRate, unit: "%", higherIsBetter: true },
    { label: "瓶頸工站時間", a: A.maxTime, b: B.maxTime, unit: "s", higherIsBetter: false },
    { label: "平均工序時間", a: A.avgTime, b: B.avgTime, unit: "s", higherIsBetter: false },
    {
      label: "Takt Time 達標率",
      a: A.taktPassRate ?? 0, b: B.taktPassRate ?? 0,
      unit: "%", higherIsBetter: true,
      noData: !A.taktPassRate && !B.taktPassRate,
    },
  ];
  const hasUpphData = A.upph != null || B.upph != null;

  const improvedCount = stationDiff.filter(r => r.improved).length;
  const worsenedCount = stationDiff.filter(r => r.worsened).length;
  const neutralCount = stationDiff.filter(r => !r.improved && !r.worsened && !r.onlyA && !r.onlyB).length;
  const hasVAData = vaChartData.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={() => navigate(`/lines/${lineId}/snapshots`)}
          className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground mb-1">歷史快照 › 快照比較</div>
          <h1 className="text-2xl font-bold text-foreground">快照比較分析</h1>
          <p className="text-sm text-muted-foreground mt-1">對比兩個時間點的產線平衡狀態與增值率，追蹤改善成效</p>
        </div>
      </div>

      {/* 快照標籤 */}
      <div className="grid grid-cols-2 gap-4">
        {[{ snap: A, color: C.a, label: "快照 A（基準）" }, { snap: B, color: C.b, label: "快照 B（比較）" }].map(({ snap, color, label }) => (
          <Card key={snap.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className="font-semibold text-foreground">{snap.name}</div>
              {snap.note && <div className="text-xs text-muted-foreground mt-0.5">{snap.note}</div>}
              <div className="text-xs text-muted-foreground mt-1">{formatDate(snap.createdAt)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI 比較（含整體增值率）*/}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map(({ label, a, b, unit, higherIsBetter, noData }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-3">{label}</div>
              {noData ? (
                <div className="text-muted-foreground text-sm">未設定</div>
              ) : (
                <>
                  <div className="flex items-end gap-3 mb-2">
                    <div>
                      <FormulaTooltip formulaKey={label === "產線平衡率" ? "balanceRate" : label === "瓶頸工站時間" ? "bottleneckTime" : label.includes("Takt") ? "taktPassRate" : "avgCycleTime"} liveValues={{ "快照": "A" }}>
                        <div className="text-lg font-bold text-cyan-400">{a.toFixed(1)}{unit}</div>
                      </FormulaTooltip>
                      <div className="text-xs text-muted-foreground">快照 A</div>
                    </div>
                    <div className="text-muted-foreground mb-1 text-sm">→</div>
                    <div>
                      <FormulaTooltip formulaKey={label === "產線平衡率" ? "balanceRate" : label === "瓶頸工站時間" ? "bottleneckTime" : label.includes("Takt") ? "taktPassRate" : "avgCycleTime"} liveValues={{ "快照": "B" }}>
                        <div className="text-lg font-bold text-violet-400">{b.toFixed(1)}{unit}</div>
                      </FormulaTooltip>
                      <div className="text-xs text-muted-foreground">快照 B</div>
                    </div>
                  </div>
                  <DeltaBadge a={a} b={b} unit={unit} higherIsBetter={higherIsBetter} />
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {/* UPPH 對比 KPI */}
        <Card className="bg-card border-amber-500/25">
          <CardContent className="p-4">
            <div className="text-sm text-amber-400 mb-3 flex items-center gap-1 font-medium">
              ★ UPPH
            </div>
            {!hasUpphData ? (
              <div className="text-muted-foreground text-sm">快照尚無 UPPH</div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-2">
                  <div>
                    <FormulaTooltip formulaKey="upph" liveValues={{ "快照": "A" }}>
                      <div className="text-lg font-bold text-cyan-400">
                        {A.upph != null ? Number(A.upph).toFixed(2) : "—"}
                      </div>
                    </FormulaTooltip>
                    <div className="text-xs text-muted-foreground">快照 A</div>
                  </div>
                  <div className="text-muted-foreground mb-1 text-sm">→</div>
                  <div>
                    <FormulaTooltip formulaKey="upph" liveValues={{ "快照": "B" }}>
                      <div className="text-lg font-bold text-violet-400">
                        {B.upph != null ? Number(B.upph).toFixed(2) : "—"}
                      </div>
                    </FormulaTooltip>
                    <div className="text-xs text-muted-foreground">快照 B</div>
                  </div>
                </div>
                {A.upph != null && B.upph != null && (
                  <DeltaBadge a={Number(A.upph)} b={Number(B.upph)} unit=" 件/人/時" higherIsBetter={true} />
                )}
              </>
            )}
          </CardContent>
        </Card>
        {/* 整體平均增値率 KPI */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              平均增値率
            </div>
            {overallVA.a == null && overallVA.b == null ? (
              <div className="text-muted-foreground text-sm">無動作拆解資料</div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-2">
                  <div>
                    <div className="text-lg font-bold text-cyan-400">
                      {overallVA.a != null ? `${overallVA.a.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">快照 A</div>
                  </div>
                  <div className="text-muted-foreground mb-1 text-sm">→</div>
                  <div>
                    <div className="text-lg font-bold text-violet-400">
                      {overallVA.b != null ? `${overallVA.b.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">快照 B</div>
                  </div>
                </div>
                {overallVA.a != null && overallVA.b != null && (
                  <DeltaBadge a={overallVA.a} b={overallVA.b} unit="%" higherIsBetter={true} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 工站週期時間對比柱狀圖 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            工站週期時間對比
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stationDiff} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="s" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                labelStyle={{ color: "#f1f5f9" }}
                formatter={(v: number, name: string) => [v != null ? `${v.toFixed(1)}s` : "—", name]}
              />
              <Legend wrapperStyle={{ paddingTop: "16px" }} />
              {A.taktTime && (
                <ReferenceLine y={A.taktTime} stroke="#a78bfa" strokeDasharray="6 3"
                  label={{ value: `Takt ${A.taktTime}s`, fill: "#a78bfa", fontSize: 11 }} />
              )}
              <Bar dataKey="A 週期時間" fill={C.a} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="B 週期時間" fill={C.b} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 增值率對比柱狀圖（有資料才顯示） */}
      {hasVAData && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              各工站增值率對比
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs ml-1">動作拆解</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={vaChartData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number, name: string) => [v != null ? `${v.toFixed(1)}%` : "—", name]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <ReferenceLine y={80} stroke="#34d399" strokeDasharray="5 3"
                  label={{ value: "目標 80%", fill: "#34d399", fontSize: 10 }} />
                <Bar dataKey="A 增值率" fill={C.a} radius={[3, 3, 0, 0]} maxBarSize={40} />
                <Bar dataKey="B 增值率" fill={C.b} radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              增值率 = 增值動作秒數 ÷ 動作拆解合計秒數 × 100%。僅顯示有動作拆解資料的工站。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 平衡率趨勢折線圖 */}
      {trendData.length > 1 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              平衡率歷史趨勢
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number, name: string) => [`${v?.toFixed(1)}%`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Line type="monotone" dataKey="平衡率" stroke={C.a} strokeWidth={2}
                  dot={{ fill: C.a, r: 4 }} activeDot={{ r: 6 }} />
                {trendData.some(d => d.達標率 !== undefined) && (
                  <Line type="monotone" dataKey="達標率" stroke={C.b} strokeWidth={2}
                    strokeDasharray="5 3" dot={{ fill: C.b, r: 4 }} activeDot={{ r: 6 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* UPPH 趨勢折線圖 */}
      {trendData.length > 1 && trendData.some(d => d.UPPH !== undefined) && (
        <Card className="bg-card border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              UPPH 歷史趨勢（件/人/時）
              <span className="text-xs text-muted-foreground font-normal ml-2">IE 績效指標趨勢</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number) => [`${Number(v).toFixed(2)} 件/人/時`, "UPPH"]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Line
                  type="monotone" dataKey="UPPH" stroke="#f59e0b" strokeWidth={2.5}
                  dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">
              UPPH = 3600 ÷ 瓶頸工站時間 ÷ 總人數，數值越高表示 IE 改善效果越好
            </p>
          </CardContent>
        </Card>
      )}

      {/* 工站差異明細表（含增値率欄位） */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            工站差異明細
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">工站名稱</th>
                  <th className="text-right py-2 px-3 text-cyan-400 font-medium">A 週期</th>
                  <th className="text-right py-2 px-3 text-violet-400 font-medium">B 週期</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">週期變化</th>
                  <th className="text-right py-2 px-3 text-cyan-400/70 font-medium">A 增值率</th>
                  <th className="text-right py-2 px-3 text-violet-400/70 font-medium">B 增值率</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">增值率變化</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {stationDiff.map((row) => (
                  <tr key={row.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-foreground font-medium">{row.name}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">
                      {row["A 週期時間"] != null ? `${row["A 週期時間"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-violet-400">
                      {row["B 週期時間"] != null ? `${row["B 週期時間"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {!row.onlyA && !row.onlyB ? (
                        <span className={row.improved ? "text-emerald-400" : row.worsened ? "text-red-400" : "text-muted-foreground"}>
                          {row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}s
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* 增值率欄位 */}
                    <td className="py-2 px-3 text-right text-cyan-400/80">
                      {row.vaA != null ? `${row.vaA.toFixed(1)}%` : <span className="text-muted-foreground text-xs">無資料</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-violet-400/80">
                      {row.vaB != null ? `${row.vaB.toFixed(1)}%` : <span className="text-muted-foreground text-xs">無資料</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {row.vaDelta != null ? (
                        <span className={`inline-flex items-center justify-end gap-1 ${row.vaImproved ? "text-emerald-400" : row.vaWorsened ? "text-red-400" : "text-muted-foreground"}`}>
                          {row.vaImproved ? <TrendingUp className="w-3 h-3" /> : row.vaWorsened ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {row.vaDelta > 0 ? "+" : ""}{row.vaDelta.toFixed(1)}%
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.onlyB ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">新增</Badge>
                      ) : row.onlyA ? (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">移除</Badge>
                      ) : row.improved ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" />改善
                        </Badge>
                      ) : row.worsened ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1 inline" />退步
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">持平</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 改善摘要 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "改善工站", count: improvedCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "退步工站", count: worsenedCount, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "持平工站", count: neutralCount, color: "text-muted-foreground", bg: "bg-card border-border" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-lg border p-3 text-center ${bg}`}>
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* 增值率改善提示 */}
          {hasVAData && (() => {
            const vaImproved = stationDiff.filter(r => r.vaImproved).length;
            const vaWorsened = stationDiff.filter(r => r.vaWorsened).length;
            if (vaImproved === 0 && vaWorsened === 0) return null;
            return (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-medium">增值率變化摘要：</span>
                  <span className="text-muted-foreground">
                    {vaImproved > 0 && `${vaImproved} 個工站增值率提升`}
                    {vaImproved > 0 && vaWorsened > 0 && "，"}
                    {vaWorsened > 0 && `${vaWorsened} 個工站增值率下降`}
                  </span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

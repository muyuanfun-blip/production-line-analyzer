import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { useLocation } from "wouter";
import {
  Activity, BarChart3, Brain, Factory, TrendingUp, Zap, ArrowRight,
  Clock, Users, Target, Camera, AlertTriangle, CheckCircle2, Minus,
  ChevronRight, TrendingDown, LineChart as LineChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LabelList,
  LineChart, Line, Legend,
} from "recharts";
import { useMemo } from "react";

// ─── 平衡率色彩對照 ────────────────────────────────────────────────────────────
function getBalanceColor(rate: number) {
  if (rate >= 90) return { bar: "#34d399", text: "text-emerald-400", badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" };
  if (rate >= 80) return { bar: "#22d3ee", text: "text-cyan-400",    badge: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" };
  if (rate >= 70) return { bar: "#f59e0b", text: "text-amber-400",   badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
  return           { bar: "#f87171", text: "text-red-400",           badge: "bg-red-400/15 text-red-400 border-red-400/30" };
}

function getBalanceLabel(rate: number) {
  if (rate >= 90) return "優秀";
  if (rate >= 80) return "良好";
  if (rate >= 70) return "普通";
  return "待改善";
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-sm min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{d.lineName}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">平衡率</span>
          <span className={`font-bold ${getBalanceColor(d.balanceRate).text}`}>{d.balanceRate.toFixed(1)}%</span>
        </div>
        {d.taktPassRate != null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Takt 達標率</span>
            <span className="font-medium text-violet-400">{d.taktPassRate.toFixed(1)}%</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">瓶頸工站</span>
          <span className="font-medium text-foreground">{d.bottleneckName ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">快照名稱</span>
          <span className="font-medium text-foreground truncate max-w-[120px]">{d.snapshotName}</span>
        </div>
        {d.upph != null && (
          <div className="flex justify-between gap-4 border-t border-border/50 pt-1 mt-1">
            <span className="text-amber-400 font-medium">UPPH</span>
            <span className="font-bold text-amber-400">{Number(d.upph).toFixed(2)} 件/人/時</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();
  const { data: lines } = trpc.productionLine.list.useQuery();
  const { data: allLatest, isLoading: latestLoading } = trpc.snapshot.getAllLinesLatest.useQuery();
  const { data: allHistory, isLoading: historyLoading } = trpc.snapshot.getAllLinesHistory.useQuery();

  const totalLines = lines?.length ?? 0;
  const activeLines = lines?.filter(l => l.status === "active").length ?? 0;

  // 整理圖表資料
  const chartData = useMemo(() => {
    if (!allLatest) return [];
    return allLatest
      .filter(item => item.snapshot !== null)
      .map(item => ({
        lineName: item.lineName,
        lineId: item.lineId,
        balanceRate: item.snapshot!.balanceRate,
        taktPassRate: item.snapshot!.taktPassRate,
        bottleneckName: item.snapshot!.bottleneckName,
        snapshotName: item.snapshot!.name,
        maxTime: item.snapshot!.maxTime,
        avgTime: item.snapshot!.avgTime,
        workstationCount: item.snapshot!.workstationCount,
        totalManpower: item.snapshot!.totalManpower,
        upph: item.snapshot!.upph ?? null,
        snapshotId: item.snapshot!.id,
      }));
  }, [allLatest]);

  // 統計摘要
  const summaryStats = useMemo(() => {
    if (!chartData.length) return null;
    const rates = chartData.map(d => d.balanceRate);
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    const best = chartData.reduce((a, b) => a.balanceRate > b.balanceRate ? a : b);
    const worst = chartData.reduce((a, b) => a.balanceRate < b.balanceRate ? a : b);
    const needImprove = chartData.filter(d => d.balanceRate < 70).length;
    // UPPH 統計
    const upphData = chartData.filter(d => d.upph != null);
    const bestUpph = upphData.length > 0
      ? upphData.reduce((a, b) => (a.upph ?? 0) > (b.upph ?? 0) ? a : b)
      : null;
    const avgUpph = upphData.length > 0
      ? upphData.reduce((s, d) => s + (d.upph ?? 0), 0) / upphData.length
      : null;
    return { avg, best, worst, needImprove, total: chartData.length, bestUpph, avgUpph };
  }, [chartData]);

  // ─── 歷史趨勢圖表資料整理 ──────────────────────────────────────────────────
  // 將各產線快照整理為折線圖所需的時間序列格式
  // 每個資料點為一個時間點，包含各產線在該時間點的平衡率
  const { trendChartData, upphTrendData, lineColors, lineNames } = useMemo(() => {
    if (!allHistory || allHistory.length === 0) {
      return { trendChartData: [], upphTrendData: [], lineColors: {}, lineNames: [] };
    }
    // 為每條產線分配固定顏色
    const palette = [
      "#34d399", "#22d3ee", "#a78bfa", "#f59e0b",
      "#f87171", "#60a5fa", "#fb923c", "#e879f9",
    ];
    const lineColors: Record<string, string> = {};
    const lineNames: string[] = [];
    allHistory.forEach((line, idx) => {
      lineColors[line.lineName] = palette[idx % palette.length]!;
      lineNames.push(line.lineName);
    });

    // 收集所有時間點（以快照 ID 為序，格式化為日期標籤）
    const maxSnaps = Math.max(...allHistory.map(l => l.snapshots.length));
    const trendChartData: Record<string, string | number>[] = [];
    const upphTrendData: Record<string, string | number | null>[] = [];

    for (let i = 0; i < maxSnaps; i++) {
      const point: Record<string, string | number> = { index: i + 1 };
      const upphPoint: Record<string, string | number | null> = { index: i + 1 };
      let hasLabel = false;
      allHistory.forEach((line) => {
        const snap = line.snapshots[i];
        if (snap) {
          point[line.lineName] = parseFloat(snap.balanceRate.toFixed(1));
          // UPPH 趨勢資料
          upphPoint[line.lineName] = snap.upph != null ? parseFloat(Number(snap.upph).toFixed(4)) : null;
          if (!hasLabel) {
            const d = new Date(snap.createdAt);
            const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            point.label = label;
            upphPoint.label = label;
            hasLabel = true;
          }
          point[`${line.lineName}_snapName`] = snap.name;
          upphPoint[`${line.lineName}_snapName`] = snap.name;
        }
      });
      trendChartData.push(point);
      upphTrendData.push(upphPoint);
    }
    return { trendChartData, upphTrendData, lineColors, lineNames };
  }, [allHistory]);

  const hasTrendData = trendChartData.length > 0;

  // 有多少產線尚無快照
  const linesWithoutSnapshot = useMemo(() => {
    if (!allLatest) return 0;
    return allLatest.filter(item => item.snapshot === null).length;
  }, [allLatest]);

  const features = [
    { icon: Factory,  title: "工站資料管理",  description: "新增、編輯、刪除工站資料，支援批量匯入 Excel/CSV", color: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20" },
    { icon: BarChart3, title: "產線平衡分析", description: "計算平衡率、識別瓶頸工站，視覺化呈現時間分佈",    color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
    { icon: Activity, title: "動作分析記錄",  description: "詳細記錄每個工站的操作步驟與時間分配",           color: "text-violet-400",  bg: "bg-violet-400/10",  border: "border-violet-400/20" },
    { icon: Brain,    title: "AI 優化建議",   description: "智能分析產線數據，自動生成平衡優化與改善方案",   color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
  ];

  return (
    <div className="min-h-full p-6 space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/20 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              生產效率優化平台
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            <span className="gradient-text">產線平衡分析系統</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            整合工站時間統計、產線平衡分析、動作分析與 AI 優化建議，
            幫助您精確識別瓶頸、提升生產效率、實現精實生產目標。
          </p>
          <div className="flex items-center gap-4 mt-6">
            <Button size="lg" className="glow-primary" onClick={() => setLocation("/lines")}>
              開始分析
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeLines} 條產線運行中</span>
              </div>
              <div className="flex items-center gap-2">
                <Factory className="h-4 w-4" />
                <span>共 {totalLines} 條產線</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Factory,   label: "生產線總數", value: totalLines,  color: "text-cyan-400",    sub: "條產線" },
          { icon: TrendingUp, label: "運行中",    value: activeLines, color: "text-emerald-400", sub: "條產線" },
          { icon: Clock,     label: "分析功能",   value: 4,           color: "text-violet-400",  sub: "項核心功能" },
          { icon: Target,    label: "優化目標",   value: "AI",        color: "text-amber-400",   sub: "智能建議" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center`}
                  style={{ background: `color-mix(in oklch, currentColor 10%, transparent)` }}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── 產線平衡率並排比較圖表 ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">各產線平衡率比較</h2>
            <p className="text-sm text-muted-foreground mt-0.5">基於各產線最新快照數據</p>
          </div>
          {chartData.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/lines")}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              管理產線
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 無快照時的引導提示 */}
        {!latestLoading && chartData.length === 0 && (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-8 text-center">
              <Camera className="h-12 w-12 text-primary/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">尚無快照資料</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                前往各產線的「平衡分析」頁面，點擊「儲存快照」按鈕記錄當前分析結果，
                即可在此處看到各產線的平衡率比較圖。
              </p>
              <Button onClick={() => setLocation("/lines")}>
                前往產線管理
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 有快照時顯示圖表 */}
        {chartData.length > 0 && (
          <div className="space-y-4">
            {/* 摘要統計卡片 */}
            {summaryStats && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="border-border bg-card/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">平均平衡率</p>
                    <FormulaTooltip formulaKey="balanceRate" liveValues={{ "說明": "所有產線最新快照的平均平衡率" }}>
                      <p className={`text-2xl font-bold ${getBalanceColor(summaryStats.avg).text}`}>
                        {summaryStats.avg.toFixed(1)}%
                      </p>
                    </FormulaTooltip>
                    <p className="text-xs text-muted-foreground mt-1">共 {summaryStats.total} 條產線</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-400/20 bg-emerald-400/5">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" /> 最佳產線
                    </p>
                    <p className="text-lg font-bold text-emerald-400 truncate">{summaryStats.best.lineName}</p>
                    <p className="text-xs text-emerald-400/70 mt-1">{summaryStats.best.balanceRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-400/20 bg-amber-400/5">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-amber-400" /> 最低產線
                    </p>
                    <p className="text-lg font-bold text-amber-400 truncate">{summaryStats.worst.lineName}</p>
                    <p className="text-xs text-amber-400/70 mt-1">{summaryStats.worst.balanceRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card className={summaryStats.needImprove > 0 ? "border-red-400/20 bg-red-400/5" : "border-emerald-400/20 bg-emerald-400/5"}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle className={`h-3 w-3 ${summaryStats.needImprove > 0 ? "text-red-400" : "text-emerald-400"}`} />
                      待改善（&lt;70%）
                    </p>
                    <FormulaTooltip formulaKey="balanceRate" liveValues={{ "說明": "平衡率 < 70% 的產線數量" }}>
                      <p className={`text-2xl font-bold ${summaryStats.needImprove > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {summaryStats.needImprove}
                      </p>
                    </FormulaTooltip>
                    <p className="text-xs text-muted-foreground mt-1">條產線</p>
                  </CardContent>
                </Card>
                {/* UPPH 最高產線卡片 */}
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4">
                    <p className="text-xs text-amber-400 mb-1 flex items-center gap-1 font-medium">
                      <Users className="h-3 w-3" /> UPPH 最高
                    </p>
                    {summaryStats.bestUpph ? (
                      <>
                        <p className="text-lg font-bold text-amber-400 truncate">{summaryStats.bestUpph.lineName}</p>
                        <FormulaTooltip formulaKey="upph" liveValues={{ "說明": "UPPH 最高產線" }}>
                          <p className="text-xs text-amber-400/70 mt-1">{Number(summaryStats.bestUpph.upph ?? 0).toFixed(2)} 件/人/時</p>
                        </FormulaTooltip>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-muted-foreground">—</p>
                        <p className="text-xs text-muted-foreground mt-1">尚無 UPPH 資料</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 主圖表卡片 */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">平衡率橫向比較</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400/80" /> ≥90% 優秀
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-cyan-400/80" /> ≥80% 良好
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-400/80" /> ≥70% 普通
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-400/80" /> &lt;70% 待改善
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 56)}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "oklch(0.7 0 0)", fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="lineName"
                      width={100}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "oklch(0.75 0 0)", fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
                    {/* 80% 良好基準線 */}
                    <ReferenceLine x={80} stroke="oklch(0.7 0.15 200 / 0.5)" strokeDasharray="4 3" label={{ value: "80%", position: "top", fill: "oklch(0.7 0.15 200 / 0.7)", fontSize: 10 }} />
                    {/* 90% 優秀基準線 */}
                    <ReferenceLine x={90} stroke="oklch(0.75 0.18 155 / 0.5)" strokeDasharray="4 3" label={{ value: "90%", position: "top", fill: "oklch(0.75 0.18 155 / 0.7)", fontSize: 10 }} />
                    <Bar dataKey="balanceRate" radius={[0, 6, 6, 0]} maxBarSize={32}>
                      {chartData.map((entry) => (
                        <Cell key={entry.lineId} fill={getBalanceColor(entry.balanceRate).bar} fillOpacity={0.85} />
                      ))}
                      <LabelList
                        dataKey="balanceRate"
                        position="right"
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                        style={{ fill: "oklch(0.85 0 0)", fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 各產線快照明細卡片列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {chartData.map((item) => {
                const colors = getBalanceColor(item.balanceRate);
                return (
                  <Card
                    key={item.lineId}
                    className="border-border bg-card hover:bg-accent/20 transition-all cursor-pointer group"
                    onClick={() => setLocation(`/lines/${item.lineId}/balance`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{item.lineName}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.snapshotName}</p>
                        </div>
                        <Badge className={`ml-2 shrink-0 text-xs border ${colors.badge}`}>
                          {getBalanceLabel(item.balanceRate)}
                        </Badge>
                      </div>
                      {/* 平衡率進度條 */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">平衡率</span>
                          <FormulaTooltip formulaKey="balanceRate" liveValues={{ "平衡率": `${item.balanceRate.toFixed(1)}%` }}>
                            <span className={`font-bold ${colors.text}`}>{item.balanceRate.toFixed(1)}%</span>
                          </FormulaTooltip>
                        </div>
                        <div className="h-2 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${item.balanceRate}%`, background: colors.bar }}
                          />
                        </div>
                      </div>
                      {/* 輔助指標 */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-muted-foreground">工站數</p>
                          <p className="font-semibold text-foreground">{item.workstationCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">瓶頸時間</p>
                          <FormulaTooltip formulaKey="bottleneckTime" liveValues={{ "瓶頸時間": `${item.maxTime.toFixed(1)}s` }}>
                            <p className="font-semibold text-foreground">{item.maxTime.toFixed(1)}s</p>
                          </FormulaTooltip>
                        </div>
                        {item.taktPassRate != null ? (
                          <div className="text-center">
                            <p className="text-muted-foreground">Takt 達標</p>
                            <FormulaTooltip formulaKey="taktPassRate" liveValues={{ "Takt 達標率": `${item.taktPassRate!.toFixed(0)}%` }}>
                            <p className="font-semibold text-violet-400">{item.taktPassRate.toFixed(0)}%</p>
                          </FormulaTooltip>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-muted-foreground">人員</p>
                            <FormulaTooltip formulaKey="totalManpower" liveValues={{ "總人數": `${item.totalManpower} 人` }}>
                            <p className="font-semibold text-foreground">{item.totalManpower}</p>
                          </FormulaTooltip>
                          </div>
                        )}
                      </div>
                      {/* UPPH 指標列 */}
                      {item.upph != null && (
                        <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center justify-between">
                          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                            <Users className="h-3 w-3" /> UPPH
                          </span>
                          <FormulaTooltip formulaKey="upph" liveValues={{ "UPPH": `${Number(item.upph).toFixed(2)} 件/人/時` }}>
                            <span className="text-sm font-bold text-amber-400">
                              {Number(item.upph).toFixed(2)} 件/人/時
                            </span>
                          </FormulaTooltip>
                        </div>
                      )}
                      <div className="flex items-center justify-end mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        查看詳情
                        <ChevronRight className="h-3 w-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* 有產線但無快照的提示卡 */}
              {linesWithoutSnapshot > 0 && (
                <Card className="border-dashed border-border bg-card/40">
                  <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[160px] text-center">
                    <Camera className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      另有 <span className="text-foreground font-medium">{linesWithoutSnapshot}</span> 條產線尚未儲存快照
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setLocation("/lines")}
                    >
                      前往建立快照
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 歷史平衡率趨勢折線圖 ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-primary" />
              歷史平衡率趨勢
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">追蹤各產線長期改善軌跡</p>
          </div>
          {hasTrendData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/lines")}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              查看快照
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 無歷史資料時的引導提示 */}
        {!historyLoading && !hasTrendData && (
          <Card className="border-dashed border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <LineChartIcon className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">尚無歷史趨勢資料</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                每次在平衡分析頁面儲存快照後，此處將自動繪製各產線的平衡率改善趨勢折線圖，
                幫助您追蹤長期優化成效。
              </p>
              <Button onClick={() => setLocation("/lines")}>
                前往建立快照
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 有歷史資料時顯示折線圖 */}
        {hasTrendData && (
          <>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-5 px-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold">各產線平衡率歷史趨勢</CardTitle>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-8 h-0.5 bg-amber-400/70" style={{ borderTop: '2px dashed #f59e0b' }} />
                    80% 基準
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-8 h-0.5 bg-emerald-400/70" style={{ borderTop: '2px dashed #34d399' }} />
                    90% 優秀
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-5">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={trendChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.18 0.01 240)",
                      border: "1px solid oklch(0.3 0.01 240)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "oklch(0.85 0 0)", fontWeight: 600, marginBottom: 4 }}
                    formatter={(value: number, name: string, props: any) => {
                      const snapName = props.payload?.[`${name}_snapName`];
                      return [
                        <span style={{ color: lineColors[name] }}>
                          {value.toFixed(1)}%{snapName ? ` (${snapName})` : ""}
                        </span>,
                        name,
                      ];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(value) => (
                      <span style={{ color: lineColors[value] ?? "oklch(0.75 0 0)" }}>{value}</span>
                    )}
                  />
                  {/* 80% 基準線 */}
                  <ReferenceLine
                    y={80}
                    stroke="oklch(0.75 0.18 80 / 0.5)"
                    strokeDasharray="5 4"
                    label={{ value: "80%", position: "insideTopRight", fill: "oklch(0.75 0.18 80 / 0.7)", fontSize: 10 }}
                  />
                  {/* 90% 優秀基準線 */}
                  <ReferenceLine
                    y={90}
                    stroke="oklch(0.75 0.18 155 / 0.5)"
                    strokeDasharray="5 4"
                    label={{ value: "90%", position: "insideTopRight", fill: "oklch(0.75 0.18 155 / 0.7)", fontSize: 10 }}
                  />
                  {/* 每條產線一條折線 */}
                  {lineNames.map((name) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={lineColors[name]}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: lineColors[name], strokeWidth: 2, stroke: "oklch(0.15 0.01 240)" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* 各產線最新改善幅度摘要 */}
              {allHistory && allHistory.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 px-4">
                  {allHistory
                    .filter(line => line.snapshots.length >= 2)
                    .map(line => {
                      const first = line.snapshots[0]!;
                      const last = line.snapshots[line.snapshots.length - 1]!;
                      const delta = last.balanceRate - first.balanceRate;
                      const isImproved = delta > 0;
                      return (
                        <div
                          key={line.lineId}
                          className="rounded-xl border border-border bg-card/60 p-3 cursor-pointer hover:bg-accent/20 transition-colors"
                          onClick={() => setLocation(`/lines/${line.lineId}/balance`)}
                        >
                          <p className="text-xs text-muted-foreground truncate mb-1">{line.lineName}</p>
                          <div className="flex items-center gap-1.5">
                            {isImproved
                              ? <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                              : delta < 0
                                ? <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />
                                : <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
                            }
                            <span className={`text-sm font-bold ${
                              isImproved ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"
                            }`}>
                              {isImproved ? "+" : ""}{delta.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            共 {line.snapshots.length} 次快照
                          </p>
                        </div>
                      );
                    })}
                  {allHistory.filter(line => line.snapshots.length === 1).map(line => (
                    <div
                      key={line.lineId}
                      className="rounded-xl border border-dashed border-border bg-card/40 p-3 cursor-pointer hover:bg-accent/20 transition-colors"
                      onClick={() => setLocation(`/lines/${line.lineId}/balance`)}
                    >
                      <p className="text-xs text-muted-foreground truncate mb-1">{line.lineName}</p>
                      <div className="flex items-center gap-1.5">
                        <Camera className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-sm font-bold" style={{ color: lineColors[line.lineName] }}>
                          {line.snapshots[0]!.balanceRate.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">僅 1 次快照</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* UPPH 歷史趨勢折線圖 */}
          {upphTrendData.some(pt => lineNames.some(n => pt[n] != null)) && (
            <Card className="border-amber-500/20 bg-card">
              <CardHeader className="pb-2 pt-5 px-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-400" />
                    <span>UPPH 歷史趨勢（件/人/時）</span>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">IE 績效指標趨勢追蹤</span>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={upphTrendData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                      interval={0}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                      tickFormatter={(v) => v.toFixed(1)}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.18 0.01 240)",
                        border: "1px solid oklch(0.3 0.01 240)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "oklch(0.85 0 0)", fontWeight: 600, marginBottom: 4 }}
                      formatter={(value: number, name: string, props: any) => {
                        const snapName = props.payload?.[`${name}_snapName`];
                        return [
                          <span style={{ color: lineColors[name] }}>
                            {Number(value).toFixed(2)} 件/人/時{snapName ? ` (${snapName})` : ""}
                          </span>,
                          name,
                        ];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                      formatter={(value) => (
                        <span style={{ color: lineColors[value] ?? "oklch(0.75 0 0)" }}>{value}</span>
                      )}
                    />
                    {lineNames.map((name) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={lineColors[name]}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: lineColors[name], strokeWidth: 2, stroke: "oklch(0.15 0.01 240)" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  UPPH = 3600 ÷ 瓶頸工站時間 ÷ 總人數，數值越高表示 IE 改善效果越好
                </p>
              </CardContent>
            </Card>
          )}
          </>
        )}
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">核心功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className={`border bg-card hover:bg-accent/30 transition-all cursor-pointer group ${feature.border}`}
              onClick={() => setLocation("/lines")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl ${feature.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      {totalLines === 0 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <Factory className="h-12 w-12 text-primary/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">開始您的第一條產線分析</h3>
            <p className="text-muted-foreground mb-4 text-sm">建立生產線，新增工站資料，即可開始分析產線平衡與效率</p>
            <Button onClick={() => setLocation("/lines")}>
              建立生產線
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

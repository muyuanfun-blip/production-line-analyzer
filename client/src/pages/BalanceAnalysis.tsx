import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, ChevronRight, BarChart3, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Users, Target, Download, Activity,
  Info, Zap, Camera, History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LabelList
} from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";

// ─── Color Tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  exceed:     "#ef4444",  // 超出 Takt Time → 紅
  bottleneck: "#f97316",  // 瓶頸（最大值）→ 橘
  warning:    "#eab308",  // 接近 Takt Time (>80%) → 黃
  normal:     "#22d3ee",  // 正常 → 青
  efficient:  "#4ade80",  // 高效（≤70% Takt Time）→ 綠
  taktLine:   "#a78bfa",  // Takt Time 參考線 → 紫
  avgLine:    "#64748b",  // 平均線 → 灰
};

type BarStatus = "exceed" | "bottleneck" | "warning" | "normal" | "efficient";

function getBarStatus(ct: number, maxTime: number, taktTime?: number): BarStatus {
  if (taktTime && ct > taktTime) return "exceed";
  if (ct === maxTime) return "bottleneck";
  if (taktTime) {
    const ratio = ct / taktTime;
    if (ratio >= 0.8) return "warning";
    if (ratio <= 0.7) return "efficient";
  } else {
    if (ct / maxTime >= 0.95) return "bottleneck";
    if (ct / maxTime >= 0.8) return "warning";
  }
  return "normal";
}

const STATUS_META: Record<BarStatus, { label: string; color: string; icon: any }> = {
  exceed:     { label: "超出節拍", color: COLORS.exceed,     icon: XCircle },
  bottleneck: { label: "瓶頸工站", color: COLORS.bottleneck, icon: AlertTriangle },
  warning:    { label: "接近節拍", color: COLORS.warning,    icon: AlertTriangle },
  normal:     { label: "正常",     color: COLORS.normal,     icon: CheckCircle },
  efficient:  { label: "高效",     color: COLORS.efficient,  icon: Zap },
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, taktTime }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = STATUS_META[d.status as BarStatus];
  const taktDiff = taktTime ? (d.cycleTime - taktTime).toFixed(1) : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-2xl text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-3 border-b border-border pb-2">{d.fullName}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">工序時間</span>
          <span className="font-mono font-bold" style={{ color: meta.color }}>{d.cycleTime.toFixed(1)}s</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">人員配置</span>
          <span className="text-foreground">{d.manpower} 人</span>
        </div>
        {taktTime && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">vs Takt Time</span>
            <span className={`font-mono font-bold ${parseFloat(taktDiff!) > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {parseFloat(taktDiff!) > 0 ? "+" : ""}{taktDiff}s
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">狀態</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Bar Label ──────────────────────────────────────────────────────────
function StatusLabel(props: any) {
  const { x, y, width, value, status, taktTime } = props;
  if (!value) return null;
  const meta = STATUS_META[status as BarStatus];
  const Icon = meta.icon;
  return (
    <g>
      <foreignObject x={x + width / 2 - 8} y={y - 22} width={16} height={16}>
        <div style={{ color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            {status === "exceed" && <path d="M18 6L6 18M6 6l12 12" />}
            {status === "bottleneck" && <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
            {status === "warning" && <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
            {status === "normal" && <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />}
            {status === "efficient" && <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
          </svg>
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BalanceAnalysis() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [snapName, setSnapName] = useState("");
  const [snapNote, setSnapNote] = useState("");

  const utils = trpc.useUtils();
  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations, isLoading } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });

  const saveSnapshotMutation = trpc.snapshot.create.useMutation({
    onSuccess: () => {
      toast.success("快照已儲存！可在「歷史快照」頁面查看");
      setShowSaveDialog(false);
      setSnapName("");
      setSnapNote("");
      // 即時刷新快照相關快取，確保歷史頁面與首頁圖表即時同步
      utils.snapshot.listByLine.invalidate({ productionLineId: lineId });
      utils.snapshot.getAllLinesLatest.invalidate();
      utils.snapshot.getAllLinesHistory.invalidate();
    },
    onError: () => toast.error("快照儲存失敗，請稍後再試"),
  });

  const handleSaveSnapshot = () => {
    if (!analysis || !workstations || !snapName.trim()) {
      toast.error("請輸入快照名稱");
      return;
    }
    saveSnapshotMutation.mutate({
      productionLineId: lineId,
      name: snapName.trim(),
      note: snapNote.trim() || undefined,
      balanceRate: analysis.balanceRate,
      balanceLoss: analysis.balanceLoss,
      totalTime: analysis.totalTime,
      maxTime: analysis.maxTime,
      minTime: analysis.minTime,
      avgTime: analysis.avgTime,
      workstationCount: analysis.workstationCount,
      totalManpower: analysis.totalManpower,
      taktTime: taktTime,
      taktPassRate: analysis.taktStats?.passRate,
      taktPassCount: analysis.taktStats?.passCount,
      upph: analysis.upph,
      workstationsData: workstations.map(w => ({
        id: w.id,
        name: w.name,
        cycleTime: parseFloat(w.cycleTime.toString()),
        manpower: w.manpower,
        sequenceOrder: w.sequenceOrder,
        description: w.description ?? undefined,
      })),
      bottleneckName: analysis.bottleneck?.name,
    });
  };

  const taktTime = line?.targetCycleTime ? parseFloat(line.targetCycleTime.toString()) : undefined;

  const analysis = useMemo(() => {
    if (!workstations || workstations.length === 0) return null;
    const times = workstations.map(w => parseFloat(w.cycleTime.toString()));
    const totalTime = times.reduce((s, t) => s + t, 0);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const avgTime = totalTime / times.length;
    const bottleneck = workstations.find(w => parseFloat(w.cycleTime.toString()) === maxTime);
    const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
    const balanceLoss = 100 - balanceRate;

    // Takt Time 達標統計
    const taktStats = taktTime ? {
      exceedCount: workstations.filter(w => parseFloat(w.cycleTime.toString()) > taktTime).length,
      passCount: workstations.filter(w => parseFloat(w.cycleTime.toString()) <= taktTime).length,
      passRate: (workstations.filter(w => parseFloat(w.cycleTime.toString()) <= taktTime).length / workstations.length) * 100,
      bottleneckExceed: parseFloat(bottleneck?.cycleTime.toString() ?? "0") > taktTime,
      maxExceedAmount: Math.max(...workstations.map(w => parseFloat(w.cycleTime.toString()) - taktTime)),
    } : null;

    const chartData = workstations.map(w => {
      const ct = parseFloat(w.cycleTime.toString());
      const status = getBarStatus(ct, maxTime, taktTime);
      return {
        name: w.name.length > 8 ? w.name.substring(0, 8) + "…" : w.name,
        fullName: w.name,
        cycleTime: ct,
        manpower: w.manpower,
        status,
        color: COLORS[status],
      };
    });

    const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
    // UPPH = 3600 ÷ maxTime ÷ totalManpower
    // 意義：在瓶頸工站節拍下，每人每小時可產出的件數
    const upph = totalManpower > 0 && maxTime > 0
      ? 3600 / maxTime / totalManpower
      : 0;

    return {
      totalTime, maxTime, minTime, avgTime, balanceRate, balanceLoss,
      bottleneck, taktStats, chartData,
      workstationCount: workstations.length,
      totalManpower,
      upph,
    };
  }, [workstations, taktTime]);

  const handleExportReport = () => {
    if (!analysis || !workstations) { toast.error("沒有資料可導出"); return; }
    const taktInfo = taktTime
      ? `目標節拍時間：${taktTime}s\n達標工站：${analysis.taktStats?.passCount}/${analysis.workstationCount} (${analysis.taktStats?.passRate.toFixed(1)}%)\n超出工站：${analysis.taktStats?.exceedCount} 個\n`
      : "目標節拍時間：未設定\n";

    const content = [
      `產線平衡分析報告`,
      `生產線：${line?.name}`,
      `分析時間：${new Date().toLocaleString("zh-TW")}`,
      ``,
      `=== 平衡指標 ===`,
      `工站數量：${analysis.workstationCount}`,
      `總工序時間：${analysis.totalTime.toFixed(1)}s`,
      `最大工序時間（瓶頸）：${analysis.maxTime.toFixed(1)}s`,
      `最小工序時間：${analysis.minTime.toFixed(1)}s`,
      `平均工序時間：${analysis.avgTime.toFixed(1)}s`,
      `產線平衡率：${analysis.balanceRate.toFixed(1)}%`,
      `平衡損失率：${analysis.balanceLoss.toFixed(1)}%`,
      `瓶頸工站：${analysis.bottleneck?.name}`,
      taktInfo,
      `=== 工站明細 ===`,
      `工站名稱,工序時間(s),人員配置,狀態${taktTime ? ",vs Takt Time" : ""}`,
      ...workstations.map(w => {
        const ct = parseFloat(w.cycleTime.toString());
        const status = STATUS_META[getBarStatus(ct, analysis.maxTime, taktTime)].label;
        const taktDiff = taktTime ? `${(ct - taktTime).toFixed(1)}s` : "";
        return `${w.name},${ct.toFixed(1)},${w.manpower},${status}${taktTime ? "," + taktDiff : ""}`;
      }),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "balance"}_平衡分析報告.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("報告已下載");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/lines")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>生產線管理</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{line?.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">產線平衡分析</h1>
        </div>
        <div className="flex items-center gap-2">
          {!taktTime && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/lines")}
              className="border-violet-400/40 text-violet-400 hover:bg-violet-400/10"
            >
              <Target className="h-4 w-4 mr-2" />
              設定 Takt Time
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            導出報告
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setLocation(`/lines/${lineId}/snapshots`)}
            className="border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10"
          >
            <History className="h-4 w-4 mr-2" />
            歷史快照
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!analysis) { toast.error("尚無分析資料"); return; }
              setSnapName(`${line?.name ?? "產線"}_${new Date().toLocaleDateString("zh-TW")}`);
              setShowSaveDialog(true);
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Camera className="h-4 w-4 mr-2" />
            儲存快照
          </Button>
        </div>
      </div>

      {/* 儲存快照 Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-400" />
              儲存分析快照
            </DialogTitle>
            <DialogDescription>
              快照會記錄目前產線的平衡率、Takt Time 達標率與工站時間明細，並自動同步各工站的動作拆解增值率資料。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>快照名稱 <span className="text-red-400">*</span></Label>
              <Input
                value={snapName}
                onChange={e => setSnapName(e.target.value)}
                placeholder="例：改善前基準、第一次改善後、Q2 平衡分析"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>備註說明（選填）</Label>
              <Textarea
                value={snapNote}
                onChange={e => setSnapNote(e.target.value)}
                placeholder="記錄本次分析的背景、改善措施或備註…"
                className="bg-background border-border resize-none"
                rows={3}
              />
            </div>
            {analysis && (
              <div className="rounded-lg bg-background/50 border border-border p-3 text-sm space-y-1">
                <div className="text-muted-foreground text-xs mb-2">快照內容預覽</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">平衡率</span>
                  <span className="font-medium text-cyan-400">{analysis.balanceRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">瓶頸工站</span>
                  <span className="font-medium">{analysis.bottleneck?.name} ({analysis.maxTime.toFixed(1)}s)</span>
                </div>
                {taktTime && analysis.taktStats && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Takt Time 達標率</span>
                    <span className="font-medium text-violet-400">{analysis.taktStats.passRate.toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">工站數 / 人員</span>
                  <span className="font-medium">{analysis.workstationCount} 站 / {analysis.totalManpower} 人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400 font-medium">UPPH</span>
                  <span className="font-bold text-amber-400">{analysis.upph.toFixed(2)} 件/人/時</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-xs text-emerald-400">將自動同步各工站動作拆解增値率（即時快取最新資料）</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-xs text-cyan-400">快照儲存後首頁儀表板圖表將即時同步更新</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400">建議：儲存快照前請確認工站 CT 與動作拆解已完成最新更新</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>取消</Button>
            <Button
              onClick={handleSaveSnapshot}
              disabled={!snapName.trim() || saveSnapshotMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saveSnapshotMutation.isPending ? "儲存中…" : "確認儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Takt Time Banner */}
      {taktTime && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-violet-400/30 bg-violet-400/8">
          <div className="h-10 w-10 rounded-lg bg-violet-400/20 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-semibold text-violet-400">
                目標節拍時間（Takt Time）：{taktTime.toFixed(1)} 秒
              </p>
              {analysis?.taktStats && (
                <>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">
                    ✓ 達標 {analysis.taktStats.passCount} 站
                  </span>
                  {analysis.taktStats.exceedCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/30">
                      ✗ 超出 {analysis.taktStats.exceedCount} 站
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    達標率 {analysis.taktStats.passRate.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              每小時產能目標：約 {Math.floor(3600 / taktTime)} 件 ｜ 圖表中紫色虛線為 Takt Time 基準
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-violet-400/70 hover:text-violet-400"
            onClick={() => setLocation("/lines")}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            修改
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : !analysis ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">尚無工站資料</h3>
            <p className="text-muted-foreground text-sm mb-6">請先在工站管理頁面新增工站資料</p>
            <Button onClick={() => setLocation(`/lines/${lineId}/workstations`)}>
              前往工站管理
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                label: "產線平衡率",
                value: `${analysis.balanceRate.toFixed(1)}%`,
                sub: analysis.balanceRate >= 85 ? "優秀" : analysis.balanceRate >= 70 ? "良好" : "需改善",
                icon: TrendingUp,
                color: analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400",
                bg: analysis.balanceRate >= 85 ? "bg-emerald-400/10" : analysis.balanceRate >= 70 ? "bg-amber-400/10" : "bg-orange-400/10",
                formulaKey: "balanceRate",
                liveValues: { "總工序時間": `${analysis.totalTime.toFixed(1)}s`, "瓶頸時間": `${analysis.maxTime.toFixed(1)}s`, "工站數": analysis.workstationCount },
              },
              {
                label: "瓶頸工站時間",
                value: `${analysis.maxTime.toFixed(1)}s`,
                sub: analysis.bottleneck?.name ?? "",
                icon: AlertTriangle,
                color: taktTime && analysis.maxTime > taktTime ? "text-red-400" : "text-orange-400",
                bg: taktTime && analysis.maxTime > taktTime ? "bg-red-400/10" : "bg-orange-400/10",
                formulaKey: "bottleneckTime",
                liveValues: { "瓶頸工站": String(analysis.bottleneck?.name ?? "-"), "瓶頸時間": `${analysis.maxTime.toFixed(1)}s` },
              },
              {
                label: taktTime ? "Takt Time 達標率" : "平均工序時間",
                value: taktTime
                  ? `${analysis.taktStats!.passRate.toFixed(1)}%`
                  : `${analysis.avgTime.toFixed(1)}s`,
                sub: taktTime
                  ? `${analysis.taktStats!.passCount}/${analysis.workstationCount} 工站達標`
                  : `共 ${analysis.workstationCount} 個工站`,
                icon: taktTime ? Target : Clock,
                color: taktTime
                  ? (analysis.taktStats!.passRate >= 80 ? "text-emerald-400" : analysis.taktStats!.passRate >= 50 ? "text-amber-400" : "text-red-400")
                  : "text-cyan-400",
                bg: taktTime
                  ? (analysis.taktStats!.passRate >= 80 ? "bg-emerald-400/10" : analysis.taktStats!.passRate >= 50 ? "bg-amber-400/10" : "bg-red-400/10")
                  : "bg-cyan-400/10",
                formulaKey: taktTime ? "taktPassRate" : "avgCycleTime",
                liveValues: taktTime
                  ? { "Takt Time": `${taktTime}s`, "達標工站": `${analysis.taktStats!.passCount}/${analysis.workstationCount}` }
                  : { "總工序時間": `${analysis.totalTime.toFixed(1)}s`, "工站數": analysis.workstationCount },
              },
              {
                label: "平衡損失率",
                value: `${analysis.balanceLoss.toFixed(1)}%`,
                sub: "可改善空間",
                icon: Activity,
                color: "text-violet-400",
                bg: "bg-violet-400/10",
                formulaKey: "balanceLoss",
                liveValues: { "平衡率": `${analysis.balanceRate.toFixed(1)}%`, "損失率": `${analysis.balanceLoss.toFixed(1)}%` },
              },
            ].map(kpi => (
              <Card key={kpi.label} className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <FormulaTooltip formulaKey={kpi.formulaKey as any} liveValues={kpi.liveValues as unknown as Record<string, string | number>}>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </FormulaTooltip>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </CardContent>
              </Card>
            ))}
            {/* UPPH KPI 卡片（獨立顯示，凸顯 IE 績效） */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm text-amber-400 font-medium">UPPH</p>
                  <div className="h-8 w-8 rounded-lg bg-amber-400/15 flex items-center justify-center">
                    <Users className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
                <FormulaTooltip
                  formulaKey="upph"
                  liveValues={{ "瓶頸時間": `${analysis.maxTime.toFixed(1)}s`, "總人數": `${analysis.totalManpower}人` }}
                >
                  <p className="text-2xl font-bold text-amber-400">
                    {analysis.upph.toFixed(2)}
                  </p>
                </FormulaTooltip>
                <p className="text-xs text-muted-foreground mt-1">件/人/時</p>
                <div className="mt-2 pt-2 border-t border-amber-500/20">
                  <p className="text-xs text-amber-400/70">
                    = 3600 ÷ {analysis.maxTime.toFixed(1)}s ÷ {analysis.totalManpower}人
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    瓶頸節拍下的 IE 績效指標
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balance Rate Progress */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                平衡率評估
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">產線平衡率</span>
                  <span className={`font-bold ${analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400"}`}>
                    {analysis.balanceRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${analysis.balanceRate}%`,
                      background: analysis.balanceRate >= 85
                        ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                        : analysis.balanceRate >= 70
                        ? "linear-gradient(90deg, #eab308, #f97316)"
                        : "linear-gradient(90deg, #f97316, #ef4444)",
                    }}
                  />
                </div>
                {taktTime && analysis.taktStats && (
                  <>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Takt Time 達標率</span>
                      <span className={`font-bold ${analysis.taktStats.passRate >= 80 ? "text-emerald-400" : analysis.taktStats.passRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {analysis.taktStats.passRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${analysis.taktStats.passRate}%`,
                          background: analysis.taktStats.passRate >= 80
                            ? "linear-gradient(90deg, #4ade80, #a78bfa)"
                            : analysis.taktStats.passRate >= 50
                            ? "linear-gradient(90deg, #eab308, #f97316)"
                            : "linear-gradient(90deg, #ef4444, #f97316)",
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs text-center mt-2">
                  <div className="p-2 rounded-lg bg-orange-400/10 border border-orange-400/20">
                    <p className="text-orange-400 font-medium">需改善</p>
                    <p className="text-muted-foreground">{"< 70%"}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                    <p className="text-amber-400 font-medium">良好</p>
                    <p className="text-muted-foreground">70% ~ 85%</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                    <p className="text-emerald-400 font-medium">優秀</p>
                    <p className="text-muted-foreground">{"> 85%"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  工站工序時間分佈
                  {taktTime && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      — 紫色虛線為 Takt Time 基準
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.chartData} margin={{ top: 28, right: 24, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "oklch(0.60 0.01 240)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.60 0.01 240)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      unit="s"
                    />
                    <Tooltip content={<CustomTooltip taktTime={taktTime} />} />

                    {/* Takt Time Reference Line */}
                    {taktTime && (
                      <ReferenceLine
                        y={taktTime}
                        stroke={COLORS.taktLine}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        label={{
                          value: `Takt Time ${taktTime}s`,
                          fill: COLORS.taktLine,
                          fontSize: 11,
                          fontWeight: 600,
                          position: "insideTopRight",
                          offset: 8,
                        }}
                      />
                    )}

                    {/* Average Reference Line */}
                    <ReferenceLine
                      y={analysis.avgTime}
                      stroke={COLORS.avgLine}
                      strokeDasharray="4 4"
                      label={{
                        value: `均值 ${analysis.avgTime.toFixed(1)}s`,
                        fill: COLORS.avgLine,
                        fontSize: 10,
                        position: "insideTopLeft",
                        offset: 8,
                      }}
                    />

                    <Bar dataKey="cycleTime" radius={[5, 5, 0, 0]} maxBarSize={64}>
                      {analysis.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="cycleTime"
                        content={(props: any) => (
                          <StatusLabel
                            {...props}
                            status={analysis.chartData[props.index]?.status}
                            taktTime={taktTime}
                          />
                        )}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center text-xs">
                {taktTime ? (
                  <>
                    {[
                      { color: COLORS.exceed,     label: "超出 Takt Time" },
                      { color: COLORS.bottleneck, label: "瓶頸工站（最大值）" },
                      { color: COLORS.warning,    label: "接近 Takt Time (>80%)" },
                      { color: COLORS.normal,     label: "正常達標" },
                      { color: COLORS.efficient,  label: "高效（≤70% Takt Time）" },
                      { color: COLORS.taktLine,   label: "Takt Time 基準線", dashed: true },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        {l.dashed
                          ? <div className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: l.color }} />
                          : <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                        }
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { color: COLORS.bottleneck, label: "瓶頸工站 (≥95% 最大值)" },
                      { color: COLORS.warning,    label: "警示工站 (80~95%)" },
                      { color: COLORS.normal,     label: "正常工站" },
                      { color: COLORS.efficient,  label: "高效工站" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workstation Detail Table */}
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                工站詳細分析
                {taktTime && (
                  <span className="text-xs font-normal text-muted-foreground">— 含 Takt Time 達標狀態</span>
                )}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">工站名稱</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">工序時間</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">人員</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">佔比</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">與瓶頸差</th>
                    {taktTime && (
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">vs Takt Time</th>
                    )}
                    <th className="text-right text-xs font-medium text-amber-400/80 px-4 py-3">人均產能 (UPPH)</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {workstations?.map((ws) => {
                    const ct = parseFloat(ws.cycleTime.toString());
                    const pct = (ct / analysis.totalTime * 100).toFixed(1);
                    const diff = ct === analysis.maxTime ? null : ((ct - analysis.maxTime) / analysis.maxTime * 100).toFixed(1);
                    const status = getBarStatus(ct, analysis.maxTime, taktTime);
                    const meta = STATUS_META[status];
                    const taktDiff = taktTime ? (ct - taktTime) : null;

                    return (
                      <tr key={ws.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <meta.icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
                            <span className="text-sm font-medium">{ws.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono font-bold" style={{ color: meta.color }}>
                            {ct.toFixed(1)}s
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">{ws.manpower}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">{pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-mono ${diff === null ? "text-muted-foreground" : "text-emerald-400"}`}>
                            {diff === null ? "—" : `${diff}%`}
                          </span>
                        </td>
                        {taktTime && (
                          <td className="px-4 py-3 text-right">
                            {taktDiff !== null ? (
                              <span className={`text-sm font-mono font-bold ${taktDiff > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {taktDiff > 0 ? "+" : ""}{taktDiff.toFixed(1)}s
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          {/* 工站級 UPPH = 3600 ÷ ct ÷ manpower */}
                          <span className="text-sm font-mono font-bold text-amber-400">
                            {ws.manpower > 0 && ct > 0 ? (3600 / ct / ws.manpower).toFixed(2) : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">件/人/時</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${meta.color}15`,
                              color: meta.color,
                              border: `1px solid ${meta.color}30`,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {taktTime && analysis.taktStats && (
              <div className="px-4 py-3 border-t border-border bg-muted/20">
                <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
                  <span>Takt Time：<strong className="text-violet-400">{taktTime}s</strong></span>
                  <span>達標工站：<strong className="text-emerald-400">{analysis.taktStats.passCount} 站</strong></span>
                  {analysis.taktStats.exceedCount > 0 && (
                    <span>超出工站：<strong className="text-red-400">{analysis.taktStats.exceedCount} 站</strong></span>
                  )}
                  <span>達標率：<strong className={analysis.taktStats.passRate >= 80 ? "text-emerald-400" : "text-amber-400"}>
                    {analysis.taktStats.passRate.toFixed(1)}%
                  </strong></span>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// Pencil icon inline (not imported to keep imports clean)
function Pencil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

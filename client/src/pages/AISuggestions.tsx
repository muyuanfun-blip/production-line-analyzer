import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, ChevronRight, Brain, Sparkles, Download, RefreshCw,
  BarChart3, AlertTriangle, TrendingUp, Clock, Users, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function AISuggestions() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const aiMutation = trpc.analysis.aiSuggest.useMutation({
    onSuccess: (data) => {
      const content = typeof data.suggestion === 'string' ? data.suggestion : JSON.stringify(data.suggestion);
      setSuggestion(content);
      setHasAnalyzed(true);
      toast.success("AI 分析完成");
    },
    onError: () => toast.error("AI 分析失敗，請稍後再試"),
  });

  const analysis = useMemo(() => {
    if (!workstations || workstations.length === 0) return null;
    const times = workstations.map(w => parseFloat(w.cycleTime.toString()));
    const totalTime = times.reduce((s, t) => s + t, 0);
    const maxTime = Math.max(...times);
    const avgTime = totalTime / times.length;
    const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
    const bottleneck = workstations.find(w => parseFloat(w.cycleTime.toString()) === maxTime);
    const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
    const upph = maxTime > 0 && totalManpower > 0 ? 3600 / maxTime / totalManpower : null;
    return { totalTime, maxTime, avgTime, balanceRate, bottleneck, totalManpower, upph };
  }, [workstations]);

  const handleAnalyze = () => {
    if (!workstations?.length) { toast.error("請先新增工站資料"); return; }
    aiMutation.mutate({
      productionLineId: lineId,
      productionLineName: line?.name ?? "未命名產線",
      targetCycleTime: line?.targetCycleTime ? parseFloat(line.targetCycleTime.toString()) : undefined,
      workstations: workstations.map(w => ({
        name: w.name,
        cycleTime: parseFloat(w.cycleTime.toString()),
        manpower: w.manpower,
        sequenceOrder: w.sequenceOrder,
      })),
    });
  };

  const handleExportReport = () => {
    if (!suggestion) { toast.error("請先執行 AI 分析"); return; }
    const content = [
      `生產工站 AI 優化分析報告`,
      `生產線：${line?.name}`,
      `分析時間：${new Date().toLocaleString("zh-TW")}`,
      ``,
      `=== 產線概況 ===`,
      `工站數量：${workstations?.length ?? 0}`,
      `平衡率：${analysis?.balanceRate.toFixed(1) ?? "N/A"}%`,
      `UPPH：${analysis?.upph != null ? analysis.upph.toFixed(2) + " 件/人/時" : "N/A"}`,
      `瓶頸工站：${analysis?.bottleneck?.name ?? "N/A"}`,
      ``,
      `=== AI 優化建議 ===`,
      suggestion,
    ].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "ai"}_AI優化報告.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("報告已下載");
  };

  const handleExportJSON = () => {
    if (!workstations?.length) { toast.error("沒有工站資料可導出"); return; }
    const data = {
      productionLine: {
        id: lineId,
        name: line?.name,
        targetCycleTime: line?.targetCycleTime,
        status: line?.status,
      },
      analysis: analysis ? {
        workstationCount: workstations.length,
        totalCycleTime: analysis.totalTime.toFixed(2),
        maxCycleTime: analysis.maxTime.toFixed(2),
        avgCycleTime: analysis.avgTime.toFixed(2),
        balanceRate: analysis.balanceRate.toFixed(2) + "%",
        upph: analysis.upph != null ? parseFloat(analysis.upph.toFixed(4)) : null,
        upphUnit: "件/人/時",
        bottleneckStation: analysis.bottleneck?.name,
      } : null,
      workstations: workstations.map(w => ({
        id: w.id,
        name: w.name,
        sequenceOrder: w.sequenceOrder,
        cycleTime: w.cycleTime,
        manpower: w.manpower,
        description: w.description,
      })),
      aiSuggestion: suggestion,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "data"}_完整分析.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON 已下載");
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
          <h1 className="text-2xl font-bold tracking-tight">AI 優化建議</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download className="h-4 w-4 mr-2" />JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportReport} disabled={!suggestion}>
            <FileText className="h-4 w-4 mr-2" />報告
          </Button>
        </div>
      </div>

      {/* Current Status Summary */}
      {analysis && workstations && workstations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              label: "工站數量", value: workstations.length, unit: "個",
              icon: BarChart3, color: "text-cyan-400", bg: "bg-cyan-400/10"
            },
            {
              label: "產線平衡率", value: analysis.balanceRate.toFixed(1), unit: "%",
              icon: TrendingUp,
              color: analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400",
              bg: analysis.balanceRate >= 85 ? "bg-emerald-400/10" : analysis.balanceRate >= 70 ? "bg-amber-400/10" : "bg-orange-400/10",
            },
            {
              label: "瓶頸時間", value: analysis.maxTime.toFixed(1), unit: "s",
              icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10"
            },
            {
              label: "總人員", value: analysis.totalManpower, unit: "人",
              icon: Users, color: "text-violet-400", bg: "bg-violet-400/10"
            },
            {
              label: "UPPH",
              value: analysis.upph != null ? analysis.upph.toFixed(2) : "—",
              unit: analysis.upph != null ? " 件/人/時" : "",
              icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10"
            },
          ].map(kpi => (
            <Card key={kpi.label} className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <FormulaTooltip
                    formulaKey={kpi.label === "產線平衡率" ? "balanceRate" : kpi.label === "瓶頸時間" ? "bottleneckTime" : kpi.label === "UPPH" ? "upph" : kpi.label === "總人員" ? "totalManpower" : "workstationCount"}
                    liveValues={{ [kpi.label]: `${kpi.value}${kpi.unit}` }}
                  >
                    <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}<span className="text-sm font-normal ml-0.5">{kpi.unit}</span></p>
                  </FormulaTooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Analysis Panel */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-amber-400" />
              </div>
              AI 產線平衡優化分析
            </CardTitle>
            <Button
              onClick={handleAnalyze}
              disabled={aiMutation.isPending || !workstations?.length}
              className="glow-primary"
            >
              {aiMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {hasAnalyzed ? "重新分析" : "開始 AI 分析"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!workstations?.length ? (
            <div className="py-12 text-center">
              <Brain className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-2">尚無工站資料</h3>
              <p className="text-muted-foreground text-sm mb-4">請先在工站管理頁面新增工站資料，再進行 AI 分析</p>
              <Button variant="outline" onClick={() => setLocation(`/lines/${lineId}/workstations`)}>
                前往工站管理
              </Button>
            </div>
          ) : aiMutation.isPending ? (
            <div className="py-12 text-center">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/20" />
                <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <Brain className="absolute inset-0 m-auto h-7 w-7 text-amber-400" />
              </div>
              <p className="text-base font-medium mb-1">AI 正在分析產線數據...</p>
              <p className="text-sm text-muted-foreground">正在生成平衡優化建議，請稍候</p>
            </div>
          ) : suggestion ? (
            <div className="prose prose-invert max-w-none">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
                <Streamdown className="text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-amber-400 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_strong]:text-foreground [&_ul]:text-muted-foreground [&_li]:mb-1 [&_p]:text-muted-foreground [&_p]:leading-relaxed">
                  {suggestion}
                </Streamdown>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-amber-400/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold mb-2">準備好進行 AI 分析</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                AI 將分析您的產線數據，識別瓶頸工站，並提供具體的平衡優化建議和改善方案
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6 text-xs">
                {[
                  { icon: BarChart3, text: "瓶頸識別與分析" },
                  { icon: TrendingUp, text: "平衡優化建議" },
                  { icon: Brain, text: "改善方案規劃" },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                    <item.icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-muted-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
              <Button onClick={handleAnalyze} size="lg" className="glow-primary">
                <Sparkles className="h-4 w-4 mr-2" />
                開始 AI 分析
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save,
  Clock, Users, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, RefreshCw, Zap, Minus, Info, Download, Activity
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine
} from "recharts";

// ─── 型別定義 ─────────────────────────────────────────────────────────────────

type ActionType = "value_added" | "non_value_added" | "necessary_waste";

interface LocalStep {
  id?: number;
  tempId: string;
  stepName: string;
  duration: string;
  actionType: ActionType;
  description: string;
  stepOrder: number;
  isDirty: boolean;
  isNew: boolean;
}

// ─── 常數 ─────────────────────────────────────────────────────────────────────

const ACTION_TYPE_CONFIG: Record<ActionType, {
  label: string; color: string; bg: string; border: string;
  icon: React.ReactNode; shortLabel: string;
}> = {
  value_added: {
    label: "增值動作", shortLabel: "增值",
    color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  non_value_added: {
    label: "非增值動作", shortLabel: "非增值",
    color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30",
    icon: <Minus className="w-3.5 h-3.5" />,
  },
  necessary_waste: {
    label: "必要浪費", shortLabel: "必要浪費",
    color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

function genTempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseDuration(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

// ─── 子元件：單一動作列 ────────────────────────────────────────────────────────

interface StepRowProps {
  step: LocalStep;
  index: number;
  total: number;
  totalSec: number;
  onChange: (tempId: string, field: string, value: string) => void;
  onDelete: (tempId: string) => void;
  onMove: (tempId: string, dir: "up" | "down") => void;
}

function StepRow({ step, index, total, totalSec, onChange, onDelete, onMove }: StepRowProps) {
  const cfg = ACTION_TYPE_CONFIG[step.actionType];
  const sec = parseDuration(step.duration);
  const pct = totalSec > 0 ? (sec / totalSec) * 100 : 0;

  return (
    <div className={`group relative flex items-start gap-2 p-3 rounded-xl border transition-all duration-200
      ${cfg.bg} ${cfg.border}
      ${step.isDirty ? "ring-1 ring-purple-500/30" : ""}
      hover:shadow-sm`}>

      {/* 序號 + 排序按鈕 */}
      <div className="flex flex-col items-center gap-0.5 pt-0.5 min-w-[26px]">
        <span className="text-[10px] font-mono text-muted-foreground/50 leading-none tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button onClick={() => onMove(step.tempId, "up")} disabled={index === 0}
          className="mt-1 p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        </button>
        <button onClick={() => onMove(step.tempId, "down")} disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>

      {/* 動作名稱 + 備註 */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Input
          value={step.stepName}
          onChange={e => onChange(step.tempId, "stepName", e.target.value)}
          placeholder="動作名稱（如：取料、組裝螺絲、目視檢查）"
          className="h-8 text-sm bg-background/50 border-white/10 focus:border-purple-500/50 placeholder:text-muted-foreground/40"
        />
        <Input
          value={step.description}
          onChange={e => onChange(step.tempId, "description", e.target.value)}
          placeholder="備註說明（選填）"
          className="h-6 text-[11px] bg-background/20 border-white/5 focus:border-purple-500/20 text-muted-foreground placeholder:text-muted-foreground/30"
        />
        {/* 時間佔比進度條 */}
        {sec > 0 && totalSec > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.7 }} />
            </div>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{pct.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* 動作類型選擇 */}
      <div className="w-[130px] shrink-0">
        <Select value={step.actionType} onValueChange={v => onChange(step.tempId, "actionType", v)}>
          <SelectTrigger className="h-8 text-xs bg-background/50 border-white/10 focus:border-purple-500/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(ACTION_TYPE_CONFIG) as [ActionType, typeof ACTION_TYPE_CONFIG[ActionType]][]).map(([key, c]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-1.5">
                  <span style={{ color: c.color }}>{c.icon}</span>
                  <span>{c.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 秒數輸入 */}
      <div className="w-[88px] shrink-0">
        <div className="relative">
          <Input
            type="number" min="0" step="0.1"
            value={step.duration}
            onChange={e => onChange(step.tempId, "duration", e.target.value)}
            placeholder="0.0"
            className="h-8 text-sm pr-7 bg-background/50 border-white/10 focus:border-purple-500/50 text-right tabular-nums"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 pointer-events-none">秒</span>
        </div>
      </div>

      {/* 狀態指示 + 刪除 */}
      <div className="flex items-start gap-1 pt-1">
        {step.isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse mt-1" title="未儲存" />
        )}
        <button onClick={() => onDelete(step.tempId)}
          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function ActionAnalysis() {
  const { id: lineId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const lineIdNum = parseInt(lineId ?? "0");

  // 從 URL 查詢參數 ?ws=N 讀取初始工站 ID
  const initialWsId = useMemo(() => {
    const params = new URLSearchParams(search);
    const ws = params.get("ws");
    return ws ? parseInt(ws) : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedWsId, setSelectedWsId] = useState<number | null>(initialWsId);
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [syncCycleTime, setSyncCycleTime] = useState(false);
  const [wsStepCounts, setWsStepCounts] = useState<Record<number, number>>({});

  // ── 查詢 ──────────────────────────────────────────────────────────────────
  const { data: line } = trpc.productionLine.getById.useQuery(
    { id: lineIdNum }, { enabled: lineIdNum > 0 }
  );
  const { data: workstations = [] } = trpc.workstation.listByLine.useQuery(
    { productionLineId: lineIdNum }, { enabled: lineIdNum > 0 }
  );

  const selectedWs = workstations.find(w => w.id === selectedWsId);

  const { data: dbSteps = [], refetch: refetchSteps } = trpc.actionStep.listByWorkstation.useQuery(
    { workstationId: selectedWsId! },
    { enabled: selectedWsId !== null }
  );

  // 使用 ref 追蹤上一次 dbSteps 的序列化值，避免陣列參考變化導致無限迴圈
  const prevDbStepsKeyRef = useRef<string>("");
  // 使用 ref 儲存 selectedWsId 的最新值，避免它被加入 useEffect 依賴陣列觸發額外執行
  const selectedWsIdRef = useRef<number | null>(selectedWsId);
  useEffect(() => { selectedWsIdRef.current = selectedWsId; });

  useEffect(() => {
    // 序列化 dbSteps 以穩定比較，避免每次 refetch 產生新陣列參考觸發無限更新
    const key = dbSteps.map((s: any) => `${s.id}:${s.stepOrder}:${s.stepName}:${s.duration}:${s.actionType}`).join("|");
    if (key === prevDbStepsKeyRef.current) return;
    prevDbStepsKeyRef.current = key;

    setSteps(
      [...dbSteps]
        .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
        .map((s: any) => ({
          id: s.id,
          tempId: genTempId(),
          stepName: s.stepName,
          duration: String(parseFloat(s.duration)),
          actionType: s.actionType as ActionType,
          description: s.description ?? "",
          stepOrder: s.stepOrder,
          isDirty: false,
          isNew: false,
        }))
    );
    const wsId = selectedWsIdRef.current;
    if (wsId !== null) {
      setWsStepCounts(prev => ({ ...prev, [wsId]: dbSteps.length }));
    }
  }, [dbSteps]); // 只依賴 dbSteps，selectedWsId 透過 ref 讀取避免觸發額外迴圈

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createStep = trpc.actionStep.create.useMutation();
  const updateStep = trpc.actionStep.update.useMutation();
  const deleteStep = trpc.actionStep.delete.useMutation();
  const updateWorkstation = trpc.workstation.update.useMutation();
  const utils = trpc.useUtils();

  // ── 計算統計 ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSec = steps.reduce((acc, s) => acc + parseDuration(s.duration), 0);
    const byType = {
      value_added: steps.filter(s => s.actionType === "value_added").reduce((a, s) => a + parseDuration(s.duration), 0),
      non_value_added: steps.filter(s => s.actionType === "non_value_added").reduce((a, s) => a + parseDuration(s.duration), 0),
      necessary_waste: steps.filter(s => s.actionType === "necessary_waste").reduce((a, s) => a + parseDuration(s.duration), 0),
    };
    const cycleTime = parseFloat(selectedWs?.cycleTime ?? "0");
    const taktTime = parseFloat(line?.targetCycleTime ?? "0");
    const diff = totalSec - cycleTime;
    const taktDiff = taktTime > 0 ? totalSec - taktTime : null;
    const valueAddedRate = totalSec > 0 ? (byType.value_added / totalSec) * 100 : 0;
    const pieData = [
      { name: "增值動作", value: byType.value_added, color: "#10b981" },
      { name: "非增值動作", value: byType.non_value_added, color: "#ef4444" },
      { name: "必要浪費", value: byType.necessary_waste, color: "#f59e0b" },
    ].filter(d => d.value > 0);
    return { totalSec, byType, diff, taktDiff, valueAddedRate, pieData, cycleTime, taktTime };
  }, [steps, selectedWs, line]);

  const workstationBarData = useMemo(() =>
    workstations
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map(w => ({
        name: w.name.length > 5 ? w.name.slice(0, 5) + "…" : w.name,
        cycleTime: parseFloat(w.cycleTime),
        isSelected: w.id === selectedWsId,
      })),
    [workstations, selectedWsId]
  );

  // ── 事件處理 ──────────────────────────────────────────────────────────────

  function handleSelectWs(id: number) {
    if (id === selectedWsId) return;
    setSelectedWsId(id);
    setSteps([]);
  }

  function handleAddStep() {
    setSteps(prev => [...prev, {
      tempId: genTempId(),
      stepName: "", duration: "", actionType: "value_added",
      description: "", stepOrder: prev.length, isDirty: true, isNew: true,
    }]);
  }

  function handleChange(tempId: string, field: string, value: string) {
    setSteps(prev => prev.map(s =>
      s.tempId === tempId ? { ...s, [field]: value, isDirty: true } : s
    ));
  }

  function handleDelete(tempId: string) {
    const step = steps.find(s => s.tempId === tempId);
    if (step?.id) deleteStep.mutate({ id: step.id });
    setSteps(prev => prev.filter(s => s.tempId !== tempId));
  }

  function handleMove(tempId: string, dir: "up" | "down") {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.tempId === tempId);
      if (idx < 0) return prev;
      const arr = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx]!, arr[idx]!];
      return arr.map((s, i) => ({ ...s, stepOrder: i, isDirty: true }));
    });
  }

  async function handleSave() {
    if (!selectedWsId) return;
    const invalid = steps.find(s => !s.stepName.trim() || parseDuration(s.duration) <= 0);
    if (invalid) { toast.error("請確認所有步驟均已填寫名稱與有效秒數"); return; }

    setIsSaving(true);
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!;
        if (!s.isDirty) continue;
        const payload = {
          stepName: s.stepName.trim(),
          stepOrder: i,
          duration: parseDuration(s.duration),
          actionType: s.actionType,
          description: s.description.trim() || undefined,
        };
        if (s.isNew) {
          await createStep.mutateAsync({ workstationId: selectedWsId, ...payload });
        } else if (s.id) {
          await updateStep.mutateAsync({ id: s.id, ...payload });
        }
      }
      if (syncCycleTime && stats.totalSec > 0) {
        await updateWorkstation.mutateAsync({ id: selectedWsId, cycleTime: stats.totalSec });
        // 同步刷新工站列表、工站詳細資料與平衡分析頁面的工站快取
        await utils.workstation.listByLine.invalidate({ productionLineId: lineIdNum });
        await utils.workstation.getById.invalidate({ id: selectedWsId });
        toast.success(`工站時間已同步更新為 ${stats.totalSec.toFixed(1)}s，平衡分析將自動重新計算`);
      }
      await refetchSteps();
      // 刷新工站步驟列表與計數快取
      await utils.actionStep.listByWorkstation.invalidate({ workstationId: selectedWsId });
      toast.success("動作步驟已儲存成功");
    } catch {
      toast.error("儲存失敗，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportCSV() {
    if (!steps.length) { toast.error("尚無步驟資料"); return; }
    const header = "序號,動作名稱,類型,時間(秒),佔比(%),備註\n";
    const rows = steps.map((s, i) =>
      `${i + 1},${s.stepName},${ACTION_TYPE_CONFIG[s.actionType].label},${parseDuration(s.duration).toFixed(1)},${stats.totalSec > 0 ? ((parseDuration(s.duration) / stats.totalSec) * 100).toFixed(1) : 0},${s.description}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${selectedWs?.name ?? "steps"}_動作拆解.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下載");
  }

  function handleClearAll() {
    if (!confirm(`確定要清除「${selectedWs?.name}」的所有動作步驟嗎？`)) return;
    steps.forEach(s => { if (s.id) deleteStep.mutate({ id: s.id }); });
    setSteps([]);
  }

  const hasDirty = steps.some(s => s.isDirty);

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-6">
      {/* 頁首 */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/lines/${lineId}/balance`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">動作分析</h1>
          <p className="text-sm text-muted-foreground">{line?.name ?? "載入中..."}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasDirty && (
            <Badge variant="outline" className="text-purple-400 border-purple-500/40 bg-purple-500/10 text-xs animate-pulse">
              有未儲存的變更
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={steps.length === 0} className="text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1.5" />匯出 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/lines/${lineId}/balance`)} className="text-xs h-8">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />平衡分析
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── 左側：工站選擇 ── */}
        <div className="col-span-3 space-y-4">
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />工站列表
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {workstations.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">尚無工站</p>
                </div>
              ) : (
                workstations
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map(w => {
                    const ct = parseFloat(w.cycleTime);
                    const takt = parseFloat(line?.targetCycleTime ?? "0");
                    const isOver = takt > 0 && ct > takt;
                    const isSelected = w.id === selectedWsId;
                    const stepCount = wsStepCounts[w.id] ?? 0;
                    return (
                      <button key={w.id} onClick={() => handleSelectWs(w.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? "border-purple-500/50 bg-purple-500/10"
                            : "border-white/8 bg-background/20 hover:border-white/20 hover:bg-background/40"
                        }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                            {w.name}
                          </span>
                          {isOver && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <Clock className="w-2.5 h-2.5" />{ct.toFixed(1)}s
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <Users className="w-2.5 h-2.5" />{w.manpower}人
                          </span>
                          {stepCount > 0 && (
                            <span className="text-[11px] text-purple-400/70">{stepCount}步驟</span>
                          )}
                        </div>
                      </button>
                    );
                  })
              )}
            </CardContent>
          </Card>

          {/* 各工站時間小圖 */}
          {workstationBarData.length > 0 && (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">各工站時間比較</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={workstationBarData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                    {stats.taktTime > 0 && (
                      <ReferenceLine y={stats.taktTime} stroke="#a855f7" strokeDasharray="3 2" strokeWidth={1} />
                    )}
                    <Bar dataKey="cycleTime" radius={[2, 2, 0, 0]}>
                      {workstationBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.isSelected ? "#a855f7" : "#374151"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 中間：動作拆解輸入 ── */}
        <div className="col-span-6">
          {!selectedWsId ? (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm h-full">
              <CardContent className="flex flex-col items-center justify-center h-full py-20">
                <BarChart3 className="w-14 h-14 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">請從左側選擇工站</p>
                <p className="text-muted-foreground/50 text-sm mt-1">選擇工站後可輸入動作拆解步驟</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">{selectedWs?.name}</CardTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />工站設定：{parseFloat(selectedWs?.cycleTime ?? "0").toFixed(1)}s
                      </span>
                      {stats.taktTime > 0 && (
                        <span className="text-xs text-purple-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />Takt：{stats.taktTime.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {steps.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleClearAll}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3 h-3 mr-1" />清除
                      </Button>
                    )}
                    <Button size="sm" onClick={handleAddStep}
                      className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-3.5 h-3.5 mr-1" />新增動作
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* 欄位標題 */}
                <div className="flex items-center gap-2 mb-2 px-1 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  <div className="w-[26px]" />
                  <div className="flex-1">動作名稱 / 備註</div>
                  <div className="w-[130px] shrink-0">類型</div>
                  <div className="w-[88px] shrink-0 text-right">時間</div>
                  <div className="w-8" />
                </div>

                {/* 動作列表 */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
                  {steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-xl">
                      <Plus className="w-10 h-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">尚無動作步驟</p>
                      <p className="text-xs text-muted-foreground/50 mt-1">點擊「新增動作」開始拆解工站動作</p>
                      <Button size="sm" onClick={handleAddStep} className="mt-4 h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-3.5 h-3.5 mr-1" />新增第一個動作
                      </Button>
                    </div>
                  ) : (
                    steps.map((step, idx) => (
                      <StepRow
                        key={step.tempId} step={step} index={idx}
                        total={steps.length} totalSec={stats.totalSec}
                        onChange={handleChange} onDelete={handleDelete} onMove={handleMove}
                      />
                    ))
                  )}
                </div>

                {/* 底部：合計 + 儲存 */}
                {steps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
                    {/* 合計資訊列 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          合計 {stats.totalSec.toFixed(1)}s
                        </span>
                        {stats.cycleTime > 0 && (
                          <span className={`text-xs flex items-center gap-1 ${
                            Math.abs(stats.diff) < 0.5 ? "text-emerald-400" :
                            stats.diff > 0 ? "text-red-400" : "text-amber-400"
                          }`}>
                            {Math.abs(stats.diff) < 0.5
                              ? <><CheckCircle2 className="w-3 h-3" />與工站時間吻合</>
                              : stats.diff > 0
                              ? <><AlertTriangle className="w-3 h-3" />超出 {stats.diff.toFixed(1)}s</>
                              : <><Info className="w-3 h-3" />少於 {Math.abs(stats.diff).toFixed(1)}s</>
                            }
                          </span>
                        )}
                      </div>
                      <span className={`text-xs flex items-center gap-1 ${
                        stats.valueAddedRate >= 70 ? "text-emerald-400" :
                        stats.valueAddedRate >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>
                        <TrendingUp className="w-3 h-3" />增值率 {stats.valueAddedRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* 各類型時間條 */}
                    <div className="space-y-1.5">
                      {(Object.entries(ACTION_TYPE_CONFIG) as [ActionType, typeof ACTION_TYPE_CONFIG[ActionType]][]).map(([key, cfg]) => {
                        const sec = stats.byType[key];
                        const pct = stats.totalSec > 0 ? (sec / stats.totalSec) * 100 : 0;
                        if (sec === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-[100px] shrink-0">
                              <span style={{ color: cfg.color }}>{cfg.icon}</span>
                              <span className="text-xs text-muted-foreground">{cfg.label}</span>
                            </div>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                            </div>
                            <span className="text-xs text-muted-foreground/70 w-[90px] text-right tabular-nums shrink-0">
                              {sec.toFixed(1)}s ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 同步選項 + 儲存按鈕 */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none group/sync">
                        <input type="checkbox" checked={syncCycleTime}
                          onChange={e => setSyncCycleTime(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-purple-500" />
                        <span className="text-xs text-muted-foreground group-hover/sync:text-foreground transition-colors">
                          同步合計時間（{stats.totalSec.toFixed(1)}s）至工站設定
                        </span>
                      </label>
                      <Button onClick={handleSave} disabled={isSaving || !hasDirty}
                        className="h-8 px-4 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-40">
                        {isSaving
                          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />儲存中...</>
                          : <><Save className="w-3.5 h-3.5 mr-1.5" />儲存步驟</>
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 右側：即時分析 ── */}
        <div className="col-span-3 space-y-4">
          {/* 圓餅圖 */}
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">動作類型分佈</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {stats.pieData.length === 0 ? (
                <div className="flex items-center justify-center h-36 text-muted-foreground/30 text-xs">
                  輸入動作後即時顯示
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={stats.pieData} cx="50%" cy="50%"
                      innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value">
                      {stats.pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}s`, ""]}
                      contentStyle={{
                        background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px", fontSize: "11px"
                      }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* KPI 指標 */}
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">分析指標</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2.5">
              {[
                { label: "動作步驟數", value: `${steps.length} 項`, color: "text-foreground" },
                { label: "合計時間", value: `${stats.totalSec.toFixed(1)}s`, color: "text-foreground" },
                {
                  label: "增值率",
                  value: `${stats.valueAddedRate.toFixed(1)}%`,
                  color: stats.valueAddedRate >= 70 ? "text-emerald-400" : stats.valueAddedRate >= 50 ? "text-amber-400" : "text-red-400"
                },
                ...(stats.cycleTime > 0 ? [{
                  label: "與工站差異",
                  value: `${stats.diff >= 0 ? "+" : ""}${stats.diff.toFixed(1)}s`,
                  color: Math.abs(stats.diff) < 0.5 ? "text-emerald-400" : stats.diff > 0 ? "text-red-400" : "text-amber-400"
                }] : []),
                ...(stats.taktTime > 0 ? [{
                  label: "vs Takt Time",
                  value: stats.totalSec <= stats.taktTime ? "✓ 達標" : `超出 ${(stats.totalSec - stats.taktTime).toFixed(1)}s`,
                  color: stats.totalSec <= stats.taktTime ? "text-emerald-400" : "text-red-400"
                }] : []),
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 改善提示卡片 */}
          {steps.length > 0 && stats.byType.non_value_added > 0 && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-400">改善機會</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    非增值動作 {stats.byType.non_value_added.toFixed(1)}s
                    （佔 {((stats.byType.non_value_added / stats.totalSec) * 100).toFixed(0)}%），建議優先消除。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {steps.length > 0 && stats.valueAddedRate >= 80 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-400">優良工站</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    增值率達 {stats.valueAddedRate.toFixed(0)}%，動作效率良好。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

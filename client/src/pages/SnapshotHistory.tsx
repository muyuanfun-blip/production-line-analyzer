import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Camera, Trash2, GitCompare, ArrowLeft, Clock,
  TrendingUp, TrendingDown, Minus, BarChart3, Target, Users
} from "lucide-react";

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
  createdAt: Date;
};

function TrendIcon({ value, prev }: { value: number; prev?: number }) {
  if (prev === undefined) return null;
  const diff = value - prev;
  if (Math.abs(diff) < 0.1) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-400 inline" />;
  return <TrendingDown className="w-3 h-3 text-red-400 inline" />;
}

export default function SnapshotHistory() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: snapshots = [], refetch } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: lineId },
    { enabled: lineId > 0 }
  );

  const deleteMutation = trpc.snapshot.delete.useMutation({
    onSuccess: () => { toast.success("快照已刪除"); refetch(); },
    onError: () => toast.error("刪除失敗，請稍後再試"),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2 ? [...prev, id] : [prev[1]!, id]
    );
  };

  const handleCompare = () => {
    if (selectedIds.length === 2) {
      navigate(`/lines/${lineId}/snapshots/compare?a=${selectedIds[0]}&b=${selectedIds[1]}`);
    }
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  const getBalanceColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-400";
    if (rate >= 75) return "text-cyan-400";
    if (rate >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getTaktBadge = (rate: number | null) => {
    if (rate === null) return null;
    if (rate >= 90) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">達標 {rate.toFixed(0)}%</Badge>;
    if (rate >= 70) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">待改善 {rate.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">超標 {rate.toFixed(0)}%</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/lines/${lineId}/balance`)}
            className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              生產線管理 › {line?.name} › 歷史快照
            </div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Camera className="w-6 h-6 text-violet-400" />
              歷史快照記錄
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              追蹤產線改善成效，選取 2 個快照進行比較
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length === 2 && (
            <Button onClick={handleCompare} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <GitCompare className="w-4 h-4" />
              比較選取的 2 個快照
            </Button>
          )}
          {selectedIds.length === 1 && (
            <div className="text-sm text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
              已選 1/2，再選 1 個即可比較
            </div>
          )}
        </div>
      </div>

      {/* 空狀態 */}
      {snapshots.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-semibold text-foreground mb-2">尚無快照記錄</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              在「產線平衡分析」頁面點擊「儲存快照」按鈕，即可記錄當前分析結果以供日後比較。
            </p>
            <Button className="mt-4 gap-2" onClick={() => navigate(`/lines/${lineId}/balance`)}>
              <BarChart3 className="w-4 h-4" />
              前往平衡分析
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 快照列表 */}
      {snapshots.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            共 {snapshots.length} 個快照 · 點選最多 2 個進行比較
          </p>
          {(snapshots as Snapshot[]).map((snap, idx) => {
            const prevSnap = snapshots[idx + 1] as Snapshot | undefined;
            const isSelected = selectedIds.includes(snap.id);
            const selOrder = selectedIds.indexOf(snap.id);

            return (
              <Card
                key={snap.id}
                onClick={() => toggleSelect(snap.id)}
                className={`cursor-pointer transition-all duration-200 border ${
                  isSelected
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.5)]"
                    : "border-border bg-card hover:border-violet-500/40"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* 左側 */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                        isSelected ? "border-violet-500 bg-violet-500" : "border-border"
                      }`}>
                        {isSelected && <span className="text-white text-xs font-bold">{selOrder + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{snap.name}</h3>
                          {idx === 0 && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">最新</Badge>}
                          {getTaktBadge(snap.taktPassRate)}
                        </div>
                        {snap.note && <p className="text-sm text-muted-foreground mt-0.5 truncate">{snap.note}</p>}
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(snap.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* 右側 KPI */}
                    <div className="flex items-center gap-5 flex-shrink-0 flex-wrap">
                      {/* 平衡率 */}
                      <div className="text-center min-w-[60px]">
                        <FormulaTooltip formulaKey="balanceRate" liveValues={{ "平衡率": `${snap.balanceRate.toFixed(1)}%` }}>
                          <div className={`text-xl font-bold ${getBalanceColor(snap.balanceRate)} flex items-center gap-1 justify-center`}>
                            {snap.balanceRate.toFixed(1)}%
                            <TrendIcon value={snap.balanceRate} prev={prevSnap?.balanceRate} />
                          </div>
                        </FormulaTooltip>
                        <div className="text-xs text-muted-foreground">平衡率</div>
                        {prevSnap && (
                          <div className={`text-xs ${snap.balanceRate > prevSnap.balanceRate ? "text-emerald-400" : snap.balanceRate < prevSnap.balanceRate ? "text-red-400" : "text-muted-foreground"}`}>
                            {snap.balanceRate > prevSnap.balanceRate ? "+" : ""}{(snap.balanceRate - prevSnap.balanceRate).toFixed(1)}%
                          </div>
                        )}
                      </div>

                      {/* 瓶頸時間 */}
                      <div className="text-center min-w-[60px]">
                        <FormulaTooltip formulaKey="bottleneckTime" liveValues={{ "瓶頸時間": `${snap.maxTime.toFixed(1)}s` }}>
                          <div className="text-xl font-bold text-orange-400 flex items-center gap-1 justify-center">
                            {snap.maxTime.toFixed(1)}s
                            <TrendIcon value={-snap.maxTime} prev={prevSnap ? -prevSnap.maxTime : undefined} />
                          </div>
                        </FormulaTooltip>
                        <div className="text-xs text-muted-foreground">瓶頸時間</div>
                        {snap.bottleneckName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[80px]">{snap.bottleneckName}</div>
                        )}
                      </div>

                      {/* 工站數 */}
                      <div className="text-center min-w-[50px]">
                        <div className="text-xl font-bold text-foreground flex items-center gap-1 justify-center">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          {snap.workstationCount}
                        </div>
                        <div className="text-xs text-muted-foreground">工站數</div>
                        <div className="flex items-center gap-1 justify-center text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />{snap.totalManpower}人
                        </div>
                      </div>

                      {/* Takt Time */}
                      {snap.taktTime && (
                        <div className="text-center min-w-[60px]">
                          <FormulaTooltip formulaKey="taktPassRate" liveValues={{ "Takt Time": `${snap.taktTime}s` }}>
                            <div className="text-xl font-bold text-violet-400 flex items-center gap-1 justify-center">
                              <Target className="w-4 h-4" />{snap.taktTime}s
                            </div>
                          </FormulaTooltip>
                          <div className="text-xs text-muted-foreground">Takt Time</div>
                          {snap.taktPassCount !== null && (
                            <div className="text-xs text-muted-foreground">{snap.taktPassCount}/{snap.workstationCount} 達標</div>
                          )}
                        </div>
                      )}

                      {/* UPPH */}
                      {snap.upph != null && (
                        <div className="text-center min-w-[70px]">
                          <FormulaTooltip formulaKey="upph" liveValues={{ "UPPH": `${Number(snap.upph).toFixed(2)} 件/人/時` }}>
                            <div className="text-xl font-bold text-amber-400 flex items-center gap-1 justify-center">
                              {Number(snap.upph).toFixed(2)}
                              <TrendIcon value={Number(snap.upph)} prev={prevSnap?.upph != null ? Number(prevSnap.upph) : undefined} />
                            </div>
                          </FormulaTooltip>
                          <div className="text-xs text-amber-400/80 font-medium">UPPH</div>
                          {prevSnap?.upph != null && (
                            <div className={`text-xs ${
                              Number(snap.upph) > Number(prevSnap.upph) ? "text-emerald-400"
                              : Number(snap.upph) < Number(prevSnap.upph) ? "text-red-400"
                              : "text-muted-foreground"
                            }`}>
                              {Number(snap.upph) > Number(prevSnap.upph) ? "+" : ""}
                              {(Number(snap.upph) - Number(prevSnap.upph)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 刪除 */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            onClick={e => e.stopPropagation()}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle>確認刪除快照</AlertDialogTitle>
                            <AlertDialogDescription>
                              確定要刪除快照「{snap.name}」嗎？此操作無法復原。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => deleteMutation.mutate({ id: snap.id })}>
                              確認刪除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

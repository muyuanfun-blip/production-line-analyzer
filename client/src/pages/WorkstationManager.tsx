import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Plus, Pencil, Trash2, Upload, Download, GripVertical,
  Clock, Users, FileText, MoreVertical, ChevronRight, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type WsFormData = {
  name: string;
  sequenceOrder: string;
  cycleTime: string;
  manpower: string;
  description: string;
  notes: string;
};

export default function WorkstationManager() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations, isLoading } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  // 快速內嵌編輯狀態
  const [inlineEdits, setInlineEdits] = useState<Record<number, { cycleTime: string; manpower: string }>>({});
  const [savingInline, setSavingInline] = useState<Record<number, boolean>>({});
  const [form, setForm] = useState<WsFormData>({
    name: "", sequenceOrder: "", cycleTime: "", manpower: "1", description: "", notes: ""
  });

  const createMutation = trpc.workstation.create.useMutation({
    onSuccess: () => {
      utils.workstation.listByLine.invalidate({ productionLineId: lineId });
      toast.success("工站建立成功");
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("建立失敗"),
  });

  const updateMutation = trpc.workstation.update.useMutation({
    onSuccess: () => {
      // 同時 invalidate 列表與對應工站詳細資料，確保平衡分析頁面即時重新計算
      utils.workstation.listByLine.invalidate({ productionLineId: lineId });
      if (editingId) utils.workstation.getById.invalidate({ id: editingId });
      toast.success("工站更新成功");
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("更新失敗"),
  });

  const deleteMutation = trpc.workstation.delete.useMutation({
    onSuccess: () => {
      utils.workstation.listByLine.invalidate({ productionLineId: lineId });
      toast.success("工站已刪除");
      setDeleteId(null);
    },
    onError: () => toast.error("刪除失敗"),
  });

  const bulkImportMutation = trpc.workstation.bulkImport.useMutation({
    onSuccess: (data) => {
      utils.workstation.listByLine.invalidate({ productionLineId: lineId });
      toast.success(`成功匯入 ${data.count} 個工站`);
      setShowImport(false);
      setImportText("");
      setImportPreview([]);
    },
    onError: () => toast.error("匯入失敗"),
  });

  const resetForm = () => setForm({ name: "", sequenceOrder: "", cycleTime: "", manpower: "1", description: "", notes: "" });

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    const nextOrder = (workstations?.length ?? 0) + 1;
    setForm(f => ({ ...f, sequenceOrder: nextOrder.toString() }));
    setShowForm(true);
  };

  const openEdit = (ws: any) => {
    setForm({
      name: ws.name,
      sequenceOrder: ws.sequenceOrder.toString(),
      cycleTime: ws.cycleTime.toString(),
      manpower: ws.manpower.toString(),
      description: ws.description ?? "",
      notes: ws.notes ?? "",
    });
    setEditingId(ws.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("請輸入工站名稱"); return; }
    if (!form.cycleTime || parseFloat(form.cycleTime) <= 0) { toast.error("請輸入有效的工序時間"); return; }
    const payload = {
      name: form.name.trim(),
      sequenceOrder: parseInt(form.sequenceOrder) || 0,
      cycleTime: parseFloat(form.cycleTime),
      manpower: parseInt(form.manpower) || 1,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate({ productionLineId: lineId, ...payload });
    }
  };

  // CSV/Text parse
  const parseImportText = (text: string) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const result: any[] = [];
    lines.forEach((line, idx) => {
      // Support: name,cycleTime,manpower or name\tcycleTime\tmanpower
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        const name = parts[0]?.trim();
        const cycleTime = parseFloat(parts[1]?.trim() ?? "0");
        const manpower = parseInt(parts[2]?.trim() ?? "1") || 1;
        if (name && cycleTime > 0) {
          result.push({ name, cycleTime, manpower, sequenceOrder: idx + 1 });
        }
      }
    });
    return result;
  };

  const handleImportTextChange = (text: string) => {
    setImportText(text);
    setImportPreview(parseImportText(text));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      setImportPreview(parseImportText(text));
    };
    reader.readAsText(file);
  };

  const handleBulkImport = () => {
    if (importPreview.length === 0) { toast.error("沒有有效的資料可匯入"); return; }
    bulkImportMutation.mutate({ productionLineId: lineId, workstations: importPreview });
  };

  // ── 快速內嵌編輯輔助函數 ──────────────────────────────────────────────────
  const startInlineEdit = (ws: any) => {
    setInlineEdits(prev => ({
      ...prev,
      [ws.id]: { cycleTime: ws.cycleTime.toString(), manpower: ws.manpower.toString() }
    }));
  };

  const cancelInlineEdit = (wsId: number) => {
    setInlineEdits(prev => { const n = { ...prev }; delete n[wsId]; return n; });
  };

  const saveInlineEdit = async (wsId: number) => {
    const edit = inlineEdits[wsId];
    if (!edit) return;
    const ct = parseFloat(edit.cycleTime);
    const mp = parseInt(edit.manpower);
    if (isNaN(ct) || ct <= 0) { toast.error("請輸入有效的工序時間"); return; }
    if (isNaN(mp) || mp < 1) { toast.error("請輸入有效的人員配置"); return; }
    setSavingInline(prev => ({ ...prev, [wsId]: true }));
    try {
      await updateMutation.mutateAsync({ id: wsId, cycleTime: ct, manpower: mp });
      cancelInlineEdit(wsId);
      toast.success("工站資料已即時更新，平衡分析將自動重新計算");
    } catch {
      toast.error("更新失敗");
    } finally {
      setSavingInline(prev => { const n = { ...prev }; delete n[wsId]; return n; });
    }
  };

  const handleExport = () => {
    if (!workstations?.length) { toast.error("沒有工站資料可導出"); return; }
    const header = "工站名稱,工序時間(s),人員配置,順序,描述\n";
    const rows = workstations.map(w =>
      `${w.name},${w.cycleTime},${w.manpower},${w.sequenceOrder},${w.description ?? ""}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "workstations"}_工站資料.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下載");
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
          <h1 className="text-2xl font-bold tracking-tight">工站管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            導出 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            批量匯入
          </Button>
          <Button onClick={openCreate} className="glow-primary">
            <Plus className="h-4 w-4 mr-2" />
            新增工站
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      {workstations && workstations.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "工站總數", value: workstations.length, icon: Activity, color: "text-cyan-400" },
            {
              label: "總工序時間",
              value: `${workstations.reduce((s, w) => s + parseFloat(w.cycleTime.toString()), 0).toFixed(1)}s`,
              icon: Clock, color: "text-emerald-400"
            },
            {
              label: "總人員配置",
              value: `${workstations.reduce((s, w) => s + w.manpower, 0)} 人`,
              icon: Users, color: "text-violet-400"
            },
          ].map(stat => (
            <Card key={stat.label} className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Workstations Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : workstations?.length === 0 ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-12 text-center">
            <Activity className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">尚無工站資料</h3>
            <p className="text-muted-foreground text-sm mb-6">手動新增工站或批量匯入 CSV 檔案</p>
            <div className="flex items-center gap-3 justify-center">
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />新增工站</Button>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />批量匯入
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-12">順序</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">工站名稱</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
                    工序時間
                    <span className="ml-1 text-xs text-primary/60">(點擊即可編輯)</span>
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">人員配置</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">描述</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {workstations?.map((ws) => {
                  const isInlineEditing = !!inlineEdits[ws.id];
                  const isSaving = !!savingInline[ws.id];
                  const edit = inlineEdits[ws.id];
                  return (
                  <tr key={ws.id} className={`border-b border-border/50 transition-colors ${
                    isInlineEditing ? 'bg-primary/5 border-primary/20' : 'hover:bg-accent/20'
                  }`}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-muted-foreground">{ws.sequenceOrder}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{ws.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isInlineEditing ? (
                        <Input
                          type="number"
                          value={edit?.cycleTime ?? ''}
                          onChange={e => setInlineEdits(prev => ({ ...prev, [ws.id]: { ...prev[ws.id]!, cycleTime: e.target.value } }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(ws.id); if (e.key === 'Escape') cancelInlineEdit(ws.id); }}
                          className="h-7 w-24 text-right text-sm font-mono bg-input border-primary/50 ml-auto"
                          min="0" step="0.1" autoFocus
                        />
                      ) : (
                        <button
                          className="text-sm font-mono text-cyan-400 hover:text-cyan-300 hover:underline decoration-dashed cursor-pointer transition-colors"
                          onClick={() => startInlineEdit(ws)}
                          title="點擊即可快速編輯"
                        >
                          {parseFloat(ws.cycleTime.toString()).toFixed(1)}s
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isInlineEditing ? (
                        <Input
                          type="number"
                          value={edit?.manpower ?? ''}
                          onChange={e => setInlineEdits(prev => ({ ...prev, [ws.id]: { ...prev[ws.id]!, manpower: e.target.value } }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(ws.id); if (e.key === 'Escape') cancelInlineEdit(ws.id); }}
                          className="h-7 w-16 text-right text-sm bg-input border-primary/50 ml-auto"
                          min="1"
                        />
                      ) : (
                        <button
                          className="text-sm text-muted-foreground hover:text-foreground hover:underline decoration-dashed cursor-pointer transition-colors"
                          onClick={() => startInlineEdit(ws)}
                          title="點擊即可快速編輯"
                        >
                          {ws.manpower} 人
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{ws.description ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isInlineEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => saveInlineEdit(ws.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "儲存中...": "儲存"}
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            onClick={() => cancelInlineEdit(ws.id)}
                            disabled={isSaving}
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:text-violet-400"
                            onClick={() => setLocation(`/lines/${lineId}/actions?ws=${ws.id}`)}
                            title="動作分析"
                          >
                            <Activity className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:text-primary"
                            onClick={() => openEdit(ws)}
                            title="完整編輯"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                            onClick={() => setDeleteId(ws.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯工站" : "新增工站"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>工站名稱 <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="例：焊接站 / 組裝站"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>順序編號</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={form.sequenceOrder}
                  onChange={e => setForm(f => ({ ...f, sequenceOrder: e.target.value }))}
                  className="bg-input border-border"
                  min="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>工序時間（秒）<span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="例：45.5"
                  value={form.cycleTime}
                  onChange={e => setForm(f => ({ ...f, cycleTime: e.target.value }))}
                  className="bg-input border-border"
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>人員配置（人）</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={form.manpower}
                  onChange={e => setForm(f => ({ ...f, manpower: e.target.value }))}
                  className="bg-input border-border"
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述說明</Label>
              <Textarea
                placeholder="工站的操作內容或注意事項..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Input
                placeholder="其他備註..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showImport} onOpenChange={(o) => { if (!o) { setShowImport(false); setImportText(""); setImportPreview([]); } }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>批量匯入工站資料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">格式說明</p>
              <p>每行一個工站，格式：<code className="text-primary">工站名稱, 工序時間(秒), 人員配置</code></p>
              <p className="mt-1 text-xs">例：焊接站, 45.5, 2</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>上傳 CSV 檔案</Label>
              </div>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>或直接貼上資料</Label>
              <Textarea
                placeholder={"焊接站, 45.5, 2\n組裝站, 38.0, 1\n測試站, 52.0, 1"}
                value={importText}
                onChange={e => handleImportTextChange(e.target.value)}
                className="bg-input border-border font-mono text-sm resize-none"
                rows={6}
              />
            </div>
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-emerald-400">預覽（{importPreview.length} 筆資料）</Label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-muted-foreground">工站名稱</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground">工序時間</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground">人員</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5">{row.name}</td>
                          <td className="px-3 py-1.5 text-right text-cyan-400 font-mono">{row.cycleTime}s</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">{row.manpower}人</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setImportText(""); setImportPreview([]); }}>取消</Button>
            <Button
              onClick={handleBulkImport}
              disabled={importPreview.length === 0 || bulkImportMutation.isPending}
            >
              匯入 {importPreview.length > 0 ? `(${importPreview.length} 筆)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>確認刪除工站</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">刪除此工站將同時刪除所有相關動作步驟，此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

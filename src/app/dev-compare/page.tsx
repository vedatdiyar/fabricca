"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listLogsAction,
  compareLogsAction,
  deleteLogAction,
  clearAllLogsAction,
  type LogMetadata,
} from "./actions";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  RotateCw,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface DiffLine {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface ValueDiff3Way {
  path: string;
  val1: unknown;
  val2: unknown;
  val3: unknown;
  type: "changed" | "added" | "removed" | "order_diff";
}

interface CompareDataResult {
  log1: Record<string, unknown>;
  log2: Record<string, unknown>;
  log3: Record<string, unknown> | null;
  report: {
    isIdentical: boolean;
    varianceCategory: "A" | "B" | "C" | "D";
    categoryName: string;
    categoryExplanation: string;
    diffs: {
      promptDiffCount12: number;
      promptDiffCount23: number;
      promptDiffCount13: number;
      payloadDiffs: ValueDiff3Way[];
      thesisMatrixDiffs: ValueDiff3Way[];
    };
  };
  promptDiffLines: DiffLine[];
  promptDiffLines23: DiffLine[];
  promptDiffLines13: DiffLine[];
}

export default function DevComparePage() {
  const [logs, setLogs] = useState<LogMetadata[]>([]);
  const [hash1, setHash1] = useState<string>("");
  const [hash2, setHash2] = useState<string>("");
  const [hash3, setHash3] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [compareData, setCompareData] = useState<CompareDataResult | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<
    "prompt" | "payload" | "matrix" | "raw"
  >("prompt");
  const [promptPair, setPromptPair] = useState<"12" | "23" | "13">("12");

  // Load the initial logs asynchronously
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      try {
        const data = await listLogsAction();
        if (!active) return;
        setLogs(data);

        // Auto-select the top logs if available
        if (data.length >= 3) {
          setHash1(data[0].id);
          setHash2(data[1].id);
          setHash3(data[2].id);
        } else if (data.length === 2) {
          setHash1(data[0].id);
          setHash2(data[1].id);
        } else if (data.length === 1) {
          setHash1(data[0].id);
        }
      } catch {
        toast.error("Loglar yüklenirken hata oluştu.");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchLogs();
    return () => {
      active = false;
    };
  }, []);

  const handleCompare = () => {
    if (!hash1 || !hash2) {
      toast.error("Lütfen karşılaştırmak için en az iki adet çağrı seçin.");
      return;
    }
    if (hash1 === hash2 || (hash3 && (hash3 === hash1 || hash3 === hash2))) {
      toast.error("Lütfen birbirinden farklı çağrılar seçin.");
      return;
    }

    startTransition(async () => {
      const res = await compareLogsAction(hash1, hash2, hash3 || null);
      if ("error" in res) {
        toast.error(res.error || "Karşılaştırma sırasında hata oluştu.");
      } else {
        setCompareData(res as CompareDataResult);
        setPromptPair("12");
        toast.success("Çağrılar başarıyla analiz edildi.");
      }
    });
  };

  const handleAutoMatchAndCompare = (sourceId: string) => {
    const selectedLog = logs.find((l) => l.id === sourceId);
    if (!selectedLog) return;

    // Prioritize logs with the same hash (exact same input)
    let counterparts = logs.filter(
      (l) => l.hash === selectedLog.hash && l.id !== selectedLog.id,
    );

    // Fallback: match by stage name
    if (counterparts.length === 0) {
      counterparts = logs.filter(
        (l) => l.stage === selectedLog.stage && l.id !== selectedLog.id,
      );
    }

    if (counterparts.length === 0) {
      setHash1(selectedLog.id);
      setHash2("");
      setHash3("");
      toast.info(
        "Bu çağrı için karşılaştırılabilecek başka bir çağrı bulunamadı.",
      );
      return;
    }

    const id2 = counterparts[0].id;
    const id3 = counterparts[1]?.id || null;

    setHash1(selectedLog.id);
    setHash2(id2);
    setHash3(id3 || "");

    startTransition(async () => {
      const res = await compareLogsAction(selectedLog.id, id2, id3);
      if ("error" in res) {
        toast.error(res.error || "Karşılaştırma sırasında hata oluştu.");
      } else {
        setCompareData(res as CompareDataResult);
        setPromptPair("12");
        if (id3) {
          toast.success(
            `"${selectedLog.stage}" aşaması 3 çalışma boyunca otomatik eşleştirilerek analiz edildi.`,
          );
        } else {
          toast.success(
            `"${selectedLog.stage}" aşaması önceki çalışmayla otomatik eşleştirilerek analiz edildi.`,
          );
        }
      }
    });
  };

  const handleClearAll = async () => {
    if (!confirm("Tüm LLM girdi loglarını silmek istediğinize emin misiniz?"))
      return;
    const res = await clearAllLogsAction();
    if ("error" in res) {
      toast.error(res.error || "Hata oluştu.");
    } else {
      toast.success("Tüm loglar temizlendi.");
      setLogs([]);
      setHash1("");
      setHash2("");
      setHash3("");
      setCompareData(null);
    }
  };

  const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await deleteLogAction(id);
    if ("error" in res) {
      toast.error(res.error || "Silinirken hata oluştu.");
    } else {
      toast.success("Log silindi.");
      if (hash1 === id) setHash1("");
      if (hash2 === id) setHash2("");
      if (hash3 === id) setHash3("");

      // Reload logs silently
      try {
        const data = await listLogsAction();
        setLogs(data);
      } catch {
        // ignore
      }
    }
  };

  const getBadgeColor = (category: string) => {
    switch (category) {
      case "A":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "B":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "C":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "D":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleTimeString("tr-TR") + " " + d.toLocaleDateString("tr-TR")
      );
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans relative selection:bg-indigo-500 selection:text-white">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
              🔍 LLM İstek Karşılaştırma & Hata Analiz Paneli
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Aynı veya farklı çalışmalarda LLM girdi prompt, payload ve tez
              matrisi farklılıklarını detaylı olarak inceleyin.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const data = await listLogsAction();
                  setLogs(data);
                  toast.success(
                    `Toplam ${data.length} LLM çağrı logu yüklendi.`,
                  );
                } catch {
                  toast.error("Loglar yüklenirken hata oluştu.");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-sm font-semibold transition-all duration-200 disabled:opacity-50"
            >
              <RotateCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Yenile
            </button>
            <button
              onClick={handleClearAll}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-950/60 border border-red-900/30 hover:border-red-900/50 text-red-400 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Tümünü Temizle
            </button>
          </div>
        </div>

        {/* Dashboard Selection Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar / Logs list */}
          <div className="lg:col-span-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-4 max-h-[580px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                LLM İstek Kayıtları ({logs.length})
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Log bulunamadı. Lütfen onboarding adımlarında LLM çağrısı
                  tetikleyin.
                </div>
              ) : (
                logs.map((log) => {
                  const isSelected1 = hash1 === log.id;
                  const isSelected2 = hash2 === log.id;
                  const isSelected3 = hash3 === log.id;
                  return (
                    <div
                      key={log.id}
                      className={`group relative flex flex-col p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                        isSelected1
                          ? "bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-950/20"
                          : isSelected2
                            ? "bg-purple-950/30 border-purple-500/50 shadow-md shadow-purple-950/20"
                            : isSelected3
                              ? "bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/20"
                              : "bg-slate-900/30 border-slate-800/50 hover:bg-slate-850 hover:border-slate-700"
                      }`}
                      onClick={() => handleAutoMatchAndCompare(log.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded">
                          {log.hash.substring(0, 8)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-slate-200 mt-2 truncate">
                        {log.thesisTitle || "Tez Başlığı Belirtilmemiş"}
                      </span>

                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] font-semibold text-indigo-400 truncate max-w-[120px]">
                          {log.modelName}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded">
                          {log.stage}
                        </span>
                      </div>

                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDeleteLog(log.id, e)}
                          className="p-1 hover:bg-red-950/30 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Logu Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Selector indicators */}
                      {isSelected1 && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-md" />
                      )}
                      {isSelected2 && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-r-md" />
                      )}
                      {isSelected3 && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-md" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Interactive Comparator Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Compare Configuration Box */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-indigo-400" />
                Karşılaştırılacak LLM Çağrılarını Seçin (Maks 3 Çağrı)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    1. LLM Çağrısı (Hedef / Referans)
                  </label>
                  <select
                    value={hash1}
                    onChange={(e) => setHash1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Seçiniz...</option>
                    {logs.map((log) => (
                      <option
                        key={log.id}
                        value={log.id}
                        disabled={log.id === hash2 || log.id === hash3}
                      >
                        [{log.hash.substring(0, 8)}] - {log.stage} (
                        {log.modelName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    2. LLM Çağrısı (Karşılaştırılacak)
                  </label>
                  <select
                    value={hash2}
                    onChange={(e) => setHash2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Seçiniz...</option>
                    {logs.map((log) => (
                      <option
                        key={log.id}
                        value={log.id}
                        disabled={log.id === hash1 || log.id === hash3}
                      >
                        [{log.hash.substring(0, 8)}] - {log.stage} (
                        {log.modelName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    3. LLM Çağrısı (Opsiyonel)
                  </label>
                  <select
                    value={hash3}
                    onChange={(e) => setHash3(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Seçiniz (Opsiyonel)...</option>
                    {logs.map((log) => (
                      <option
                        key={log.id}
                        value={log.id}
                        disabled={log.id === hash1 || log.id === hash2}
                      >
                        [{log.hash.substring(0, 8)}] - {log.stage} (
                        {log.modelName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCompare}
                disabled={!hash1 || !hash2 || loading || isPending}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4" />
                    Seçilen İstekleri Karşılaştır
                  </>
                )}
              </button>
            </div>

            {/* Comparison Diagnostic Result Card */}
            {compareData && (
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800/80 bg-slate-900/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-400">
                        ANALİZ SONUCU:
                      </span>
                      {compareData.report.isIdentical ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Girdiler Birebir Aynı (Identical)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Girdiler Farklı (NOT Identical)
                        </span>
                      )}
                    </div>

                    <h4 className="text-xl font-black text-slate-100 flex items-center gap-2">
                      Hata Kategorisi:
                      <span
                        className={`px-2 py-0.5 rounded text-base border font-mono ${getBadgeColor(compareData.report.varianceCategory)}`}
                      >
                        {compareData.report.varianceCategory}){" "}
                        {compareData.report.categoryName}
                      </span>
                    </h4>
                  </div>

                  <div className="text-xs font-bold text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col gap-1 min-w-[200px]">
                    <div>Fark Hacmi:</div>
                    <div className="text-slate-300 font-mono text-[10px] space-y-0.5">
                      <div className="flex justify-between gap-4">
                        <span>Prompt Farkı (1-2 / 2-3 / 1-3):</span>
                        <span className="text-indigo-400 font-bold">
                          {compareData.report.diffs.promptDiffCount12} /{" "}
                          {compareData.report.diffs.promptDiffCount23} /{" "}
                          {compareData.report.diffs.promptDiffCount13} satır
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Payload Değişikliği:</span>
                        <span className="text-purple-400 font-bold">
                          {compareData.report.diffs.payloadDiffs.length} alan
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Tez Matrisi Değişikliği:</span>
                        <span className="text-amber-400 font-bold">
                          {compareData.report.diffs.thesisMatrixDiffs.length}{" "}
                          alan
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-950/40 text-sm text-slate-300 border-b border-slate-800/50">
                  <p className="font-semibold text-slate-200">🔍 Açıklama:</p>
                  <p className="mt-1 text-slate-400">
                    {compareData.report.categoryExplanation}
                  </p>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-800 bg-slate-900/30 flex">
                  <button
                    onClick={() => setActiveTab("prompt")}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                      activeTab === "prompt"
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                    }`}
                  >
                    📝 Prompt Farkları (
                    {compareData.report.diffs.promptDiffCount12 +
                      compareData.report.diffs.promptDiffCount23 +
                      compareData.report.diffs.promptDiffCount13}
                    )
                  </button>
                  <button
                    onClick={() => setActiveTab("payload")}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                      activeTab === "payload"
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                    }`}
                  >
                    🛠️ Payload Diffs (
                    {compareData.report.diffs.payloadDiffs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("matrix")}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                      activeTab === "matrix"
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                    }`}
                  >
                    💼 Tez Matrisi Diffs (
                    {compareData.report.diffs.thesisMatrixDiffs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("raw")}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                      activeTab === "raw"
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                    }`}
                  >
                    👁️ Ham Loglar (JSON)
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="p-6 min-h-[300px]">
                  {/* Tab 1: Prompt Diff */}
                  {activeTab === "prompt" && (
                    <div className="space-y-4">
                      {compareData.log3 && (
                        <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg max-w-md">
                          <button
                            onClick={() => setPromptPair("12")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                              promptPair === "12"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Çalışma 1 vs 2
                          </button>
                          <button
                            onClick={() => setPromptPair("23")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                              promptPair === "23"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Çalışma 2 vs 3
                          </button>
                          <button
                            onClick={() => setPromptPair("13")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                              promptPair === "13"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Çalışma 1 vs 3
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
                        <span>Sol Sütun: Silinen / Değişen Girdi</span>
                        <span>Sağ Sütun: Eklenen / Yeni Girdi</span>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto font-mono text-xs leading-relaxed p-4 space-y-0.5 custom-scrollbar">
                        {(promptPair === "12"
                          ? compareData.promptDiffLines
                          : promptPair === "23"
                            ? compareData.promptDiffLines23
                            : compareData.promptDiffLines13
                        ).map((line: DiffLine, idx: number) => {
                          let bgColor = "text-slate-400";
                          let prefix = " ";
                          if (line.added) {
                            bgColor =
                              "bg-green-500/10 text-green-400 px-1 border-l-2 border-green-500";
                            prefix = "+";
                          } else if (line.removed) {
                            bgColor =
                              "bg-red-500/10 text-red-400 line-through px-1 border-l-2 border-red-500";
                            prefix = "-";
                          }
                          return (
                            <div
                              key={idx}
                              className={`${bgColor} py-0.5 whitespace-pre-wrap break-all`}
                            >
                              <span className="select-none opacity-40 mr-3 inline-block w-4 text-center">
                                {prefix}
                              </span>
                              {line.value || " "}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Payload Diff */}
                  {activeTab === "payload" && (
                    <div className="space-y-4">
                      {compareData.report.diffs.payloadDiffs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          JSON payload konfigürasyonlarında (model, temperature,
                          seed, schema vb.) hiçbir fark yoktur.
                        </div>
                      ) : (
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                                <th className="p-3">Girdi Alanı (JSON Path)</th>
                                <th className="p-3">Tür</th>
                                <th className="p-3 text-red-400">Çalışma 1</th>
                                <th className="p-3 text-indigo-400">
                                  Çalışma 2
                                </th>
                                {compareData.log3 && (
                                  <th className="p-3 text-emerald-400">
                                    Çalışma 3
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {compareData.report.diffs.payloadDiffs.map(
                                (d: ValueDiff3Way, idx: number) => (
                                  <tr
                                    key={idx}
                                    className="border-b border-slate-800/50 hover:bg-slate-900/30"
                                  >
                                    <td className="p-3 font-mono text-indigo-400 font-semibold">
                                      {d.path || "(root)"}
                                    </td>
                                    <td className="p-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          d.type === "changed"
                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            : d.type === "order_diff"
                                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                              : d.type === "added"
                                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        }`}
                                      >
                                        {d.type === "order_diff"
                                          ? "Sıralama Farkı"
                                          : d.type === "changed"
                                            ? "Değişti"
                                            : d.type === "added"
                                              ? "Eklendi"
                                              : "Silindi"}
                                      </span>
                                    </td>
                                    <td className="p-3 font-mono text-slate-400 whitespace-pre-wrap break-all max-w-[200px]">
                                      {d.val1 === undefined ? (
                                        <span className="italic text-slate-650">
                                          Yok
                                        </span>
                                      ) : (
                                        JSON.stringify(d.val1, null, 1)
                                      )}
                                    </td>
                                    <td className="p-3 font-mono text-slate-200 whitespace-pre-wrap break-all max-w-[200px]">
                                      {d.val2 === undefined ? (
                                        <span className="italic text-slate-650">
                                          Yok
                                        </span>
                                      ) : (
                                        JSON.stringify(d.val2, null, 1)
                                      )}
                                    </td>
                                    {compareData.log3 && (
                                      <td className="p-3 font-mono text-emerald-200 whitespace-pre-wrap break-all max-w-[200px]">
                                        {d.val3 === undefined ? (
                                          <span className="italic text-slate-650">
                                            Yok
                                          </span>
                                        ) : (
                                          JSON.stringify(d.val3, null, 1)
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Thesis Matrix Diff */}
                  {activeTab === "matrix" && (
                    <div className="space-y-4">
                      {compareData.report.diffs.thesisMatrixDiffs.length ===
                      0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          Karşılaştırılan çalışmalarda kullanılan kaynak tez
                          matrisi alanları tamamen aynıdır.
                        </div>
                      ) : (
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                                <th className="p-3">Matris Alanı</th>
                                <th className="p-3 text-red-400">
                                  Çalışma 1 Değeri
                                </th>
                                <th className="p-3 text-indigo-400">
                                  Çalışma 2 Değeri
                                </th>
                                {compareData.log3 && (
                                  <th className="p-3 text-emerald-400">
                                    Çalışma 3 Değeri
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {compareData.report.diffs.thesisMatrixDiffs.map(
                                (d: ValueDiff3Way, idx: number) => (
                                  <tr
                                    key={idx}
                                    className="border-b border-slate-800/50 hover:bg-slate-900/30"
                                  >
                                    <td className="p-3 font-bold text-amber-400">
                                      {d.path}
                                    </td>
                                    <td className="p-3 text-slate-400 whitespace-pre-wrap max-w-[300px]">
                                      {d.val1 === undefined ? (
                                        <span className="italic text-slate-650">
                                          Boş
                                        </span>
                                      ) : (
                                        String(d.val1)
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-200 whitespace-pre-wrap max-w-[300px]">
                                      {d.val2 === undefined ? (
                                        <span className="italic text-slate-650">
                                          Boş
                                        </span>
                                      ) : (
                                        String(d.val2)
                                      )}
                                    </td>
                                    {compareData.log3 && (
                                      <td className="p-3 text-emerald-200 whitespace-pre-wrap max-w-[300px]">
                                        {d.val3 === undefined ? (
                                          <span className="italic text-slate-650">
                                            Boş
                                          </span>
                                        ) : (
                                          String(d.val3)
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Raw Logs side by side */}
                  {activeTab === "raw" && (
                    <div
                      className={
                        compareData.log3
                          ? "grid grid-cols-1 md:grid-cols-3 gap-4"
                          : "grid grid-cols-1 md:grid-cols-2 gap-4"
                      }
                    >
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-indigo-400">
                          Çağrı 1 (Referans) Raw JSON
                        </h5>
                        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[10px] font-mono leading-normal max-h-[400px] overflow-y-auto custom-scrollbar text-slate-400 whitespace-pre-wrap break-all">
                          {JSON.stringify(compareData.log1, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-purple-400">
                          Çağrı 2 (Karşılaştırılan) Raw JSON
                        </h5>
                        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[10px] font-mono leading-normal max-h-[400px] overflow-y-auto custom-scrollbar text-slate-400 whitespace-pre-wrap break-all">
                          {JSON.stringify(compareData.log2, null, 2)}
                        </pre>
                      </div>
                      {compareData.log3 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-emerald-400">
                            Çağrı 3 (Karşılaştırılan) Raw JSON
                          </h5>
                          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[10px] font-mono leading-normal max-h-[400px] overflow-y-auto custom-scrollbar text-slate-400 whitespace-pre-wrap break-all">
                            {JSON.stringify(compareData.log3, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

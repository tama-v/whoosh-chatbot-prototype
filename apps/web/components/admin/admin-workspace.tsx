"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  FileText,
  Filter,
  Layers,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Mic,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Volume2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORY_META, PRIORITY_META, STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type {
  Analytics,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  KnowledgeDocument,
  RetrievalTestResponse,
} from "@/lib/types";
import {
  CategoryBadge,
  CategoryIcon,
  ComplaintDetail,
  StatusBadge,
} from "@/components/complaints/complaint-ui";

type Feedback = { type: "success" | "error"; text: string };

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  submitted_to_demo_system: "#961826",
  under_review: "#c58a3e",
  resolved: "#4f7a5c",
  closed: "#b9a8a0",
};

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(5);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <div className="ui-card-flat p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        {hint && <span className="rounded-full bg-cream px-1.5 py-0.5 text-[13px] font-bold text-muted/70">{hint}</span>}
      </div>
      <p className="mt-2.5 text-[24px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-1 text-[13px] font-semibold text-muted">{label}</p>
    </div>
  );
}

export function AdminWorkspace() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [retrievalLanguage, setRetrievalLanguage] = useState<"id" | "en">("id");
  const [retrievalResult, setRetrievalResult] = useState<RetrievalTestResponse | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [refreshingEmbeddings, setRefreshingEmbeddings] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.analytics();
      setAnalytics(data);
      setAnalyticsError(null);
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : "Gagal memuat analytics.");
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    try {
      const data = await api.adminComplaints();
      setComplaints(data.items);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal memuat daftar laporan.",
      });
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await api.documents();
      setDocuments(data.items);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal memuat knowledge base.",
      });
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
    void loadComplaints();
    void loadDocuments();
  }, [loadAnalytics, loadComplaints, loadDocuments]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();
    return complaints.filter((complaint) => {
      if (statusFilter && complaint.status !== statusFilter) return false;
      if (categoryFilter && complaint.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        complaint.ticket_number.toLowerCase().includes(query) ||
        complaint.description.toLowerCase().includes(query) ||
        (complaint.station ?? "").toLowerCase().includes(query)
      );
    });
  }, [complaints, search, statusFilter, categoryFilter]);

  const selectedComplaint = complaints.find((complaint) => complaint.id === selectedId) ?? null;

  const updateStatus = async (complaint: Complaint, status: ComplaintStatus) => {
    if (status === complaint.status) return;
    setUpdatingId(complaint.id);
    try {
      const updated = await api.updateComplaint(complaint.id, status);
      setComplaints((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFeedback({
        type: "success",
        text: `${updated.ticket_number} diperbarui ke status “${STATUS_META[updated.status].label}”.`,
      });
      void loadAnalytics();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Status gagal diperbarui.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const uploadDocument = async () => {
    if (!documentFile) {
      setFeedback({ type: "error", text: "Pilih file PDF, TXT, atau Markdown terlebih dahulu." });
      return;
    }
    setUploading(true);
    try {
      const created = await api.uploadDocument(documentFile, documentTitle.trim() || undefined);
      setDocuments((prev) => [created, ...prev.filter((document) => document.id !== created.id)]);
      setDocumentFile(null);
      setDocumentTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFeedback({
        type: "success",
        text: `“${created.title}” diunggah dan diindeks menjadi ${created.chunk_count} chunk.`,
      });
      void loadAnalytics();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Upload dokumen gagal.",
      });
    } finally {
      setUploading(false);
    }
  };

  const reindexDocument = async (document: KnowledgeDocument) => {
    setReindexingId(document.id);
    try {
      const result = await api.reindexDocument(document.id);
      setDocuments((prev) =>
        prev.map((item) => (item.id === result.document.id ? result.document : item)),
      );
      setFeedback({
        type: "success",
        text: `“${result.document.title}” diindeks ulang menjadi ${result.chunks} chunk.`,
      });
      void loadAnalytics();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Reindex gagal.",
      });
    } finally {
      setReindexingId(null);
    }
  };

  const deleteDocument = async (document: KnowledgeDocument) => {
    const confirmed = window.confirm(
      `Hapus “${document.title}” dari knowledge base demo? Chunk dokumen ini juga akan dihapus.`,
    );
    if (!confirmed) return;
    setDeletingId(document.id);
    try {
      await api.deleteDocument(document.id);
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
      setFeedback({ type: "success", text: `“${document.title}” dihapus dari knowledge base demo.` });
      void loadAnalytics();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Dokumen gagal dihapus.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const runRetrievalTest = async () => {
    const query = retrievalQuery.trim();
    if (!query) {
      setFeedback({ type: "error", text: "Tulis pertanyaan uji terlebih dahulu." });
      return;
    }
    setRetrievalLoading(true);
    try {
      const result = await api.retrievalTest(query, retrievalLanguage);
      setRetrievalResult(result);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Uji retrieval gagal.",
      });
    } finally {
      setRetrievalLoading(false);
    }
  };

  const refreshEmbeddings = async () => {
    setRefreshingEmbeddings(true);
    try {
      const result = await api.refreshEmbeddings();
      setFeedback({
        type: "success",
        text: `Embedding diperbarui: ${result.chunks} chunk · model ${result.model ?? "lokal"}.`,
      });
      void loadAnalytics();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Refresh embedding gagal.",
      });
    } finally {
      setRefreshingEmbeddings(false);
    }
  };

  const overview = analytics?.overview;
  const retrieval = analytics?.retrieval;
  const voice = analytics?.voice;
  const embeddingModels = Object.entries(retrieval?.embedding_models ?? {});
  const trendMax = Math.max(1, ...(analytics?.trend.map((item) => item.count) ?? [1]));
  const categoryCounts = new Map(
    analytics?.complaints_by_category.map((item) => [item.category, item.count]) ?? [],
  );
  const categoryMax = Math.max(1, ...Array.from(categoryCounts.values()));
  const totalComplaints = overview?.complaints ?? 0;

  const donutSegments = (() => {
    if (!analytics || totalComplaints === 0) return null;
    let cursor = 0;
    return analytics.complaints_by_status
      .map((item) => {
        const start = cursor;
        cursor += (item.count / totalComplaints) * 360;
        return `${STATUS_COLORS[item.status]} ${start}deg ${cursor}deg`;
      })
      .join(", ");
  })();

  const sentiment = analytics?.sentiment;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-maroon/75">
            Dashboard admin
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[30px]">
            Operasional Whoosh AI
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Ringkasan percakapan, keluhan, dan knowledge base dari database lokal. Halaman ini
            dilindungi sesi admin yang tersimpan di server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="demo-badge">
            <Sparkles className="h-3 w-3" />
            Data demo SQLite
          </span>
          <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-muted">
            {analytics?.ai_mode === "qwen" ? "Qwen aktif" : "Mode demo AI"}
          </span>
          <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-muted">
            Sesi admin
          </span>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-[13px] font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 opacity-60 transition hover:opacity-100"
            aria-label="Tutup notifikasi"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {analyticsError && !analytics && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          {analyticsError} Pastikan backend FastAPI berjalan di port 8000.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Percakapan"
          value={overview?.conversations ?? "—"}
          icon={MessageCircle}
          tone="bg-blush text-maroon"
        />
        <StatCard
          label="Pesan"
          value={overview?.messages ?? "—"}
          icon={MessagesSquare}
          tone="bg-cream text-maroon"
        />
        <StatCard
          label="Keluhan terbuka"
          value={overview?.open_complaints ?? "—"}
          hint="terbuka"
          icon={ClipboardList}
          tone="bg-blush text-maroon"
        />
        <StatCard
          label="Keluhan selesai"
          value={overview?.resolved_complaints ?? "—"}
          hint="selesai"
          icon={CheckCircle2}
          tone="bg-cream text-maroon"
        />
        <StatCard
          label="Dokumen"
          value={overview?.documents ?? "—"}
          icon={FileText}
          tone="bg-blush text-maroon"
        />
        <StatCard
          label="Chunk terindeks"
          value={overview?.chunks ?? "—"}
          icon={Layers}
          tone="bg-cream text-maroon"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="ui-card p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                <Activity className="h-3.5 w-3.5 text-maroon" />
                Percakapan 7 hari terakhir
              </p>
              <p className="mt-0.5 text-[13px] text-muted">Jumlah percakapan baru per hari.</p>
            </div>
            <span className="rounded-full bg-cream px-2 py-0.5 text-[13px] font-medium text-muted/70">
              demo
            </span>
          </div>

          <div className="mt-4 flex h-[170px] items-end gap-1.5 sm:gap-2.5">
            {(analytics?.trend ?? Array.from({ length: 7 }, (_, index) => ({ date: `----${index}`, count: 0 }))).map(
              (item) => {
                const isToday = analytics?.trend[analytics.trend.length - 1]?.date === item.date;
                return (
                  <div key={item.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[13px] font-bold text-muted">{item.count}</span>
                    <div
                      className={`w-full max-w-[36px] rounded-t-lg transition-all ${
                        isToday
                          ? "bg-gradient-to-t from-maroon to-maroon"
                          : "bg-gradient-to-t from-[#e9d5cd] to-[#f3e4dc]"
                      }`}
                      style={{ height: `${Math.max(4, (item.count / trendMax) * 104)}px` }}
                      title={`${item.date}: ${item.count} percakapan`}
                    />
                    <span className={`text-[13px] font-semibold ${isToday ? "text-maroon" : "text-muted/60"}`}>
                      {item.date.startsWith("----") ? "—" : shortDate(item.date)}
                    </span>
                  </div>
                );
              },
            )}
          </div>
          <p className="mt-2 border-t border-line/60 pt-2 text-[13px] text-muted/60">
            {analytics?.notice ?? "Memuat data demo…"}
          </p>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">Distribusi status</p>
            <span className="text-[13px] font-semibold text-muted/60">{totalComplaints} laporan</span>
          </div>
          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-5">
            <div className="relative mx-auto h-[104px] w-[104px] shrink-0 rounded-full xl:mx-0"
              style={{
                background: donutSegments
                  ? `conic-gradient(${donutSegments})`
                  : "conic-gradient(#eadfd7 0deg 360deg)",
              }}
            >
              <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-paper">
                <span className="text-[22px] font-extrabold leading-none text-ink">{totalComplaints}</span>
                <span className="mt-0.5 text-[13px] font-medium text-muted/60">total</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {STATUS_ORDER.map((status) => {
                const count = analytics?.complaints_by_status.find((item) => item.status === status)?.count ?? 0;
                return (
                  <div key={status} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_COLORS[status] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted">{STATUS_META[status].label}</span>
                    <span className="font-bold text-ink">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-cream/60 px-2.5 py-2 text-[13px] leading-relaxed text-muted/70">
            Status hanya berubah melalui dashboard ini. Tidak ada sinkronisasi ke sistem operator.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="ui-card p-4 sm:p-5">
          <p className="text-[13px] font-bold text-ink">Keluhan per kategori</p>
          <div className="mt-3 space-y-2.5">
            {(Object.keys(CATEGORY_META) as ComplaintCategory[]).map((category) => {
              const count = categoryCounts.get(category) ?? 0;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CategoryIcon category={category} className="h-3 w-3 text-maroon/70" />
                    <span className="flex-1 truncate text-muted">{CATEGORY_META[category].label}</span>
                    <span className="font-bold text-ink">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full bg-maroon"
                      style={{ width: `${(count / categoryMax) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">Sentimen pesan pengguna</p>
            <span className="rounded-full bg-cream px-2 py-0.5 text-[13px] font-medium text-muted/60">
              rule-based
            </span>
          </div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-cream">
            <div className="bg-[#4f7a5c]" style={{ width: `${sentiment?.positive ?? 0}%` }} />
            <div className="bg-[#e6d3c7]" style={{ width: `${sentiment?.neutral ?? 0}%` }} />
            <div className="bg-[#a33a45]" style={{ width: `${sentiment?.negative ?? 0}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Positif", value: sentiment?.positive ?? 0, color: "bg-[#4f7a5c]" },
              { label: "Netral", value: sentiment?.neutral ?? 0, color: "bg-[#e6d3c7]" },
              { label: "Negatif", value: sentiment?.negative ?? 0, color: "bg-[#a33a45]" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line/60 bg-cream/35 px-2 py-2">
                <p className="flex items-center gap-1 text-[13px] font-semibold text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                  {item.label}
                </p>
                <p className="mt-1 text-[16px] font-extrabold text-ink">{item.value}%</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted/65">
            Dihitung dari kata kunci sederhana pada pesan pengguna di database demo, bukan model
            sentimen produksi.
          </p>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">Pertanyaan populer</p>
            <span className="text-[13px] font-semibold text-muted/60">top 6</span>
          </div>
          <div className="mt-3 space-y-2">
            {(analytics?.top_questions?.length ?? 0) === 0 ? (
              <p className="rounded-xl bg-cream/50 px-3 py-6 text-center text-[13px] text-muted">
                Belum ada pertanyaan pengguna pada database demo.
              </p>
            ) : (
              analytics?.top_questions.map((item, index) => (
                <div key={`${item.content}-${index}`} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blush text-[13px] font-extrabold text-maroon">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink/80">{item.content}</p>
                  <span className="shrink-0 rounded-full bg-cream px-1.5 py-0.5 text-[13px] font-bold text-muted">
                    {item.count}×
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200/60 bg-warn px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900">
              <AlertTriangle className="h-3 w-3" />
              Jawaban “belum ditemukan”
            </p>
            <span className="text-[13.5px] font-extrabold text-amber-900">{analytics?.unanswered ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/75 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blush text-maroon">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink">Manajemen keluhan</p>
              <p className="text-[13px] text-muted">
                {filteredComplaints.length} dari {complaints.length} laporan demo
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/50" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari tiket, deskripsi, stasiun…"
                className="field h-9 w-full py-0 pl-8 text-[13px] sm:w-60"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-[138px] shrink-0">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted/50" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter status"
                  className="field h-9 w-full appearance-none py-0 pl-7 pr-6 text-[13px]"
                >
                  <option value="">Semua status</option>
                  {STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter kategori"
                className="field h-9 w-[148px] shrink-0 py-0 text-[13px]"
              >
                <option value="">Semua kategori</option>
                {Object.entries(CATEGORY_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {complaintsLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-xl bg-cream/70" />
            ))}
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream text-muted/60">
              <Search className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13.5px] font-bold text-ink">Tidak ada laporan yang cocok</p>
            <p className="mt-1 text-[13px] text-muted">Ubah kata kunci atau filter status/kategori.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line/70 bg-cream/45 text-[13px] font-medium text-muted/60">
                  <th className="px-4 py-2.5 font-bold">Laporan</th>
                  <th className="px-3 py-2.5 font-bold">Kategori</th>
                  <th className="px-3 py-2.5 font-bold">Prioritas</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Dibuat</th>
                  <th className="px-3 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b border-line/50 transition hover:bg-cream/35 last:border-0">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="font-mono text-[13px] font-bold tracking-wide text-maroon">
                        {complaint.ticket_number}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">
                        {complaint.description}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <CategoryBadge category={complaint.category} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[13px] font-bold ${PRIORITY_META[complaint.priority].badge}`}>
                        {PRIORITY_META[complaint.priority].label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={complaint.status}
                          onChange={(event) =>
                            void updateStatus(complaint, event.target.value as ComplaintStatus)
                          }
                          disabled={updatingId === complaint.id}
                          aria-label={`Ubah status ${complaint.ticket_number}`}
                          className="h-7 rounded-lg border border-line bg-paper px-2 text-[13px] font-medium text-ink outline-none transition-colors hover:border-line-strong focus:border-maroon/40"
                        >
                          {STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_META[status].label}
                            </option>
                          ))}
                        </select>
                        {updatingId === complaint.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-maroon" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[13px] font-semibold text-ink/70">
                        {formatRelativeTime(complaint.created_at)}
                      </p>
                      <p className="text-[13px] text-muted/55">
                        {formatDateTime(complaint.created_at)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(complaint.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-paper px-2.5 text-[13px] font-medium text-muted transition-colors hover:border-maroon/30 hover:text-maroon"
                      >
                        <Eye className="h-3 w-3" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line/60 bg-cream/25 px-4 py-2.5 text-[13px] leading-relaxed text-muted/65">
          Update status di sini hanya mengubah database demo. Tidak ada tiket, email, atau
          notifikasi yang dikirim ke sistem operator.
        </p>
      </div>

      <div id="retrieval" className="ui-card scroll-mt-24 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line/75 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blush text-maroon">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink">RAG &amp; suara</p>
              <p className="text-[13px] text-muted">
                {retrieval?.strategy ?? "hybrid retrieval"} · embedding + ASR/TTS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshEmbeddings()}
            disabled={refreshingEmbeddings}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-paper px-2.5 text-[13px] font-medium text-muted transition-colors hover:border-maroon/25 hover:text-maroon disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${refreshingEmbeddings ? "animate-spin" : ""}`} />
            {refreshingEmbeddings ? "Menghitung…" : "Refresh embedding"}
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.15fr] lg:divide-x lg:divide-line/60">
          <div className="space-y-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line/70 bg-cream/30 p-2.5">
                <p className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                  <Database className="h-3 w-3 text-maroon/70" />
                  Chunk vektor
                </p>
                <p className="mt-1 text-[17px] font-extrabold text-ink">
                  {retrieval ? `${retrieval.embedded}/${retrieval.chunks}` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-line/70 bg-cream/30 p-2.5">
                <p className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                  <Search className="h-3 w-3 text-maroon/70" />
                  FTS5 BM25
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
                  {retrieval?.fts_rows ?? "—"}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      retrieval?.fts_available
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {retrieval?.fts_available ? "aktif" : "off"}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line/70 bg-paper px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-muted">Model embedding</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {embeddingModels.length ? (
                  embeddingModels.map(([model, count]) => (
                    <span
                      key={model}
                      className="rounded-full bg-blush px-2 py-0.5 font-mono text-[12px] font-semibold text-maroon"
                    >
                      {model} · {count}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-muted/70">Belum ada vektor tersimpan.</span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted/65">
                Bahasa dokumen:{" "}
                {Object.entries(retrieval?.documents_by_language ?? {})
                  .map(([key, count]) => `${key} ×${count}`)
                  .join(" · ") || "—"}
              </p>
            </div>

            <div className="rounded-xl border border-line/70 bg-paper px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-muted">Suara</p>
                <span className="rounded-full bg-cream px-2 py-0.5 text-[11.5px] font-bold text-muted/80">
                  ID: {voice?.languages.id ?? "—"} · EN: {voice?.languages.en ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink/80">
                <Mic className="h-3 w-3 shrink-0 text-maroon/70" />
                <span className="font-semibold">ASR</span>
                <span className="min-w-0 truncate">
                  {voice?.asr_configured
                    ? voice.asr_model
                    : "belum aktif — endpoint mengembalikan 503"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink/80">
                <Volume2 className="h-3 w-3 shrink-0 text-maroon/70" />
                <span className="font-semibold">TTS</span>
                <span className="min-w-0 truncate">
                  {voice?.tts_configured
                    ? voice.tts_model
                    : voice?.demo_tts
                      ? "Windows SAPI demo (Inggris)"
                      : "suara browser"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-line/60 p-4 sm:p-5 lg:border-t-0">
            <p className="text-[13px] font-extrabold text-ink">Uji retrieval</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted/70">
              Jalankan pertanyaan uji dan lihat hit, skor, serta gerbang answerability sebelum
              jawaban dikirim ke Heiser.
            </p>
            <div className="mt-2.5 space-y-2">
              <input
                value={retrievalQuery}
                onChange={(event) => setRetrievalQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runRetrievalTest();
                }}
                placeholder={retrievalLanguage === "id" ? "Mis. aturan bagasi kabin" : "E.g. cabin baggage rules"}
                className="field h-10 w-full py-0 text-[13px]"
                maxLength={240}
              />
              <div className="flex items-center gap-2">
                <select
                  value={retrievalLanguage}
                  onChange={(event) => setRetrievalLanguage(event.target.value as "id" | "en")}
                  className="field h-10 w-20 shrink-0 py-0 text-[13px]"
                  aria-label="Bahasa uji retrieval"
                >
                  <option value="id">ID</option>
                  <option value="en">EN</option>
                </select>
                <button
                  type="button"
                  onClick={() => void runRetrievalTest()}
                  disabled={retrievalLoading || !retrievalQuery.trim()}
                  className="ui-btn-primary h-10 flex-1 px-4 text-[13px] sm:flex-none"
                >
                  {retrievalLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Uji
                </button>
              </div>
            </div>

            {retrievalResult ? (
              <div className="mt-3 rounded-xl border border-line/70 bg-cream/25 p-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      retrievalResult.trace.answerable
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-warn text-amber-900"
                    }`}
                  >
                    {retrievalResult.trace.answerable ? "Basis cukup" : "Belum ditemukan"}
                  </span>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-muted">
                    coverage {retrievalResult.trace.best_coverage ?? 0}
                  </span>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-muted">
                    {retrievalResult.hits.length} hit
                  </span>
                  {retrievalResult.trace.embedding?.model && (
                    <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[11.5px] text-muted">
                      {retrievalResult.trace.embedding.model}
                    </span>
                  )}
                </div>
                {retrievalResult.trace.tokens?.length ? (
                  <p className="mt-1.5 truncate text-[12px] text-muted/60">
                    Token: {retrievalResult.trace.tokens.slice(0, 10).join(", ")}
                  </p>
                ) : null}
                {retrievalResult.hits.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {retrievalResult.hits.slice(0, 3).map((hit, index) => (
                      <li
                        key={`${hit.document_id}-${index}`}
                        className="rounded-lg border border-line/60 bg-paper px-2.5 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-[12.5px] font-bold text-ink">
                            {hit.document_title}
                            {hit.section ? (
                              <span className="font-medium text-muted"> · {hit.section}</span>
                            ) : null}
                          </p>
                          <span className="shrink-0 font-mono text-[11.5px] text-maroon">
                            {hit.score.toFixed(3)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted/75">
                          {hit.preview}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted/70">
                    Tidak ada chunk yang lolos ambang bukti. Heiser akan menyatakan informasi belum
                    ditemukan dan tidak memberi sitasi.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line/70 px-3 py-4 text-center text-[12.5px] text-muted/60">
                Hasil uji muncul di sini. Tidak ada data yang dikirim ke sistem operator.
              </p>
            )}
          </div>
        </div>

        <p className="border-t border-line/60 bg-cream/25 px-4 py-2.5 text-[13px] leading-relaxed text-muted/65">
          Retrieval hybrid berjalan lokal: FTS5 BM25 + skor leksikal IDF + vektor hashed; embedding
          Qwen dipakai bila kunci backend tersedia. Skor tinggi bukan jaminan kebenaran.
        </p>
      </div>

      <div id="knowledge" className="ui-card scroll-mt-24 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line/75 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blush text-maroon">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink">Knowledge base</p>
              <p className="text-[13px] text-muted">
                {documents.length} dokumen · chunking + hybrid retrieval (FTS5 + vektor)
              </p>
            </div>
          </div>
          <span className="rounded-full bg-warn px-2.5 py-1 text-[13px] font-semibold text-amber-900">
            Dokumen contoh, bukan kebijakan resmi operator
          </span>
        </div>

        <div className="border-b border-line/70 bg-cream/25 p-4 sm:p-5">
          <div className="rounded-2xl border border-dashed border-line-strong bg-paper/70 p-3.5">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                className="sr-only"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-left transition hover:border-maroon/30 hover:bg-blush/30"
              >
                <UploadCloud className="h-4 w-4 shrink-0 text-maroon" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink/80">
                  {documentFile ? documentFile.name : "Pilih PDF, TXT, atau Markdown (maks 5 MB)"}
                </span>
                {documentFile && (
                  <span className="shrink-0 text-[13px] font-medium text-muted">
                    {Math.max(1, Math.round(documentFile.size / 1024))} KB
                  </span>
                )}
              </button>
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="Judul dokumen (opsional)"
                className="field h-10 py-0 text-[13px] lg:w-56"
                maxLength={160}
              />
              <button
                type="button"
                onClick={() => void uploadDocument()}
                disabled={uploading || !documentFile}
                className="ui-btn-primary h-10 shrink-0 px-4 text-[13px]"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                {uploading ? "Mengindeks…" : "Upload & indeks"}
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted/60">
              Teks diekstrak dari file, dipecah per bagian, lalu disimpan ke SQLite demo. File tidak
              diunggah ke layanan pihak ketiga.
            </p>
          </div>
        </div>

        {documentsLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-xl bg-cream/70" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            Belum ada dokumen. Upload file pertama untuk mengisi knowledge base demo.
          </p>
        ) : (
          <div className="divide-y divide-line/55">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-2 px-4 py-3 transition hover:bg-cream/25 sm:flex-row sm:items-center sm:px-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-maroon">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{document.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-muted/70">
                    <span className="rounded bg-cream px-1.5 py-0.5 font-bold uppercase text-muted/70">
                      {document.file_type}
                    </span>
                    <span>{document.chunk_count} chunk</span>
                    <span className="text-muted/35">·</span>
                    <span>{document.uploaded_by}</span>
                    <span className="text-muted/35">·</span>
                    <span>{formatRelativeTime(document.updated_at)}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[13px] font-bold ${
                        document.status === "processed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {document.status}
                    </span>
                    {document.demo && (
                      <span className="rounded-full bg-warn px-1.5 py-0.5 text-[13px] font-bold text-amber-900">
                        demo
                      </span>
                    )}
                  </div>
                  {document.error_message && (
                    <p className="mt-1 text-[13px] text-rose-600">{document.error_message}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void reindexDocument(document)}
                    disabled={reindexingId === document.id}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-paper px-2.5 text-[13px] font-medium text-muted transition-colors hover:border-maroon/20 hover:text-maroon disabled:opacity-60"
                    title="Indeks ulang dokumen"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${reindexingId === document.id ? "animate-spin" : ""}`}
                    />
                    Reindex
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteDocument(document)}
                    disabled={deletingId === document.id}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-paper text-muted transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                    title="Hapus dokumen"
                    aria-label={`Hapus ${document.title}`}
                  >
                    {deletingId === document.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="border-t border-line/60 bg-cream/25 px-4 py-2.5 text-[13px] leading-relaxed text-muted/65">
          Upload dokumen tidak membuat AI otomatis “tahu segalanya”. Jawaban tetap dibatasi isi
          knowledge base dan bisa salah.
        </p>
      </div>

      {selectedComplaint && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Tutup detail laporan"
            onClick={() => setSelectedId(null)}
            className="absolute inset-0 bg-wine/30 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detail laporan ${selectedComplaint.ticket_number}`}
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-[460px] flex-col border-l border-line bg-paper shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
              <div>
                <p className="text-[13px] font-medium text-muted/70">
                  Detail laporan
                </p>
                <p className="mt-0.5 font-mono text-[13px] font-extrabold tracking-wide text-ink">
                  {selectedComplaint.ticket_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-blush hover:text-maroon"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scroll-area flex-1 overflow-y-auto px-5 py-4">
              <ComplaintDetail complaint={selectedComplaint} />

              <div className="mt-4 rounded-2xl border border-line bg-paper p-3.5">
                <label htmlFor="admin-status" className="label">
                  Ubah status demo
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="admin-status"
                    value={selectedComplaint.status}
                    onChange={(event) =>
                      void updateStatus(selectedComplaint, event.target.value as ComplaintStatus)
                    }
                    disabled={updatingId === selectedComplaint.id}
                    className="field h-10 py-0 text-[13px]"
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status].label}
                      </option>
                    ))}
                  </select>
                  {updatingId === selectedComplaint.id && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-maroon" />
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted/60">
                  Status saat ini: <StatusBadge status={selectedComplaint.status} />
                </p>
              </div>
            </div>

            <div className="border-t border-line/80 px-5 py-3">
              <button type="button" onClick={() => setSelectedId(null)} className="ui-btn-primary w-full">
                Selesai meninjau
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

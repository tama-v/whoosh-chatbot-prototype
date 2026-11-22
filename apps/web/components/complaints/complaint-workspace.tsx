"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORY_META, PRIORITY_META, STATUS_META } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import type {
  Complaint,
  ComplaintAnalysis,
  ComplaintCategory,
  Priority,
} from "@/lib/types";
import {
  CategoryBadge,
  CategoryIcon,
  ComplaintDetail,
  PriorityBadge,
  StatusBadge,
} from "@/components/complaints/complaint-ui";

const STEPS = ["Ceritakan", "Tinjau analisis", "Kirim"];

export function ComplaintWorkspace() {
  const [description, setDescription] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [station, setStation] = useState("");
  const [trainInfo, setTrainInfo] = useState("");
  const [contact, setContact] = useState("");
  const [analysis, setAnalysis] = useState<ComplaintAnalysis | null>(null);
  const [category, setCategory] = useState<ComplaintCategory>("other");
  const [priority, setPriority] = useState<Priority>("medium");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Complaint | null>(null);
  const [copied, setCopied] = useState(false);

  const [reports, setReports] = useState<Complaint[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [ticketQuery, setTicketQuery] = useState("");
  const [tracked, setTracked] = useState<Complaint | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data = await api.complaints();
      setReports(data.items);
      setReportsError(null);
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : "Gagal memuat laporan.");
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshReports();
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [refreshReports]);

  const step = created ? 3 : analysis ? 2 : 1;

  const dynamicMissing =
    analysis?.missing_fields.filter((field) => {
      if (field === "stasiun" && station.trim()) return false;
      if (field.includes("tanggal") && travelDate) return false;
      if (field.includes("kereta") && trainInfo.trim()) return false;
      if (field.includes("kontak") && contact.trim()) return false;
      return true;
    }) ?? [];

  const handleDescription = (value: string) => {
    setDescription(value);
    if (analysis) setAnalysis(null);
    if (error) setError(null);
  };

  const handleAnalyze = async () => {
    if (description.trim().length < 5) {
      setError("Ceritakan kendalamu minimal 5 karakter agar bisa dianalisis.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const result = await api.analyzeComplaint({
        description: description.trim(),
        travel_date: travelDate || null,
        station: station.trim() || null,
        train_info: trainInfo.trim() || null,
      });
      setAnalysis(result);
      setCategory(result.category);
      setPriority(result.priority);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analisis gagal. Coba lagi.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!analysis) return;
    if (!contact.trim()) {
      setError("Isi kontak yang dapat dihubungi supaya laporan bisa ditindaklanjuti.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createComplaint({
        category,
        description: description.trim(),
        travel_date: travelDate || null,
        station: station.trim() || null,
        train_info: trainInfo.trim() || null,
        contact: contact.trim(),
        priority,
        summary: analysis.summary,
      });
      setCreated(result);
      setTracked(result);
      setTicketQuery(result.ticket_number);
      await refreshReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laporan gagal dikirim. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrack = async () => {
    const query = ticketQuery.trim();
    if (!query) {
      setTrackError("Masukkan nomor tiket laporan terlebih dahulu.");
      return;
    }
    setTracking(true);
    setTrackError(null);
    try {
      const result = await api.complaintByTicket(query.toUpperCase());
      setTracked(result);
    } catch (err) {
      setTracked(null);
      setTrackError(
        err instanceof Error ? err.message : "Laporan tidak ditemukan pada sistem demo.",
      );
    } finally {
      setTracking(false);
    }
  };

  const trackFromList = (complaint: Complaint) => {
    setTracked(complaint);
    setTicketQuery(complaint.ticket_number);
    setTrackError(null);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const startNew = () => {
    setCreated(null);
    setAnalysis(null);
    setDescription("");
    setTravelDate("");
    setStation("");
    setTrainInfo("");
    setContact("");
    setCategory("other");
    setPriority("medium");
    setError(null);
  };

  const copyTicket = async (ticket: string) => {
    try {
      await navigator.clipboard.writeText(ticket);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-maroon/75">
            Asisten laporan
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[30px]">
            Ceritakan kendalanya, Heiser bantu rapikan.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            Kategori dan prioritas dianalisis otomatis dari deskripsi. Semua laporan tersimpan di
            sistem simulasi internal aplikasi.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="demo-badge">
            <Sparkles className="h-3 w-3" />
            Simulasi internal
          </span>
          <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-muted">
            Bukan tiket resmi operator
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="ui-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line/75 bg-paper px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blush text-maroon">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-ink">Laporan baru</p>
                  <p className="text-[13px] text-muted">Langkah {step} dari 3</p>
                </div>
              </div>
              <ol className="flex items-center gap-1.5">
                {STEPS.map((label, index) => {
                  const number = index + 1;
                  const complete = number < step;
                  const active = number === step;
                  return (
                    <li key={label} className="flex items-center gap-1.5">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[13px] font-extrabold ${
                          complete
                            ? "bg-maroon text-white"
                            : active
                              ? "bg-maroon text-white"
                              : "bg-cream text-muted/60"
                        }`}
                      >
                        {complete ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : number}
                      </span>
                      <span
                        className={`text-[13px] font-bold ${
                          active ? "text-ink" : "text-muted/60"
                        } ${index === STEPS.length - 1 ? "" : "hidden sm:inline"}`}
                      >
                        {label}
                      </span>
                      {index < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-line" />}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="p-4 sm:p-5">
              {created ? (
                <div className="animate-fade-up">
                  <div className="flex flex-col items-center py-4 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush text-maroon">
                      <CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />
                    </span>
                    <h2 className="mt-4 text-[20px] font-extrabold tracking-[-0.03em] text-ink">
                      Laporan tercatat di sistem simulasi
                    </h2>
                    <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
                      Simpan nomor laporan berikut untuk melacak status. Laporan ini tidak dikirim
                      ke sistem operator.
                    </p>

                    <div className="mt-4 flex w-full max-w-sm items-center gap-2 rounded-2xl border border-dashed border-maroon/25 bg-blush/40 px-4 py-3">
                      <span className="min-w-0 flex-1 truncate text-left font-mono text-[16px] font-extrabold tracking-wider text-maroon">
                        {created.ticket_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyTicket(created.ticket_number)}
                        className="flex h-8 shrink-0 items-center gap-1 rounded-xl bg-paper px-2.5 text-[13px] font-bold text-maroon shadow-sm transition hover:bg-blush"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Tersalin" : "Salin"}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <CategoryBadge category={created.category} />
                      <StatusBadge status={created.status} />
                      <PriorityBadge priority={created.priority} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                    <button type="button" onClick={startNew} className="ui-btn-secondary">
                      Buat laporan baru
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById("tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="ui-btn-primary"
                    >
                      Lacak status laporan
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-4 text-center text-[13px] leading-relaxed text-muted/60">
                    Alur penanganan pada aplikasi ini adalah demo. Untuk keadaan darurat, hubungi
                    petugas di stasiun.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (analysis) void handleSubmit();
                    else void handleAnalyze();
                  }}
                >
                  <label htmlFor="complaint-description" className="label">
                    Apa yang terjadi?
                  </label>
                  <textarea
                    id="complaint-description"
                    value={description}
                    onChange={(event) => handleDescription(event.target.value)}
                    rows={5}
                    placeholder="Contoh: Tas hitam saya tertinggal di rak bagasi kereta Whoosh dari Halim ke Padalarang sekitar pukul 14.00."
                    className="field mt-1.5 min-h-[120px] resize-y text-[13.5px] leading-relaxed"
                    maxLength={4000}
                  />
                  <div className="mt-1 flex items-center justify-between text-[13px] text-muted/60">
                    <span>Semakin detail, semakin mudah dirapikan.</span>
                    <span>{description.length}/4000</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="travel-date" className="label">
                        Tanggal perjalanan
                      </label>
                      <input
                        id="travel-date"
                        type="date"
                        value={travelDate}
                        onChange={(event) => setTravelDate(event.target.value)}
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="station" className="label">
                        Stasiun
                      </label>
                      <input
                        id="station"
                        value={station}
                        onChange={(event) => setStation(event.target.value)}
                        placeholder="Halim"
                        className="field mt-1.5"
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <label htmlFor="train-info" className="label">
                        Nomor / nama kereta
                      </label>
                      <input
                        id="train-info"
                        value={trainInfo}
                        onChange={(event) => setTrainInfo(event.target.value)}
                        placeholder="Whoosh 1205"
                        className="field mt-1.5"
                        maxLength={120}
                      />
                    </div>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  {!analysis ? (
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[13px] leading-relaxed text-muted/60">
                        Data hanya disimpan pada backend demo SQLite.
                      </p>
                      <button type="submit" disabled={analyzing} className="ui-btn-primary">
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {analyzing ? "Menganalisis…" : "Analisis dengan Heiser"}
                      </button>
                    </div>
                  ) : (
                    <div className="animate-fade-up mt-4 rounded-2xl border border-maroon/15 bg-[linear-gradient(150deg,#fdf7f3_0%,#f8ebe7_100%)] p-3.5 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                          <Sparkles className="h-3.5 w-3.5 text-maroon" />
                          Analisis Heiser
                          <span className="rounded-full bg-paper px-1.5 py-0.5 text-[13px] font-medium text-maroon/70">
                            demo
                          </span>
                        </p>
                        <PriorityBadge priority={priority} />
                      </div>

                      <div className="mt-2.5 flex items-start gap-2">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-maroon shadow-sm">
                          <CategoryIcon category={category} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-extrabold text-ink">
                            {CATEGORY_META[category].label}
                          </p>
                          <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed text-muted">
                            {analysis.summary}
                          </p>
                        </div>
                      </div>

                      {dynamicMissing.length > 0 && (
                        <div className="mt-2.5 rounded-xl border border-amber-200/60 bg-paper/70 px-2.5 py-2">
                          <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-900">
                            <AlertCircle className="h-3 w-3" />
                            Informasi yang bisa melengkapi laporan
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {dynamicMissing.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-amber-200/70 bg-warn px-2 py-0.5 text-[13px] font-semibold text-amber-900/80"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label htmlFor="review-category" className="label">
                            Kategori
                          </label>
                          <select
                            id="review-category"
                            value={category}
                            onChange={(event) => setCategory(event.target.value as ComplaintCategory)}
                            className="field mt-1.5"
                          >
                            {Object.entries(CATEGORY_META).map(([value, meta]) => (
                              <option key={value} value={value}>
                                {meta.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="review-priority" className="label">
                            Prioritas
                          </label>
                          <select
                            id="review-priority"
                            value={priority}
                            onChange={(event) => setPriority(event.target.value as Priority)}
                            className="field mt-1.5"
                          >
                            {Object.entries(PRIORITY_META).map(([value, meta]) => (
                              <option key={value} value={value}>
                                {meta.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <label htmlFor="contact" className="label">
                          Kontak yang dapat dihubungi
                        </label>
                        <input
                          id="contact"
                          value={contact}
                          onChange={(event) => setContact(event.target.value)}
                          placeholder="Email atau nomor telepon"
                          className="field mt-1.5"
                          maxLength={160}
                        />
                      </div>

                      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setAnalysis(null);
                            setError(null);
                          }}
                          className="text-[13px] font-bold text-muted transition hover:text-maroon"
                        >
                          Ubah deskripsi / analisis ulang
                        </button>
                        <button type="submit" disabled={submitting} className="ui-btn-primary">
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {submitting ? "Mengirim…" : "Kirim laporan simulasi"}
                        </button>
                      </div>

                      <p className="mt-2.5 text-[13px] leading-relaxed text-muted/60">
                        {analysis.notice}
                      </p>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>

          <div className="ui-card-flat flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn text-amber-800">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-ink">Bagaimana laporan ini diproses?</p>
                <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-muted">
                  Di aplikasi demo, status hanya berubah lewat dashboard admin. Tidak ada tim operator
                  yang menerima laporan ini.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-[13px] font-semibold text-muted">
              Simulasi end-to-end
            </span>
          </div>
        </div>

        <aside className="space-y-4">
          <div id="tracker" className="ui-card scroll-mt-24 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-muted/65">
                  Lacak laporan
                </p>
                <h2 className="mt-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-ink">
                  Cek status laporan
                </h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blush text-maroon">
                <Search className="h-4 w-4" />
              </span>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleTrack();
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={ticketQuery}
                onChange={(event) => setTicketQuery(event.target.value.toUpperCase())}
                placeholder="WH-XXXXXX-XXXXXX"
                aria-label="Nomor laporan"
                className="field min-w-0 flex-1 font-mono text-[13px]"
              />
              <button
                type="submit"
                disabled={tracking}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line-strong/80 bg-paper px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-maroon/30 hover:bg-cream disabled:opacity-60"
              >
                {tracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5 text-maroon" />}
                Cari
              </button>
            </form>

            {trackError && (
              <p role="alert" className="mt-2.5 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
                {trackError}
              </p>
            )}

            {tracked ? (
              <div className="mt-4 animate-fade-up">
                <ComplaintDetail complaint={tracked} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-line-strong/70 bg-cream/35 p-5 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-paper text-maroon shadow-sm">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <p className="mt-2.5 text-[13.5px] font-bold text-ink">Belum ada laporan dipilih</p>
                <p className="mx-auto mt-1 max-w-[240px] text-[13px] leading-relaxed text-muted">
                  Masukkan nomor laporan, atau pilih salah satu laporan terbaru di bawah.
                </p>
                {reports.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {reports.slice(0, 3).map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => trackFromList(report)}
                        className="rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[13px] font-semibold text-muted transition hover:border-maroon/30 hover:text-maroon"
                      >
                        {report.ticket_number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ui-card-flat overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
              <p className="text-[13px] font-bold text-ink">Laporan terbaru</p>
              <span className="rounded-full bg-cream px-2 py-0.5 text-[13px] font-bold text-muted">
                {reports.length}
              </span>
            </div>

            {reportsLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-xl bg-cream/70" />
                ))}
              </div>
            ) : reportsError ? (
              <p className="p-4 text-[13px] leading-relaxed text-rose-700">{reportsError}</p>
            ) : reports.length === 0 ? (
              <p className="p-4 text-[13px] leading-relaxed text-muted">
                Belum ada laporan pada sistem demo. Buat laporan pertama lewat formulir.
              </p>
            ) : (
              <div className="scroll-area max-h-[360px] overflow-y-auto p-2">
                {reports.slice(0, 12).map((report) => {
                  const selected = tracked?.id === report.id;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => trackFromList(report)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                        selected
                          ? "border-line-strong bg-blush/60"
                          : "border-transparent hover:border-line/70 hover:bg-cream/60"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-maroon shadow-sm">
                        <CategoryIcon category={report.category} className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-bold tracking-wide text-ink">
                          {report.ticket_number}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[report.status].dot}`} />
                          {CATEGORY_META[report.category].short}
                          <span className="text-muted/40">·</span>
                          {formatRelativeTime(report.created_at)}
                        </p>
                      </div>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted/35" />
                    </button>
                  );
                })}
              </div>
            )}

            <p className="border-t border-line/70 px-4 py-2.5 text-[13px] leading-relaxed text-muted/60">
              Data contoh + laporan buatanmu di backend SQLite demo.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

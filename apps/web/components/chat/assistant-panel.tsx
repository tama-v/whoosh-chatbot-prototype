"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  FileText,
  Mic,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { HeiserMascot, type HeiserMode } from "@/components/heiser/heiser-mascot";
import type { KnowledgeDocument } from "@/lib/types";

export type VoiceUiState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

const STATE_COPY: Record<VoiceUiState, { title: string; body: string }> = {
  idle: { title: "Tanya soal perjalanan", body: "Boarding, bagasi, tiket, atau fasilitas stasiun." },
  listening: { title: "Mendengarkan…", body: "Tekan mikrofon lagi untuk berhenti." },
  transcribing: { title: "Menyusun transkrip…", body: "Periksa hasilnya sebelum dikirim." },
  thinking: { title: "Menelusuri sumber…", body: "Heiser sedang menyiapkan jawaban." },
  speaking: { title: "Sedang berbicara…", body: "Tekan stop untuk menghentikan audio." },
};

export function AssistantPanel({
  mode,
  voiceState,
  voiceMode,
  isListening,
  isSpeaking,
  onToggleVoiceMode,
  onToggleListening,
  onStopSpeaking,
  documents,
  aiMode,
  voiceLabel,
}: {
  mode: HeiserMode;
  voiceState: VoiceUiState;
  voiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onToggleVoiceMode: () => void;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  documents: KnowledgeDocument[];
  aiMode: "qwen" | "demo" | null;
  voiceLabel: string;
}) {
  const copy = STATE_COPY[voiceState];
  const active = voiceState !== "idle";

  return (
    <aside className="flex min-h-0 flex-col gap-3 xl:h-full xl:overflow-y-auto xl:pr-0.5">
      <div className="ui-card shrink-0 overflow-hidden">
        <div className="relative overflow-hidden bg-blush px-3.5 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4 xl:pb-6 xl:pt-5">
          <div className="pointer-events-none absolute left-1/2 top-[55%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-maroon/10 xl:h-64 xl:w-64" />

          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/70 bg-paper/85 px-2.5 py-1 text-[13px] font-medium text-ink">
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-maroon" : "bg-emerald-500"}`} />
              {aiMode === "qwen" ? "Qwen aktif" : "Mode demo"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleVoiceMode}
                aria-pressed={voiceMode}
                aria-label="Bacakan jawaban otomatis"
                className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[13px] font-medium transition-colors xl:hidden ${
                  voiceMode
                    ? "border-maroon bg-maroon text-white"
                    : "border-line bg-paper/80 text-muted"
                }`}
              >
                <Volume2 className="h-3 w-3" />
                Auto-baca
              </button>
              <span className="rounded-lg border border-line/60 bg-paper/60 px-2 py-0.5 text-[13px] font-medium text-muted">
                2D demo
              </span>
            </div>
          </div>

          <div className="relative mt-1 flex items-center gap-2 sm:gap-4 xl:flex-col xl:gap-0">
            <div className={`relative mx-auto w-[104px] shrink-0 transition-transform sm:w-[140px] xl:w-[225px] ${active ? "" : "animate-float"}`}>
              <HeiserMascot mode={mode} />
            </div>
            <div className="min-w-0 flex-1 xl:mt-1 xl:text-center">
              <p className="text-[13px] font-medium text-muted">Heiser</p>
              <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-ink sm:text-[18px]">{copy.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{copy.body}</p>

              {(voiceState === "listening" || voiceState === "speaking" || voiceState === "transcribing") && (
                <div className="mt-2.5 flex items-center gap-1 xl:justify-center">
                  {[12, 19, 26, 16, 22, 11, 18, 14].map((height, index) => (
                    <span
                      key={index}
                      className="wave-bar w-1 rounded-full bg-maroon/60"
                      style={{ height, animationDelay: `${index * 0.08}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden space-y-3 p-3.5 sm:p-4 xl:block xl:p-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-cream/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-maroon">
                <Volume2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">Bacakan jawaban</p>
                <p className="text-[13px] text-muted">Otomatis setelah menjawab</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={voiceMode}
              aria-label="Bacakan jawaban otomatis"
              onClick={onToggleVoiceMode}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${voiceMode ? "bg-maroon" : "bg-line-strong/70"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${
                  voiceMode ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isSpeaking ? onStopSpeaking : onToggleListening}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors ${
                isListening ? "voice-ring bg-maroon" : isSpeaking ? "bg-ink" : "bg-maroon hover:bg-wine"
              }`}
              aria-label={isListening ? "Berhenti mendengarkan" : isSpeaking ? "Hentikan audio" : "Mulai bicara"}
            >
              {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">
                {isListening ? "Mendengarkan suara…" : isSpeaking ? "Audio sedang diputar" : "Push-to-talk"}
              </p>
              <p className="truncate text-[13px] text-muted" title={voiceLabel}>
                {voiceLabel}
              </p>
            </div>
            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                className="rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium text-ink transition-colors hover:bg-blush"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ui-card-flat hidden shrink-0 p-4 xl:block">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <BookOpen className="h-3.5 w-3.5 text-maroon" />
            Knowledge base
          </p>
          <Link href="/admin#knowledge" className="text-[13px] font-medium text-maroon hover:underline">
            Kelola
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {(documents.length ? documents.slice(0, 3) : [{ id: "loading-1", title: "Memuat dokumen…", chunk_count: 0 }, { id: "loading-2", title: "Panduan boarding", chunk_count: 0 }, { id: "loading-3", title: "Ketentuan bagasi", chunk_count: 0 }]).map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-line/70 bg-cream/50 px-2.5 py-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-maroon/65" />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink/85">{doc.title}</p>
              <span className="shrink-0 text-[13px] text-muted/75">{doc.chunk_count || "—"} chunk</span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted/80">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-maroon" />
          Dokumen demo, bukan kebijakan resmi operator.
        </p>
      </div>

      <div className="ui-card-flat hidden shrink-0 p-3 xl:block">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/complaints"
            className="group rounded-xl border border-line/80 bg-cream/40 p-3 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-blush/50"
          >
            <ClipboardList className="h-4 w-4 text-maroon" />
            <p className="mt-2 text-[13px] font-semibold text-ink">Buat laporan</p>
            <p className="mt-0.5 text-[13px] text-muted">Terstruktur</p>
          </Link>
          <Link
            href="/complaints"
            className="group rounded-xl border border-line/80 bg-cream/40 p-3 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-blush/50"
          >
            <ArrowUpRight className="h-4 w-4 text-maroon" />
            <p className="mt-2 text-[13px] font-semibold text-ink">Lacak status</p>
            <p className="mt-0.5 text-[13px] text-muted">Simulasi</p>
          </Link>
        </div>
      </div>
    </aside>
  );
}

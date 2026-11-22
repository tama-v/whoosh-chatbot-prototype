"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { SpeechEngine } from "@/lib/voice";
import type { VoiceUiState } from "./assistant-panel";

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  voiceState,
  isListening,
  onToggleListening,
  onStopSpeaking,
  voiceSupported,
  speechEngine,
  onChangeSpeechEngine,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  voiceState: VoiceUiState;
  isListening: boolean;
  onToggleListening: () => void;
  onStopSpeaking: () => void;
  voiceSupported: boolean;
  speechEngine: SpeechEngine;
  onChangeSpeechEngine: (engine: SpeechEngine) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [value]);

  const submit = () => {
    if (disabled || !value.trim()) return;
    onSend();
  };

  return (
    <div className="border-t border-line/75 bg-paper px-3 pb-2.5 pt-2 sm:px-4 sm:pb-3">
      {voiceState !== "idle" && (
        <div
          className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium ${
            voiceState === "listening"
              ? "bg-blush text-maroon"
              : voiceState === "speaking"
                ? "bg-blush text-maroon"
                : "bg-cream text-muted"
          }`}
        >
          {voiceState === "listening" && (
            <>
              <span className="flex items-center gap-0.5">
                {[10, 16, 12, 18, 9].map((height, index) => (
                  <span
                    key={index}
                    className="wave-bar w-0.5 rounded-full bg-maroon"
                    style={{ height, animationDelay: `${index * 0.08}s` }}
                  />
                ))}
              </span>
              Mendengarkan… tekan mikrofon untuk berhenti
            </>
          )}
          {voiceState === "transcribing" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Menyusun transkrip…
            </>
          )}
          {voiceState === "thinking" && (
            <>
              <span className="flex items-center gap-1">
                <span className="typing-dot h-1 w-1 rounded-full bg-maroon/70" />
                <span className="typing-dot h-1 w-1 rounded-full bg-maroon/70" />
                <span className="typing-dot h-1 w-1 rounded-full bg-maroon/70" />
              </span>
              Heiser sedang berpikir…
            </>
          )}
          {voiceState === "speaking" && (
            <>
              <Volume2 className="h-3.5 w-3.5" />
              Membacakan jawaban
              <button
                type="button"
                onClick={onStopSpeaking}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1 text-[13px] font-medium text-maroon"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                Stop
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl border border-line bg-paper p-1.5 transition focus-within:border-maroon/35 focus-within:ring-4 focus-within:ring-maroon/10">
        <button
          type="button"
          onClick={onToggleListening}
          disabled={!voiceSupported}
          className={`relative mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isListening
              ? "voice-ring bg-maroon text-white"
              : voiceSupported
                ? "bg-blush text-maroon hover:bg-[#fae1e5]"
                : "cursor-not-allowed bg-cream text-muted/40"
          }`}
          aria-label={isListening ? "Berhenti merekam" : "Rekam pertanyaan dengan suara"}
          title={voiceSupported ? "Push-to-talk (ID/EN)" : "Browser tidak mendukung pengenalan suara"}
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={isListening ? "Mendengarkan suara kamu…" : "Tanya boarding, bagasi, tiket, atau fasilitas…"}
          className="max-h-[128px] min-h-[40px] flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted/60 disabled:opacity-70"
          aria-label="Tulis pertanyaan untuk Heiser"
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon text-white transition-colors hover:bg-wine disabled:bg-line disabled:text-muted/50"
          aria-label="Kirim pesan"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />}
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2">
        <p className="text-[12.5px] leading-relaxed text-muted/70">
          Heiser adalah AI demo dan bisa keliru. Verifikasi informasi resmi di kanal operator.
          <span className="hidden sm:inline"> · Enter untuk kirim</span>
        </p>
        <label className="flex shrink-0 items-center gap-1 rounded-lg border border-line/70 bg-paper px-1.5 py-0.5 text-[12.5px] font-medium text-muted transition-colors hover:border-maroon/25 hover:text-maroon">
          <Volume2 className="h-3 w-3 text-maroon/70" />
          <span className="sr-only">Sumber suara jawaban</span>
          <select
            value={speechEngine}
            onChange={(event) => onChangeSpeechEngine(event.target.value as SpeechEngine)}
            className="cursor-pointer bg-transparent pr-0.5 outline-none"
            aria-label="Sumber suara jawaban"
            title="Pilih sumber suara jawaban"
          >
            <option value="auto">Suara server</option>
            <option value="browser">Suara browser</option>
          </select>
        </label>
      </div>
    </div>
  );
}

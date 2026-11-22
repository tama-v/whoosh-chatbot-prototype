"use client";

import { useState } from "react";
import { Check, Copy, FileText, Quote, Square, Volume2 } from "lucide-react";
import { WhooshMark } from "@/components/whoosh-mark";
import { formatRelativeTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { AnswerText } from "./answer-text";

export function MessageBubble({
  message,
  isSpeaking,
  onPlay,
  onStop,
}: {
  message: ChatMessage;
  isSpeaking: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  if (message.role === "user") {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[86%] sm:max-w-[76%]">
          <div className="rounded-2xl rounded-br-md bg-maroon px-4 py-3 text-[14px] leading-relaxed text-white">
            {message.content}
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[13px] font-medium text-muted/80">
            <span>{formatRelativeTime(message.created_at) || "Sekarang"}</span>
            <span className="h-1 w-1 rounded-full bg-muted/40" />
            <span>{message.input_type === "voice" ? "Suara" : "Teks"}</span>
          </div>
        </div>
      </div>
    );
  }

  const streaming = message.streaming && !message.content;

  return (
    <div className="msg-in flex gap-2.5 sm:gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-blush">
        <WhooshMark className="h-5 w-5" />
      </span>
      <div className="min-w-0 max-w-[88%] sm:max-w-[82%]">
        <div className="rounded-2xl rounded-tl-md border border-line/85 bg-paper px-4 py-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">Heiser</span>
            <span className="rounded-md bg-blush px-1.5 py-0.5 text-[13px] font-semibold text-maroon">
              AI
            </span>
            {message.streaming && message.content && (
              <span className="flex items-center gap-1 text-[13px] font-medium text-muted">
                <span className="h-1 w-1 animate-pulse rounded-full bg-maroon" />
                menulis
              </span>
            )}
          </div>

          {streaming ? (
            <div className="flex h-6 items-center gap-1.5 px-0.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-maroon/70" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-maroon/70" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-maroon/70" />
              <span className="ml-1.5 text-[13px] font-medium text-muted">Heiser menelusuri sumber…</span>
            </div>
          ) : (
            <AnswerText content={message.content} />
          )}

          {message.streaming && message.content && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded-full bg-maroon align-middle" />
          )}

          {message.citations.length > 0 && (
            <details className="group mt-3.5 border-t border-line/70 pt-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-maroon/85 transition-colors hover:text-maroon">
                <Quote className="h-3 w-3" />
                Sumber ({message.citations.length})
                <span className="font-medium text-muted/70 group-open:hidden">— lihat</span>
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.citations.map((citation, index) => (
                  <span
                    key={`${citation.document_id}-${index}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-cream/70 px-2 py-1 text-[13px] font-medium text-muted"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-maroon/70" />
                    <span className="truncate">{citation.document_title}</span>
                    {citation.section && (
                      <>
                        <span className="text-muted/40">·</span>
                        <span className="truncate text-muted/80">{citation.section}</span>
                      </>
                    )}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1 pl-1">
          <button
            type="button"
            onClick={isSpeaking ? onStop : onPlay}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium transition-colors ${
              isSpeaking ? "text-maroon" : "text-muted hover:bg-blush hover:text-maroon"
            }`}
            aria-label={isSpeaking ? "Hentikan suara" : "Putar suara jawaban"}
          >
            {isSpeaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3 w-3" />}
            {isSpeaking ? "Hentikan" : "Putar suara"}
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-muted transition-colors hover:bg-blush hover:text-maroon"
            aria-label="Salin jawaban"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Tersalin" : "Salin"}
          </button>
          <span className="ml-auto text-[13px] font-medium text-muted/70">
            {formatRelativeTime(message.created_at) || "Sekarang"}
          </span>
        </div>
      </div>
    </div>
  );
}

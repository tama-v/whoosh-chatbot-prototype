"use client";

import { useEffect } from "react";
import { MessageSquare, Plus, X } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";

export function HistoryDrawer({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  loadingId,
}: {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (conversation: ConversationSummary) => void;
  onNewChat: () => void;
  loadingId: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Tutup riwayat"
        onClick={onClose}
        className="absolute inset-0 bg-wine/30 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Riwayat percakapan"
        className="absolute bottom-0 right-0 top-0 flex w-full max-w-[370px] flex-col border-l border-line bg-paper shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
          <div>
            <p className="text-[13px] font-medium text-muted">Arsip lokal</p>
            <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">Riwayat percakapan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-blush hover:text-maroon"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <button type="button" onClick={onNewChat} className="ui-btn-primary w-full">
            <Plus className="h-4 w-4" />
            Percakapan baru
          </button>
        </div>

        <div className="scroll-area mt-3 flex-1 overflow-y-auto px-3 pb-4">
          {conversations.length === 0 ? (
            <div className="mt-16 flex flex-col items-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blush text-maroon">
                <MessageSquare className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-ink">Belum ada riwayat</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Percakapanmu akan tersimpan agar bisa dibuka kembali kapan saja.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => {
                const active = conversation.id === activeId;
                const loading = conversation.id === loadingId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-line-strong bg-blush/70"
                        : "border-transparent hover:border-line/70 hover:bg-cream/70"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-maroon text-white" : "bg-paper text-maroon"}`}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{conversation.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted/85">
                          {conversation.last_message || "Belum ada pesan"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-muted/70">
                          <span>{formatRelativeTime(conversation.updated_at)}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-muted/50" />
                          <span>{conversation.message_count} pesan</span>
                          {loading && <span className="ml-auto text-maroon">memuat…</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-line/80 px-5 py-3">
          <p className="text-[13px] leading-relaxed text-muted/70">
            Riwayat tersimpan di akunmu dan bisa dibuka kembali kapan saja.
          </p>
        </div>
      </div>
    </div>
  );
}

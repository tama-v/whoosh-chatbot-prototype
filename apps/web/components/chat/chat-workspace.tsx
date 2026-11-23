"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Globe2,
  History,
  MessageSquareText,
  Plus,
  ServerOff,
  Sparkles,
} from "lucide-react";
import type { HeiserMode } from "@/components/heiser/heiser-mascot";
import { api, streamChat } from "@/lib/api";
import { SUGGESTED_PROMPTS } from "@/lib/constants";
import {
  createRecognition,
  getSpeechEngine,
  mediaRecorderSupported,
  setSpeechEngine as persistSpeechEngine,
  speakText,
  speechRecognitionSupported,
  startRecording,
  stopSpeaking,
  type RecordingController,
  type SpeechEngine,
} from "@/lib/voice";
import type {
  ChatMessage,
  Citation,
  ConversationSummary,
} from "@/lib/types";
import { AssistantPanel, type VoiceUiState } from "./assistant-panel";
import { Composer } from "./composer";
import { HistoryDrawer } from "./history-drawer";
import { MessageBubble } from "./message-bubble";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Halo, saya **Heiser**. Tanyakan boarding, bagasi, tiket, atau fasilitas stasiun.\n\nSetiap jawaban menyebut dokumen sumbernya. Bila bukti kurang, saya akan mengatakannya.",
  citations: [],
};

type RecognitionController = ReturnType<typeof createRecognition>;

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recorderSupported, setRecorderSupported] = useState(false);
  const [speechEngine, setSpeechEngine] = useState<SpeechEngine>("auto");
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [toast, setToast] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<RecognitionController>(null);
  const recorderRef = useRef<RecordingController | null>(null);
  const latestTranscriptRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingIdRef = useRef<string | null>(null);
  const voiceModeRef = useRef(false);
  const inputSourceRef = useRef<"text" | "voice">("text");
  const messageCountRef = useRef(1);
  const voiceActiveRef = useRef(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await api.conversations();
      setConversations(data.items);
    } catch {
      // Conversation history is non-critical for the current chat.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        if (!cancelled) setConnection("online");
      } catch {
        if (!cancelled) setConnection("offline");
      }
      try {
        const data = await api.conversations();
        if (!cancelled) setConversations(data.items);
      } catch {
        // handled by connection banner
      }
      if (!cancelled) {
        setVoiceSupported(speechRecognitionSupported());
        setRecorderSupported(mediaRecorderSupported());
        setSpeechEngine(getSpeechEngine());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    speakingIdRef.current = speakingMessageId;
  }, [speakingMessageId]);

  useEffect(() => {
    const previousCount = messageCountRef.current;
    const previousVoiceActive = voiceActiveRef.current;
    const voiceActive = isListening || isTranscribing || Boolean(speakingMessageId);
    messageCountRef.current = messages.length;
    voiceActiveRef.current = voiceActive;
    const grew = messages.length > previousCount;
    const voiceChanged = voiceActive !== previousVoiceActive;
    if (!grew && !isStreaming && !voiceChanged) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming, isTranscribing, isListening, speakingMessageId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recorderRef.current?.cancel();
      abortRef.current?.abort();
      stopSpeaking();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (transcribeTimerRef.current) clearTimeout(transcribeTimerRef.current);
    };
  }, []);

  const stopAudio = useCallback(() => {
    stopSpeaking();
    setSpeakingMessageId(null);
  }, []);

  const playText = useCallback(
    async (messageId: string, text: string) => {
      if (speakingIdRef.current === messageId) {
        stopAudio();
        return;
      }
      stopSpeaking();
      setSpeakingMessageId(messageId);
      const started = await speakText(
        text,
        language,
        {
          onEnd: () => {
            if (speakingIdRef.current === messageId) setSpeakingMessageId(null);
          },
          onError: (message) => {
            if (speakingIdRef.current === messageId) setSpeakingMessageId(null);
            showToast(message);
          },
        },
        speechEngine,
      );
      if (!started && speakingIdRef.current === messageId) setSpeakingMessageId(null);
    },
    [language, showToast, speechEngine, stopAudio],
  );

  const playMessage = (message: ChatMessage) => void playText(message.id, message.content);

  const changeSpeechEngine = (next: SpeechEngine) => {
    setSpeechEngine(next);
    persistSpeechEngine(next);
    stopAudio();
    showToast(
      next === "browser"
        ? "Jawaban dibacakan dengan suara browser."
        : "Jawaban dibacakan dengan suara standar; browser dipakai bila layanan tidak tersedia.",
    );
  };

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    recorderRef.current?.stop();
  }, []);

  const startRecorderListening = useCallback(async () => {
    if (isStreaming) {
      showToast("Tunggu jawaban Heiser selesai sebelum bicara lagi.");
      return;
    }
    stopAudio();
    setInput("");
    latestTranscriptRef.current = "";
    const recorder = await startRecording(
      (blob) => {
        recorderRef.current = null;
        setIsListening(false);
        setIsTranscribing(true);
        void api
          .transcribeAudio(blob, language)
          .then((result) => {
            const transcript = result.text.trim();
            if (transcript) {
              latestTranscriptRef.current = transcript;
              inputSourceRef.current = "voice";
              setInput(transcript);
            }
          })
          .catch((error) => {
            showToast(
              error instanceof Error
                ? error.message
                : "Transkripsi suara belum tersedia. Gunakan input teks.",
            );
          })
          .finally(() => setIsTranscribing(false));
      },
      (message) => {
        recorderRef.current = null;
        setIsListening(false);
        showToast(message);
      },
    );
    if (!recorder) return;
    recorderRef.current = recorder;
    setIsListening(true);
  }, [isStreaming, language, showToast, stopAudio]);

  const startListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    if (!voiceSupported && !recorderSupported) {
      showToast("Browser ini belum mendukung input suara. Gunakan input teks.");
      return;
    }
    if (isStreaming) {
      showToast("Tunggu jawaban Heiser selesai sebelum bicara lagi.");
      return;
    }
    stopAudio();
    if (!voiceSupported) {
      void startRecorderListening();
      return;
    }
    const recognition = createRecognition(language, {
      onTranscript: (finalText, interimText) => {
        if (finalText) {
          latestTranscriptRef.current = finalText;
          inputSourceRef.current = "voice";
          setInput(finalText);
        } else if (interimText) {
          latestTranscriptRef.current = interimText;
          inputSourceRef.current = "voice";
          setInput(interimText);
        }
      },
      onError: (message) => {
        showToast(message);
        setIsListening(false);
        setIsTranscribing(false);
        recognitionRef.current = null;
      },
      onEnd: () => {
        recognitionRef.current = null;
        setIsListening(false);
        if (latestTranscriptRef.current.trim()) {
          setIsTranscribing(true);
          if (transcribeTimerRef.current) clearTimeout(transcribeTimerRef.current);
          transcribeTimerRef.current = setTimeout(() => setIsTranscribing(false), 550);
        }
      },
    });
    if (!recognition) {
      showToast("Speech recognition tidak tersedia di browser ini.");
      return;
    }
    recognitionRef.current = recognition;
    latestTranscriptRef.current = "";
    setInput("");
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      showToast("Mikrofon tidak dapat dimulai. Periksa izin browser.");
    }
  }, [
    isListening,
    isStreaming,
    language,
    showToast,
    startRecorderListening,
    stopAudio,
    stopListening,
    recorderSupported,
    voiceSupported,
  ]);

  const toggleVoiceMode = () => {
    const next = !voiceMode;
    setVoiceMode(next);
    if (!next) stopAudio();
    if (next) showToast("Jawaban Heiser akan dibacakan otomatis.");
  };

  const resetConversation = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopAudio();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setIsStreaming(false);
    setConversationId(null);
    setMessages([GREETING]);
    setInput("");
    setHistoryOpen(false);
    inputSourceRef.current = "text";
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const openConversation = async (conversation: ConversationSummary) => {
    if (conversation.id === conversationId) {
      setHistoryOpen(false);
      return;
    }
    stopAudio();
    if (isListening) recognitionRef.current?.stop();
    setHistoryOpen(false);
    setLoadingConversationId(conversation.id);
    try {
      const data = await api.messages(conversation.id);
      const loaded: ChatMessage[] = data.items.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        citations: item.citations ?? [],
        created_at: item.created_at,
        input_type: item.input_type,
        streaming: false,
      }));
      setConversationId(conversation.id);
      setMessages(loaded.length ? loaded : [GREETING]);
      setInput("");
      window.setTimeout(() => {
        const node = scrollRef.current;
        if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
      }, 80);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memuat percakapan.");
    } finally {
      setLoadingConversationId(null);
    }
  };

  const sendMessage = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isStreaming) return;

    const inputType = inputSourceRef.current;
    inputSourceRef.current = "text";
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
      citations: [],
      created_at: now,
      input_type: inputType,
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", citations: [], created_at: now, streaming: true },
    ]);
    setInput("");
    setIsStreaming(true);
    stopAudio();
    if (isListening) recognitionRef.current?.stop();
    recorderRef.current?.cancel();
    recorderRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let citations: Citation[] = [];
    let pending = "";
    let flushTimer: number | null = null;

    const flushDeltas = () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (!pending) return;
      const chunk = pending;
      pending = "";
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, content: message.content + chunk } : message,
        ),
      );
    };

    const queueDelta = (delta: string) => {
      pending += delta;
      if (flushTimer === null) flushTimer = window.setTimeout(flushDeltas, 50);
    };

    try {
      await streamChat(
        { message: text, conversation_id: conversationId, language, input_type: inputType },
        {
          onMeta: (meta) => {
            setConversationId(meta.conversation_id);
            void refreshConversations();
          },
          onDelta: (delta) => {
            accumulated += delta;
            queueDelta(delta);
          },
          onCitations: (list) => {
            flushDeltas();
            citations = list;
            setMessages((prev) =>
              prev.map((message) => (message.id === assistantId ? { ...message, citations: list } : message)),
            );
          },
          onDone: () => {
            flushDeltas();
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId ? { ...message, streaming: false, citations } : message,
              ),
            );
            if (voiceModeRef.current && accumulated.trim()) {
              setIsTranscribing(false);
              window.setTimeout(() => void playText(assistantId, accumulated), 220);
            }
          },
        },
        controller.signal,
      );
    } catch {
      flushDeltas();
      if (controller.signal.aborted) return;
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content:
                  accumulated.trim() ||
                  `Maaf, jawaban belum bisa dimuat. Silakan coba lagi sebentar lagi.`,
                streaming: false,
                citations,
              }
            : item,
        ),
      );
      showToast("Layanan belum merespons. Coba lagi sebentar lagi.");
    } finally {
      flushDeltas();
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((message) => (message.id === assistantId ? { ...message, streaming: false } : message)),
      );
      void refreshConversations();
      abortRef.current = null;
    }
  };

  const changeLanguage = (next: "id" | "en") => {
    if (next === language) return;
    if (isListening) recognitionRef.current?.stop();
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
      setIsListening(false);
    }
    stopAudio();
    setLanguage(next);
  };

  const voiceState: VoiceUiState = isListening
    ? "listening"
    : isTranscribing
      ? "transcribing"
      : isStreaming
        ? "thinking"
        : speakingMessageId
          ? "speaking"
          : "idle";

  const mascotMode: HeiserMode =
    voiceState === "listening"
      ? "listening"
      : voiceState === "thinking" || voiceState === "transcribing"
        ? "thinking"
        : voiceState === "speaking"
          ? "speaking"
          : "idle";

  const showSuggestions = !messages.some((message) => message.role === "user");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-4 2xl:grid-cols-[minmax(0,1fr)_350px]">
      <section className="order-2 flex min-h-0 flex-col xl:order-1">
        <div className="ui-card flex h-[calc(100dvh-390px)] min-h-[420px] flex-col overflow-hidden xl:h-full">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line/75 bg-paper px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-blush">
                <MessageSquareText className="h-4 w-4 text-maroon" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
                  Heiser <span className="hidden font-medium text-muted sm:inline">· Whoosh AI</span>
                </p>
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${connection === "offline" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {connection === "offline" ? "Belum tersambung" : "Siap membantu"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-line bg-cream/70 p-0.5">
                <Globe2 className="mx-1.5 hidden h-3 w-3 text-muted/70 sm:block" />
                {(["id", "en"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => changeLanguage(code)}
                    className={`rounded-md px-2 py-1 text-[13px] font-semibold uppercase transition-colors ${
                      language === code ? "bg-paper text-maroon shadow-sm" : "text-muted hover:text-ink"
                    }`}
                    aria-pressed={language === code}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-[13px] font-medium text-muted transition-colors hover:border-maroon/30 hover:text-maroon"
                aria-label="Buka riwayat percakapan"
              >
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Riwayat</span>
                {conversations.length > 0 && (
                  <span className="rounded-md bg-cream px-1.5 py-0.5 text-[13px] text-muted">{conversations.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={resetConversation}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-muted transition-colors hover:border-maroon/30 hover:text-maroon"
                aria-label="Mulai percakapan baru"
                title="Percakapan baru"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {connection === "offline" && (
            <div className="flex items-center gap-2 border-b border-amber-200/70 bg-warn px-4 py-2 text-[13px] font-medium text-amber-900">
              <ServerOff className="h-3.5 w-3.5 shrink-0" />
              Asisten belum tersambung. Periksa koneksi internet lalu coba lagi.
            </div>
          )}

          <div ref={scrollRef} className="scroll-area flex-1 overflow-y-auto bg-[#fbf7f2] px-3.5 py-4 sm:px-5">
            <div className="mx-auto flex max-w-[780px] flex-col gap-3.5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isSpeaking={speakingMessageId === message.id}
                  onPlay={() => playMessage(message)}
                  onStop={stopAudio}
                />
              ))}

              {showSuggestions && (
                <div className="ml-10 mr-1 mt-1 rounded-[20px] border border-line/70 bg-paper p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Sparkles className="h-3 w-3 text-maroon" />
                      Mulai dari pertanyaan ini
                    </p>
                    <span className="text-[13px] font-medium text-muted/70">Contoh</span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        disabled={isStreaming}
                        className="group flex items-center gap-2 rounded-xl border border-line/70 bg-paper px-2.5 py-2 text-left text-[13px] font-medium text-ink/80 transition-colors hover:border-maroon/30 hover:bg-blush/40 hover:text-maroon disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">{prompt}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted/35 transition-colors group-hover:text-maroon" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pl-10 pt-1 text-[13px] font-medium text-muted/60">
                <span className="h-px flex-1 bg-line/60" />
                <span>Jawaban bersifat informatif · verifikasi kanal resmi</span>
                <span className="h-px flex-1 bg-line/60" />
              </div>
            </div>
          </div>

          <Composer
            value={input}
            onChange={(value) => {
              inputSourceRef.current = "text";
              setInput(value);
            }}
            onSend={() => void sendMessage()}
            disabled={isStreaming}
            voiceState={voiceState}
            isListening={isListening}
            onToggleListening={startListening}
            onStopSpeaking={stopAudio}
            voiceSupported={voiceSupported || recorderSupported}
            speechEngine={speechEngine}
            onChangeSpeechEngine={changeSpeechEngine}
          />
        </div>
      </section>

      <div className="order-1 min-h-0 xl:order-2">
        <AssistantPanel
          mode={mascotMode}
          voiceState={voiceState}
          voiceMode={voiceMode}
          isListening={isListening}
          isSpeaking={Boolean(speakingMessageId)}
          onToggleVoiceMode={toggleVoiceMode}
          onToggleListening={isListening ? stopListening : startListening}
          onStopSpeaking={stopAudio}
        />
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(conversation) => void openConversation(conversation)}
        onNewChat={resetConversation}
        loadingId={loadingConversationId}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] w-[88%] max-w-sm -translate-x-1/2 rounded-xl border border-wine/10 bg-wine/95 px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-2xl backdrop-blur lg:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

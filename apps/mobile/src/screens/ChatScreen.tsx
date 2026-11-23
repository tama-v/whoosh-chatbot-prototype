import { Ionicons } from "@expo/vector-icons";
import type { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorMessage } from "../api";
import { colors, fonts, radius, shadows } from "../theme";
import type { ChatTurn, Conversation, Language } from "../types";
import { greeting, relativeTime, speechText } from "../utils";
import { Heiser } from "../components/Heiser";
import { CitationChips, MessageText } from "../components/MessageText";
import { WhooshMark } from "../components/WhooshMark";
import { AppText, Badge, IconButton, LoadingDots, ScreenHeader } from "../components/ui";

type RecordStatus = "idle" | "recording" | "transcribing";

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: WebRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type WebRecognitionEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type WebRecognitionCtor = new () => WebRecognition;

const MODE_META: Record<string, { label: string; color: string; bg: string }> = {
  qwen: { label: "Dengan sumber", color: colors.amber, bg: colors.goldSoft },
  demo: { label: "Dengan sumber", color: colors.green, bg: colors.greenSoft },
  "demo-fallback": { label: "Ringkasan umum", color: colors.amber, bg: colors.amberSoft },
  "no-evidence": { label: "Belum ada bukti", color: colors.red, bg: colors.redSoft },
};

const SUGGESTIONS: Record<Language, { icon: keyof typeof Ionicons.glyphMap; title: string; prompt: string }[]> = {
  id: [
    { icon: "id-card-outline", title: "Persiapan boarding", prompt: "Apa saja persiapan boarding Whoosh?" },
    { icon: "briefcase-outline", title: "Ketentuan bagasi", prompt: "Bagaimana ketentuan bagasi yang perlu saya perhatikan?" },
    { icon: "train-outline", title: "Fasilitas stasiun", prompt: "Fasilitas apa yang tersedia di stasiun?" },
    { icon: "search-outline", title: "Barang tertinggal", prompt: "Apa yang harus saya lakukan jika barang tertinggal?" },
  ],
  en: [
    { icon: "id-card-outline", title: "Boarding preparation", prompt: "What should I prepare before boarding?" },
    { icon: "briefcase-outline", title: "Baggage rules", prompt: "What baggage rules should I know?" },
    { icon: "train-outline", title: "Station facilities", prompt: "What facilities are available at the station?" },
    { icon: "search-outline", title: "Left an item", prompt: "What should I do if I left an item behind?" },
  ],
};

function getWebRecognition(): WebRecognitionCtor | null {
  const source = globalThis as unknown as {
    SpeechRecognition?: WebRecognitionCtor;
    webkitSpeechRecognition?: WebRecognitionCtor;
  };
  return source.SpeechRecognition ?? source.webkitSpeechRecognition ?? null;
}

export function ChatScreen({
  language,
  onLanguageChange,
  onOpenAccount,
  userName,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onOpenAccount: () => void;
  userName: string | null;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<Conversation[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);

  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const nativeAudioRef = useRef<typeof import("expo-av").Audio | null>(null);
  const webRecognitionRef = useRef<WebRecognition | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5200);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void Speech.stop();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
        recordingRef.current = null;
      }
      webRecognitionRef.current?.abort();
      webRecognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recordStatus !== "recording") {
      setRecordSeconds(0);
      return;
    }
    setRecordSeconds(0);
    const timer = setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recordStatus]);

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 140);
    return () => clearTimeout(timer);
  }, [messages.length, sending]);

  useEffect(() => {
    if (!notice) return;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5200);
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [notice]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const sendMessage = useCallback(
    async (rawText: string, inputType: "text" | "voice" = "text") => {
      const text = rawText.trim();
      if (!text || sending) return;
      setInput("");
      setError(null);
      setSending(true);

      const stamp = Date.now();
      const userTurn: ChatTurn = {
        id: `user-${stamp}`,
        role: "user",
        content: text,
        citations: [],
        input_type: inputType,
        language,
      };
      const pendingId = `pending-${stamp}`;
      setMessages((previous) => [
        ...previous,
        userTurn,
        {
          id: pendingId,
          role: "assistant",
          content: "",
          citations: [],
          pending: true,
          language,
        },
      ]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      try {
        const response = await api.sendChat(text, conversationId, language, inputType);
        setConversationId(response.conversation_id);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === pendingId
              ? {
                  id: response.message_id,
                  role: "assistant",
                  content: response.answer,
                  citations: response.citations ?? [],
                  mode: response.mode,
                  language,
                }
              : message,
          ),
        );
      } catch (requestError) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== pendingId && message.id !== userTurn.id),
        );
        setInput(text);
        setError(errorMessage(requestError));
      } finally {
        setSending(false);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
    },
    [conversationId, language, sending],
  );

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await api.conversations();
      setHistoryItems(result.items ?? []);
    } catch (historyError) {
      flashNotice(errorMessage(historyError));
    } finally {
      setHistoryLoading(false);
    }
  }, [flashNotice]);

  const openHistory = useCallback(() => {
    if (sending) return;
    setHistoryOpen(true);
    void loadHistory();
  }, [loadHistory, sending]);

  const openConversation = useCallback(
    async (conversation: Conversation) => {
      setConversationLoading(true);
      try {
        const result = await api.conversationMessages(conversation.id);
        const loaded: ChatTurn[] = (result.items ?? [])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role === "user" ? "user" : "assistant",
            content: message.content,
            citations: message.citations ?? [],
            mode: message.mode ?? undefined,
            input_type: message.input_type ?? undefined,
            created_at: message.created_at,
            language,
          }));
        setMessages(loaded);
        setConversationId(conversation.id);
        setError(null);
        setHistoryOpen(false);
      } catch (conversationError) {
        flashNotice(errorMessage(conversationError));
      } finally {
        setConversationLoading(false);
      }
    },
    [flashNotice, language],
  );

  const newChat = useCallback(() => {
    if (sending) return;
    void Speech.stop();
    setSpeakingId(null);
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
  }, [sending]);

  const speakMessage = useCallback(
    (message: ChatTurn) => {
      if (speakingId === message.id) {
        void Speech.stop();
        setSpeakingId(null);
        return;
      }
      void Speech.stop();
      setSpeakingId(message.id);
      const spokenLanguage = message.language ?? language;
      Speech.speak(speechText(message.content), {
        language: spokenLanguage === "id" ? "id-ID" : "en-US",
        rate: 0.95,
        pitch: 1,
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
        onError: () => {
          setSpeakingId(null);
          flashNotice("Suara perangkat tidak tersedia untuk bahasa ini.");
        },
      });
      flashNotice("Memutar suara perangkat. Anda dapat menghentikannya dengan tombol yang sama.");
    },
    [flashNotice, language, speakingId],
  );

  const startWebRecognition = useCallback(() => {
    const Recognition = getWebRecognition();
    if (!Recognition) {
      flashNotice("Browser ini belum mendukung input suara. Gunakan Chrome atau Edge.");
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = language === "id" ? "id-ID" : "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) void sendMessage(transcript, "voice");
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") {
          flashNotice("Input suara berhenti. Periksa izin mikrofon lalu coba lagi.");
        }
      };
      recognition.onend = () => {
        webRecognitionRef.current = null;
        setRecordStatus("idle");
      };
      webRecognitionRef.current = recognition;
      setRecordStatus("recording");
      recognition.start();
    } catch {
      setRecordStatus("idle");
      flashNotice("Tidak dapat memulai input suara di browser ini.");
    }
  }, [flashNotice, language, sendMessage]);

  const startNativeRecording = useCallback(async () => {
    let audio: typeof import("expo-av").Audio;
    try {
      ({ Audio: audio } = await import("expo-av"));
    } catch {
      flashNotice("Rekam suara native memerlukan development build Expo, tidak tersedia di Expo Go.");
      return;
    }
    nativeAudioRef.current = audio;
    try {
      const permission = await audio.requestPermissionsAsync();
      if (!permission.granted) {
        flashNotice("Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan perangkat.");
        return;
      }
      await audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      const { recording } = await audio.Recording.createAsync(audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordStatus("recording");
    } catch {
      flashNotice("Tidak dapat memulai perekaman. Periksa izin mikrofon perangkat.");
    }
  }, [flashNotice]);

  const stopNativeRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setRecordStatus("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      await nativeAudioRef.current?.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error("Rekaman tidak tersedia.");
      const result = await api.transcribe(uri, "audio/mp4", language);
      const text = result.text?.trim();
      if (text) {
        await sendMessage(text, "voice");
      } else {
        flashNotice("Tidak ada suara yang terdeteksi. Coba rekam ulang lebih dekat ke mikrofon.");
      }
    } catch (recordError) {
      recordingRef.current = null;
      flashNotice(errorMessage(recordError));
    } finally {
      setRecordStatus("idle");
    }
  }, [flashNotice, language, sendMessage]);

  const toggleRecording = useCallback(() => {
    if (recordStatus === "transcribing" || sending) return;
    if (recordStatus === "recording") {
      if (Platform.OS === "web") {
        webRecognitionRef.current?.stop();
      } else {
        void stopNativeRecording();
      }
      return;
    }
    if (Platform.OS === "web") startWebRecognition();
    else void startNativeRecording();
  }, [recordStatus, sending, startNativeRecording, startWebRecognition, stopNativeRecording]);

  const confirmLogoutHint = useCallback(() => {
    if (userName) {
      onOpenAccount();
      return;
    }
    Alert.alert(
      "Masuk untuk menyimpan riwayat",
      "Tamu tetap bisa chat dan membuat laporan. Masuk atau daftar agar data tamu ini tersimpan ke akun Anda.",
      [
        { text: "Nanti", style: "cancel" },
        { text: "Buka Akun", onPress: onOpenAccount },
      ],
    );
  }, [onOpenAccount, userName]);

  const suggestions = SUGGESTIONS[language];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Heiser"
        subtitle={language === "id" ? "Asisten perjalanan" : "Travel assistant"}
        right={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={language === "id" ? "Ganti ke bahasa Inggris" : "Switch to Indonesian"}
              onPress={() => onLanguageChange(language === "id" ? "en" : "id")}
              style={({ pressed }) => [styles.languagePill, pressed && styles.languagePillPressed]}
            >
              <Ionicons name="language-outline" size={15} color={colors.white} />
              <Text style={styles.languageText}>{language.toUpperCase()}</Text>
            </Pressable>
            <IconButton
              icon="time-outline"
              label="Riwayat percakapan"
              color={colors.white}
              onPress={openHistory}
              disabled={sending}
            />
            <IconButton
              icon="create-outline"
              label="Percakapan baru"
              color={colors.white}
              onPress={newChat}
              disabled={sending}
            />
          </>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (messages.length > 0) {
              setTimeout(scrollToEnd, 80);
            }
          }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.welcome}>
              <View style={styles.welcomeBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.welcomeBadgeText}>
                  {language === "id" ? "SIAP MEMBANTU" : "READY TO HELP"}
                </Text>
              </View>
              <Heiser width={158} />
              <Text style={styles.welcomeTitle}>
                {language === "id" ? `${greeting()}, saya Heiser.` : "Hi, I'm Heiser."}
              </Text>
              <Text style={styles.welcomeCopy}>
                {language === "id"
                  ? "Tanyakan persiapan boarding, bagasi, tiket, fasilitas stasiun, atau barang tertinggal. Saya menjawab dari panduan perjalanan yang tersedia, bukan dari sistem operator."
                  : "Ask about boarding, baggage, tickets, station facilities, or lost items. I answer from the available travel guides, not from operator systems."}
              </Text>
              {!userName ? (
                <Pressable onPress={confirmLogoutHint} style={styles.guestHint}>
                  <Ionicons name="person-circle-outline" size={17} color={colors.maroon} />
                  <Text style={styles.guestHintText}>
                    {language === "id"
                      ? "Anda memakai mode tamu. Masuk agar riwayat tersimpan."
                      : "You are using guest mode. Sign in to keep your history."}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.maroon} />
                </Pressable>
              ) : null}
              <View style={styles.suggestionGrid}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.title}
                    onPress={() => void sendMessage(suggestion.prompt)}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                  >
                    <View style={styles.suggestionIcon}>
                      <Ionicons name={suggestion.icon} size={18} color={colors.maroon} />
                    </View>
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <Ionicons name="arrow-up-outline" size={14} color={colors.lineStrong} style={styles.suggestionArrow} />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.disclaimer}>
                {language === "id"
                  ? "Bukan layanan resmi operator · verifikasi informasi penting."
                  : "Not an official operator service · verify important information."}
              </Text>
            </View>
          ) : (
            <View style={styles.messages}>
              {messages.map((message) => {
                const isUser = message.role === "user";
                const mode = message.mode ? MODE_META[message.mode] : null;
                return (
                  <View key={message.id} style={[styles.messageRow, isUser && styles.messageRowUser]}>
                    {!isUser ? (
                      <View style={styles.assistantAvatar}>
                        <WhooshMark size={30} />
                      </View>
                    ) : null}
                    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                      {message.pending ? (
                        <View style={styles.typing}>
                          <LoadingDots color={colors.maroon} size={6} />
                          <Text style={styles.typingText}>
                            {language === "id" ? "Heiser menyusun jawaban…" : "Heiser is drafting an answer…"}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <MessageText content={message.content} tone={isUser ? "light" : "dark"} />
                          {!isUser ? <CitationChips citations={message.citations} /> : null}
                          {!isUser ? (
                            <View style={styles.bubbleFooter}>
                              {mode ? <Badge label={mode.label} color={mode.color} background={mode.bg} /> : <View />}
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  speakingId === message.id ? "Hentikan suara" : "Putar jawaban dengan suara"
                                }
                                onPress={() => speakMessage(message)}
                                hitSlop={8}
                                style={({ pressed }) => [styles.speakButton, pressed && styles.speakButtonPressed]}
                              >
                                <Ionicons
                                  name={speakingId === message.id ? "stop-circle-outline" : "volume-high-outline"}
                                  size={18}
                                  color={colors.maroon}
                                />
                                <Text style={styles.speakLabel}>
                                  {speakingId === message.id ? "Stop" : "Suara"}
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
              <View style={styles.endNote}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
                <Text style={styles.endNoteText}>
                  {language === "id"
                    ? "Jawaban dapat keliru. Verifikasi info penting ke kanal resmi operator."
                    : "Answers may be wrong. Verify important info with official operator channels."}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {notice ? (
            <Pressable style={styles.noticeBar} onPress={() => setNotice(null)}>
              <Ionicons name="information-circle-outline" size={16} color={colors.maroon} />
              <Text style={styles.noticeText}>{notice}</Text>
              <Ionicons name="close" size={14} color={colors.muted} />
            </Pressable>
          ) : null}
          {error ? (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => setError(null)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.red} />
              </Pressable>
            </View>
          ) : null}
          {recordStatus !== "idle" ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {recordStatus === "transcribing"
                  ? "Mentranskripsi rekaman…"
                  : `Merekam ${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, "0")} · ketuk mikrofon untuk berhenti`}
              </Text>
              {recordStatus === "transcribing" ? <LoadingDots color={colors.maroon} size={5} /> : null}
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                language === "id" ? "Tulis pertanyaan perjalanan…" : "Ask a travel question…"
              }
              placeholderTextColor="#A58E8F"
              style={styles.composerInput}
              multiline
              maxLength={2000}
              editable={!sending}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recordStatus === "recording" ? "Berhenti merekam" : "Input suara"}
              onPress={toggleRecording}
              disabled={sending || recordStatus === "transcribing"}
              style={({ pressed }) => [
                styles.micButton,
                recordStatus === "recording" && styles.micButtonActive,
                pressed && styles.micButtonPressed,
              ]}
            >
              <Ionicons
                name={recordStatus === "recording" ? "stop" : "mic-outline"}
                size={20}
                color={recordStatus === "recording" ? colors.white : colors.maroon}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kirim pesan"
              onPress={() => void sendMessage(input)}
              disabled={!input.trim() || sending}
              style={({ pressed }) => [
                styles.sendButton,
                (!input.trim() || sending) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.composerMeta}>
            <View style={styles.metaDot} />
            <Text style={styles.composerMetaText}>
              {language === "id"
                ? "Jawaban bisa keliru · verifikasi di kanal resmi"
                : "Answers may be wrong · verify with official channels"}
            </Text>
            <Text style={styles.composerMetaText}>·</Text>
            <Text style={styles.composerMetaText}>Heiser v1</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={historyOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.historyScreen}>
          <View style={[styles.historyHeader, { paddingTop: Math.max(insets.top, 18) }]}>
            <View>
              <Text style={styles.historyEyebrow}>WHOOSH AI</Text>
              <Text style={styles.historyTitle}>Riwayat percakapan</Text>
            </View>
            <View style={styles.historyActions}>
              <IconButton
                icon="add"
                label="Percakapan baru"
                color={colors.maroon}
                background={colors.maroonSoft}
                onPress={() => {
                  setHistoryOpen(false);
                  newChat();
                }}
              />
              <IconButton
                icon="close"
                label="Tutup riwayat"
                color={colors.ink}
                background={colors.creamDeep}
                onPress={() => setHistoryOpen(false)}
              />
            </View>
          </View>
          {historyLoading ? (
            <View style={styles.historyEmpty}>
              <LoadingDots />
              <Text style={styles.historyEmptyText}>Memuat percakapan…</Text>
            </View>
          ) : (
            <FlatList
              data={historyItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              refreshControl={
                <RefreshControl
                  refreshing={historyLoading}
                  onRefresh={() => void loadHistory()}
                  tintColor={colors.maroon}
                />
              }
              ListEmptyComponent={
                <View style={styles.historyEmpty}>
                  <Ionicons name="chatbubbles-outline" size={38} color={colors.lineStrong} />
                  <Text style={styles.historyEmptyTitle}>Belum ada percakapan</Text>
                  <Text style={styles.historyEmptyText}>
                    Mulai pertanyaan pertama, lalu riwayat akan muncul di sini.
                  </Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.historySeparator} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void openConversation(item)}
                  style={({ pressed }) => [styles.historyItem, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.historyIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.maroon} />
                  </View>
                  <View style={styles.historyCopy}>
                    <View style={styles.historyTopLine}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {item.title || "Percakapan"}
                      </Text>
                      <Text style={styles.historyTime}>{relativeTime(item.updated_at)}</Text>
                    </View>
                    <Text style={styles.historyPreview} numberOfLines={2}>
                      {item.last_message || "Belum ada pesan"}
                    </Text>
                    <View style={styles.historyMetaRow}>
                      <Badge label={`${item.message_count} pesan`} icon="layers-outline" />
                      <Badge label={item.language === "en" ? "English" : "Indonesia"} icon="language-outline" />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.lineStrong} />
                </Pressable>
              )}
            />
          )}
          {conversationLoading ? (
            <View style={styles.conversationOverlay}>
              <View style={styles.conversationOverlayCard}>
                <LoadingDots />
                <Text style={styles.conversationOverlayText}>Membuka percakapan…</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  languagePill: {
    height: 32,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  languagePillPressed: {
    opacity: 0.7,
  },
  languageText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: fonts.bold,
    letterSpacing: 0.5,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    flexGrow: 1,
  },
  welcome: {
    alignItems: "center",
    paddingTop: 4,
  },
  welcomeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  welcomeBadgeText: {
    color: colors.green,
    fontSize: 9.5,
    fontWeight: fonts.bold,
    letterSpacing: 0.8,
  },
  welcomeTitle: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: fonts.heavy,
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 2,
  },
  welcomeCopy: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 330,
  },
  guestHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  guestHintText: {
    color: colors.maroonDark,
    fontSize: 11.5,
    fontWeight: fonts.semibold,
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 18,
    width: "100%",
  },
  suggestion: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 84,
    ...shadows.card,
  },
  suggestionPressed: {
    transform: [{ scale: 0.985 }],
    borderColor: colors.maroon,
  },
  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  suggestionTitle: {
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: fonts.bold,
    paddingRight: 14,
  },
  suggestionArrow: {
    position: "absolute",
    right: 10,
    top: 10,
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 16,
    maxWidth: 320,
  },
  messages: {
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 26,
  },
  messageRowUser: {
    justifyContent: "flex-end",
    paddingRight: 0,
    paddingLeft: 42,
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubble: {
    maxWidth: "92%",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 7,
    ...shadows.card,
  },
  userBubble: {
    backgroundColor: colors.maroon,
    borderTopRightRadius: 7,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  typingText: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: fonts.medium,
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  speakButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.maroonSoft,
  },
  speakButtonPressed: {
    opacity: 0.65,
  },
  speakLabel: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: fonts.bold,
  },
  endNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  endNoteText: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    flexShrink: 1,
  },
  composerArea: {
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 7,
  },
  noticeText: {
    flex: 1,
    color: colors.maroonDark,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: fonts.medium,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.redSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 7,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: fonts.medium,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.maroonSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 7,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  recordingText: {
    flex: 1,
    color: colors.maroonDark,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: fonts.semibold,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    ...shadows.card,
  },
  composerInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 20,
    maxHeight: 112,
    minHeight: 38,
    paddingTop: 9,
    paddingBottom: 8,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.maroonSoft,
  },
  micButtonActive: {
    backgroundColor: colors.red,
  },
  micButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.maroon,
  },
  sendButtonDisabled: {
    backgroundColor: colors.lineStrong,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  composerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 6,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
  },
  composerMetaText: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: fonts.medium,
  },
  historyScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  historyHeader: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.cream,
  },
  historyEyebrow: {
    color: colors.maroon,
    fontSize: 9.5,
    fontWeight: fonts.bold,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: fonts.heavy,
  },
  historyActions: {
    flexDirection: "row",
    gap: 8,
  },
  historyList: {
    padding: 14,
    paddingBottom: 32,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    ...shadows.card,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  historyCopy: {
    flex: 1,
  },
  historyTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyItemTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: fonts.bold,
  },
  historyTime: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: fonts.medium,
  },
  historyPreview: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  historyMetaRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 7,
  },
  historySeparator: {
    height: 9,
  },
  historyEmpty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 34,
    gap: 7,
    flex: 1,
  },
  historyEmptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: fonts.bold,
  },
  historyEmptyText: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 270,
  },
  conversationOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(43,22,25,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationOverlayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
    ...shadows.raised,
  },
  conversationOverlayText: {
    color: colors.inkSoft,
    fontSize: 12.5,
    fontWeight: fonts.semibold,
  },
});

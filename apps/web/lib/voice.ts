type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }>;
};

export type RecognitionHandlers = {
  onTranscript: (finalText: string, interimText: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognition(language: "id" | "en", handlers: RecognitionHandlers) {
  if (typeof window === "undefined") return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = language === "en" ? "en-US" : "id-ID";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) finalText += transcript;
      else interimText += transcript;
    }
    handlers.onTranscript(finalText.trim(), interimText.trim());
  };
  recognition.onerror = (event) => {
    const messages: Record<string, string> = {
      "not-allowed": "Izin mikrofon ditolak. Aktifkan akses mikrofon di browser.",
      "service-not-allowed": "Layanan pengenalan suara tidak tersedia di browser ini.",
      "no-speech": "Tidak ada suara yang terdeteksi. Coba lagi.",
      network: "Koneksi terputus saat memproses suara.",
      aborted: "",
    };
    const message = messages[event.error ?? ""] ?? "Gagal memproses suara. Coba lagi.";
    if (message) handlers.onError(message);
  };
  recognition.onend = () => handlers.onEnd();

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

export function mediaRecorderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export type RecordingController = {
  stop: () => void;
  cancel: () => void;
};

export async function startRecording(
  onStop: (blob: Blob) => void,
  onError: (message: string) => void,
): Promise<RecordingController | null> {
  if (!mediaRecorderSupported()) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    onError("Izin mikrofon ditolak. Aktifkan akses mikrofon di browser.");
    return null;
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    onError("Browser tidak dapat merekam audio.");
    return null;
  }
  const chunks: Blob[] = [];
  let cancelled = false;
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (cancelled) return;
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (blob.size > 0) onStop(blob);
  };
  recorder.start();
  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

export type SpeechEngine = "auto" | "browser";

const ENGINE_KEY = "whoosh-tts-engine";

export function getSpeechEngine(): SpeechEngine {
  if (typeof window === "undefined") return "auto";
  return window.localStorage.getItem(ENGINE_KEY) === "browser" ? "browser" : "auto";
}

export function setSpeechEngine(engine: SpeechEngine): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENGINE_KEY, engine);
}

type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let speechToken = 0;

function cleanupAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

async function backendSpeech(text: string, language: "id" | "en"): Promise<Blob | null> {
  const response = await fetch("/api/v1/voice/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, voice_id: "auto" }),
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return blob.size > 100 ? blob : null;
}

function speakWithBrowser(text: string, language: "id" | "en", handlers: SpeakHandlers): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const clean = text
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return false;

  const utterance = new SpeechSynthesisUtterance(clean.slice(0, 3500));
  utterance.lang = language === "en" ? "en-US" : "id-ID";
  utterance.rate = 1;
  utterance.pitch = 1.02;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => voice.lang.toLowerCase().startsWith(language === "en" ? "en" : "id"));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export async function speakText(
  text: string,
  language: "id" | "en",
  handlers: SpeakHandlers = {},
  engine: SpeechEngine = "auto",
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  stopSpeaking();
  const token = ++speechToken;

  if (engine === "auto") {
    try {
      const blob = await backendSpeech(text, language);
      if (token !== speechToken) return false;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        activeAudio = audio;
        activeAudioUrl = url;
        audio.onended = () => {
          cleanupAudio();
          handlers.onEnd?.();
        };
        audio.onerror = () => {
          cleanupAudio();
          handlers.onEnd?.();
        };
        await audio.play();
        handlers.onStart?.();
        return true;
      }
    } catch {
      cleanupAudio();
      // Server voice unavailable: fall through to the browser voice.
    }
  }

  if (token !== speechToken) return false;
  const started = speakWithBrowser(text, language, handlers);
  if (!started) {
    handlers.onError?.("Suara tidak tersedia. Periksa dukungan suara browser.");
  }
  return started;
}

export function stopSpeaking() {
  speechToken += 1;
  cleanupAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function currentlySpeaking(): boolean {
  if (typeof window === "undefined") return false;
  const audioPlaying = Boolean(activeAudio) && !activeAudio?.paused;
  const browserSpeaking = "speechSynthesis" in window && window.speechSynthesis.speaking;
  return Boolean(audioPlaying || browserSpeaking);
}

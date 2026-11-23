import { NativeModules, Platform } from "react-native";

import type {
  AuthResponse,
  AuthUser,
  ChatResponse,
  Complaint,
  ComplaintAnalysis,
  ComplaintCategory,
  ComplaintStatus,
  Conversation,
  HealthResponse,
  Language,
  Priority,
  StoredMessage,
} from "./types";

function devServerHost(): string | null {
  try {
    const source = NativeModules?.SourceCode?.scriptURL as string | undefined;
    if (!source) return null;
    const match = source.match(/^https?:\/\/(\[[^\]]+\]|[^/:]+)/);
    if (!match) return null;
    const host = match[1];
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return null;
    return `http://${host}:8000`;
  } catch {
    return null;
  }
}

function webHost(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const hostname = (globalThis as { location?: { hostname?: string } }).location?.hostname;
    if (!hostname) return null;
    return `http://${hostname}:8000`;
  } catch {
    return null;
  }
}

function platformDefault(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (override) return normalizeBase(override);
  const fromDev = devServerHost();
  if (fromDev) return fromDev;
  const fromWeb = webHost();
  if (fromWeb) return fromWeb;
  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

export function normalizeBase(value: string): string {
  let base = value.trim();
  if (!base) return platformDefault();
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  base = base.replace(/\/+$/, "");
  base = base.replace(/\/api\/v1$/i, "");
  return base;
}

export const DEFAULT_API_BASE = platformDefault();

let apiBase = DEFAULT_API_BASE;
let authToken: string | null = null;
let guestId: string | null = null;

export function configureApi(options: { base?: string; token?: string | null; guest?: string | null }): void {
  if (options.base !== undefined) apiBase = normalizeBase(options.base);
  if (options.token !== undefined) authToken = options.token;
  if (options.guest !== undefined) guestId = options.guest;
}

export function getApiBase(): string {
  return apiBase;
}

export function getGuestId(): string | null {
  return guestId;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  form?: FormData;
  skipAuth?: boolean;
};

function detailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const msg = (item as { msg?: unknown }).msg;
        return typeof msg === "string" ? msg : null;
      })
      .filter((item): item is string => Boolean(item));
    if (messages.length) return messages.join(" ");
  }
  return null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 65000);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (guestId) headers["X-Guest-Id"] = guestId;
  if (authToken && !options.skipAuth) headers.Authorization = `Bearer ${authToken}`;
  if (!options.form && options.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(`${apiBase}/api/v1${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? "POST" : "GET"),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      const detail = detailFromBody(body);
      throw new ApiError(
        detail || `Permintaan gagal (${response.status}). Coba lagi sebentar lagi.`,
        response.status,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Layanan terlalu lama merespons. Periksa koneksi lalu coba lagi.", 0);
    }
    throw new ApiError("Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<HealthResponse>("/health", { timeoutMs: 12000, skipAuth: true }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { body: { email, password } }),

  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", { body: { name, email, password } }),

  me: () => request<{ user: AuthUser }>("/auth/me", { timeoutMs: 15000 }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST", timeoutMs: 12000 }),

  sendChat: (message: string, conversationId: string | null, language: Language, inputType: "text" | "voice") =>
    request<ChatResponse>("/chat", {
      body: { message, conversation_id: conversationId, language, input_type: inputType },
    }),

  conversations: () => request<{ items: Conversation[] }>("/conversations", { timeoutMs: 20000 }),

  conversationMessages: (conversationId: string) =>
    request<{ items: StoredMessage[] }>(`/conversations/${conversationId}/messages`, {
      timeoutMs: 20000,
    }),

  analyzeComplaint: (payload: {
    description: string;
    travel_date?: string | null;
    station?: string | null;
    train_info?: string | null;
  }) => request<ComplaintAnalysis>("/complaints/analyze", { body: payload, timeoutMs: 20000 }),

  createComplaint: (payload: {
    category: ComplaintCategory;
    description: string;
    travel_date?: string | null;
    station?: string | null;
    train_info?: string | null;
    contact?: string | null;
    priority: Priority;
    summary?: string | null;
  }) => request<Complaint>("/complaints", { body: payload }),

  complaints: () => request<{ items: Complaint[]; total: number }>("/complaints", { timeoutMs: 20000 }),

  ticket: (ticketNumber: string) =>
    request<Complaint>(`/complaints/ticket/${encodeURIComponent(ticketNumber)}`, { timeoutMs: 20000 }),

  transcribe: async (uri: string, mimeType: string, language: Language): Promise<{ text: string }> => {
    const form = new FormData();
    const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "m4a" : "webm";
    form.append("audio", {
      uri,
      name: `rekaman.${extension}`,
      type: mimeType,
    } as unknown as Blob);
    form.append("language", language);
    return request<{ text: string }>("/voice/transcribe", { form });
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan tak terduga.";
}

export type { ComplaintStatus };

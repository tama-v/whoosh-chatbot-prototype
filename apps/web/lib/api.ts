import { getGuestId } from "./client-id";
import type {
  Analytics,
  AuthResponse,
  ChatStreamMeta,
  Citation,
  Complaint,
  ComplaintAnalysis,
  ConversationSummary,
  HealthResponse,
  KnowledgeDocument,
  RetrievalTestResponse,
} from "./types";

const API_BASE = "/api/v1";

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ");
    }
  } catch {
    // ignore malformed error bodies
  }
  return `Permintaan gagal (${response.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const guestId = getGuestId();
  if (guestId) headers.set("X-Guest-Id", guestId);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await errorDetail(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  me: () => request<{ user: AuthResponse["user"] }>("/auth/me"),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  health: () => request<HealthResponse>("/health"),
  conversations: () => request<{ items: ConversationSummary[] }>("/conversations?limit=30"),
  messages: (conversationId: string) =>
    request<{ items: Array<{ id: string; role: "user" | "assistant"; content: string; citations: Citation[]; created_at: string; input_type: string }> }>(
      `/conversations/${conversationId}/messages`,
    ),
  complaints: (params?: { q?: string; category?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    if (params?.status) search.set("status", params.status);
    search.set("limit", "100");
    return request<{ items: Complaint[]; total: number }>(`/complaints?${search.toString()}`);
  },
  complaintByTicket: (ticketNumber: string) =>
    request<Complaint>(`/complaints/ticket/${encodeURIComponent(ticketNumber)}`),
  createComplaint: (payload: Record<string, unknown>) =>
    request<Complaint>("/complaints", { method: "POST", body: JSON.stringify(payload) }),
  analyzeComplaint: (payload: Record<string, unknown>) =>
    request<ComplaintAnalysis>("/complaints/analyze", { method: "POST", body: JSON.stringify(payload) }),
  updateComplaint: (complaintId: string, status: string) =>
    request<Complaint>(`/complaints/${complaintId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  documents: () => request<{ items: KnowledgeDocument[] }>("/documents"),
  uploadDocument: (file: File, title?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    return request<KnowledgeDocument>("/documents", { method: "POST", body: form });
  },
  reindexDocument: (documentId: string) =>
    request<{ document: KnowledgeDocument; chunks: number }>(`/documents/${documentId}/reindex`, { method: "POST" }),
  deleteDocument: (documentId: string) =>
    request<void>(`/documents/${documentId}`, { method: "DELETE" }),
  analytics: () => request<Analytics>("/admin/analytics"),
  adminComplaints: (params?: { q?: string; category?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    if (params?.status) search.set("status", params.status);
    return request<{ items: Complaint[] }>(`/admin/complaints?${search.toString()}`);
  },
  retrievalTest: (query: string, language: "id" | "en") => {
    const search = new URLSearchParams({ q: query, language });
    return request<RetrievalTestResponse>(`/admin/retrieval/test?${search.toString()}`);
  },
  refreshEmbeddings: () =>
    request<{ chunks: number; model: string | null; dims: number }>("/admin/embeddings/refresh", {
      method: "POST",
    }),
  transcribeAudio: (blob: Blob, language: "id" | "en") => {
    const form = new FormData();
    form.append("audio", blob, "voice.webm");
    form.append("language", language);
    return request<{ text: string; provider: string; model: string; language: string }>(
      "/voice/transcribe",
      { method: "POST", body: form },
    );
  },
};

export type StreamHandlers = {
  onMeta: (meta: ChatStreamMeta) => void;
  onDelta: (text: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: (payload: { mode?: string }) => void;
};

export async function streamChat(
  payload: {
    message: string;
    conversation_id?: string | null;
    language: "id" | "en";
    input_type?: "text" | "voice";
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  });
  const guestId = getGuestId();
  if (guestId) headers.set("X-Guest-Id", guestId);
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
    credentials: "same-origin",
  });

  if (!response.ok || !response.body) {
    throw new Error(await errorDetail(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEvent = (raw: string) => {
    const data = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) return;
    const event = JSON.parse(data) as {
      type: string;
      text?: string;
      citations?: Citation[];
      mode?: string;
      message?: string;
      conversation_id?: string;
      user_message_id?: string;
      message_id?: string;
    };
    if (event.type === "meta") {
      handlers.onMeta({
        conversation_id: event.conversation_id ?? "",
        user_message_id: event.user_message_id ?? "",
        message_id: event.message_id ?? "",
        mode: event.mode ?? "demo",
      });
    } else if (event.type === "delta" && event.text) {
      handlers.onDelta(event.text);
    } else if (event.type === "citations") {
      handlers.onCitations(event.citations ?? []);
    } else if (event.type === "done") {
      handlers.onDone({ mode: event.mode });
    } else if (event.type === "error") {
      throw new Error(event.message ?? "Streaming gagal");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      processEvent(chunk);
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) processEvent(buffer);
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "passenger";
  created_at: string;
  last_login_at: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  access_token?: string;
  token_type?: string;
  expires_at?: string;
  notice?: string;
};

export type Citation = {
  document_id: string;
  document_title: string;
  section: string | null;
  page_number: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at?: string;
  input_type?: string;
  streaming?: boolean;
};

export type ConversationSummary = {
  id: string;
  title: string;
  last_message: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type VoiceEngine = "qwen" | "demo-sapi" | "browser";

export type VoiceOption = {
  id: string;
  label: string;
  engine: VoiceEngine;
  voice: string | null;
};

export type VoiceHealth = {
  asr_configured: boolean;
  tts_configured: boolean;
  asr_model: string | null;
  tts_model: string | null;
  demo_tts: boolean;
  provider: VoiceEngine;
  languages: Record<"id" | "en", VoiceEngine>;
  voices: Record<"id" | "en", VoiceOption[]>;
  notice?: string;
};

export type HealthResponse = {
  status: string;
  notice?: string;
};

export type ChatStreamMeta = {
  conversation_id: string;
  user_message_id: string;
  message_id: string;
  mode: string;
};

export type ComplaintCategory =
  | "lost_and_found"
  | "ticket_issue"
  | "boarding_issue"
  | "station_facility"
  | "train_service"
  | "other";

export type ComplaintStatus =
  | "submitted_to_demo_system"
  | "under_review"
  | "resolved"
  | "closed";

export type Priority = "low" | "medium" | "high";

export type Complaint = {
  id: string;
  ticket_number: string;
  category: ComplaintCategory;
  category_label?: string;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  travel_date: string | null;
  station: string | null;
  train_info: string | null;
  contact: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  demo: boolean;
};

export type ComplaintAnalysis = {
  category: ComplaintCategory;
  category_label: string;
  priority: Priority;
  missing_fields: string[];
  summary: string;
  demo: boolean;
  notice: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  status: string;
  uploaded_by: string;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  demo: boolean;
};

export type RetrievalStats = {
  chunks: number;
  embedded: number;
  fts_rows: number;
  fts_available: boolean;
  embedding_models: Record<string, number>;
  documents_by_language: Record<string, number>;
  strategy: string;
};

export type RetrievalTestHit = {
  document_id: string;
  document_title: string;
  section: string | null;
  language: string;
  score: number;
  sources: string[];
  raw: Record<string, number | null>;
  preview: string;
};

export type RetrievalTestResponse = {
  query: string;
  language: "id" | "en";
  hits: RetrievalTestHit[];
  trace: {
    strategy?: string;
    answerable?: boolean;
    best_coverage?: number;
    tokens?: string[];
    candidates?: { fts: number; lexical: number; vector: number; chunks: number };
    embedding?: { model?: string | null; backend?: string; stored_models?: Record<string, number> };
    fts?: boolean;
  };
  demo: boolean;
};

export type Analytics = {
  demo: boolean;
  ai_mode: string;
  retrieval?: RetrievalStats;
  voice?: VoiceHealth;
  overview: {
    conversations: number;
    messages: number;
    complaints: number;
    open_complaints: number;
    resolved_complaints: number;
    documents: number;
    chunks: number;
  };
  complaints_by_status: { status: ComplaintStatus; count: number }[];
  complaints_by_category: { category: ComplaintCategory; count: number }[];
  trend: { date: string; count: number }[];
  top_questions: { content: string; count: number }[];
  unanswered: number;
  sentiment: { positive: number; neutral: number; negative: number; demo: boolean };
  notice: string;
};

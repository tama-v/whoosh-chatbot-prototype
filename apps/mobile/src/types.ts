export type Language = "id" | "en";

export type Role = "admin" | "passenger";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
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

export type ChatMode = "qwen" | "demo" | "demo-fallback" | "no-evidence" | string;

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  mode?: ChatMode;
  created_at?: string;
  input_type?: string;
  language?: Language;
  pending?: boolean;
};

export type ChatResponse = {
  conversation_id: string;
  user_message_id: string;
  message_id: string;
  answer: string;
  citations: Citation[];
  mode: ChatMode;
  retrieval: {
    strategy?: string;
    answerable?: boolean;
    hits?: number;
    sources?: string[];
  };
};

export type Conversation = {
  id: string;
  title: string;
  last_message: string | null;
  message_count: number;
  language: Language;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  mode?: ChatMode | null;
  input_type?: string | null;
  created_at: string;
};

export type ComplaintCategory =
  | "lost_and_found"
  | "ticket_issue"
  | "boarding_issue"
  | "station_facility"
  | "train_service"
  | "other";

export type ComplaintStatus = "submitted_to_demo_system" | "under_review" | "resolved" | "closed";

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

export type HealthResponse = {
  status: string;
  mode: "qwen" | "demo";
  model: string | null;
  qwen_configured: boolean;
  voice: {
    asr_configured: boolean;
    tts_configured: boolean;
    asr_model: string | null;
    tts_model: string | null;
    demo_tts: boolean;
    notice?: string;
  };
  demo_notice: string;
};

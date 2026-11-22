import type { ComplaintCategory, ComplaintStatus, Priority } from "./types";

export const SUGGESTED_PROMPTS = [
  "Bagaimana cara boarding Whoosh?",
  "Apa saja ketentuan bagasi?",
  "Bagaimana cara mengubah jadwal tiket?",
  "Bagaimana prosedur pembatalan tiket?",
  "Fasilitas apa saja yang ada di stasiun?",
  "Bagaimana melaporkan barang tertinggal?",
];

export const CATEGORY_META: Record<
  ComplaintCategory,
  { label: string; short: string; description: string }
> = {
  lost_and_found: {
    label: "Barang tertinggal",
    short: "Lost & found",
    description: "Barang hilang di stasiun atau kereta",
  },
  ticket_issue: {
    label: "Masalah tiket",
    short: "Tiket",
    description: "Data, jadwal, pembatalan, refund",
  },
  boarding_issue: {
    label: "Proses boarding",
    short: "Boarding",
    description: "Gate, antrean, atau keterlambatan",
  },
  station_facility: {
    label: "Fasilitas stasiun",
    short: "Fasilitas",
    description: "Lift, toilet, aksesibilitas, parkir",
  },
  train_service: {
    label: "Layanan kereta",
    short: "Layanan",
    description: "Kursi, kebersihan, petugas",
  },
  other: {
    label: "Lainnya",
    short: "Lainnya",
    description: "Masukan atau kendala lain",
  },
};

export const STATUS_META: Record<
  ComplaintStatus,
  { label: string; description: string; badge: string; dot: string }
> = {
  submitted_to_demo_system: {
    label: "Terkirim (demo)",
    description: "Tersimpan di sistem simulasi",
    badge: "bg-blush text-maroon border-line",
    dot: "bg-maroon",
  },
  under_review: {
    label: "Ditinjau",
    description: "Sedang ditinjau pada alur demo",
    badge: "bg-warn text-amber-900 border-amber-200",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Selesai",
    description: "Ditandai selesai pada alur demo",
    badge: "bg-mint text-[#3d6b4f] border-[#d6e6da]",
    dot: "bg-[#4f7a5c]",
  },
  closed: {
    label: "Ditutup",
    description: "Laporan demo ditutup",
    badge: "bg-cream text-muted border-line",
    dot: "bg-[#b9a8a0]",
  },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  low: { label: "Rendah", badge: "bg-cream text-muted" },
  medium: { label: "Sedang", badge: "bg-warn text-amber-900" },
  high: { label: "Tinggi", badge: "bg-blush text-maroon" },
};

export const STATUS_ORDER: ComplaintStatus[] = [
  "submitted_to_demo_system",
  "under_review",
  "resolved",
  "closed",
];

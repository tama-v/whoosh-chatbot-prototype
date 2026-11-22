"use client";

import type { ReactNode } from "react";
import {
  Building2,
  Check,
  CircleHelp,
  DoorOpen,
  PackageSearch,
  Ticket,
  TrainFront,
} from "lucide-react";
import { CATEGORY_META, PRIORITY_META, STATUS_META, STATUS_ORDER } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Complaint, ComplaintCategory, ComplaintStatus, Priority } from "@/lib/types";

const ICONS = {
  lost_and_found: PackageSearch,
  ticket_issue: Ticket,
  boarding_issue: DoorOpen,
  station_facility: Building2,
  train_service: TrainFront,
  other: CircleHelp,
} as const;

export function CategoryIcon({ category, className = "h-4 w-4" }: { category: ComplaintCategory; className?: string }) {
  const Icon = ICONS[category] ?? CircleHelp;
  return <Icon className={className} />;
}

export function CategoryBadge({ category }: { category: ComplaintCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/70 px-2.5 py-1 text-[13px] font-bold text-ink/75">
      <CategoryIcon category={category} className="h-3.5 w-3.5 text-maroon/75" />
      {CATEGORY_META[category]?.label ?? "Lainnya"}
    </span>
  );
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-bold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-bold ${meta.badge}`}>
      Prioritas {meta.label.toLowerCase()}
    </span>
  );
}

export function ComplaintTimeline({ status, dense = false }: { status: ComplaintStatus; dense?: boolean }) {
  const current = Math.max(STATUS_ORDER.indexOf(status), 0);
  return (
    <ol className="flex flex-col">
      {STATUS_ORDER.map((step, index) => {
        const meta = STATUS_META[step];
        const complete = index < current;
        const active = index === current;
        const reached = complete || active;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[13px] font-extrabold transition ${
                  complete
                    ? "border-maroon bg-maroon text-white"
                    : active
                      ? "border-maroon bg-maroon text-white"
                      : "border-line-strong bg-paper text-muted/50"
                }`}
              >
                {complete ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
              </span>
              {index < STATUS_ORDER.length - 1 && (
                <span className={`w-px flex-1 ${reached ? "bg-maroon/35" : "bg-line"} ${dense ? "min-h-4" : "min-h-6"}`} />
              )}
            </div>
            <div className={`${dense ? "pb-2" : "pb-3"} -mt-0.5`}>
              <p className={`text-[13px] font-bold ${reached ? "text-ink" : "text-muted/60"}`}>{meta.label}</p>
              <p className="text-[13px] leading-relaxed text-muted/70">{meta.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-muted/55">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink/80">{children}</p>
    </div>
  );
}

export function ComplaintDetail({ complaint }: { complaint: Complaint }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-ink px-2 py-1 font-mono text-[13px] font-bold tracking-wide text-white">
          {complaint.ticket_number}
        </span>
        <StatusBadge status={complaint.status} />
        <PriorityBadge priority={complaint.priority} />
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blush text-maroon">
          <CategoryIcon category={complaint.category} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-extrabold text-ink">{CATEGORY_META[complaint.category]?.label}</p>
          <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-muted">
            {complaint.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-line/70 bg-cream/50 p-3">
        <MetaItem label="Tanggal perjalanan">{formatDate(complaint.travel_date)}</MetaItem>
        <MetaItem label="Stasiun">{complaint.station || "—"}</MetaItem>
        <MetaItem label="Kereta">{complaint.train_info || "—"}</MetaItem>
        <MetaItem label="Kontak">{complaint.contact || "—"}</MetaItem>
      </div>

      {complaint.summary && (
        <div className="rounded-2xl border border-line/60 bg-paper p-3">
          <p className="text-[13px] font-medium text-muted/55">Ringkasan laporan</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{complaint.summary}</p>
        </div>
      )}

      <div className="rounded-2xl border border-line/70 bg-paper p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-bold text-ink">Status penanganan</p>
          <span className="text-[13px] font-medium text-muted/55">Simulasi</span>
        </div>
        <ComplaintTimeline status={complaint.status} dense />
        <p className="mt-1 text-[13px] text-muted/60">
          Dibuat {formatDateTime(complaint.created_at)} · diperbarui {formatDateTime(complaint.updated_at)}
        </p>
      </div>

      <p className="rounded-xl bg-warn px-3 py-2 text-[13px] leading-relaxed text-amber-900/80">
        Laporan ini tersimpan pada sistem simulasi internal aplikasi. Bukan tiket resmi dan tidak
        diteruskan ke sistem operator.
      </p>
    </div>
  );
}

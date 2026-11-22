"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { initials, useAuth } from "@/lib/auth";

function GateCard({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-180px)] max-w-md items-center justify-center">
      <div className="w-full rounded-[24px] border border-line/75 bg-paper p-7 text-center shadow-[var(--shadow-soft)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blush text-maroon">
          {icon}
        </span>
        <h2 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
        <div className="mt-6 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[14px] text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memeriksa akses admin…
      </div>
    );
  }

  if (!user) {
    return (
      <GateCard
        icon={<LockKeyhole className="h-5 w-5" />}
        title="Dashboard membutuhkan akun admin"
        body="Masuk dengan akun admin untuk melihat analitik, mengubah status laporan, dan mengelola knowledge base. Chat dan laporan penumpang tetap bisa dipakai tanpa login."
      >
        <Link href="/login" className="ui-btn-primary h-11 w-full text-[14px]">
          Masuk sebagai admin
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/chat" className="ui-btn-ghost h-11 w-full text-[14px]">
          Kembali ke chat
        </Link>
      </GateCard>
    );
  }

  if (user.role !== "admin") {
    return (
      <GateCard
        icon={<UserRound className="h-5 w-5" />}
        title="Akun ini bukan admin"
        body={`Kamu masuk sebagai ${user.name}. Dashboard hanya terbuka untuk role admin.`}
      >
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-[13px] text-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon text-[12px] font-bold text-white">
            {initials(user.name)}
          </span>
          <span className="truncate">{user.email}</span>
        </div>
        <Link href="/chat" className="ui-btn-primary h-11 w-full text-[14px]">
          Lanjut sebagai penumpang
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="ui-btn-ghost h-11 w-full text-[14px]"
        >
          Keluar dan ganti akun
        </button>
      </GateCard>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-mint px-3.5 py-2 text-[13px] text-emerald-900">
        <ShieldCheck className="h-3.5 w-3.5" />
        Sesi admin aktif sebagai {user.email}
      </div>
      {children}
    </div>
  );
}

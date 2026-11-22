"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { HeiserMascot } from "@/components/heiser/heiser-mascot";
import { Wordmark } from "@/components/whoosh-mark";
import { initials, useAuth } from "@/lib/auth";

type Mode = "login" | "register";

export function LoginWorkspace() {
  const router = useRouter();
  const { user, loading, login, register, logout } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const account =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(name.trim(), email.trim(), password);
      router.push(account.role === "admin" ? "/admin" : "/chat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tidak dapat memproses akun.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      setNotice("Kamu sudah keluar dari sesi ini.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-cream">
      <header className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke beranda
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
        <section className="order-1 flex flex-col justify-center rounded-[24px] border border-line/75 bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-9 lg:order-1">
          {loading ? (
            <div className="flex items-center gap-2 text-[14px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memeriksa sesi…
            </div>
          ) : user ? (
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-[13px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sesi aktif
              </span>
              <h1 className="mt-5 text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[36px]">
                Halo, {user.name}.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Kamu masuk sebagai{" "}
                <span className="font-semibold text-ink">
                  {user.role === "admin" ? "Admin" : "Penumpang"}
                </span>
                . Riwayat baru akan tersimpan pada akun ini.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-cream/60 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-maroon text-[14px] font-bold text-white">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{user.email}</p>
                  <p className="text-[13px] text-muted">
                    {user.role === "admin" ? "Akses dashboard penuh" : "Akun penumpang"}
                  </p>
                </div>
              </div>
              {notice && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-mint px-3.5 py-2.5 text-[13px] text-emerald-900">
                  {notice}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link
                  href={user.role === "admin" ? "/admin" : "/chat"}
                  className="ui-btn-primary h-11 px-5 text-[14px]"
                >
                  {user.role === "admin" ? "Buka dashboard" : "Lanjut ke chat"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={busy}
                  className="ui-btn-ghost h-11 px-4 text-[14px]"
                >
                  Keluar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-medium text-muted">Akun lokal Whoosh AI</p>
              <h1 className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[38px]">
                Masuk untuk menyimpan percakapan.
              </h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                Tamu tetap bisa chat. Masuk agar riwayat dan laporan terikat ke akunmu, atau
                gunakan akun admin untuk mengelola knowledge base.
              </p>

              <div className="mt-6 inline-flex rounded-xl border border-line bg-cream/70 p-1">
                {(
                  [
                    ["login", "Masuk"],
                    ["register", "Daftar"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value);
                      setError(null);
                    }}
                    className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
                      mode === value ? "bg-paper text-maroon shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "register" && (
                  <div>
                    <label className="label" htmlFor="auth-name">
                      Nama
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                      <input
                        id="auth-name"
                        className="field pl-10"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nama lengkap"
                        autoComplete="name"
                        minLength={2}
                        maxLength={60}
                        required
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="auth-email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                    <input
                      id="auth-email"
                      type="email"
                      className="field pl-10"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nama@contoh.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="auth-password">
                    Kata sandi
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                    <input
                      id="auth-password"
                      type="password"
                      className="field pl-10"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === "register" ? "Minimal 8 karakter" : "Kata sandi akun"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      minLength={mode === "register" ? 8 : 1}
                      maxLength={200}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="ui-btn-primary h-11 w-full text-[14px]"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "login" ? "Masuk" : "Buat akun"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                Akun admin awal dibuat otomatis oleh backend saat pertama berjalan. Kredensialnya
                tersimpan di folder data backend, bukan di frontend. Tidak ada data yang dikirim ke
                sistem perusahaan.
              </p>
            </>
          )}
        </section>

        <aside className="order-2 overflow-hidden rounded-[24px] bg-wine p-6 text-white sm:p-8 lg:order-2 lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-[13px] font-medium text-rose-100/90">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sesi mandiri · tanpa layanan pihak ketiga
            </span>
            <h2 className="mt-5 max-w-sm text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px]">
              Heiser tetap siap, riwayatmu sekarang punya pemilik.
            </h2>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-rose-100/75">
              Login admin melindungi upload dokumen, pembaruan status laporan, dan diagnostik RAG.
              Kata sandi di-hash dengan PBKDF2; sesi disimpan di server.
            </p>
          </div>
          <div className="mt-8 flex items-end justify-between gap-4">
            <div className="hidden w-[190px] sm:block">
              <HeiserMascot mode="happy" />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 text-[13px] text-rose-100/80">
              {["Cookie HttpOnly", "Role admin", "Rate limit", "Data per akun"].map((item) => (
                <span key={item} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

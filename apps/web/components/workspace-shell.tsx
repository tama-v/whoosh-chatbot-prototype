"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  House,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserRound,
  Waves,
} from "lucide-react";
import { initials, useAuth } from "@/lib/auth";
import { WhooshMark, Wordmark } from "./whoosh-mark";

const NAV = [
  { href: "/chat", label: "Chat", icon: MessageCircle, group: "Penumpang" },
  { href: "/complaints", label: "Laporan", icon: ClipboardList, group: "Penumpang" },
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Admin" },
  { href: "/admin#knowledge", label: "Pengetahuan", icon: BookOpen, group: "Admin" },
];

const MOBILE_NAV = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/complaints", label: "Laporan", icon: ClipboardList },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin#knowledge") return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceShell({
  children,
  title,
  kicker,
  fill = false,
}: {
  children: ReactNode;
  title: string;
  kicker?: string;
  fill?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-cream">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line/75 bg-paper/95 px-5 py-6 lg:flex">
        <Wordmark />
        <div className="mt-8 space-y-6">
          {(user?.role === "admin" ? ["Penumpang", "Admin"] : ["Penumpang"]).map((group) => (
            <div key={group}>
              <p className="mb-2 px-3 text-[13px] font-medium text-muted/80">{group}</p>
              <nav className="space-y-1">
                {NAV.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                        active
                          ? "bg-maroon text-white"
                          : "text-muted hover:bg-blush hover:text-maroon"
                      }`}
                    >
                      <Icon className={`h-[17px] w-[17px] ${active ? "text-white" : "text-muted/80"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-[20px] border border-line/75 bg-blush p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper ring-1 ring-line/80">
              <WhooshMark className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[14px] font-semibold leading-tight text-ink">Heiser</p>
              <p className="text-[13px] text-muted">Asisten perjalanan</p>
            </div>
          </div>
          <Link
            href="/chat"
            className="ui-btn-ghost mt-3.5 h-9 w-full rounded-xl px-3 text-[13px]"
          >
            Tanya Heiser
            <Waves className="h-3.5 w-3.5 text-maroon" />
          </Link>
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-[20px] border border-line/75 bg-cream/70 px-3.5 py-3">
            <p className="text-[13px] font-semibold text-ink">Prototipe mandiri</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Bukan layanan resmi operator. Verifikasi info penting di kanal resmi.
            </p>
          </div>
          {loading ? (
            <div className="flex h-[58px] items-center rounded-[20px] border border-line/75 bg-paper px-3 text-[13px] text-muted">
              Memeriksa sesi…
            </div>
          ) : user ? (
            <div className="flex items-center gap-2.5 rounded-[20px] border border-line/75 bg-paper px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush text-[13px] font-semibold text-maroon">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">{user.name}</p>
                <p className="text-[13px] text-muted">
                  {user.role === "admin" ? "Admin" : "Penumpang"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                title="Keluar"
                aria-label="Keluar"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-blush hover:text-maroon"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2.5 rounded-[20px] border border-line/75 bg-paper px-3 py-2.5 transition-colors hover:border-maroon/25 hover:bg-cream"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush text-maroon">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">Tamu</p>
                <p className="text-[13px] text-muted">Masuk untuk menyimpan riwayat</p>
              </div>
              <LogIn className="ml-auto h-4 w-4 text-muted/60" />
            </Link>
          )}
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-line/65 bg-cream/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <Wordmark compact />
            </div>
            <div className="hidden items-center gap-1.5 text-[13px] font-medium text-muted lg:flex">
              <span>Whoosh AI</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
              <span className="text-ink">{title}</span>
            </div>
            <div className="lg:hidden">
              <p className="text-[13px] font-medium text-muted">{kicker ?? "Whoosh AI"}</p>
              <p className="-mt-0.5 text-[14px] font-semibold text-ink">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-[13px] font-medium text-ink transition-colors hover:border-maroon/30 hover:bg-cream sm:flex"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-maroon" />
                Admin
              </Link>
            )}
            {user ? (
              <details className="group relative">
                <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-maroon text-[13px] font-semibold text-white ring-2 ring-cream [&::-webkit-details-marker]:hidden">
                  {initials(user.name)}
                </summary>
                <div className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-paper p-1.5 shadow-[var(--shadow-lift)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[13px] text-muted">{user.email}</p>
                    <span className="mt-1.5 inline-flex rounded-md bg-blush px-2 py-0.5 text-[12px] font-semibold text-maroon">
                      {user.role === "admin" ? "Admin" : "Penumpang"}
                    </span>
                  </div>
                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 text-muted" />
                      Dashboard admin
                    </Link>
                  )}
                  <Link
                    href="/chat"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-ink hover:bg-cream"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-muted" />
                    Chat
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-maroon hover:bg-blush"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Keluar
                  </button>
                </div>
              </details>
            ) : (
              <Link
                href="/login"
                className="flex h-8 items-center gap-1.5 rounded-full bg-maroon px-3 text-[13px] font-semibold text-white ring-2 ring-cream"
              >
                <UserRound className="h-3.5 w-3.5" />
                Masuk
              </Link>
            )}
          </div>
        </header>

        <main
          className={
            fill
              ? "px-4 pb-28 pt-4 sm:px-6 lg:pb-10 xl:h-[calc(100dvh-68px)] xl:overflow-hidden xl:pb-5 xl:pt-5"
              : "px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6"
          }
        >
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-paper/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between">
          {(user?.role === "admin"
            ? [...MOBILE_NAV, { href: "/admin", label: "Admin", icon: LayoutDashboard }]
            : MOBILE_NAV
          ).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "bg-blush text-maroon" : "text-muted"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

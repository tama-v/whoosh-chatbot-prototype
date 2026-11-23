"use client";

import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "./whoosh-mark";

export function MarketingHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
          <Link href="#fitur" className="whitespace-nowrap transition-colors hover:text-ink">
            Fitur
          </Link>
          <Link href="#cara-kerja" className="whitespace-nowrap transition-colors hover:text-ink">
            Cara kerja
          </Link>
          <Link href="/complaints" className="whitespace-nowrap transition-colors hover:text-ink">
            Laporan
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin" className="whitespace-nowrap transition-colors hover:text-ink">
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2.5">
          {user ? (
            <Link
              href={user.role === "admin" ? "/admin" : "/chat"}
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-line-strong/80 bg-paper px-3 text-[13px] font-medium text-ink transition-colors hover:border-maroon/30 hover:bg-cream sm:flex"
            >
              <UserRound className="h-3.5 w-3.5 text-maroon" />
              {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-xl px-2 text-[13px] font-semibold text-ink transition-colors hover:text-maroon sm:flex"
            >
              Masuk
            </Link>
          )}
          <Link href="/chat" className="ui-btn-primary h-10 whitespace-nowrap px-4 text-[13px]">
            Coba Heiser
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

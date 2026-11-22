import type { Metadata } from "next";
import { LoginWorkspace } from "@/components/auth/login-workspace";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk atau daftar akun lokal Whoosh AI untuk menyimpan riwayat dan laporan.",
};

export default function LoginPage() {
  return <LoginWorkspace />;
}

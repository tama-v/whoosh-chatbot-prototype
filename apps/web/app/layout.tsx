import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Whoosh AI — Asisten Perjalanan Whoosh",
    template: "%s · Whoosh AI",
  },
  description:
    "Asisten perjalanan Whoosh AI: chat dengan dokumen sumber, pertanyaan suara, laporan keluhan, dan dashboard admin. Knowledge base demo, bukan sistem operator.",
};

export const viewport: Viewport = {
  themeColor: "#961826",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

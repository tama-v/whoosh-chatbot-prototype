import Link from "next/link";
import { ArrowRight, ClipboardList, FileText, Mic } from "lucide-react";
import { HeiserMascot } from "@/components/heiser/heiser-mascot";
import { MarketingHeader } from "@/components/marketing-header";
import { WhooshMark, Wordmark } from "@/components/whoosh-mark";

const FLOWS = [
  {
    icon: FileText,
    title: "Jawaban dengan sumber",
    body: "Setiap balasan menyebut dokumen dan bagian yang dipakai. Bila bukti tidak cukup, Heiser mengatakannya.",
    visual: "sources" as const,
  },
  {
    icon: Mic,
    title: "Tanya lewat suara",
    body: "Rekam pertanyaan, periksa transkrip, lalu dengarkan jawabannya langsung dari perangkatmu.",
    visual: "voice" as const,
  },
  {
    icon: ClipboardList,
    title: "Laporan terstruktur",
    body: "Ceritakan keluhan; Heiser mengusulkan kategori, prioritas, dan detail yang masih kurang.",
    visual: "complaint" as const,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tanya dengan teks atau suara",
    body: "Pilih pertanyaan cepat atau tulis sendiri. Bahasa Indonesia dan Inggris diterima.",
  },
  {
    number: "02",
    title: "Heiser menelusuri dokumen",
    body: "Pertanyaan dicocokkan dengan panduan perjalanan yang tersedia. Jawaban tidak keluar dari isi dokumen.",
  },
  {
    number: "03",
    title: "Baca jawaban dan sumbernya",
    body: "Dokumen sumber tampil di bawah jawaban, dan jawaban bisa dibacakan atau dilanjutkan menjadi laporan.",
  },
];

function FlowVisual({ kind }: { kind: (typeof FLOWS)[number]["visual"] }) {
  if (kind === "sources") {
    return (
      <div className="space-y-2">
        {["Panduan Boarding · bagian 2", "Stasiun dan Fasilitas · bagian 1"].map((source) => (
          <div key={source} className="flex items-center gap-2 rounded-lg border border-line/80 bg-cream/50 px-3 py-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-maroon/70" />
            <span className="min-w-0 truncate text-[13px] text-muted">{source}</span>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "voice") {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-line/80 bg-paper px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon text-white">
          <Mic className="h-4 w-4" />
        </span>
        <div className="flex h-8 flex-1 items-center gap-1">
          {[14, 22, 30, 18, 26, 12, 20, 28, 16, 24].map((height, index) => (
            <span
              key={index}
              className="wave-bar w-0.5 rounded-full bg-maroon/45"
              style={{ height, animationDelay: `${index * 0.08}s` }}
            />
          ))}
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">Tahan untuk bicara</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line/80 bg-cream/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] font-semibold text-ink">WH-2026-1001</span>
        <span className="rounded-full border border-amber-200 bg-warn px-2 py-0.5 text-[13px] font-medium text-amber-900">
          Ditinjau
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1">
        {[1, 1, 0, 0].map((active, index) => (
          <span key={index} className={`h-1 flex-1 rounded-full ${active ? "bg-maroon" : "bg-line-strong/60"}`} />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-cream">
      <MarketingHeader />

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:min-h-[calc(100svh-72px)] lg:grid-cols-2 lg:gap-16 lg:py-16">
          <div className="animate-fade-up">
            <p className="text-[13px] font-medium text-muted">Asisten perjalanan Whoosh</p>
            <h1 className="mt-5 max-w-[600px] text-[42px] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[56px] lg:text-[44px] xl:text-[58px]">
              Asisten perjalanan Whoosh, dengan{" "}
              <span className="text-maroon">sumber</span> di setiap jawaban.
            </h1>
            <p className="mt-6 max-w-[520px] text-[16px] leading-[1.72] text-muted">
              Tanya soal boarding, bagasi, tiket, atau fasilitas stasiun. Setiap jawaban menyebut
              dokumen dan bagian yang dipakai. Bila bukti tidak cukup, Heiser mengatakannya.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/chat" className="ui-btn-primary h-12 px-6 text-[15px]">
                Mulai chat
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/complaints" className="ui-btn-ghost h-12 px-5 text-[15px]">
                Buat laporan
              </Link>
            </div>
            <p className="mt-7 max-w-[420px] text-[13px] leading-relaxed text-muted">
              Prototipe mandiri. Bukan layanan resmi operator dan tidak terhubung ke sistem
              internal.
            </p>
          </div>

          <div className="animate-fade-up delay-1">
            <div className="overflow-hidden rounded-[20px] border border-line-strong/70 bg-paper shadow-[0_30px_70px_-45px_rgba(115,15,27,0.45)]">
              <div className="flex items-center justify-between border-b border-line/80 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush">
                    <WhooshMark className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">Heiser</p>
                    <p className="text-[13px] text-muted">Siap membantu</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>

              <div className="grid sm:grid-cols-[108px_1fr]">
                <div className="hidden items-center justify-center border-r border-line/80 bg-cream/60 p-3 sm:flex">
                  <div className="w-full">
                    <HeiserMascot mode="idle" />
                  </div>
                </div>

                <div className="min-w-0 space-y-4 p-4 sm:p-5">
                  <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-cream px-4 py-3 text-[14px] leading-relaxed text-ink">
                    Bagaimana cara boarding Whoosh?
                  </p>
                  <div className="max-w-[94%]">
                    <p className="rounded-2xl rounded-bl-md border border-line/80 bg-paper px-4 py-3 text-[14px] leading-[1.68] text-ink/85">
                      Masuk ke area stasiun, ikuti pemeriksaan keamanan, lalu tunjukkan bukti tiket di
                      gate boarding. Datang lebih awal agar tidak tertinggal.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/60 px-2.5 py-1 text-[13px] text-muted">
                        <FileText className="h-3 w-3 text-maroon/70" />
                        Panduan Boarding · bagian 2
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/60 px-2.5 py-1 text-[13px] text-muted">
                        <FileText className="h-3 w-3 text-maroon/70" />
                        Stasiun dan Fasilitas · bagian 1
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-cream/40 px-3 py-2.5">
                    <Mic className="h-4 w-4 shrink-0 text-maroon/70" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                      Tanya soal boarding, tiket, atau bagasi…
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon text-white">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="border-t border-line/70 bg-paper/50">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
              <h2 className="max-w-[620px] text-[34px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[42px]">
                Tiga hal yang bisa Heiser bantu.
              </h2>
              <p className="text-[15px] leading-[1.72] text-muted">
                Setiap jawaban punya sumber, setiap laporan punya status, dan setiap keterbatasan
                dijelaskan.
              </p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-[20px] border border-line/80 bg-line/70 sm:grid-cols-3">
              {FLOWS.map((flow, index) => {
                const Icon = flow.icon;
                return (
                  <article
                    key={flow.title}
                    className="p-6 transition-colors hover:bg-cream/40 sm:p-8"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-cream text-maroon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-[13px] text-muted">0{index + 1}</span>
                    </div>
                    <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-ink">
                      {flow.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-[1.72] text-muted">{flow.body}</p>
                    <div className="mt-6">
                      <FlowVisual kind={flow.visual} />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="border-t border-line/70">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:py-24">
            <div>
              <h2 className="text-[34px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[42px]">
                Transparan dari pertanyaan sampai sumber.
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-[1.72] text-muted">
                Chat dan laporan membaca panduan yang sama. Tidak ada jalur pintas yang melewati
                dokumen.
              </p>
              <p className="mt-8 text-[13px] leading-relaxed text-muted">
                Prototipe mandiri · tidak terhubung ke sistem operator.
              </p>
            </div>

            <ol className="divide-y divide-line/80 border-t border-line/80">
              {STEPS.map((step) => (
                <li key={step.number} className="grid grid-cols-[48px_1fr] gap-4 py-6 first:pt-5 sm:gap-6">
                  <span className="font-mono text-[13px] font-semibold text-maroon">{step.number}</span>
                  <div>
                    <h3 className="text-[17px] font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1.5 max-w-lg text-[15px] leading-[1.72] text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-wine">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:py-24">
            <div>
              <h2 className="max-w-[640px] text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[44px]">
                Mulai dari satu pertanyaan.
              </h2>
              <p className="mt-4 max-w-[520px] text-[15px] leading-[1.72] text-rose-100/75">
                Chat, dengarkan jawaban, lalu buat laporan bila ada kendala perjalanan.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/chat" className="ui-btn h-12 bg-paper px-6 text-[15px] text-maroon hover:bg-paper">
                Mulai chat
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/complaints"
                className="ui-btn h-12 border border-white/25 px-5 text-[15px] text-white hover:bg-paper/10"
              >
                Buat laporan
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/70 bg-cream">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Wordmark />
            <span className="hidden h-4 w-px bg-line-strong/70 sm:block" />
            <p className="text-[13px] text-muted">Prototipe asisten perjalanan · 2026</p>
          </div>
          <p className="text-[13px] text-muted">
            Bukan layanan resmi operator. Verifikasi informasi penting di kanal resmi.
          </p>
        </div>
      </footer>
    </div>
  );
}

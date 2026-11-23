# Whoosh AI — Prototype Asisten Penumpang

Prototype asisten perjalanan Whoosh dengan maskot 2D **Heiser** (dipertahankan dari `train-mascot/mascot-2d.html`), chat RAG bilingual dengan sitasi, voice mode (ASR/TTS) dengan fallback demo, complaint assistant simulasi, admin dashboard dengan diagnostik retrieval, serta aplikasi pendamping **Expo/React Native** yang memakai API yang sama. Autentikasi, sesi, dan rate limiting berjalan mandiri di dalam backend (tanpa layanan pihak ketiga).

> **Bukan layanan resmi operator.** Prototype ini tidak terhubung ke sistem internal operator, tidak mengirim keluhan ke petugas, dan tidak menetapkan tarif/jadwal/kebijakan resmi. Semua data berasal dari database demo SQLite atau dokumen contoh di `backend/knowledge/`.

## Isi workspace

| Path | Keterangan |
| --- | --- |
| `apps/web` | Next.js 15 App Router + React 19 + Tailwind v4 (TypeScript) |
| `apps/mobile` | Expo SDK 58 + React Native 0.88 (TypeScript), identitas Heiser, tab Chat/Laporan/Akun |
| `backend` | FastAPI modular monolith, SQLite demo + migrasi berversi, hybrid retrieval, SSE streaming, auth + rate limiting |
| `backend/knowledge` | Dokumen demo knowledge base (ID + EN, total 12 dokumen) |
| `assets/character` | Maskot 2D asli (`mascot-2d.html`) dan preview, dipertahankan dari desain awal |
| `backend/data` | Runtime lokal: database demo, cache audio TTS, dan `admin_bootstrap.txt` (tidak disertakan di repo) |
| `backend/uploads` | Runtime lokal: file yang diunggah lewat admin demo (tidak disertakan di repo) |

## Prasyarat

- Node.js 22+ dan npm
- Python 3.11+

## Menjalankan

### Cara cepat: Docker Compose (PostgreSQL/pgvector + backend + web + Expo web)

Prasyarat: Docker Desktop. Dari root repo:

```bash
docker compose up --build
```

| Layanan | URL | Catatan |
| --- | --- | --- |
| Web | <http://localhost:3000> | Next.js dev, proxy `/api/v1` ke container backend |
| Backend | <http://localhost:8000/docs> | FastAPI + SQLite, `--reload` |
| Expo web | <http://localhost:8082> | App React Native yang sama, dikompilasi ke web |

- Source di-bind-mount, jadi edit file tetap hot-reload. `node_modules` disimpan di volume terpisah agar tidak tertimpa.
- Database demo, upload, cache TTS, dan `admin_bootstrap.txt` tetap di `backend/data` pada host.
- Port host **8081 sengaja dikosongkan** untuk Metro/Expo Go di host (`npm run android` tetap jalan di luar Docker).
- Untuk mengaktifkan Qwen, buat `.env` di root (contoh di `.env.example`); service backend membacanya bila ada.
- Berhenti: `docker compose down`. Reset total termasuk volume `node_modules`: `docker compose down -v`.

Langkah manual tanpa Docker tetap berlaku di bawah ini.

### Demo dari perangkat lain di Wi-Fi yang sama

1. Cari IP LAN komputer ini (`ipconfig` di Windows), misalnya `192.168.1.9`.
2. Tambahkan origin perangkat ke `.env` di root (buat dari `.env.example`):
   ```bash
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8082,http://127.0.0.1:8082,http://192.168.1.9:3000,http://192.168.1.9:8082
   ```
3. Terapkan ulang backend agar env baru terbaca, lalu buka dari perangkat lain:
   ```bash
   docker compose up -d backend
   ```
   - Web: `http://192.168.1.9:3000`
   - Expo web: `http://192.168.1.9:8082`
   - Dokumentasi API: `http://192.168.1.9:8000/docs`
4. Untuk Expo Go native, Metro berjalan di host port 8081 (`npm run android` atau `npx expo start --lan`). Isi alamat backend lewat `EXPO_PUBLIC_API_URL=http://192.168.1.9:8000` atau tab **Akun → Server & koneksi**.

Catatan: izinkan port **3000, 8000, 8082** (dan **8081** untuk Expo Go) di Windows Firewall. Hanya lakukan ini di Wi-Fi tepercaya; jangan meneruskan port demo ke internet publik. Aplikasi tetap memakai data demo dan bukan layanan resmi operator.

### 1. Backend (port 8000)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Saat pertama kali berjalan, backend membuat `backend/data/whoosh_ai_demo.db`, menjalankan seed data (knowledge base, keluhan `WH-DEMO-1001…1006`, akun admin lokal), indeks FTS5, dan vektor embedding. Skema dikelola lewat `schema_migrations`, jadi database lama ikut ter-upgrade otomatis.

Jika `ADMIN_PASSWORD` tidak diisi, backend membuat kata sandi admin acak sekali dan menyimpannya di `backend/data/admin_bootstrap.txt`. Baca file itu untuk login admin; jangan commit atau membagikannya. Untuk mengganti kata sandi, set `ADMIN_PASSWORD` lalu restart backend.

### 2. Web (port 3000)

```bash
cd apps/web
npm install
npm run dev
```

Buka <http://localhost:3000>. Next.js me-rewrite `/api/v1/*` ke `API_PROXY_URL` (default `http://127.0.0.1:8000`), jadi tidak ada kunci API di browser.

### 3. Aplikasi mobile Expo (opsional)

```bash
cd apps/mobile
npm install
npm run web      # cek cepat di browser, port 8081
npm run android  # emulator/perangkat Android
npm run ios      # simulator iOS (macOS)
```

Backend harus berjalan di port 8000. Resolusi alamat API otomatis: `EXPO_PUBLIC_API_URL` bila diisi, lalu host Metro/web pada port 8000, lalu `10.0.2.2:8000` untuk emulator Android, lalu `localhost:8000`. Perangkat fisik perlu IP LAN komputer (mis. `EXPO_PUBLIC_API_URL=http://192.168.1.10:8000`) atau isi lewat tab **Akun → Server & koneksi**. Halaman admin tetap di web dan dapat dibuka dari aplikasi lewat tombol "Buka versi web".

Tab bar aplikasi dibuat manual (Chat/Laporan/Akun) agar state chat tetap hidup saat berpindah tab; saran Expo Router di `apps/mobile/AGENTS.md` dari scaffold tidak dipakai.

### 4. Build produksi untuk demo/lomba

Build aplikasi tidak mengemas backend ataupun model AI. Backend harus tetap berjalan dan dapat diakses oleh web/APK.

#### Web production

```bash
cd apps/web
npm ci
npm run typecheck
NEXT_DIST_DIR=.next-production API_PROXY_URL=http://127.0.0.1:8000 npm run build
NEXT_DIST_DIR=.next-production API_PROXY_URL=http://127.0.0.1:8000 npm start
```

`NEXT_DIST_DIR` memisahkan build production dari `.next` milik dev server sehingga keduanya tidak saling menimpa. `API_PROXY_URL` adalah alamat backend untuk rewrite server Next.js, bukan URL yang dipanggil langsung oleh browser. Ganti dengan alamat backend server bila frontend dan backend berada pada mesin berbeda.

#### Android: Expo Go atau APK

- **Expo Go (demo tercepat):** jalankan backend dengan `--host 0.0.0.0`, lalu `EXPO_PUBLIC_API_URL=http://IP_LAPTOP:8000 npx expo start --lan` dari `apps/mobile`. HP dan laptop harus berada pada Wi-Fi tepercaya yang sama.
- **APK (distribusi ke juri):** gunakan EAS Build dengan profile `preview` (`npx eas-cli@latest build --platform android --profile preview`). Siapkan `EXPO_PUBLIC_API_URL` pada environment profile build ke alamat backend HTTPS/HTTP yang dapat diakses HP. Backend lokal di `127.0.0.1` tidak dapat diakses oleh APK pada HP lain.
- Build APK memerlukan akun Expo untuk EAS dan koneksi internet. Jangan memasukkan API key ke `EXPO_PUBLIC_*`; semua variabel dengan prefix tersebut bersifat publik di aplikasi.

Untuk penjurian, API cloud biasanya memberi respons paling konsisten. Ollama lokal dapat menjadi cadangan offline, tetapi pada laptop CPU/RAM terbatas jawaban dapat memerlukan 20–60 detik dan chat non-streaming dapat kembali ke jawaban cadangan bila melewati batas waktunya.

## Konfigurasi AI (Qwen, backend-only)

Semua variabel dibaca dari environment proses backend (tidak ada loader `.env`). Lihat [`.env.example`](./.env.example).

| Variabel | Fungsi |
| --- | --- |
| `DASHSCOPE_API_KEY` | Kunci Alibaba Cloud Model Studio. **Jangan pernah** dikirim ke frontend. |
| `QWEN_BASE_URL` | Base URL OpenAI-compatible, mis. `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. |
| `QWEN_CHAT_MODEL` | Model chat, default `qwen3.7-plus`. Cek nama model terbaru di Model Studio sebelum produksi. |
| `QWEN_EMBEDDING_MODEL` | Default `text-embedding-v4`. Dipakai untuk vektor chunk bila kunci tersedia; jika tidak, retrieval memakai vektor `hashed-token-v1` lokal. |
| `SOCIAL_LLM_TIMEOUT` | Budget jawaban sosial non-streaming dalam detik, default `40`. Naikkan misalnya ke `120` untuk model lokal yang lambat; konsekuensinya pengguna menunggu lebih lama sebelum fallback. |
| `QWEN_ASR_MODEL` | Default `qwen3-asr-flash`, dipanggil lewat `/chat/completions` dengan `input_audio`. |
| `QWEN_TTS_MODEL` / `QWEN_TTS_VOICE_ID` | Default `qwen-audio-3.1-tts-flash` + suara `embun_id`, lewat non-realtime SpeechSynthesizer API. |
| `QWEN_TTS_VOICE_EN` | Override suara Inggris (opsional). |
| `QWEN_TTS_API_BASE` | Override host TTS (opsional). |
| `DEMO_TTS_ENABLED` | Default `1`. Fallback TTS server memakai Windows SAPI (suara Inggris Zira). |

Contoh menjalankan backend manual dengan API cloud dari Git Bash (nama model harus tersedia pada akun Model Studio Anda):

```bash
cd backend
DASHSCOPE_API_KEY='MASUKKAN_API_KEY' \
QWEN_BASE_URL='https://dashscope-intl.aliyuncs.com/compatible-mode/v1' \
QWEN_CHAT_MODEL='qwen3.7-plus' \
QWEN_EMBEDDING_MODEL='text-embedding-v4' \
QWEN_ASR_MODEL='qwen3-asr-flash' \
QWEN_TTS_MODEL='qwen-audio-3.1-tts-flash' \
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Setelah mengganti model embedding, gunakan aksi refresh embedding di admin agar seluruh chunk dihitung ulang dengan model yang baru. Jangan menaruh API key pada perintah yang direkam secara publik, screenshot, atau file yang akan di-commit.

Jika `DASHSCOPE_API_KEY` dan `QWEN_BASE_URL` kosong, aplikasi berjalan penuh dalam **demo mode**:

- Retrieval hybrid lokal: FTS5 BM25 + skor leksikal IDF + vektor hashed 512 dimensi, digabung dengan RRF dan gerbang answerability.
- Jawaban ekstraktif dengan sitasi dokumen/bagian.
- TTS server demo memakai Windows SAPI untuk bahasa Inggris bila suara SAPI tersedia di mesin server; jika tidak (atau untuk bahasa Indonesia), UI memakai suara browser.
- ASR memakai Web Speech API di browser; jika tidak tersedia, UI merekam audio dan memanggil endpoint ASR (yang menjawab `503` tanpa kunci).

UI menampilkan badge mode tersebut secara jujur (mis. "Mode demo", "Suara browser · server TTS belum tersedia").

### Tanpa API key: model open-source lokal

Backend hanya memanggil endpoint OpenAI-compatible, jadi model open-source lokal bisa menggantikan DashScope — mis. **Ollama** (`https://ollama.com`) atau LM Studio. Contoh Ollama dengan `qwen2.5:3b` varian CPU-only (stabil di laptop RAM kecil tanpa GPU besar):

```bash
ollama pull qwen2.5:3b
printf 'FROM qwen2.5:3b\nPARAMETER num_gpu 0\nPARAMETER num_ctx 4096\n' > Modelfile.whoosh
ollama create whoosh-qwen-cpu -f Modelfile.whoosh

cd backend
DASHSCOPE_API_KEY=local \
QWEN_BASE_URL=http://127.0.0.1:11434/v1 \
QWEN_CHAT_MODEL=whoosh-qwen-cpu \
SOCIAL_LLM_TIMEOUT=120 \
QWEN_EMBEDDING_MODEL= QWEN_ASR_MODEL= QWEN_TTS_MODEL= \
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- `DASHSCOPE_API_KEY=local` hanya penanda bahwa endpoint sudah dikonfigurasi; server lokal tidak memvalidasinya.
- Embedding tetap memakai vektor `hashed-token-v1` offline; suara tetap fallback browser/SAPI.
- Model lain yang tersedia di Ollama (`llama3.2:3b`, `phi3.5`, `gemma3:1b`, `mistral`) bisa dipakai dengan mengganti `QWEN_CHAT_MODEL`.
- Kecepatan di mesin demo: ±4–5 token/detik CPU-only, jadi jawaban penuh butuh ±20–60 detik (streaming mulai tampil setelah beberapa detik).
- Client HTTP melewati proxy environment untuk base URL loopback (`127.0.0.1`/`localhost`) agar server lokal tidak terhambat proxy kantor.

### Vector store: SQLite atau pgvector

- `VECTOR_STORE=sqlite` adalah pilihan paling sederhana dan portable; embedding disimpan sebagai BLOB di database demo.
- `VECTOR_STORE=auto` mencoba pgvector lalu kembali ke SQLite bila PostgreSQL tidak tersedia.
- `VECTOR_STORE=pgvector` digunakan oleh Docker Compose. Seluruh stack sudah menjalankan database `pgvector/pgvector:pg16`, membuat skema, dan menyinkronkan embedding saat backend start.
- Untuk backend manual dengan PostgreSQL dari Compose, jalankan `docker compose up -d db`, lalu gunakan `VECTOR_STORE=auto` dan `PGVECTOR_DSN=postgresql://whoosh:whoosh@127.0.0.1:15432/whoosh`.

pgvector meningkatkan similarity search, tetapi tidak menggantikan model chat. Model lokal/API dan pilihan vector store dapat dikombinasikan secara independen.

## Akun, tamu, dan rate limit

- **Peran** — `passenger` (default pendaftaran) dan `admin`. Endpoint `/api/v1/admin/*` serta halaman `/admin` memerlukan login admin.
- **Sesi** — kata sandi di-hash PBKDF2; sesi disimpan di SQLite. Web memakai cookie `whoosh_session` (HttpOnly, SameSite=Lax); mobile memakai Bearer token dari respons login/register. Masa berlaku mengikuti `SESSION_TTL_DAYS`.
- **Mode tamu** — web dan mobile membuat ID tamu acak dan mengirim header `X-Guest-Id`. Percakapan dan laporan tamu terpisah per perangkat; saat login/register, data tamu dengan ID tersebut dipindahkan ke akun.
- **Rate limit** — token bucket in-process per IP dan per grup rute: auth 10/menit, chat 30/menit, voice 30/menit, admin 120/menit, default 240/menit. Respons `429` menyertakan `Retry-After`. Batas dapat diubah lewat environment (lihat `.env.example`).
- **Admin lokal** — dibuat saat boot pertama; kredensial awal ada di `backend/data/admin_bootstrap.txt` (jangan di-commit) atau ditentukan lewat `ADMIN_PASSWORD`.

## Arsitektur RAG & database

- **Dokumen** — `documents` menyimpan metadata + bahasa (`id`/`en`), `chunks` menyimpan potongan per bagian `##`.
- **FTS5** — tabel `chunk_fts` (unicode61, remove_diacritics) memberi ranking BM25.
- **Vektor** — tabel `chunk_embeddings` menyimpan vektor BLOB per chunk dan nama model. Vektor Qwen 1024 dimensi dipakai bila tersedia; vektor hashed 512 dimensi selalu bisa dibuat offline.
- **Fusion** — skor gabungan RRF (K=20) dikali bobot coverage, plus boost judul/bagian/bahasa. Maksimal 2 chunk per dokumen.
- **Gerbang bukti** — retrieval mengembalikan kosong bila coverage mentah **dan** coverage sinonim sama-sama < 0.5, atau bila masih ada istilah fokus yang tidak ditemukan di corpus. Kata umum ("stasiun", "kereta", "tiket") dan kata aksi ("bawa", "bayar", "beli") tidak dihitung sebagai fokus. Sinonim (cancel ↔ cancellation, lift ↔ elevator, ketinggalan ↔ hilang), bentuk jamak Inggris, dan kata bantu ("harus", "lakukan") dinormalisasi agar pertanyaan wajar tidak salah ditolak, sementara topik yang benar-benar absen (mis. WiFi, harga) tetap dijawab "belum ditemukan". Respons demo memilih seksi paling relevan: boarding untuk ketinggalan kereta, fasilitas umum vs aksesibilitas, langkah awal untuk barang tertinggal, dan persiapan sebelum berangkat.
- **Intent panduan** — pertanyaan keluhan ("cara lapor AC rusak") diarahkan ke fitur Laporan tanpa retrieval; pertanyaan kontak/nomor CS menjawab bahwa nomor resmi belum ada di knowledge base demo. Strategi ini tercatat di trace (`complaint` / `contact`).
- **Pesan non-topik** — sapaan, permintaan bantuan, terima kasih, pertanyaan identitas, smalltalk, dan umpan balik meta diproses sebagai percakapan tanpa memicu retrieval. Bila model dikonfigurasi, jawaban dasar ditulis ulang oleh LLM tanpa menambah fakta perjalanan; bila model gagal/timeout, jawaban template menjadi fallback. Pesan lain di luar knowledge base mendapat jawaban "belum ditemukan" plus daftar topik yang tersedia.
- **Trace** — setiap pesan menyimpan `retrieval_trace` (token, kandidat, skor, coverage, model embedding) dan `mode` (`qwen` / `conversational` / `demo` / `demo-fallback` / `no-evidence`) untuk audit di admin. Mode `conversational` mencakup jawaban sosial dari LLM maupun fallback template.
- **Voice** — hasil TTS Qwen di-cache di `backend/data/tts_cache`; metadata provider dikirim lewat header `X-Voice-*`.
- **Migrasi** — `backend/app/database/migrations.py` menjalankan versi skema secara berurutan dan mencatatnya di `schema_migrations`.

## Yang sudah berjalan

- **Chat** — streaming SSE (`meta` / `delta` / `citations` / `done` / `error`) di web dan endpoint non-streaming `POST /api/v1/chat` untuk mobile; toggle ID/EN, riwayat per akun/tamu, salin jawaban, auto-scroll.
- **Sitasi** — setiap jawaban menampilkan dokumen + bagian sumber; jawaban tanpa bukti menyatakan informasi belum ditemukan.
- **Knowledge base bilingual** — 6 dokumen ID + 6 dokumen EN (boarding, bagasi, tiket, fasilitas stasiun, lost & found, keluhan).
- **Voice input** — Web Speech API (ID/EN) di browser; di mobile memakai rekaman `expo-av` → `POST /voice/transcribe`. Fallback web: MediaRecorder → transkrip yang bisa diedit.
- **Voice output** — pemilih "Suara server" / "Suara browser"; server memakai Qwen TTS bila dikonfigurasi, lalu Windows SAPI demo (Inggris) bila tersedia, lalu suara browser. Di mobile jawaban dibacakan dengan TTS perangkat (`expo-speech`) sesuai bahasa jawaban.
- **Complaint assistant** — form dengan klasifikasi kategori/prioritas, nomor laporan simulasi (`WH-…`), pelacakan status lewat nomor tiket, timeline status; data terpisah per akun/tamu dan ikut terklaim saat login.
- **Akun** — register/login/logout di web dan mobile, profil + bahasa + alamat server di tab Akun, gate admin di web.
- **Admin** — analytics dari SQLite (trend 7 hari, status, kategori, sentimen rule-based, pertanyaan populer, jawaban belum ditemukan), ubah status keluhan, upload PDF/TXT/MD (maks 5 MB), reindex, hapus dokumen.
- **Admin diagnostik** — statistik RAG (chunk, vektor, FTS, model, bahasa), status ASR/TTS per bahasa, uji retrieval per pertanyaan (hit + skor + coverage + token), dan refresh embedding.

## Yang belum diimplementasikan

- PostgreSQL/pgvector produksi yang dikelola penuh — integrasi pgvector lokal sudah tersedia melalui Docker Compose, tetapi deployment produksi, backup, replikasi, dan migrasi data produksi belum disiapkan. Supabase belum digunakan.
- Integrasi, sinkronisasi, atau notifikasi ke sistem operator.
- Model sentimen produksi (sentimen memakai kata kunci sederhana).
- Integrasi Qwen ASR/TTS **belum diuji dengan kunci nyata** di environment ini; jalur tanpa kunci (503 + fallback suara browser) yang terverifikasi di Docker/Linux. Fallback SAPI hanya tersedia bila backend dijalankan di Windows. Nama model mengikuti dokumentasi Model Studio dan bisa berubah.
- Suara TTS bahasa Indonesia di server hanya tersedia lewat Qwen; Windows SAPI biasanya tidak punya voice `id-ID`, sehingga mode demo memakai suara browser untuk bahasa Indonesia.
- Verifikasi di perangkat fisik Android/iOS belum dilakukan; UI mobile diverifikasi lewat Expo web pada viewport 390×844.

## API ringkas

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/v1/health` | Status backend, mode AI, model embedding, status voice |
| `POST /api/v1/auth/register` · `POST /api/v1/auth/login` | Buat akun / masuk (cookie web + Bearer untuk mobile) |
| `GET /api/v1/auth/me` · `POST /api/v1/auth/logout` | Profil sesi aktif / keluar |
| `POST /api/v1/chat/stream` | SSE chat dengan sitasi + retrieval trace |
| `POST /api/v1/chat` | Chat non-streaming (dipakai aplikasi mobile) |
| `GET /api/v1/conversations` · `GET /api/v1/conversations/{id}/messages` | Riwayat milik akun/tamu aktif |
| `POST /api/v1/complaints` · `POST /api/v1/complaints/analyze` | Buat / analisis keluhan |
| `GET /api/v1/complaints` · `GET /api/v1/complaints/ticket/{ticket}` · `PATCH /api/v1/complaints/{id}` | Daftar / lacak / ubah status |
| `GET /api/v1/documents` · `POST /api/v1/documents` | Knowledge base |
| `POST /api/v1/documents/{id}/reindex` · `DELETE /api/v1/documents/{id}` | Reindex / hapus |
| `GET /api/v1/admin/analytics` · `GET /api/v1/admin/complaints` | Data dashboard (admin) |
| `GET /api/v1/admin/retrieval/test?q=&language=` | Uji retrieval + trace (admin) |
| `POST /api/v1/admin/embeddings/refresh` | Hitung ulang vektor (admin) |
| `GET /api/v1/voice/health` · `GET /api/v1/voice/voices` | Status + katalog suara |
| `POST /api/v1/voice/transcribe` | ASR (multipart `audio`, `language`) |
| `POST /api/v1/voice/synthesize` | TTS (JSON `text`, `language`, `voice_id`) → WAV |

Dokumentasi interaktif: <http://127.0.0.1:8000/docs>. Klien tamu mengirim header `X-Guest-Id` (8–64 karakter alfanumerik/`_`/`-`); klien login mengirim cookie sesi atau `Authorization: Bearer <token>`.

## Keamanan

- `DASHSCOPE_API_KEY` dan kunci rahasia apa pun hanya boleh berada di environment backend.
- Jangan commit `.env`, `backend/data/admin_bootstrap.txt`, database demo berisi data uji, cache audio, atau kunci API.
- Set `SESSION_COOKIE_SECURE=1` bila web disajikan lewat HTTPS. Rate limit memakai IP socket; set `RATE_LIMIT_TRUST_PROXY=1` hanya di belakang reverse proxy tepercaya.
- Dokumen yang diunggah hanya disimpan lokal di SQLite/filesystem demo; tidak dikirim ke layanan pihak ketiga. Embedding dikirim ke Qwen hanya jika kunci backend dikonfigurasi.
- Semua jawaban dan keluhan adalah simulasi; jangan gunakan untuk keputusan perjalanan nyata tanpa verifikasi kanal resmi.

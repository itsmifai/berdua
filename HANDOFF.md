# BERDUA — Dokumen Spesifikasi Implementasi (Handoff)

> **Untuk agent coding:** Dokumen ini adalah sumber kebenaran (source of truth) untuk membangun aplikasi "Berdua". Baca seluruh dokumen sebelum menulis kode apa pun. File `prototype-v2.html` (di folder yang sama dengan dokumen ini) adalah **referensi visual utama** — salin design token, layout, maskot SVG, dan interaksinya sedekat mungkin.

---

## 1. Ringkasan Produk

**Berdua** adalah web app (PWA, installable) untuk **sepasang kekasih (tepat 2 pengguna)** yang berisi:

1. **Agenda** — kalender bersama; tiap tanggal bisa punya beberapa agenda dengan kategori berwarna; tampilan kalender (dot penanda) + list per tanggal.
2. **Misi (Gamified Tasks)** — task harian yang bisa dibuat masing-masing; setiap misi punya tingkat kesulitan & XP; menyelesaikan misi memberi XP.
3. **Api Bersama (Couple Streak)** — satu streak untuk berdua. Api menyala hanya jika **kedua partner menyelesaikan minimal 1 misi di hari yang sama**. Ini fitur signature.
4. **Leaderboard & Kupon** — XP diakumulasi per minggu (kompetisi siapa lebih tinggi), dan XP bisa ditukar dengan "kupon hadiah" buatan mereka sendiri (mis. "Dipijitin 10 menit" = 100 XP).
5. **Badge milestone** streak: 7, 30, 100, 365 hari.

Bahasa UI: **Indonesia**. Nada: hangat, playful, singkat. **DILARANG memakai emoji di UI** — gunakan ikon SVG inline (gaya feather/lucide) dan karakter maskot SVG dari prototype.

Target platform: mobile-first (dipakai sebagai PWA di HP), tapi harus tetap rapi di desktop (tampilkan dalam frame maks. 420px di tengah, seperti prototype).

---

## 2. Tech Stack (WAJIB — sudah diputuskan)

| Layer | Teknologi | Catatan |
|---|---|---|
| Frontend | **HTML + CSS + Vanilla JavaScript (ES Modules)** | TANPA framework, TANPA build tool (no Vite/webpack). Murni static files agar simpel & cocok dengan prototype |
| Backend/DB | **Supabase** (Postgres + Auth + Realtime + Row Level Security) | Proyek gratis. Semua data sync realtime antar 2 perangkat |
| Auth | **Supabase Auth** — email + password (paling sederhana & andal) | Magic link opsional, jangan wajibkan OAuth |
| PWA | `manifest.json` + **Service Worker** (strategi: cache-first untuk shell, network-first untuk data) | Harus installable ke homescreen Android/iOS |
| Hosting | **Vercel / Netlify / Cloudflare Pages** (pilih salah satu, static deploy) | Tidak butuh server |
| Ikon | Inline SVG (lucide style) | Tidak boleh emoji, tidak boleh icon font |
| Font | Google Fonts: **Plus Jakarta Sans** (400–800) + **Fraunces** (500, 600) | Sama persis dengan prototype |

**Struktur file yang diharapkan:**

```
berdua/
├── index.html              # app shell (5 tab dalam 1 halaman, SPA manual)
├── login.html              # halaman login saja (akun sudah di-seed, lihat §3)
├── css/
│   └── style.css           # semua design token & komponen (salin dari prototype-v2.html)
├── js/
│   ├── app.js              # router tab, init, state global
│   ├── supabaseClient.js   # init client (env: VITE_/global const SUPABASE_URL & ANON_KEY)
│   ├── auth.js             # login, session guard, lupa password
│   ├── today.js            # halaman Hari Ini (flame, misi hari ini, agenda terdekat)
│   ├── agenda.js           # kalender + CRUD agenda
│   ├── misi.js             # CRUD misi, selesaikan misi, leaderboard mingguan
│   ├── poin.js             # saldo XP, toko kupon, redeem
│   ├── profil.js           # statistik, badge, pengaturan
│   ├── streak.js           # logika api bersama (hitung & render)
│   └── fx.js               # confetti, toast, animasi hop maskot
├── img/
│   └── icons/              # ikon PWA (192, 512, maskable)
├── manifest.json
├── sw.js                   # service worker
└── supabase/
    └── schema.sql          # seluruh DDL + RLS (lihat bagian 4)
```

Konfigurasi Supabase (URL + anon key) ditaruh di `js/supabaseClient.js` sebagai konstanta (anon key memang publik; keamanan dijaga oleh RLS).

---

## 3. Model Pengguna & Akun (Keputusan final: TANPA register/pairing)

Pengguna app ini diketahui dari awal dan tetap hanya 2 orang, maka alur register + kode pairing **dihapus**. Pendekatan yang dipakai:

- **Kedua akun dibuat sekaligus di awal (seed)** oleh agent saat Fase 0:
  - Buat 2 user di Supabase Authentication (dashboard → Users → Add user, atau panggil `supabase.auth.signUp()` sekali lewat skrip development).
  - Insert 1 row `couples` (status `paired`; minta `anniversary_date` ke pemilik produk, boleh null) dan 2 row `profiles` yang menunjuk couple itu — `color_role` `terra` untuk akun utama (Miftah), `sage` untuk akun pasangan.
  - Email + password kedua akun dicatat dan diberikan ke pemilik produk. Setelah login pertama, user boleh ganti password sendiri dari menu Profil (opsional).
- **Layar terkait auth jadi minimal**: hanya Login (email + password). Tidak ada form register, tidak ada layar kode invite, tidak ada RPC `join_couple`.
- Reset password memakai recovery email bawaan Supabase ("Lupa password?" di halaman Login) — SMTP default cukup untuk 2 akun.
- Kolom `couples.invite_code` dibiarkan nullable di schema (warisan rencana; mungkin dipakai bila app dibuka untuk orang lain nanti), tapi TIDAK ada UI-nya di MVP.
- Satu "ruang" = satu **couple** berisi tepat 2 profil; pasangan ditampilkan di header sebagai dua avatar maskot dengan centang "aktif hari ini" (sudah menyelesaikan ≥1 misi hari itu).

---

## 4. Skema Database (Supabase Postgres)

Buat file `supabase/schema.sql` berisi seluruh tabel berikut + RLS. Kolom `uuid id default gen_random_uuid()`, `created_at timestamptz default now()` di semua tabel.

```sql
-- 1. couples: ruang bersama
create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique,                   -- nullable; tidak dipakai di MVP (lihat §3)
  status text not null default 'paired',     -- waiting | paired (seed langsung 'paired')
  anniversary_date date,                     -- opsional, diisi user
  created_at timestamptz default now()
);

-- 2. profiles: 1 per user auth
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references couples(id),
  display_name text not null,
  color_role text not null default 'terra',  -- terra | sage
  xp_balance int not null default 0,         -- XP yang belum dibelanjakan
  created_at timestamptz default now(),
  unique (couple_id, color_role)
);

-- 3. missions: template task (bisa berulang harian)
create table missions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null check (char_length(title) <= 60),
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  assignee uuid references profiles(id),     -- null = berdua/bergantian (siapa saja boleh selesaikan & dapat XP)
  is_active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
-- XP per difficulty: easy=10, medium=25, hard=50 (JANGAN simpan di DB, hitung di kode; atau pakai generated column/check — pilih konstanta di JS)

-- 4. mission_completions: fakta penyelesaian (1 baris = 1 penyelesaian)
create table mission_completions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  mission_id uuid references missions(id) on delete set null,
  user_id uuid not null references profiles(id),
  xp_awarded int not null check (xp_awarded > 0),
  completed_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_at timestamptz default now(),
  unique (mission_id, user_id, completed_on)  -- 1 misi maksimal 1x/hari/orang
);

-- 5. agenda_events
create table agenda_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null check (char_length(title) <= 80),
  event_date date not null,
  event_time time,                            -- nullable (agenda sepanjang hari)
  location text,                              -- nullable
  category text not null default 'kencan' check (category in ('kencan','ibadah','kerja','spesial')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

-- 6. coupons: item toko (dibuat oleh couple, untuk couple)
create table coupons (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null check (char_length(name) <= 50),
  price_xp int not null check (price_xp between 10 and 5000),
  icon_key text not null default 'gift',      -- gift | food | heart | briefcase | movie | custom
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 7. coupon_redemptions: riwayat penukaran
create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  coupon_id uuid references coupons(id),
  redeemed_by uuid not null references profiles(id),
  price_xp int not null,
  status text not null default 'redeemed' check (status in ('redeemed','fulfilled','cancelled')),
  redeemed_at timestamptz default now()
);
```

### 4.1 Streak — TIDAK pakai tabel state, hitung on-the-fly

Api bersama diturunkan dari `mission_completions`:

```
streak_day(d) ADA  jika ada penyelesaian misi oleh user A pada tanggal d
                 DAN ada penyelesaian oleh user B (partner) pada tanggal d
                 (A ≠ B, keduanya anggota couple yang sama)

streak_sekarang = jumlah hari berturut-turut (mundur dari hari ini, TZ Asia/Jakarta)
                  yang memenuhi streak_day.
                  KHUSUS: jika hari ini belum memenuhi tapi kemarin memenuhi,
                  streak TIDAK hangus — tampilkan angka streak kemarin dengan
                  status "terancam" (api redup), karena hari ini belum selesai.
                  Api benar-benar putus jika ada hari (sebelum hari ini) yang bolong.
```

Sediakan SQL function `couple_streak(p_couple_id uuid)` yang mengembalikan `(current_streak int, longest_streak int, is_today_done boolean, is_at_risk boolean)` agar efisien, ATAU hitung di client dengan satu query `select distinct completed_on, user_id from mission_completions where couple_id = ? and completed_on >= current_date - 400`. Pilih function di DB (lebih bersih). Sertakan unit-test manual di catatan PR.

### 4.2 RLS (WAJIB, ini lapisan keamanan utama)

Aktifkan RLS di semua tabel. Pola policy (contoh untuk `missions`, terapkan setara untuk semua tabel ber-`couple_id`):

```sql
alter table missions enable row level security;

-- helper: ambil couple_id user yang sedang login
create or replace function my_couple_id() returns uuid
language sql stable security definer as $$
  select couple_id from profiles where id = auth.uid()
$$;

create policy "couple read" on missions for select
  using (couple_id = my_couple_id());
create policy "couple insert" on missions for insert
  with check (couple_id = my_couple_id() and created_by = auth.uid());
create policy "couple update" on missions for update
  using (couple_id = my_couple_id());
create policy "couple delete" on missions for delete
  using (couple_id = my_couple_id());
```

Aturan tambahan:
- `profiles`: user hanya bisa update profil sendiri; select untuk satu couple; INSERT hanya via seed/admin (service role) — client tidak perlu bisa insert (lihat §3).
- `couples`: select hanya bila `id = my_couple_id()`. Row dibuat via seed/admin, jadi policy insert/update cukup untuk service role. RPC `join_couple` TIDAK diperlukan di MVP (lihat §3).
- `mission_completions`: insert hanya `user_id = auth.uid()`; **delete tidak diizinkan** (mencegah curang menghapus riwayat) — koreksi kesalahan via update `is_active` di missions, bukan hapus completion. Untuk UX "batal centang", izinkan delete completion HANYA pada hari yang sama (`completed_on = today`) dan kurangi `xp_balance` di trigger yang sama.
- **XP balance dijaga trigger DB** (bukan update dari client) agar tidak bisa dimanipulasi:
  - after insert on `mission_completions` → `xp_balance += xp_awarded` (profil user)
  - after delete on `mission_completions` → `xp_balance -= xp_awarded`
  - RPC `redeem_coupon(coupon_id uuid)` (security definer): validasi saldo cukup → insert `coupon_redemptions` → `xp_balance -= price_xp`, semuanya dalam satu transaksi. Client TIDAK boleh update `xp_balance` langsung (revoke).

### 4.3 Realtime

Aktifkan Supabase Realtime (`alter publication supabase_realtime add table ...`) untuk: `mission_completions`, `agenda_events`, `missions`, `coupons`, `coupon_redemptions`, `profiles`. Client subscribe channel per couple dan me-refresh view aktif saat ada perubahan — sehingga centang misi di HP A langsung terlihat di HP B, api bersama ikut update, dsb.

---

## 5. Spesifikasi Fitur per Layar

### 5.1 Splash (Loading) & Login

**Splash — fitur pemanis, durasi ±2 detik, tampilkan di cold start:**
- Layar penuh warna `#FAF5EE`; logo **Ber*dua*** besar (Fraunces) di tengah dengan fade/slide-in halus + dot api kecil berkedip di bawahnya.
- **DUA maskot blob berjalan** (terracotta di depan, sage mengikuti di belakang — visual "berdua"!) melintasi layar dari kiri ke kanan, loop. **Implementasi persisnya sudah tersedia di `prototype-v2.html` blok `<!-- ===== SPLASH ===== -->` (CSS `.splash*`, `.walk-blob`, `.bw-*` + JS `endSplash`) — salin apa adanya, jangan bikin ulang dari nol.**
- Teknik walk cycle (sudah diterapkan di prototype, pertahankan): tiap maskot adalah inline `<svg>` (bukan `<use>` — agar CSS grup bisa diakses) berisi 3 group: `<g class="bw-body">` (badan + wajah, animasi `bwBob` naik-turun + miring 2.5deg, 0.5s loop), `<g class="bw-arm-a">` & `<g class="bw-arm-b">` (lengan, animasi `bwSwing` rotasi ±20deg dengan `reverse` agar bergantian; `transform-box: fill-box` + `transform-origin` di titik pangkal lengan).
- Sequence nyata: splash tampil → auto-hide ±2.6 detik (fade 0.45s lalu `display:none`) ATAU langsung hide saat diketuk (label "ketuk untuk melewatkan" di bawah). Di app asli: setelah splash selesai → cek session → sudah login: render app; belum: `login.html`. Splash tidak diulang saat pindah tab (tab switch bukan reload).
- Setelah deploy sebagai PWA, splash juga jadi `screens` entry di `manifest.json` (buat gambar statis 1× versinya).

**Login (`login.html`) — sangat sederhana:**
- Layout: cream bg, kartu putih membulat di tengah (max-width 380px), logo "Berdua" kecil + maskot `#blob` diam di pojok kartu, copy hangat singkat (contoh: "Masuk ke ruang kalian berdua").
- Field: Email, Password, tombol "Masuk" (gaya 3D), link "Lupa password?" (recovery email bawaan Supabase).
- Kredensial salah → toast "Email atau password salah" + animasi shake halus pada kartu.
- TIDAK ada form register / input kode pairing — akun sudah di-seed (§3).
- Session guard: akses `index.html` tanpa session valid → lempar ke `login.html`.
- Tombol kecil "Install app" (pakai event `beforeinstallprompt`) tersedia di halaman ini saat tersedia.

### 5.2 Header (persisten di index.html)
- Kiri: logo teks **Ber*dua*** (Fraunces, "dua" warna terracotta) — persis prototype.
- Tengah: dua pill statistik: (1) ikon flamechar + angka streak hari ini; (2) ikon petir + saldo XP user login. Keduanya live-update.
- Kanan: dua avatar maskot (warna sesuai `color_role` masing-masing; yang login di kiri). Centang hijau/terracotta muncul bila sudah menyelesaikan ≥1 misi hari ini.

### 5.3 Tab "Hari Ini"
1. **Kartu Api Bersama** — salin persis dari prototype: flamechar animasi flicker + glow, diapit 2 maskot bergoyang. Angka besar = streak hari. Status teks (3 kondisi):
   - Both done hari ini → "Api kalian menyala!"
   - Baru satu yang done → "Tinggal {nama} lagi hari ini!" (dot progress per orang)
   - At risk (belum ada yang done, streak kemarin aktif) → api redup (filter grayscale 40% + opacity) + "Ayo selamatkan api kalian!"
2. **Misi Hari Ini** — semua misi aktif (assignee = user ini ATAU assignee null), max 5 teratas; checkbox bulat 3D; tap → RPC insert `mission_completions` → confetti + toast random dari daftar CHEERS + maskot header hop + pill XP & streak update. Tap lagi (hari sama) → batal (delete completion, XP dikurangi, tanpa confetti).
3. **Agenda terdekat** — 2 event terdekat (hari ini & sesudahnya), row: kotak tanggal + judul + jam + dot kategori.
4. **Gift strip** — kartu gelap: maskot amber + "…XP = {kupon termurah}!" → tap ke tab Poin. Ambil kupon aktif termurah; jika tidak ada, sembunyikan strip.

### 5.4 Tab "Agenda"
- Header bulan (nama + tahun) dengan tombol ‹ › navigasi bulan (render dinamis bulan apa pun, bukan hardcode Oktober 2026 seperti prototype).
- Grid kalender: hari dimulai Minggu; dot maks. 3 per tanggal dengan warna kategori:
  - kencan `#E2725B`, ibadah `#7D9B76`, kerja `#8FA3B8`, spesial `#F5A623`
- Hari ini ditandai warna terracotta; tanggal terpilih = chip gelap (lihat prototype).
- Di bawah: judul "{d} {Bulan}" + list agenda tanggal terpilih; kosong → maskot blob-sad + "Kosong — yuk bikin rencana berdua!".
- FAB "+" (hanya di tab ini) → **modal/bottom-sheet form**: judul, tanggal (default = tanggal terpilih), jam (opsional), lokasi (opsional), kategori (4 chip pilihan warna). Validasi judul wajib.
- Tap lama / ikon kecil di row agenda → opsi edit & hapus (bottom-sheet sederhana).
- Legend kategori di bawah kalender (persis prototype).

### 5.5 Tab "Misi"
1. **Kartu duel VS** — maskot pasangan vs maskot user, XP minggu ini (Senin 00:00 TZ Asia/Jakarta s.d. sekarang, jumlah `xp_awarded` per user dari `mission_completions`). Mahkota di yang memimpin (dan maskot pemimpin animasi hop loop). Progress bar 2 warna (sage = pasangan, terracotta = user). Caption dinamis: "Tertinggal X XP — salip dia!" / "Kamu memimpin! Jangan kasih kendor!" / "Seri! Siapa duluan hari ini?".
2. **Semua Misi** — list semua misi aktif (punya bersama): checkbox (hanya bisa dicentang bila assignee = user atau null), judul, badge XP. Swipe/tap ikon → edit/hapus (hanya pembuat misi atau keduanya? → keduanya boleh, sederhana).
3. **+ Tambah misi** → bottom-sheet form: judul (max 60 char), kesulitan (3 chip: Mudah +10 / Sedang +25 / Sulit +50 — tampilkan XP-nya!), assignee (Kamu / Dia / Siapa saja).
4. Kesulitan → warna chip: easy sage-soft, medium amber-soft, hard terra-soft (lihat prototype).

### 5.6 Tab "Poin"
1. **Kartu saldo** — gelap, maskot terra, "XP Kamu" + angka besar (dari `profiles.xp_balance`).
2. **Toko Kupon** — kartu kupon bergaya tiket (poni lingkaran kiri-kanan via ::before/::after — salin CSS prototype), ikon per `icon_key`, nama, tombol harga 3D amber. Tap → konfirmasi (bottom-sheet "Tukar {nama} dengan {harga} XP?") → RPC `redeem_coupon` → confetti + toast; saldo kurang → toast "XP kurang! Selesaikan misi dulu" + shake halus pada kartu saldo.
3. **+ Bikin kupon** → form: nama (max 50), harga XP (preset chips: 50/100/150/200 + input bebas), ikon (pilih dari 5 icon_key).
4. Kupon yang sudah ditukar muncul di riwayat kecil di bawah (3 terakhir): "{nama} · {siapa} · −{harga}". Status fulfillment: penerima kupon bisa tandai "selesai ditepati" (update status → `fulfilled`) — opsional fase akhir, jangan hambat MVP.

### 5.7 Tab "Profil"
- Maskot besar (warna user) bergoyang, display name, subtitle "{level} · {julukan}" — Level = floor(total XP sepanjang masa / 250) + 1; julukan dari total misi selesai (0+: "Pemula", 20+: "Si Rajin", 50+: "Si Tangguh", 100+: "Legenda Berdua").
- 3 kotak statistik: total misi selesai (user ini, sepanjang masa), streak saat ini, streak terpanjang.
- **Koleksi Badge** 4 slot: 7/30/100/365 hari (berdasarkan `longest_streak`). Earned = border emas + maskot amber/crown; locked = opacity 40% + blob-sad.
- Pengaturan (row dengan ikon): edit display name, ganti warna maskot (terra/sage, validasi tidak bentrok dengan pasangan), logout. (Notifikasi = placeholder "Segera hadir" kecuali diimplementasikan di Fase 6.)

---

## 6. Design System (SALIN dari prototype-v2.html)

Ambil **persis** dari `prototype-v2.html`:

- **CSS variables** — seluruh blok `:root` (bg `#FAF5EE`, terra `#E2725B`, sage `#7D9B76`, amber `#F5A623`, ink `#2E2A26`, dst).
- **Font**: Plus Jakarta Sans (400–800) untuk UI, Fraunces (500,600) untuk angka/nama besar.
- **Maskot & karakter SVG**: symbol `#blob`, `#blob-sad`, `#flamechar`, `#crown` — copy verbatim dari prototype (dipakai via `<use href="#blob">`, warna via `color:` + `fill="currentColor"`).
- **Tombol 3D**: `box-shadow: 0 Npx 0 <warna-gelap>` + `:active { transform: translateY(...); box-shadow mengecil }` — cek di prototype `.m-check`, `.fab`, `.coupon-price`, `.gift-strip`.
- **Animasi**: `flicker` (api), `glowPulse`, `sway` (maskot bergoyang), `hop` (maskot melompat), `fadeIn` (ganti tab).
- **Confetti**: fungsi `confetti(el)` dari prototype (24 partikel, warna palet, Web Animations API) → pindahkan ke `js/fx.js`.
- **Toast**: pill gelap di atas bottom-nav, auto-hide 1.8 detik → `js/fx.js`.
- **Bottom nav** 5 tab dengan ikon lucide inline (home, calendar, check-circle, gift, user); tab aktif terracotta + translateY(-2px).
- **Frame desktop**: di layar > 480px, app dibungkus "phone frame" max-width 420px, rounded 32px, di tengah (persis CSS prototype). Di ≤ 480px full-screen.
- Radius besar (18–26px), shadow halus, kartu putih di atas cream. **Jangan** ubah palet.

---

## 7. PWA

- `manifest.json`: name "Berdua", short_name "Berdua", description, start_url `/index.html`, display `standalone`, background `#FAF5EE`, theme `#E2725B`, icons 192 & 512 (+ maskable). Ikon app: flamechar di atas latar cream (generate SVG → boleh ekspor PNG).
- `sw.js`: cache app shell (index.html, login.html, css, js, img) dengan versioning (`CACHE_NAME = 'berdua-v1'`, invalidate saat deploy); network-first untuk navigasi dengan fallback cache; jangan cache request Supabase.
- Registrasi SW hanya di production/https.
- Tombol/petunjuk "Install" sederhana tersedia di halaman Login saat event `beforeinstallprompt` tersedia (lihat §5.1).

---

## 8. Aturan Bisnis — Rangkuman Tegas

| Aturan | Nilai |
|---|---|
| XP easy / medium / hard | 10 / 25 / 50 |
| Satu misi, satu orang, satu hari | maksimal 1 penyelesaian (unique constraint) |
| Misi `assignee null` | siapa saja boleh selesaikan, XP masuk ke yang menyelesaikan |
| Streak (api bersama) | hari dihitung bila KEDUA user punya ≥1 completion di tanggal itu (TZ Asia/Jakarta) |
| Streak "at risk" | hari ini belum lengkap tapi streak kemarin hidup → tampilkan api redup, angka streak tidak direset sampai hari berganti |
| Leaderboard | XP minggu berjalan, reset tiap Senin 00:00 Asia/Jakarta (hitung dari completions, bukan saldo) |
| Saldo XP | saldo = total didapat − total dibelanjakan; HANYA berubah via trigger/RPC DB |
| Redeem kupon | gagal bila saldo < harga (error toast, bukan alert) |
| Badge | based on longest streak: 7, 30, 100, 365 hari |

Zona waktu canonical seluruh app: **Asia/Jakarta** (`completed_on` default sudah pakai ini).

---

## 9. Rencana Pengerjaan (Fase)

Kerjakan berurutan; setiap fase harus bisa dijalankan & diuji sebelum lanjut:

- **Fase 0 — Setup**: struktur folder, salin design system dari prototype ke `css/style.css`, supabaseClient, `schema.sql` lengkap (tabel + RLS + trigger + RPC `redeem_coupon` + function `couple_streak`), **skrip/langkah seed** sesuai §3 (2 akun auth + 1 couple + 2 profiles). Instruksikan di README cara membuat project Supabase, menjalankan schema.sql, dan menjalankan seed.
- **Fase 1 — Splash & Auth**: layar splash dengan maskot `#blob-walk` berjalan (§5.1), halaman login (kredensial dari seed), session guard, "Lupa password?".
- **Fase 2 — Agenda**: kalender dinamis multi-bulan, CRUD agenda, dot kategori, list per tanggal, empty state.
- **Fase 3 — Misi & XP**: CRUD misi, centang/batal dengan trigger XP, toast+confetti+hop, pill XP header live.
- **Fase 4 — Streak & Leaderboard**: function `couple_streak`, kartu api bersama 3 kondisi, duel VS mingguan dengan mahkota dinamis.
- **Fase 5 — Kupon & Profil**: toko kupon, RPC redeem, bikin kupon, riwayat; halaman profil + badge + statistik.
- **Fase 6 — Realtime & PWA**: subscription realtime per tabel, manifest, service worker, ikon, install prompt, uji offline shell.
- **Fase 7 (opsional polish)**: fulfillment status kupon, edit/hapus agenda & misi penuh, notifikasi pengingat (butuh push — skip bila rumit), halaman anniversary.

---

## 10. Acceptance Checklist (uji sebelum dinyatakan selesai)

- [ ] Dua device/browser berbeda login sebagai pasangan; data identik & tersinkron realtime (centang misi di A muncul di B < 2 detik tanpa refresh).
- [ ] Api bersama hanya menyala bila keduanya menyelesaikan ≥1 misi hari itu; kondisi "at risk" tampil dengan api redup.
- [ ] XP tidak bisa dimanipulasi dari client (cek: update langsung `xp_balance` via console Supabase JS harus ditolak RLS/trigger).
- [ ] Redeem kupon gagal dengan toast ramah bila saldo kurang; saldo & riwayat benar setelah redeem sukses.
- [ ] Leaderboard reset setiap Senin (uji dengan data completions lintas minggu).
- [ ] Kalender bisa navigasi bulan maju/mundur, tambah agenda di tanggal mana pun, dot tampil benar.
- [ ] PWA: bisa di-install di Chrome Android (muncul di homescreen, buka standalone, ikon benar); app shell tetap termuat saat offline (data boleh gagal dengan pesan ramah).
- [ ] Tidak ada emoji di seluruh UI; semua ikon SVG inline.
- [ ] Layout tidak rusak di 360px (HP kecil) maupun desktop.
- [ ] Semua teks UI bahasa Indonesia, tone hangat & singkat.

---

## 11. Catatan Tambahan untuk Agent

- **Jangan pakai framework** (React/Vue/dll) — vanilla ES modules sudah diputuskan.
- **Jangan ubah palet/tipografi/maskot** — itu identitas produk yang sudah disetujui pemilik.
- Prototype memakai data dummy hardcoded (streak 12, XP 160/185, kalender Oktober 2026) — di implementasi nyata SEMUA angka berasal dari Supabase.
- Query default selalu difilter `couple_id = my_couple_id()`; jangan pernah fetch lintas couple.
- Gunakan `supabase-js` v2 via CDN ESM (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`).
- Simpan file `.env.example` / komentar di README berisi: SUPABASE_URL, SUPABASE_ANON_KEY, dan langkah deploy.
- Commit per fase dengan pesan jelas.

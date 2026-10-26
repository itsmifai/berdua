# BERDUA — Web App Pasangan (PWA Gamified)

Aplikasi web privat untuk sepasang kekasih dengan fitur Agenda bersama, Misi harian berhadiah XP, Api Bersama (Streak), Leaderboard mingguan, dan Toko Kupon hadiah.

---

## 🚀 Panduan Setup Supabase & Seed Akun (Fase 0 & 1)

Karena aplikasi ini privat untuk kalian berdua, kedua akun telah ditentukan sejak awal tanpa perlu form pendaftaran atau kode invite manual.

### 1. Buat Proyek Baru di Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard).
2. Klik **New project**, beri nama (misal: `berdua-app`), pilih region terdekat (misal: `Singapore`), dan simpan database password Anda.

### 2. Jalankan Skema Database & RLS
1. Masuk ke proyek Anda di dashboard Supabase.
2. Buka menu **SQL Editor** di sidebar kiri.
3. Buka file [`supabase/schema.sql`](file:///C:/Users/miftah/berdua/supabase/schema.sql) di proyek ini, salin seluruh kodenya, dan tempel ke SQL Editor Supabase.
4. Klik **Run** (atau `Ctrl + Enter`).
   - Ini akan membuat seluruh tabel (`couples`, `profiles`, `missions`, `mission_completions`, `agenda_events`, `coupons`, `coupon_redemptions`).
   - Menyiapkan Row Level Security (RLS) lengkap.
   - Menyiapkan RPC `redeem_coupon` dan fungsi kalkulasi streak `couple_streak`.
   - Mengaktifkan Supabase Realtime.

### 3. Buat 2 Akun & Jalankan Seed
1. Buka menu **Authentication** -> **Users** di dashboard Supabase.
2. Klik tombol **Add user** -> **Create user**:
   - Akun 1: Masukkan email Miftah (misal: `miftah@email.com`) & kata sandi. Centang **Auto Confirm User**.
   - Akun 2: Masukkan email Pasangan (misal: `pasangan@email.com`) & kata sandi. Centang **Auto Confirm User**.
3. Salin **User UID** dari kedua akun tersebut.
4. Buka file [`supabase/seed.sql`](file:///C:/Users/miftah/berdua/supabase/seed.sql), gantikan nilai `v_user1_id` dan `v_user2_id` dengan UID yang baru saja disalin.
5. Jalankan query tersebut di **SQL Editor**. 1 ruang couple berstatus `paired` dan 2 profil (`terra` untuk Miftah dan `sage` untuk Pasangan) akan otomatis siap!

### 4. Konfigurasi Kredensial Supabase
1. Buka menu **Project Settings** (ikon gear) -> **API**.
2. Salin **Project URL** dan **Project API Keys (`anon` `public`)**.
3. Buka file [`js/supabaseClient.js`](file:///C:/Users/miftah/berdua/js/supabaseClient.js).
4. Ganti nilai `DEFAULT_SUPABASE_URL` dan `DEFAULT_SUPABASE_ANON_KEY` dengan kredensial proyek Anda:
   ```javascript
   export const DEFAULT_SUPABASE_URL = 'https://xyzcompany.supabase.co';
   export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

### 5. Menjalankan Aplikasi Secara Lokal
Aplikasi ini murni **Vanilla JS (ES Modules) tanpa build tool**. Jalankan static web server sederhana:

```bash
# Menggunakan Python
python -m http.server 3000

# Atau menggunakan Node npx serve
npx serve .
```
Buka browser di `http://localhost:3000`.
- Layar **Splash Loading** dengan animasi maskot blob berjalan akan tampil selama 2.6 detik.
- Aplikasi akan otomatis memeriksa sesi: jika belum masuk, pengguna akan diarahkan ke `login.html`.

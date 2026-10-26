# BERDUA — Web App Pasangan (PWA Gamified)

Aplikasi web privat untuk sepasang kekasih dengan fitur Agenda bersama, Misi harian berhadiah XP, Api Bersama (Streak), Leaderboard mingguan, dan Toko Kupon hadiah.

---

## 🚀 Panduan Setup Supabase (Fase 0)

Karena kamu sudah memiliki akun Supabase, ikuti langkah mudah berikut:

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
   - Menyiapkan RPC `create_couple`, `join_couple`, `redeem_coupon`, dan function `couple_streak`.
   - Mengaktifkan Supabase Realtime.

### 3. Konfigurasi Kredensial Supabase
1. Buka menu **Project Settings** (ikon gear) -> **API**.
2. Salin **Project URL** dan **Project API Keys (`anon` `public`)**.
3. Buka file [`js/supabaseClient.js`](file:///C:/Users/miftah/berdua/js/supabaseClient.js).
4. Ganti nilai `DEFAULT_SUPABASE_URL` dan `DEFAULT_SUPABASE_ANON_KEY` dengan kredensial proyek Anda:
   ```javascript
   export const DEFAULT_SUPABASE_URL = 'https://xyzcompany.supabase.co';
   export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

### 4. Menjalankan Aplikasi Secara Lokal
Aplikasi ini murni **Vanilla JS (ES Modules) tanpa build tool**. Jalankan static web server sederhana:

```bash
# Menggunakan Python
python -m http.server 3000

# Atau menggunakan Node npx serve
npx serve .
```
Buka browser di `http://localhost:3000`.

-- ==============================================================================
-- BERDUA — Seed Script (2 Akun + 1 Couple Ruang Bersama)
-- ==============================================================================
-- CARA PENGGUNAAN DI SUPABASE:
--
-- Langkah 1: Buat 2 akun pengguna di menu Authentication -> Users -> Add user
--            Misalnya:
--            - User 1: miftah@berdua.app (password rahasia)
--            - User 2: pasangan@berdua.app (password rahasia)
--            Pastikan opsi "Auto Confirm User?" dicentang (agar tidak butuh verifikasi email).
--
-- Langkah 2: Salin User UID masing-masing dari tabel Users, lalu tempelkan
--            ke variabel di bawah ini dan jalankan di SQL Editor:
-- ==============================================================================

do $$
declare
  -- GANTI DENGAN UUID DARI SUPABASE AUTH USERS:
  v_user1_id uuid := '00000000-0000-0000-0000-000000000001'; -- UID Miftah (Terra)
  v_user2_id uuid := '00000000-0000-0000-0000-000000000002'; -- UID Pasangan (Sage)

  v_couple_id uuid;
begin
  -- 1. Buat ruang couple berstatus 'paired'
  insert into couples (status, anniversary_date)
  values ('paired', null) -- ganti null dengan '2024-10-27' jika ada tanggal jadian
  returning id into v_couple_id;

  -- 2. Buat profil untuk Miftah (terracotta)
  insert into profiles (id, couple_id, display_name, color_role, xp_balance)
  values (v_user1_id, v_couple_id, 'Miftah', 'terra', 0)
  on conflict (id) do update
  set couple_id = v_couple_id,
      display_name = 'Miftah',
      color_role = 'terra';

  -- 3. Buat profil untuk Pasangan (sage)
  insert into profiles (id, couple_id, display_name, color_role, xp_balance)
  values (v_user2_id, v_couple_id, 'Dia', 'sage', 0)
  on conflict (id) do update
  set couple_id = v_couple_id,
      display_name = 'Dia',
      color_role = 'sage';

  raise notice 'Seed berhasil! Couple ID: %', v_couple_id;
end $$;

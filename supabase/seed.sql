-- ==============================================================================
-- BERDUA — Seed Script (2 Akun + 1 Couple Ruang Bersama)
-- ==============================================================================
-- UID telah diisi sesuai akun yang dibuat:
-- - User 1 (Miftah / Terra): 4ab7988d-643e-4f31-9bcf-6d05cac30c4b
-- - User 2 (Pasangan / Sage): 10cda475-25b2-45a4-b790-6931c5c5d8a5
-- ==============================================================================

do $$
declare
  v_user1_id uuid := '4ab7988d-643e-4f31-9bcf-6d05cac30c4b'; -- UID Miftah (Terra)
  v_user2_id uuid := '10cda475-25b2-45a4-b790-6931c5c5d8a5'; -- UID Pasangan (Sage)

  v_couple_id uuid;
begin
  -- 1. Buat ruang couple berstatus 'paired'
  insert into couples (status, anniversary_date)
  values ('paired', null) -- ganti null dengan misal '2024-10-27' jika ada tanggal jadian
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

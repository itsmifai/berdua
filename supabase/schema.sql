-- ==============================================================================
-- BERDUA — Database Schema & Security Definition (Supabase Postgres)
-- ==============================================================================

-- 0. EXTENSIONS & CLEANUP
create extension if not exists "pgcrypto";

-- 1. TABEL: couples (Ruang Bersama)
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique,                   -- nullable; tidak dipakai di MVP (lihat §3)
  status text not null default 'paired' check (status in ('waiting', 'paired')), -- seed langsung 'paired'
  anniversary_date date,                     -- opsional, diisi user
  created_at timestamptz default now()
);

-- 2. TABEL: profiles (1 per user auth, tepat 2 profil per couple)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  display_name text not null,
  color_role text not null default 'terra' check (color_role in ('terra', 'sage')),
  xp_balance int not null default 0 check (xp_balance >= 0),
  created_at timestamptz default now(),
  unique (couple_id, color_role)
);

-- 3. TABEL: missions (Template task / tugas harian)
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null check (char_length(title) <= 60),
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  assignee uuid references profiles(id) on delete set null, -- null = siapa saja boleh selesaikan
  is_active boolean not null default true,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- 4. TABEL: mission_completions (Fakta penyelesaian misi harian)
create table if not exists mission_completions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  mission_id uuid references missions(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  xp_awarded int not null check (xp_awarded > 0),
  completed_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_at timestamptz default now(),
  unique (mission_id, user_id, completed_on)  -- 1 misi maks 1x per hari per orang
);

-- 5. TABEL: agenda_events (Kalender kegiatan bersama)
create table if not exists agenda_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null check (char_length(title) <= 80),
  event_date date not null,
  event_time time,                            -- nullable (agenda seharian)
  location text,                              -- nullable
  category text not null default 'kencan' check (category in ('kencan','ibadah','kerja','spesial')),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- 6. TABEL: coupons (Kupon hadiah buatan pasangan)
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null check (char_length(name) <= 50),
  price_xp int not null check (price_xp between 10 and 5000),
  icon_key text not null default 'gift' check (icon_key in ('gift','food','heart','briefcase','movie','custom')),
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 7. TABEL: coupon_redemptions (Riwayat penukaran kupon)
create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  coupon_id uuid references coupons(id) on delete set null,
  redeemed_by uuid not null references profiles(id) on delete cascade,
  price_xp int not null,
  status text not null default 'redeemed' check (status in ('redeemed','fulfilled','cancelled')),
  redeemed_at timestamptz default now()
);

-- ==============================================================================
-- HELPER FUNCTIONS & RLS
-- ==============================================================================

-- Helper function: Mendapatkan couple_id pengguna saat ini
create or replace function my_couple_id() returns uuid
language sql stable security definer as $$
  select couple_id from profiles where id = auth.uid()
$$;

-- Aktifkan RLS di semua tabel
alter table couples enable row level security;
alter table profiles enable row level security;
alter table missions enable row level security;
alter table mission_completions enable row level security;
alter table agenda_events enable row level security;
alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;

-- Policies: couples (hanya bisa dibaca oleh anggota couple)
create policy "Couple read couples" on couples for select
  using (id = my_couple_id());

create policy "Couple update own couple" on couples for update
  using (id = my_couple_id());

-- Policies: profiles (baca profil dalam satu couple, update hanya profil sendiri)
create policy "Couple read profiles" on profiles for select
  using (id = auth.uid() or (couple_id is not null and couple_id = my_couple_id()));

create policy "User update own profile non-xp fields" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policies: missions
create policy "Couple read missions" on missions for select
  using (couple_id = my_couple_id());

create policy "Couple insert missions" on missions for insert
  with check (couple_id = my_couple_id() and created_by = auth.uid());

create policy "Couple update missions" on missions for update
  using (couple_id = my_couple_id());

create policy "Couple delete missions" on missions for delete
  using (couple_id = my_couple_id());

-- Policies: mission_completions
create policy "Couple read completions" on mission_completions for select
  using (couple_id = my_couple_id());

create policy "User insert own completion" on mission_completions for insert
  with check (couple_id = my_couple_id() and user_id = auth.uid());

-- UX batal centang: izinkan delete HANYA di hari yang sama untuk misi milik sendiri
create policy "User delete own completion today" on mission_completions for delete
  using (
    user_id = auth.uid() 
    and couple_id = my_couple_id() 
    and completed_on = (now() at time zone 'Asia/Jakarta')::date
  );

-- Policies: agenda_events
create policy "Couple read agenda" on agenda_events for select
  using (couple_id = my_couple_id());

create policy "Couple insert agenda" on agenda_events for insert
  with check (couple_id = my_couple_id() and created_by = auth.uid());

create policy "Couple update agenda" on agenda_events for update
  using (couple_id = my_couple_id());

create policy "Couple delete agenda" on agenda_events for delete
  using (couple_id = my_couple_id());

-- Policies: coupons
create policy "Couple read coupons" on coupons for select
  using (couple_id = my_couple_id());

create policy "Couple insert coupons" on coupons for insert
  with check (couple_id = my_couple_id() and created_by = auth.uid());

create policy "Couple update coupons" on coupons for update
  using (couple_id = my_couple_id());

create policy "Couple delete coupons" on coupons for delete
  using (couple_id = my_couple_id());

-- Policies: coupon_redemptions
create policy "Couple read redemptions" on coupon_redemptions for select
  using (couple_id = my_couple_id());

create policy "Couple update redemptions" on coupon_redemptions for update
  using (couple_id = my_couple_id());

-- ==============================================================================
-- TRIGGERS: INTEGRITAS XP BALANCE
-- ==============================================================================

-- Trigger tambah XP saat misi diselesaikan
create or replace function handle_mission_completion_insert()
returns trigger language plpgsql security definer as $$
begin
  update profiles
  set xp_balance = xp_balance + new.xp_awarded
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_mission_completed on mission_completions;
create trigger on_mission_completed
after insert on mission_completions
for each row execute function handle_mission_completion_insert();

-- Trigger kurangi XP jika pembatalan centang dilakukan pada hari yang sama
create or replace function handle_mission_completion_delete()
returns trigger language plpgsql security definer as $$
begin
  update profiles
  set xp_balance = greatest(0, xp_balance - old.xp_awarded)
  where id = old.user_id;
  return old;
end;
$$;

drop trigger if exists on_mission_uncompleted on mission_completions;
create trigger on_mission_uncompleted
after delete on mission_completions
for each row execute function handle_mission_completion_delete();

-- ==============================================================================
-- RPC: PENUKARAN KUPON (REDEEM)
-- ==============================================================================

create or replace function redeem_coupon(p_coupon_id uuid)
returns json language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_coupon coupons%rowtype;
  v_user_profile profiles%rowtype;
  v_redemption_id uuid;
begin
  if v_user_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  -- Ambil profil user
  select * into v_user_profile from profiles where id = v_user_id;
  if not found then
    raise exception 'Profil tidak ditemukan';
  end if;

  -- Ambil kupon
  select * into v_coupon from coupons where id = p_coupon_id and is_active = true;
  if not found then
    raise exception 'Kupon tidak ditemukan atau tidak aktif';
  end if;

  -- Validasi couple_id
  if v_coupon.couple_id <> v_user_profile.couple_id then
    raise exception 'Kupon bukan milik ruang couple Anda';
  end if;

  -- Validasi saldo
  if v_user_profile.xp_balance < v_coupon.price_xp then
    raise exception 'Saldo XP tidak cukup';
  end if;

  -- Kurangi saldo XP
  update profiles
  set xp_balance = xp_balance - v_coupon.price_xp
  where id = v_user_id;

  -- Catat transaksi redemption
  insert into coupon_redemptions (
    couple_id,
    coupon_id,
    redeemed_by,
    price_xp,
    status
  ) values (
    v_coupon.couple_id,
    v_coupon.id,
    v_user_id,
    v_coupon.price_xp,
    'redeemed'
  ) returning id into v_redemption_id;

  return json_build_object(
    'redemption_id', v_redemption_id,
    'remaining_xp', v_user_profile.xp_balance - v_coupon.price_xp
  );
end;
$$;

-- ==============================================================================
-- FUNCTION: HITUNG STREAK (API BERSAMA)
-- ==============================================================================

create or replace function couple_streak(p_couple_id uuid)
returns table (
  current_streak int,
  longest_streak int,
  is_today_done boolean,
  is_at_risk boolean
) language plpgsql security definer as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_yesterday date := v_today - 1;
  v_today_done boolean := false;
  v_yesterday_done boolean := false;
  v_cur_streak int := 0;
  v_max_streak int := 0;
  v_run_streak int := 0;
  v_check_date date;
  v_is_at_risk boolean := false;
  r record;
  prev_date date := null;
begin
  -- Cek apakah hari ini berdua selesai
  select (count(distinct user_id) >= 2) into v_today_done
  from mission_completions
  where couple_id = p_couple_id and completed_on = v_today;

  -- Cek apakah kemarin berdua selesai
  select (count(distinct user_id) >= 2) into v_yesterday_done
  from mission_completions
  where couple_id = p_couple_id and completed_on = v_yesterday;

  -- Hitung current_streak mundur
  if v_today_done then
    v_check_date := v_today;
  elsif v_yesterday_done then
    v_check_date := v_yesterday;
    v_is_at_risk := true;
  else
    v_check_date := null;
  end if;

  if v_check_date is not null then
    loop
      if exists (
        select 1 from mission_completions
        where couple_id = p_couple_id and completed_on = v_check_date
        group by completed_on
        having count(distinct user_id) >= 2
      ) then
        v_cur_streak := v_cur_streak + 1;
        v_check_date := v_check_date - 1;
      else
        exit;
      end if;
    end loop;
  end if;

  -- Hitung longest_streak sepanjang sejarah
  v_run_streak := 0;
  v_max_streak := 0;
  prev_date := null;

  for r in (
    select completed_on
    from mission_completions
    where couple_id = p_couple_id
    group by completed_on
    having count(distinct user_id) >= 2
    order by completed_on asc
  ) loop
    if prev_date is null or r.completed_on = prev_date + 1 then
      v_run_streak := v_run_streak + 1;
    else
      v_run_streak := 1;
    end if;
    if v_run_streak > v_max_streak then
      v_max_streak := v_run_streak;
    end if;
    prev_date := r.completed_on;
  end loop;

  return query select
    v_cur_streak as current_streak,
    v_max_streak as longest_streak,
    v_today_done as is_today_done,
    v_is_at_risk as is_at_risk;
end;
$$;

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================

alter publication supabase_realtime add table mission_completions;
alter publication supabase_realtime add table agenda_events;
alter publication supabase_realtime add table missions;
alter publication supabase_realtime add table coupons;
alter publication supabase_realtime add table coupon_redemptions;
alter publication supabase_realtime add table profiles;

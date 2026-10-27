// ==============================================================================
// BERDUA — Api Bersama (Streak) & Leaderboard Mingguan (Fase 4)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state } from './app.js';
import { formatDateKey } from './agenda.js';

export const streakState = {
  currentStreak: 0,
  longestStreak: 0,
  isTodayDone: false,
  isAtRisk: false,
  myWeekXp: 0,
  partnerWeekXp: 0
};

/**
 * Mendapatkan tanggal Senin minggu ini (Asia/Jakarta)
 */
export function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = Min, 1 = Sen, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Senin
  const monday = new Date(now.setDate(diff));
  return formatDateKey(monday);
}

/**
 * Inisialisasi modul Streak & Leaderboard
 */
export async function initStreak() {
  await loadStreakData();
  await loadWeeklyLeaderboard();
}

/**
 * Memuat kalkulasi api bersama (streak) dari DB atau fallback
 */
export async function loadStreakData() {
  if (!isSupabaseConfigured() || !state.profile?.couple_id) return;

  const coupleId = state.profile.couple_id;

  // 1. Coba panggil SQL function couple_streak
  const { data, error } = await supabase.rpc('couple_streak', {
    p_couple_id: coupleId
  });

  if (!error && data && data.length > 0) {
    const res = data[0];
    streakState.currentStreak = res.current_streak || 0;
    streakState.longestStreak = res.longest_streak || 0;
    streakState.isTodayDone = !!res.is_today_done;
    streakState.isAtRisk = !!res.is_at_risk;
  } else {
    // Fallback: hitung dari mission_completions langsung
    await calculateStreakFallback(coupleId);
  }

  renderStreakCard();
  updateProfileStreakStats();
}

/**
 * Fallback hitung streak di client jika function belum tersedia
 */
async function calculateStreakFallback(coupleId) {
  const { data: completions, error } = await supabase
    .from('mission_completions')
    .select('completed_on, user_id')
    .eq('couple_id', coupleId);

  if (error || !completions) return;

  const datesWithBoth = {};
  completions.forEach(c => {
    if (!datesWithBoth[c.completed_on]) {
      datesWithBoth[c.completed_on] = new Set();
    }
    datesWithBoth[c.completed_on].add(c.user_id);
  });

  const validDates = new Set();
  Object.keys(datesWithBoth).forEach(d => {
    if (datesWithBoth[d].size >= 2) validDates.add(d);
  });

  const todayStr = formatDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateKey(yesterday);

  streakState.isTodayDone = validDates.has(todayStr);
  const isYesterdayDone = validDates.has(yesterdayStr);

  let cur = 0;
  let check = new Date();

  if (streakState.isTodayDone) {
    streakState.isAtRisk = false;
  } else if (isYesterdayDone) {
    streakState.isAtRisk = true;
    check.setDate(check.getDate() - 1);
  } else {
    streakState.isAtRisk = false;
    check = null;
  }

  if (check) {
    while (true) {
      const key = formatDateKey(check);
      if (validDates.has(key)) {
        cur++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
  }

  streakState.currentStreak = cur;
  streakState.longestStreak = Math.max(cur, streakState.longestStreak || 0);
}

/**
 * Render Kartu Api Bersama (3 kondisi status api & pembedaan maskot)
 */
export function renderStreakCard() {
  const flameCard = document.getElementById('flameCard');
  const streakCount = document.getElementById('streak-count');
  const streakStatus = document.getElementById('streakStatus');
  const pillStreak = document.getElementById('pill-streak');
  const flameCharSvg = document.getElementById('flameCharSvg');
  const mascotLeft = document.getElementById('mascotLeft');
  const mascotRight = document.getElementById('mascotRight');

  if (pillStreak) pillStreak.textContent = streakState.currentStreak;
  if (streakCount) streakCount.innerHTML = `${streakState.currentStreak} <span>hari</span>`;

  if (!flameCard || !streakStatus) return;

  const myDoneToday = document.getElementById('av-me')?.classList.contains('active');
  const partnerDoneToday = document.getElementById('av-you')?.classList.contains('active');
  const partnerName = state.partner?.display_name || 'Dia';

  // 1. BEDAKAN VISUAL KARAKTER DUA BLOB (SUDAH vs BELUM SELESAI MISI HARI INI)
  if (mascotLeft) {
    if (myDoneToday) {
      mascotLeft.classList.add('done');
      mascotLeft.classList.remove('pending');
      mascotLeft.querySelector('svg').innerHTML = '<use href="#blob"/>';
    } else {
      mascotLeft.classList.add('pending');
      mascotLeft.classList.remove('done');
      mascotLeft.querySelector('svg').innerHTML = '<use href="#blob"/>';
    }
  }

  if (mascotRight) {
    if (partnerDoneToday) {
      mascotRight.classList.add('done');
      mascotRight.classList.remove('pending');
      mascotRight.querySelector('svg').innerHTML = '<use href="#blob"/>';
    } else {
      mascotRight.classList.add('pending');
      mascotRight.classList.remove('done');
      mascotRight.querySelector('svg').innerHTML = '<use href="#blob"/>';
    }
  }

  // 2. TIGA KONDISI API: BERKOBAR (flame-on), MEMBARA (flame-warm), PADAM (flame-off)
  flameCard.classList.remove('flame-on', 'flame-warm', 'flame-off', 'at-risk');

  if (streakState.isTodayDone) {
    // KONDISI 1: BERDUA TUNTAS -> API BERKOBAR PENUH!
    flameCard.classList.add('flame-on');
    streakStatus.textContent = 'Api kalian berkobar bersama!';
    if (flameCharSvg) flameCharSvg.innerHTML = '<use href="#flamechar"/>';
  } else if (myDoneToday || partnerDoneToday) {
    // KONDISI 2: SATU ORANG TUNTAS -> API MEMBARA HANGAT (Tinggal 1 lagi)
    flameCard.classList.add('flame-warm');
    if (myDoneToday && !partnerDoneToday) {
      streakStatus.textContent = `Tinggal ${partnerName} lagi hari ini!`;
    } else {
      streakStatus.textContent = 'Tinggal Kamu lagi hari ini!';
    }
    if (flameCharSvg) flameCharSvg.innerHTML = '<use href="#flamechar"/>';
  } else {
    // KONDISI 3: BELUM ADA YANG TUNTAS -> API PADAM / TIDUR NYENYAK
    flameCard.classList.add('flame-off');
    if (streakState.isAtRisk) {
      flameCard.classList.add('at-risk');
      streakStatus.textContent = 'Ayo selamatkan api kalian!';
    } else {
      streakStatus.textContent = 'Api padam — selesaikan misi berdua!';
    }
    if (flameCharSvg) flameCharSvg.innerHTML = '<use href="#flamechar-sleeping"/>';
  }
}

/**
 * Memuat Leaderboard Mingguan (Senin s.d. Sekarang)
 */
export async function loadWeeklyLeaderboard() {
  if (!isSupabaseConfigured() || !state.profile?.couple_id) return;

  const mondayStr = getMondayOfCurrentWeek();
  const myId = state.profile.id;
  const partnerId = state.partner?.id;

  const { data: completions, error } = await supabase
    .from('mission_completions')
    .select('user_id, xp_awarded')
    .eq('couple_id', state.profile.couple_id)
    .gte('completed_on', mondayStr);

  if (error) {
    console.error('Error load weekly leaderboard:', error);
    return;
  }

  let myXp = 0;
  let partnerXp = 0;

  (completions || []).forEach(c => {
    if (c.user_id === myId) myXp += c.xp_awarded;
    else if (partnerId && c.user_id === partnerId) partnerXp += c.xp_awarded;
  });

  streakState.myWeekXp = myXp;
  streakState.partnerWeekXp = partnerXp;

  renderWeeklyDuel();
}

/**
 * Render Kartu Duel VS Mingguan & Ekspresi Karakter (Memimpin, Ketinggalan, Seri)
 */
export function renderWeeklyDuel() {
  const lbMe = document.getElementById('lb-me');
  const lbYou = document.getElementById('lb-you');
  const barMe = document.getElementById('bar-me');
  const barYou = document.getElementById('bar-you');
  const lbCaption = document.getElementById('lb-caption');
  const vsMe = document.getElementById('vs-me');
  const vsYou = document.getElementById('vs-you');
  const vsMid = document.getElementById('vs-mid');
  const mascotMe = document.getElementById('vs-mascot-me');
  const mascotYou = document.getElementById('vs-mascot-you');

  const myXp = streakState.myWeekXp;
  const youXp = streakState.partnerWeekXp;

  if (lbMe) lbMe.textContent = myXp;
  if (lbYou) lbYou.textContent = youXp;

  const total = myXp + youXp;
  const youPct = total > 0 ? (youXp / total) * 100 : 50;
  const mePct = total > 0 ? (myXp / total) * 100 : 50;

  if (barYou) barYou.style.width = youPct + '%';
  if (barMe) barMe.style.width = mePct + '%';

  // Hapus mahkota lama
  document.querySelectorAll('.crown-svg').forEach(c => c.remove());

  const crownSvg = `
    <svg class="crown-svg" viewBox="0 0 24 24">
      <use href="#crown"/>
    </svg>
  `;

  if (!vsMe || !vsYou || !lbCaption) return;

  // Reset classes
  vsMe.classList.remove('leading', 'trailing', 'draw');
  vsYou.classList.remove('leading', 'trailing', 'draw');

  if (myXp > youXp) {
    // 1. KAMU MEMIMPIN (Memakai Mahkota, Dia Keringat Dingin)
    lbCaption.textContent = `Kamu memimpin unggul +${myXp - youXp} XP! Jangan kasih kendor!`;
    vsMe.classList.add('leading');
    vsYou.classList.add('trailing');
    vsMe.querySelector('.mascot-big')?.insertAdjacentHTML('afterbegin', crownSvg);

    if (mascotMe) mascotMe.querySelector('svg').innerHTML = '<use href="#blob"/>';
    if (mascotYou) mascotYou.querySelector('svg').innerHTML = '<use href="#blob-worried"/>';
    if (vsMid) vsMid.innerHTML = 'VS';

  } else if (youXp > myXp) {
    // 2. DIA MEMIMPIN (Dia Memakai Mahkota, Kamu Keringat Dingin)
    lbCaption.textContent = `Tertinggal ${youXp - myXp} XP — yuk salip dia!`;
    vsYou.classList.add('leading');
    vsMe.classList.add('trailing');
    vsYou.querySelector('.mascot-big')?.insertAdjacentHTML('afterbegin', crownSvg);

    if (mascotYou) mascotYou.querySelector('svg').innerHTML = '<use href="#blob"/>';
    if (mascotMe) mascotMe.querySelector('svg').innerHTML = '<use href="#blob-worried"/>';
    if (vsMid) vsMid.innerHTML = 'VS';

  } else {
    // 3. SKOR DRAW / SERI (Kedua Maskot Memakai Kacamata Keren 😎)
    lbCaption.textContent = myXp > 0
      ? `Skor seimbang (${myXp} XP)! Siapa duluan yang bakal unggul?`
      : 'Duel mingguan dimulai! Selesaikan misi untuk poin pertama!';
    vsMe.classList.add('draw');
    vsYou.classList.add('draw');

    if (mascotMe) mascotMe.querySelector('svg').innerHTML = '<use href="#blob-cool"/>';
    if (mascotYou) mascotYou.querySelector('svg').innerHTML = '<use href="#blob-cool"/>';
    if (vsMid) vsMid.innerHTML = '<span class="vs-draw-badge">🤝 SERI</span>';
  }
}

/**
 * Update statistik rekor api di halaman profil
 */
function updateProfileStreakStats() {
  const statCur = document.getElementById('statCurrentStreak');
  const statMax = document.getElementById('statLongestStreak');

  if (statCur) statCur.textContent = streakState.currentStreak;
  if (statMax) statMax.textContent = streakState.longestStreak;

  // Update Badge Milestone (7, 30, 100, 365 hari)
  const longest = streakState.longestStreak;
  const milestones = [7, 30, 100, 365];

  milestones.forEach(m => {
    const badgeEl = document.getElementById(`badge-${m}`);
    if (badgeEl) {
      if (longest >= m) {
        badgeEl.classList.remove('locked');
        badgeEl.classList.add('earned');
      } else {
        badgeEl.classList.add('locked');
        badgeEl.classList.remove('earned');
      }
    }
  });
}

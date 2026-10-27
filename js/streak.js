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
 * Render Kartu Api Bersama (3 kondisi status)
 */
export function renderStreakCard() {
  const flameCard = document.getElementById('flameCard');
  const streakCount = document.getElementById('streak-count');
  const streakStatus = document.getElementById('streakStatus');
  const pillStreak = document.getElementById('pill-streak');

  if (pillStreak) pillStreak.textContent = streakState.currentStreak;
  if (streakCount) streakCount.innerHTML = `${streakState.currentStreak} <span>hari</span>`;

  if (!flameCard || !streakStatus) return;

  const myDoneToday = document.getElementById('av-me')?.classList.contains('active');
  const partnerDoneToday = document.getElementById('av-you')?.classList.contains('active');
  const partnerName = state.partner?.display_name || 'Dia';

  if (streakState.isTodayDone) {
    // KONDISI 1: Berdua sudah tuntas hari ini
    flameCard.classList.remove('at-risk');
    streakStatus.textContent = 'Api kalian menyala!';
  } else if (streakState.isAtRisk && !myDoneToday && !partnerDoneToday) {
    // KONDISI 2: Belum ada yang selesai & kemarin menyala (At Risk)
    flameCard.classList.add('at-risk');
    streakStatus.textContent = 'Ayo selamatkan api kalian!';
  } else {
    // KONDISI 3: Satu selesai, satu lagi belum
    flameCard.classList.remove('at-risk');
    if (myDoneToday && !partnerDoneToday) {
      streakStatus.textContent = `Tinggal ${partnerName} lagi hari ini!`;
    } else if (!myDoneToday && partnerDoneToday) {
      streakStatus.textContent = 'Tinggal Kamu lagi hari ini!';
    } else {
      streakStatus.textContent = 'Selesaikan misi berdua hari ini!';
    }
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
 * Render Kartu Duel VS Mingguan & Mahkota
 */
export function renderWeeklyDuel() {
  const lbMe = document.getElementById('lb-me');
  const lbYou = document.getElementById('lb-you');
  const barMe = document.getElementById('bar-me');
  const barYou = document.getElementById('bar-you');
  const lbCaption = document.getElementById('lb-caption');
  const vsMe = document.getElementById('vs-me');
  const vsYou = document.getElementById('vs-you');

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

  if (myXp > youXp) {
    lbCaption.textContent = 'Kamu memimpin! Jangan kasih kendor!';
    vsMe.classList.add('leading');
    vsYou.classList.remove('leading');
    vsMe.querySelector('.mascot-big')?.insertAdjacentHTML('afterbegin', crownSvg);
  } else if (youXp > myXp) {
    lbCaption.textContent = `Tertinggal ${youXp - myXp} XP — salip dia!`;
    vsYou.classList.add('leading');
    vsMe.classList.remove('leading');
    vsYou.querySelector('.mascot-big')?.insertAdjacentHTML('afterbegin', crownSvg);
  } else {
    lbCaption.textContent = 'Seri! Siapa duluan hari ini?';
    vsMe.classList.remove('leading');
    vsYou.classList.remove('leading');
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

// ==============================================================================
// BERDUA — Main App Controller & Router
// ==============================================================================

import { requireAuth, getCurrentProfile, logout } from './auth.js';
import { showToast } from './fx.js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { initAgenda, loadAgendaEvents, renderCalendar, renderDayList, renderUpcomingAgenda } from './agenda.js';
import { initMisi, loadMissionsData, renderTodayMissions, renderAllMissions } from './misi.js';
import { initStreak, loadStreakData, loadWeeklyLeaderboard } from './streak.js';
import { initPoin, loadCouponsData, renderCoupons, renderGiftStrip, renderRedemptions } from './poin.js';
import { initProfil, loadProfilStats } from './profil.js';

// State Global Aplikasi
export const state = {
  session: null,
  profile: null,
  partner: null,
  activeTab: 'today'
};

/* ==============================================================================
   SPLASH SCREEN CONTROLLER
   ============================================================================== */
const splashEl = document.getElementById('splash');
let splashDone = false;

export function endSplash() {
  if (splashDone || !splashEl) return;
  splashDone = true;
  splashEl.classList.add('hide');
  setTimeout(() => {
    splashEl.style.display = 'none';
  }, 500);
}

if (splashEl) {
  setTimeout(endSplash, 2600);
  splashEl.addEventListener('click', endSplash);
}

/* ==============================================================================
   TAB NAVIGATION
   ============================================================================== */
export function switchTab(name) {
  state.activeTab = name;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById('view-' + name);
  const targetBtn = document.querySelector(`.nav-btn[data-view="${name}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  const viewsContainer = document.getElementById('views');
  if (viewsContainer) viewsContainer.scrollTop = 0;

  // Tampilkan FAB hanya di tab agenda
  const fab = document.getElementById('fab');
  if (fab) {
    fab.style.display = (name === 'agenda') ? 'flex' : 'none';
  }
}

// Global hook switchTab untuk elemen dengan data-switch
document.querySelectorAll('[data-switch]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = btn.getAttribute('data-switch');
    switchTab(tab);
  });
});

// Bottom navigation click listeners
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const viewName = btn.dataset.view;
    if (viewName) switchTab(viewName);
  });
});

/* ==============================================================================
   APP INITIALIZATION
   ============================================================================== */
async function init() {
  // 1. Validasi konfigurasi Supabase
  if (!isSupabaseConfigured()) {
    showToast('Kredensial Supabase belum diisi di supabaseClient.js');
    console.warn('Isi SUPABASE_URL & SUPABASE_ANON_KEY di js/supabaseClient.js');
    return;
  }

  // 2. Session guard
  const session = await requireAuth();
  if (!session) return;
  state.session = session;

  // 3. Ambil data profil user
  const profile = await getCurrentProfile();
  if (profile) {
    state.profile = profile;
    renderUserHeader(profile);
  }

  // 4. Inisialisasi Fitur Agenda (Fase 2)
  await initAgenda();

  // 5. Inisialisasi Fitur Misi & XP (Fase 3)
  await initMisi();

  // 6. Inisialisasi Fitur Streak & Leaderboard (Fase 4)
  await initStreak();

  // 7. Inisialisasi Fitur Kupon & Poin (Fase 5)
  await initPoin();

  // 8. Inisialisasi Fitur Profil & Statistik (Fase 5)
  await initProfil();

  // 9. Aktifkan Supabase Realtime Sinkronisasi Dua Arah (Fase 6)
  setupRealtimeSubscriptions();

  // 10. Registrasi Service Worker PWA (Fase 6)
  registerPwaServiceWorker();

  // 11. Global Backdrop Sheet Close Handler
  const backdrop = document.getElementById('sheetBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('active'));
      backdrop.classList.remove('active');
    });
  }

  // 7. Hook logout button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (confirm('Yakin ingin keluar dari akun?')) {
        await logout();
      }
    });
  }
}

export function renderUserHeader(profile) {
  const profileNameEl = document.getElementById('profileDisplayName');
  if (profileNameEl) profileNameEl.textContent = profile.display_name;

  const xpPill = document.getElementById('pill-xp');
  if (xpPill) xpPill.textContent = profile.xp_balance || 0;

  const xpTotal = document.getElementById('xp-total');
  if (xpTotal) xpTotal.innerHTML = `${profile.xp_balance || 0} <small>XP</small>`;

  const labelMe = document.getElementById('label-me');
  if (labelMe) labelMe.textContent = profile.display_name;

  const vsNameMe = document.getElementById('vs-name-me');
  if (vsNameMe) vsNameMe.textContent = profile.display_name;

  if (profile.partner) {
    const labelYou = document.getElementById('label-you');
    if (labelYou) labelYou.textContent = profile.partner.display_name;
    const vsNameYou = document.getElementById('vs-name-you');
    if (vsNameYou) vsNameYou.textContent = profile.partner.display_name;
  }
}

/* ==============================================================================
   SUPABASE REALTIME SUBSCRIPTIONS (Fase 6)
   ============================================================================== */
export function setupRealtimeSubscriptions() {
  const coupleId = state.profile?.couple_id;
  if (!coupleId || !isSupabaseConfigured()) return;

  supabase.channel(`couple-live-${coupleId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_completions', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadMissionsData();
      renderTodayMissions();
      renderAllMissions();
      await loadStreakData();
      await loadWeeklyLeaderboard();
      await loadProfilStats();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_events', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadAgendaEvents();
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'missions', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadMissionsData();
      renderTodayMissions();
      renderAllMissions();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadCouponsData();
      renderCoupons();
      renderGiftStrip();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coupon_redemptions', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadCouponsData();
      renderRedemptions();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `couple_id=eq.${coupleId}` }, async (payload) => {
      if (payload.new?.id === state.profile?.id) {
        state.profile = { ...state.profile, ...payload.new };
        renderUserHeader(state.profile);
      } else if (state.partner && payload.new?.id === state.partner?.id) {
        state.partner = { ...state.partner, ...payload.new };
        renderUserHeader(state.profile);
      }
    })
    .subscribe();
}

/* ==============================================================================
   SERVICE WORKER PWA REGISTRATION (Fase 6)
   ============================================================================== */
function registerPwaServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Berdua PWA Service Worker aktif'))
        .catch(err => console.warn('Gagal registrasi SW:', err));
    });
  }
}

// Jalankan aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', init);

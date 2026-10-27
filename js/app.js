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
  try {
    // 1. Validasi konfigurasi Supabase
    if (!isSupabaseConfigured()) {
      console.error('Supabase belum dikonfigurasi!');
      showToast('Konfigurasi Supabase belum diisi');
      return;
    }

    // 2. Session guard — jika belum login, redirect ke login.html
    const session = await requireAuth();
    if (!session) return; // requireAuth sudah handle redirect
    state.session = session;

    // 3. Ambil data profil user + partner
    const profile = await getCurrentProfile();
    if (!profile || !profile.couple_id) {
      // Sudah auth tapi belum punya profil/couple — arahkan ke login
      console.error('Profil atau couple_id tidak ditemukan. Pastikan seed sudah dijalankan.');
      showToast('Data profil tidak ditemukan. Hubungi admin.');
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
      return;
    }

    state.profile = profile;
    state.partner = profile.partner || null;
    renderUserHeader(profile);

    // 4. Inisialisasi semua fitur secara paralel untuk performa
    await Promise.all([
      initAgenda(),
      initMisi(),
    ]);

    await Promise.all([
      initStreak(),
      initPoin(),
      initProfil(),
    ]);

    // 5. Aktifkan Realtime Sync (Fase 6)
    setupRealtimeSubscriptions();

    // 6. Registrasi Service Worker PWA (Fase 6)
    registerPwaServiceWorker();

    // 7. Global Backdrop Sheet Close Handler
    const backdrop = document.getElementById('sheetBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.querySelectorAll('.bottom-sheet').forEach(sheet => sheet.classList.remove('active'));
        backdrop.classList.remove('active');
      });
    }

    // 8. Hook logout button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (confirm('Yakin ingin keluar dari akun?')) {
          await logout();
        }
      });
    }

  } catch (err) {
    console.error('Error saat init app:', err);
    showToast('Gagal memuat aplikasi. Coba refresh halaman.');
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

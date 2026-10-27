// ==============================================================================
// BERDUA — Main App Controller & Router
// ==============================================================================

import { requireAuth, getCurrentProfile, logout } from './auth.js';
import { showToast, showConfirmModal } from './fx.js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { initAgenda, loadAgendaEvents, renderCalendar, renderDayList, renderUpcomingAgenda, loadCategories, renderCategoryChips } from './agenda.js';
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

export function initNavigation() {
  // Global hook switchTab untuk elemen dengan data-switch
  document.querySelectorAll('[data-switch]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const tab = btn.getAttribute('data-switch');
      switchTab(tab);
    };
  });

  // Bottom navigation click listeners
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      const viewName = btn.dataset.view;
      if (viewName) switchTab(viewName);
    };
  });
}

// Inisialisasi navigasi langsung saat script dievaluasi
initNavigation();

/* ==============================================================================
   APP INITIALIZATION
   ============================================================================== */
let appInitialized = false;

async function init() {
  if (appInitialized) return;
  appInitialized = true;

  try {
    initNavigation();

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
      console.error('Profil atau couple_id tidak ditemukan. Pastikan seed sudah dijalankan.');
      endSplash();
      showToast('Data profil belum terdaftar di database.');
      showProfileMissingScreen(session.user);
      return;
    }

    state.profile = profile;
    state.partner = profile.partner || null;
    renderUserHeader(profile);

    // 4. Inisialisasi setiap fitur secara terisolasi agar kegagalan satu modul tidak mematikan app
    try { await initAgenda(); } catch (e) { console.error('Gagal initAgenda:', e); }
    try { await initMisi(); } catch (e) { console.error('Gagal initMisi:', e); }
    try { await initStreak(); } catch (e) { console.error('Gagal initStreak:', e); }
    try { await initPoin(); } catch (e) { console.error('Gagal initPoin:', e); }
    try { await initProfil(); } catch (e) { console.error('Gagal initProfil:', e); }

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
        const ok = await showConfirmModal({
          title: 'Keluar Akun',
          message: 'Yakin ingin keluar dari akun Berdua?',
          confirmText: 'Keluar',
          cancelText: 'Batal',
          isDanger: true
        });
        if (ok) {
          await logout();
        }
      });
    }

  } catch (err) {
    console.error('Error saat init app:', err);
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
let activeRealtimeChannel = null;

export function setupRealtimeSubscriptions() {
  const coupleId = state.profile?.couple_id;
  if (!coupleId || !isSupabaseConfigured()) return;

  if (activeRealtimeChannel) {
    try { supabase.removeChannel(activeRealtimeChannel); } catch (_) {}
  }

  activeRealtimeChannel = supabase.channel(`couple-live-${coupleId}`)
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_categories', filter: `couple_id=eq.${coupleId}` }, async () => {
      await loadCategories();
      renderCategoryChips();
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

function showProfileMissingScreen(user) {
  const views = document.getElementById('views');
  if (views) {
    views.innerHTML = `
      <div style="padding: 40px 20px; text-align: center;">
        <div style="font-family:'Fraunces',serif; font-size: 22px; font-weight:600; margin-bottom: 12px; color: var(--terra);">Ruang Belum Siap</div>
        <p style="font-size: 13.5px; color: var(--ink-soft); line-height: 1.5; margin-bottom: 20px;">
          Akun <b>${user.email || 'kamu'}</b> berhasil masuk, tetapi profil belum terdaftar di tabel <code>profiles</code> database.
        </p>
        <div style="background: var(--card); border: 1.5px dashed var(--line); border-radius: 16px; padding: 14px; margin-bottom: 20px; text-align: left;">
          <div style="font-size: 11px; font-weight:700; color:var(--ink-soft); text-transform:uppercase; margin-bottom:4px;">UID Akun Anda:</div>
          <div style="font-family: monospace; font-size: 12px; word-break: break-all; color: var(--ink); user-select: all;">${user.id}</div>
        </div>
        <p style="font-size: 12px; color: var(--ink-soft); line-height: 1.5; margin-bottom: 24px;">
          Salin UID di atas, lalu pastikan sudah dimasukkan ke variabel <code>v_user1_id</code> / <code>v_user2_id</code> di <code>supabase/seed.sql</code> dan dijalankan di SQL Editor Supabase.
        </p>
        <button id="btnMissingLogout" class="btn-primary" style="max-width: 200px; margin: 0 auto;">Keluar Akun</button>
      </div>
    `;
    document.getElementById('btnMissingLogout')?.addEventListener('click', () => logout());
  }
}

// Jalankan aplikasi saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

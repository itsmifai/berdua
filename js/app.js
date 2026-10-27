// ==============================================================================
// BERDUA — Main App Controller & Router
// ==============================================================================

import { requireAuth, getCurrentProfile, logout } from './auth.js';
import { showToast } from './fx.js';
import { isSupabaseConfigured } from './supabaseClient.js';
import { initAgenda } from './agenda.js';
import { initMisi } from './misi.js';
import { initStreak } from './streak.js';
import { initPoin } from './poin.js';
import { initProfil } from './profil.js';

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

  // 9. Global Backdrop Sheet Close Handler
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

function renderUserHeader(profile) {
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
}

// Jalankan aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', init);

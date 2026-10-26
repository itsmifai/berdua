// ==============================================================================
// BERDUA — Main App Controller & Router
// ==============================================================================

import { requireAuth, getCurrentProfile, logout } from './auth.js';
import { showToast } from './fx.js';
import { isSupabaseConfigured } from './supabaseClient.js';

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

  // 4. Hook logout button
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

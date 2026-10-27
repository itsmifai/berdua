// ==============================================================================
// BERDUA — Profil Pengguna, Statistik & Badges (Fase 5)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state, renderUserHeader } from './app.js';
import { showToast } from './fx.js';

/**
 * Inisialisasi modul Profil
 */
export async function initProfil() {
  setupProfilDomEvents();
  await loadProfilStats();
}

/**
 * Memuat statistik pengguna sepanjang masa (total misi selesai & total XP)
 */
export async function loadProfilStats() {
  if (!isSupabaseConfigured() || !state.profile?.id) return;

  const myId = state.profile.id;

  const { data: completions, error } = await supabase
    .from('mission_completions')
    .select('xp_awarded')
    .eq('user_id', myId);

  if (error) {
    console.error('Error load profil stats:', error);
    return;
  }

  const totalMissions = (completions || []).length;
  const totalXp = (completions || []).reduce((acc, cur) => acc + (cur.xp_awarded || 0), 0);

  // Kalkulasi Level & Julukan
  const level = Math.floor(totalXp / 250) + 1;
  let title = 'Pemula';
  if (totalMissions >= 100) title = 'Legenda Berdua';
  else if (totalMissions >= 50) title = 'Si Tangguh';
  else if (totalMissions >= 20) title = 'Si Rajin';

  // Render ke DOM
  const rankLabel = document.getElementById('profileRankLabel');
  if (rankLabel) {
    rankLabel.textContent = `Level ${level} · ${title}`;
  }

  const statDone = document.getElementById('statMissionsDone');
  if (statDone) {
    statDone.textContent = totalMissions;
  }

  const mascotSvg = document.getElementById('profileMascotSvg');
  if (mascotSvg) {
    const color = state.profile.color_role === 'sage' ? 'var(--sage)' : 'var(--terra)';
    mascotSvg.style.color = color;
  }
}

/**
 * Setup event listeners untuk pengaturan profil
 */
function setupProfilDomEvents() {
  const btnEditName = document.getElementById('btnEditName');
  if (btnEditName) {
    btnEditName.addEventListener('click', async () => {
      const currentName = state.profile?.display_name || '';
      const newName = prompt('Masukkan nama tampilan baru:', currentName);
      if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

      const { error } = await supabase
        .from('profiles')
        .update({ display_name: newName.trim() })
        .eq('id', state.profile.id);

      if (error) {
        console.error('Error update display name:', error);
        showToast('Gagal mengubah nama');
        return;
      }

      state.profile.display_name = newName.trim();
      renderUserHeader(state.profile);
      showToast('Nama tampilan berhasil diubah');
    });
  }
}

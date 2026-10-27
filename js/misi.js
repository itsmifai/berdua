// ==============================================================================
// BERDUA — Misi Gamifikasi & XP Controller (Fase 3)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state } from './app.js';
import { showToast, launchConfetti, hopElement } from './fx.js';
import { formatDateKey } from './agenda.js';
import { loadStreakData, loadWeeklyLeaderboard } from './streak.js';

export const DIFFICULTY_XP = {
  easy: 10,
  medium: 25,
  hard: 50
};

export const DIFFICULTY_LABEL = {
  easy: 'Mudah +10 XP',
  medium: 'Sedang +25 XP',
  hard: 'Sulit +50 XP'
};

const CHEERS = [
  'Mantap!', 'Keren!', 'Nah gitu dong!', 'Lanjut!', 'Dia bangga!', '+XP masuk!'
];

// State internal modul Misi
let allMissions = [];
let todayCompletions = [];

/**
 * Inisialisasi modul Misi
 */
export async function initMisi() {
  setupMissionDomEvents();
  await loadMissionsData();
  renderTodayMissions();
  renderAllMissions();
}

/**
 * Ambil daftar misi aktif dan riwayat penyelesaian hari ini
 */
export async function loadMissionsData() {
  if (!isSupabaseConfigured() || !state.profile?.couple_id) {
    allMissions = [];
    todayCompletions = [];
    return;
  }

  const todayStr = formatDateKey(new Date());

  // 1. Ambil misi aktif
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('*')
    .eq('couple_id', state.profile.couple_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (mErr) {
    console.error('Error load missions:', mErr);
  } else {
    allMissions = missions || [];
  }

  // 2. Ambil penyelesaian hari ini
  const { data: completions, error: cErr } = await supabase
    .from('mission_completions')
    .select('*')
    .eq('couple_id', state.profile.couple_id)
    .eq('completed_on', todayStr);

  if (cErr) {
    console.error('Error load completions:', cErr);
  } else {
    todayCompletions = completions || [];
  }

  updateHeaderActiveTicks();
}

/**
 * Update centang aktif pada avatar jika sudah ada minimal 1 misi selesai hari ini
 */
export function updateHeaderActiveTicks() {
  const myId = state.profile?.id;
  const partnerId = state.partner?.id;

  const myDoneToday = todayCompletions.some(c => c.user_id === myId);
  const partnerDoneToday = partnerId ? todayCompletions.some(c => c.user_id === partnerId) : false;

  const avMe = document.getElementById('av-me');
  const avYou = document.getElementById('av-you');

  if (avMe) {
    if (myDoneToday) avMe.classList.add('active');
    else avMe.classList.remove('active');
  }

  if (avYou) {
    if (partnerDoneToday) avYou.classList.add('active');
    else avYou.classList.remove('active');
  }

  // Update dot di kartu flame hari ini
  const fpMe = document.getElementById('fp-me');
  const fppMe = document.getElementById('fpp-me');
  const fpYou = document.getElementById('fp-you');
  const fppYou = document.getElementById('fpp-you');

  if (fpMe && fppMe) {
    if (myDoneToday) {
      fpMe.classList.add('done');
      fppMe.classList.add('on');
    } else {
      fpMe.classList.remove('done');
      fppMe.classList.remove('on');
    }
  }

  if (fpYou && fppYou) {
    if (partnerDoneToday) {
      fpYou.classList.add('done');
      fppYou.classList.add('on');
    } else {
      fpYou.classList.remove('done');
      fppYou.classList.remove('on');
    }
  }
}

/**
 * Render Misi Hari Ini di tab "Hari Ini" (maks. 5 teratas)
 */
export function renderTodayMissions() {
  const container = document.getElementById('today-missions');
  if (!container) return;

  const myId = state.profile?.id;

  // Tampilkan misi yang ditujukan untuk user ini atau siapa saja (assignee null)
  const available = allMissions.filter(m => !m.assignee || m.assignee === myId);

  if (available.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        <p>Belum ada misi aktif hari ini</p>
      </div>
    `;
    return;
  }

  const topMissions = available.slice(0, 5);

  container.innerHTML = topMissions.map(m => {
    const isDone = todayCompletions.some(c => c.mission_id === m.id && c.user_id === myId);
    const xp = DIFFICULTY_XP[m.difficulty] || 10;
    const diffClass = m.difficulty || 'easy';

    return `
      <div class="mission-row ${isDone ? 'done' : ''}" data-id="${m.id}" data-xp="${xp}">
        <button type="button" class="m-check" aria-label="Centang misi">
          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3.5"/></svg>
        </button>
        <div class="m-body">
          <div class="m-title">${escapeHtml(m.title)}</div>
        </div>
        <span class="m-xp ${diffClass}">+${xp} XP</span>
      </div>
    `;
  }).join('');

  // Tautkan handler klik tombol check
  container.querySelectorAll('.m-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.mission-row');
      const missionId = row.dataset.id;
      toggleMission(missionId, btn);
    });
  });
}

/**
 * Render Semua Misi di tab "Misi"
 */
export function renderAllMissions() {
  const container = document.getElementById('all-missions-list');
  if (!container) return;

  const myId = state.profile?.id;
  const partnerId = state.partner?.id;

  if (allMissions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 22px;">
        <p>Belum ada misi. Buat misi pertamamu!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allMissions.map(m => {
    const isDone = todayCompletions.some(c => c.mission_id === m.id && c.user_id === myId);
    const xp = DIFFICULTY_XP[m.difficulty] || 10;
    const diffClass = m.difficulty || 'easy';

    let assigneeTag = '';
    if (m.assignee === myId) {
      assigneeTag = '<small style="color:var(--terra);font-weight:700;margin-left:6px;">· Kamu</small>';
    } else if (m.assignee === partnerId) {
      assigneeTag = `<small style="color:var(--sage);font-weight:700;margin-left:6px;">· ${escapeHtml(state.partner?.display_name || 'Dia')}</small>`;
    } else {
      assigneeTag = '<small style="color:var(--ink-soft);font-weight:700;margin-left:6px;">· Berdua</small>';
    }

    const canCheck = !m.assignee || m.assignee === myId;

    return `
      <div class="mission-row ${isDone ? 'done' : ''}" data-id="${m.id}" data-xp="${xp}" style="cursor:pointer;">
        <button type="button" class="m-check" ${!canCheck ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} aria-label="Centang misi">
          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9L10 3.5"/></svg>
        </button>
        <div class="m-body" style="cursor:pointer;">
          <div class="m-title">
            ${escapeHtml(m.title)} ${assigneeTag}
          </div>
        </div>
        <span class="m-xp ${diffClass}">+${xp} XP</span>
        <div style="font-size:14px;color:var(--ink-faint);padding:0 2px;">›</div>
      </div>
    `;
  }).join('');

  // Tautkan check toggle
  container.querySelectorAll('.m-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.mission-row');
      const missionId = row.dataset.id;
      toggleMission(missionId, btn);
    });
  });

  // Tautkan klik baris untuk edit misi
  container.querySelectorAll('.m-body').forEach(body => {
    body.addEventListener('click', () => {
      const row = body.closest('.mission-row');
      const missionId = row.dataset.id;
      const m = allMissions.find(x => x.id === missionId);
      if (m) openMissionSheet(m);
    });
  });
}

/**
 * Centang atau Batal Centang Misi
 */
export async function toggleMission(missionId, checkBtn) {
  const myId = state.profile?.id;
  if (!myId || !state.profile?.couple_id) return;

  const mission = allMissions.find(m => m.id === missionId);
  if (!mission) return;

  const todayStr = formatDateKey(new Date());
  const existingCompletion = todayCompletions.find(c => c.mission_id === missionId && c.user_id === myId);
  const xp = DIFFICULTY_XP[mission.difficulty] || 10;

  if (existingCompletion) {
    // BATAL SELESAI: Delete completion
    checkBtn.disabled = true;
    const { error } = await supabase
      .from('mission_completions')
      .delete()
      .eq('id', existingCompletion.id);

    checkBtn.disabled = false;

    if (error) {
      console.error('Error delete completion:', error);
      showToast('Gagal membatalkan misi');
      return;
    }

    // Update state lokal
    todayCompletions = todayCompletions.filter(c => c.id !== existingCompletion.id);
    state.profile.xp_balance = Math.max(0, (state.profile.xp_balance || 0) - xp);
    updateXpDisplays();
    showToast('Batal selesai — XP disesuaikan');

  } else {
    // SELESAIKAN MISI: Insert completion
    checkBtn.disabled = true;
    const { data, error } = await supabase
      .from('mission_completions')
      .insert({
        couple_id: state.profile.couple_id,
        mission_id: missionId,
        user_id: myId,
        xp_awarded: xp,
        completed_on: todayStr
      })
      .select()
      .single();

    checkBtn.disabled = false;

    if (error) {
      console.error('Error insert completion:', error);
      showToast('Gagal menyelesaikan misi');
      return;
    }

    // Update state lokal
    todayCompletions.push(data);
    state.profile.xp_balance = (state.profile.xp_balance || 0) + xp;
    updateXpDisplays();

    // Animasi Confetti, Hop, & Cheers Toast
    launchConfetti(checkBtn);
    const avMe = document.getElementById('av-me');
    hopElement(avMe);

    const randomCheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    showToast(`+${xp} XP — ${randomCheer}`);
  }

  updateHeaderActiveTicks();
  renderTodayMissions();
  renderAllMissions();
  await loadStreakData();
  await loadWeeklyLeaderboard();
}

/**
 * Sinkronkan tampilan nilai XP di header dan kartu saldo
 */
export function updateXpDisplays() {
  const currentXp = state.profile?.xp_balance || 0;

  const pillXp = document.getElementById('pill-xp');
  if (pillXp) pillXp.textContent = currentXp;

  const xpTotal = document.getElementById('xp-total');
  if (xpTotal) xpTotal.innerHTML = `${currentXp} <small>XP</small>`;
}

/**
 * Setup DOM listeners untuk form tambah/edit misi
 */
function setupMissionDomEvents() {
  const btnOpen = document.getElementById('btnOpenAddMission');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openMissionSheet(null);
    });
  }

  // Setup form & bottom-sheet handlers
  setupMissionSheetHandlers();
}

/**
 * Membuka Bottom Sheet Misi (Tambah / Edit)
 */
export function openMissionSheet(existingMission = null) {
  const sheet = document.getElementById('sheetMission');
  const backdrop = document.getElementById('sheetBackdrop');
  if (!sheet || !backdrop) return;

  const titleEl = document.getElementById('sheetMissionTitle');
  const idInput = document.getElementById('missionId');
  const titleInput = document.getElementById('missionTitle');
  const diffInput = document.getElementById('missionDifficulty');
  const assigneeInput = document.getElementById('missionAssignee');
  const btnDelete = document.getElementById('btnDeleteMission');

  if (existingMission) {
    titleEl.textContent = 'Edit Misi';
    idInput.value = existingMission.id;
    titleInput.value = existingMission.title;
    diffInput.value = existingMission.difficulty || 'easy';
    assigneeInput.value = existingMission.assignee || '';
    btnDelete.style.display = 'block';
  } else {
    titleEl.textContent = 'Tambah Misi';
    idInput.value = '';
    titleInput.value = '';
    diffInput.value = 'easy';
    assigneeInput.value = '';
    btnDelete.style.display = 'none';
  }

  updateDifficultyChips(diffInput.value);
  updateAssigneeChips(assigneeInput.value);

  backdrop.classList.add('active');
  sheet.classList.add('active');
}

/**
 * Menutup Bottom Sheet Misi
 */
export function closeMissionSheet() {
  const sheet = document.getElementById('sheetMission');
  const backdrop = document.getElementById('sheetBackdrop');
  if (sheet) sheet.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function updateDifficultyChips(activeDiff) {
  document.querySelectorAll('#missionDiffChips .chip-btn').forEach(btn => {
    if (btn.dataset.diff === activeDiff) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

function updateAssigneeChips(activeAssignee) {
  document.querySelectorAll('#missionAssigneeChips .chip-btn').forEach(btn => {
    if (btn.dataset.assignee === activeAssignee) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

function setupMissionSheetHandlers() {
  const form = document.getElementById('formMission');
  const btnDelete = document.getElementById('btnDeleteMission');
  const diffInput = document.getElementById('missionDifficulty');
  const assigneeInput = document.getElementById('missionAssignee');

  // Pilih kesulitan chip
  document.querySelectorAll('#missionDiffChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.diff;
      diffInput.value = diff;
      updateDifficultyChips(diff);
    });
  });

  // Pilih assignee chip
  document.querySelectorAll('#missionAssigneeChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      let assignee = btn.dataset.assignee;
      if (assignee === 'me') assignee = state.profile?.id || '';
      else if (assignee === 'you') assignee = state.partner?.id || '';
      else assignee = '';

      assigneeInput.value = assignee;
      updateAssigneeChips(btn.dataset.assignee);
    });
  });

  // Submit Simpan Misi (Insert / Update)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('missionId').value;
      const title = document.getElementById('missionTitle').value.trim();
      const difficulty = diffInput.value || 'easy';
      const assignee = assigneeInput.value || null;

      if (!title) {
        showToast('Judul misi wajib diisi');
        return;
      }

      if (!state.profile?.couple_id) {
        showToast('Sesi pengguna belum valid');
        return;
      }

      const btnSave = document.getElementById('btnSaveMission');
      btnSave.disabled = true;
      btnSave.textContent = 'Menyimpan…';

      let err;
      if (id) {
        const { error } = await supabase
          .from('missions')
          .update({ title, difficulty, assignee })
          .eq('id', id);
        err = error;
      } else {
        const { error } = await supabase
          .from('missions')
          .insert({
            couple_id: state.profile.couple_id,
            title,
            difficulty,
            assignee,
            created_by: state.profile.id,
            is_active: true
          });
        err = error;
      }

      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Misi';

      if (err) {
        console.error('Error save mission:', err);
        showToast('Gagal menyimpan misi');
        return;
      }

      showToast(id ? 'Misi berhasil diperbarui' : 'Misi baru ditambahkan!');
      closeMissionSheet();
      await loadMissionsData();
      renderTodayMissions();
      renderAllMissions();
    });
  }

  // Hapus Misi (nonaktifkan)
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = document.getElementById('missionId').value;
      if (!id) return;
      if (!confirm('Hapus misi ini?')) return;

      btnDelete.disabled = true;
      btnDelete.textContent = 'Menghapus…';

      const { error } = await supabase
        .from('missions')
        .update({ is_active: false })
        .eq('id', id);

      btnDelete.disabled = false;
      btnDelete.textContent = 'Hapus Misi';

      if (error) {
        console.error('Error delete mission:', error);
        showToast('Gagal menghapus misi');
        return;
      }

      showToast('Misi telah dihapus');
      closeMissionSheet();
      await loadMissionsData();
      renderTodayMissions();
      renderAllMissions();
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==============================================================================
// BERDUA — Agenda & Kalender Bersama (Fase 2 + Custom Categories)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state, broadcastLiveSync } from './app.js';
import { showToast, showConfirmModal } from './fx.js';

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const COLOR_PALETTE = [
  '#E2725B', // Terracotta
  '#7D9B76', // Sage Green
  '#8FA3B8', // Slate Blue
  '#F5A623', // Amber
  '#E88B88', // Soft Rose
  '#9E86C8', // Lavender
  '#4FA3A5', // Teal
  '#D4A338', // Mustard
  '#E05263', // Crimson
  '#6C7A89'  // Charcoal
];

export const DEFAULT_CATEGORIES = [
  { key: 'kencan', name: 'Kencan', color: '#E2725B' },
  { key: 'ibadah', name: 'Ibadah', color: '#7D9B76' },
  { key: 'kerja', name: 'Kerja', color: '#8FA3B8' },
  { key: 'spesial', name: 'Spesial', color: '#F5A623' }
];

// State internal modul Agenda
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDate = formatDateKey(new Date());
let agendaEvents = [];
export let customCategories = [...DEFAULT_CATEGORIES];
let selectedPaletteColor = COLOR_PALETTE[0];

/**
 * Helper format Date object menjadi string YYYY-MM-DD
 */
export function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format string jam HH:MM:SS atau HH:MM menjadi HH.MM
 */
export function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Mendapatkan warna dot untuk kategori tertentu
 */
export function getCategoryColor(catKey) {
  if (!catKey) return '#E2725B';
  const norm = String(catKey).toLowerCase().trim();
  const found = customCategories.find(c => c && (String(c.key || '').toLowerCase() === norm || String(c.name || '').toLowerCase() === norm));
  if (found && found.color) return found.color;
  return '#E2725B';
}

/**
 * Mendapatkan nama tampilan untuk kategori
 */
export function getCategoryName(catKey) {
  if (!catKey) return 'Kencan';
  const norm = String(catKey).toLowerCase().trim();
  const found = customCategories.find(c => c && (String(c.key || '').toLowerCase() === norm || String(c.name || '').toLowerCase() === norm));
  if (found && found.name) return found.name;
  return String(catKey);
}

let agendaHandlersInitialized = false;
let isSubmittingAgenda = false;

/**
 * Inisialisasi modul Agenda
 */
export async function initAgenda() {
  if (!agendaHandlersInitialized) {
    setupDomEvents();
    setupSheetHandlers();
    setupCategoryManagerHandlers();
    agendaHandlersInitialized = true;
  }

  await loadCategories();
  renderCategoryChips();
  renderCalendarLegend();
  await loadAgendaEvents();
  renderCalendar();
  renderDayList();
  renderUpcomingAgenda();
}

/**
 * Muat kategori kustom dari Supabase (dengan fallback ke localStorage)
 */
export async function loadCategories() {
  const coupleId = state.profile?.couple_id;
  const storageKey = 'berdua_cats_' + (coupleId || 'default');

  if (isSupabaseConfigured() && coupleId) {
    try {
      const { data, error } = await supabase
        .from('agenda_categories')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        customCategories = data.map(item => ({
          id: item.id,
          key: item.key || item.name.toLowerCase().replace(/\s+/g, '-'),
          name: item.name,
          color: item.color
        }));
        localStorage.setItem(storageKey, JSON.stringify(customCategories));
        return;
      }
    } catch (e) {
      console.warn('[Agenda] agenda_categories belum ada di DB, memakai cache lokal:', e.message);
    }
  }

  // Fallback dari localStorage
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customCategories = parsed;
        return;
      }
    } catch (_) {}
  }

  // Default awal
  customCategories = [...DEFAULT_CATEGORIES];
}

/**
 * Simpan kategori ke Supabase dan localStorage
 */
async function saveCategories() {
  const coupleId = state.profile?.couple_id;
  const storageKey = 'berdua_cats_' + (coupleId || 'default');
  localStorage.setItem(storageKey, JSON.stringify(customCategories));

  if (isSupabaseConfigured() && coupleId) {
    try {
      for (const cat of customCategories) {
        await supabase
          .from('agenda_categories')
          .upsert({
            couple_id: coupleId,
            key: cat.key,
            name: cat.name,
            color: cat.color
          }, { onConflict: 'couple_id,key' });
      }
    } catch (err) {
      console.warn('[Agenda] Sinkronisasi kategori ke Supabase gagal (tabel mungkin belum dibuat):', err.message);
    }
  }
}

/**
 * Render chip-chip pilihan kategori di form agenda
 */
export function renderCategoryChips() {
  const container = document.getElementById('agendaCategoryChips');
  if (!container) return;

  const categoryInput = document.getElementById('agendaCategory');
  let currentVal = categoryInput?.value || (customCategories[0]?.key || 'kencan');

  // Jika nilai saat ini tidak ada di daftar kategori, fallback ke kategori pertama
  if (!customCategories.some(c => c.key === currentVal)) {
    currentVal = customCategories[0]?.key || 'kencan';
    if (categoryInput) categoryInput.value = currentVal;
  }

  container.innerHTML = customCategories.map(cat => {
    const isSelected = (cat.key === currentVal);
    const selStyle = isSelected 
      ? `background: ${cat.color}; border-color: ${cat.color}; color: #fff;` 
      : '';
    const dotBg = isSelected ? '#fff' : cat.color;

    return `
      <button type="button" class="chip-btn ${isSelected ? 'selected' : ''}" data-cat="${escapeHtml(cat.key)}" style="${selStyle}">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${dotBg}; margin-right:6px; vertical-align:middle;"></span>${escapeHtml(cat.name)}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (categoryInput) categoryInput.value = cat;
      renderCategoryChips();
    });
  });
}

/**
 * Ambil data agenda dari Supabase
 */
export async function loadAgendaEvents() {
  if (!isSupabaseConfigured() || !state.profile?.couple_id) {
    agendaEvents = [];
    return;
  }

  const { data, error } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('couple_id', state.profile.couple_id)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Gagal memuat agenda:', error);
    showToast('Gagal memuat agenda bersama');
    return;
  }

  agendaEvents = data || [];
}

/**
 * Render grid kalender
 */
export function renderCalendar() {
  const monthTitle = document.getElementById('cal-month-title');
  const calGrid = document.getElementById('cal-grid');
  if (!monthTitle || !calGrid) return;

  monthTitle.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
  calGrid.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Minggu
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const todayStr = formatDateKey(new Date());

  // Kotak kosong sebelum tanggal 1
  for (let i = 0; i < firstDay; i++) {
    const emptyBtn = document.createElement('button');
    emptyBtn.className = 'cal-day empty';
    calGrid.appendChild(emptyBtn);
  }

  // Petakan events per tanggal untuk efisiensi
  const eventsByDate = {};
  agendaEvents.forEach(evt => {
    if (!eventsByDate[evt.event_date]) {
      eventsByDate[evt.event_date] = [];
    }
    eventsByDate[evt.event_date].push(evt);
  });

  // Render hari 1..N
  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.className = 'cal-day';
    btn.dataset.date = dateKey;

    if (dateKey === todayStr) btn.classList.add('today');
    if (dateKey === selectedDate) btn.classList.add('selected');

    btn.innerHTML = `<span>${d}</span>`;

    const dayItems = eventsByDate[dateKey];
    if (dayItems && dayItems.length > 0) {
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'cal-dots';
      dayItems.slice(0, 3).forEach(evt => {
        const dot = document.createElement('i');
        dot.style.background = getCategoryColor(evt.category);
        dotsWrap.appendChild(dot);
      });
      btn.appendChild(dotsWrap);
    }

    btn.addEventListener('click', () => {
      selectedDate = dateKey;
      document.querySelectorAll('#cal-grid .cal-day').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      renderDayList();
    });

    calGrid.appendChild(btn);
  }

  // Render keterangan warna di bawah kalender
  renderCalendarLegend();
}

/**
 * Render keterangan / legenda kategori di bawah kalender
 */
export function renderCalendarLegend() {
  const container = document.getElementById('cal-legend');
  if (!container) return;

  container.innerHTML = customCategories.map(cat => `
    <span><i style="background:${cat.color}"></i> ${escapeHtml(cat.name)}</span>
  `).join('');
}

/**
 * Render daftar agenda pada tanggal yang dipilih
 */
export function renderDayList() {
  const titleEl = document.getElementById('agenda-list-title');
  const listEl = document.getElementById('agenda-day-list');
  if (!titleEl || !listEl) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  titleEl.textContent = `${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const dayItems = agendaEvents.filter(evt => evt.event_date === selectedDate);

  if (dayItems.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <svg class="sad-blob" viewBox="0 0 100 100"><use href="#blob-sad"/></svg>
        <p>Kosong — yuk bikin rencana berdua!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = dayItems.map(evt => {
    let subInfo = [];
    if (evt.event_time) subInfo.push(formatTimeDisplay(evt.event_time));
    if (evt.location) subInfo.push(escapeHtml(evt.location));
    const subText = subInfo.length > 0 ? subInfo.join(' · ') : 'Sepanjang hari';
    const catColor = getCategoryColor(evt.category);

    return `
      <div class="agenda-row" data-id="${evt.id}" style="border-bottom:1.5px solid var(--line); cursor:pointer;">
        <span class="cat-dot" style="background: ${catColor};"></span>
        <div class="a-info">
          <div class="a-title">${escapeHtml(evt.title)}</div>
          <div class="a-sub">${subText}</div>
        </div>
        <div style="font-size: 13px; color: var(--ink-faint); font-weight: 800; padding: 0 4px;">›</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.agenda-row').forEach(row => {
    row.addEventListener('click', () => {
      const evtId = row.dataset.id;
      const evt = agendaEvents.find(e => e.id === evtId);
      if (evt) openAgendaSheet(evt);
    });
  });
}

/**
 * Render 2 agenda terdekat di tab "Hari Ini"
 */
export function renderUpcomingAgenda() {
  const container = document.getElementById('upcoming-agenda');
  if (!container) return;

  const todayStr = formatDateKey(new Date());
  const upcoming = agendaEvents
    .filter(evt => evt.event_date >= todayStr)
    .slice(0, 2);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 18px 10px;">
        <p>Belum ada rencana terdekat</p>
      </div>
    `;
    return;
  }

  container.innerHTML = upcoming.map(evt => {
    const [y, m, d] = evt.event_date.split('-').map(Number);
    const mShort = MONTHS[m - 1].substring(0, 3);
    let sub = evt.event_time ? formatTimeDisplay(evt.event_time) : 'Sepanjang hari';
    if (evt.location) sub += ` · ${escapeHtml(evt.location)}`;
    const catColor = getCategoryColor(evt.category);

    return `
      <div class="agenda-row" style="border-bottom: 1.5px solid var(--line); padding: 8px 0;">
        <div class="a-date">
          <div class="d">${d}</div>
          <div class="m">${mShort}</div>
        </div>
        <div class="a-info">
          <div class="a-title">${escapeHtml(evt.title)}</div>
          <div class="a-sub">${sub}</div>
        </div>
        <span class="cat-dot" style="background: ${catColor};"></span>
      </div>
    `;
  }).join('');
}

/**
 * Setup DOM listeners untuk navigasi bulan & FAB
 */
function setupDomEvents() {
  const btnPrev = document.getElementById('btnCalPrev');
  const btnNext = document.getElementById('btnCalNext');
  const fab = document.getElementById('fab');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

  if (fab) {
    fab.addEventListener('click', () => {
      openAgendaSheet(null);
    });
  }
}

/**
 * Membuka Bottom Sheet Tambah/Edit Agenda
 */
export function openAgendaSheet(existingEvt = null) {
  const sheet = document.getElementById('sheetAgenda');
  const backdrop = document.getElementById('sheetBackdrop');
  if (!sheet || !backdrop) return;

  const titleEl = document.getElementById('sheetAgendaTitle');
  const idInput = document.getElementById('agendaId');
  const titleInput = document.getElementById('agendaTitle');
  const dateInput = document.getElementById('agendaDate');
  const timeInput = document.getElementById('agendaTime');
  const locationInput = document.getElementById('agendaLocation');
  const categoryInput = document.getElementById('agendaCategory');
  const btnDelete = document.getElementById('btnDeleteAgenda');

  if (existingEvt) {
    titleEl.textContent = 'Edit Agenda';
    idInput.value = existingEvt.id;
    titleInput.value = existingEvt.title;
    dateInput.value = existingEvt.event_date;
    timeInput.value = existingEvt.event_time ? existingEvt.event_time.substring(0, 5) : '';
    locationInput.value = existingEvt.location || '';
    categoryInput.value = existingEvt.category || (customCategories[0]?.key || 'kencan');
    btnDelete.style.display = 'block';
  } else {
    titleEl.textContent = 'Tambah Agenda';
    idInput.value = '';
    titleInput.value = '';
    dateInput.value = selectedDate;
    timeInput.value = '';
    locationInput.value = '';
    categoryInput.value = customCategories[0]?.key || 'kencan';
    btnDelete.style.display = 'none';
  }

  renderCategoryChips();

  backdrop.classList.add('active');
  sheet.classList.add('active');
}

/**
 * Menutup Bottom Sheet Agenda
 */
export function closeAgendaSheet() {
  const sheet = document.getElementById('sheetAgenda');
  const backdrop = document.getElementById('sheetBackdrop');
  if (sheet) sheet.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function setupSheetHandlers() {
  const form = document.getElementById('formAgenda');
  const backdrop = document.getElementById('sheetBackdrop');
  const btnDelete = document.getElementById('btnDeleteAgenda');
  const categoryInput = document.getElementById('agendaCategory');

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeAgendaSheet();
      closeCategoryManager();
    });
  }

  // Tombol kelola kategori
  const btnManage = document.getElementById('btnManageCategories');
  if (btnManage) {
    btnManage.addEventListener('click', () => {
      openCategoryManager();
    });
  }

  // Submit Simpan (Insert / Update)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingAgenda) return;

      const id = document.getElementById('agendaId').value;
      const title = document.getElementById('agendaTitle').value.trim();
      const date = document.getElementById('agendaDate').value;
      const time = document.getElementById('agendaTime').value || null;
      const location = document.getElementById('agendaLocation').value.trim() || null;
      const category = categoryInput?.value || (customCategories[0]?.key || 'kencan');

      if (!title || !date) {
        showToast('Judul dan tanggal wajib diisi');
        return;
      }

      if (!state.profile?.couple_id) {
        showToast('Gagal: Sesi pengguna belum terhubung ke couple');
        return;
      }

      const payload = {
        couple_id: state.profile.couple_id,
        title,
        event_date: date,
        event_time: time,
        location,
        category,
        created_by: state.profile.id
      };

      const btnSave = document.getElementById('btnSaveAgenda');
      btnSave.disabled = true;
      btnSave.textContent = 'Menyimpan…';
      isSubmittingAgenda = true;

      try {
        let err;
        if (id) {
          const { error } = await supabase
            .from('agenda_events')
            .update({ title, event_date: date, event_time: time, location, category })
            .eq('id', id);
          err = error;
        } else {
          const { error } = await supabase
            .from('agenda_events')
            .insert(payload);
          err = error;
        }

        if (err) {
          console.error('Error simpan agenda:', err);
          showToast('Gagal menyimpan agenda');
          return;
        }

        showToast(id ? 'Agenda berhasil diperbarui' : 'Agenda baru disimpan');
        closeAgendaSheet();
        broadcastLiveSync('agenda_sync');
        await loadAgendaEvents();
        selectedDate = date;
        const [y, m] = date.split('-').map(Number);
        currentYear = y;
        currentMonth = m - 1;
        renderCalendar();
        renderDayList();
        renderUpcomingAgenda();
      } catch (ex) {
        console.error('Exception simpan agenda:', ex);
        showToast('Terjadi kesalahan saat menyimpan agenda');
      } finally {
        isSubmittingAgenda = false;
        btnSave.disabled = false;
        btnSave.textContent = 'Simpan Agenda';
      }
    });
  }

  // Hapus Agenda
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = document.getElementById('agendaId').value;
      if (!id) return;

      const ok = await showConfirmModal({
        title: 'Hapus Agenda',
        message: 'Yakin ingin menghapus agenda kegiatan ini?',
        confirmText: 'Hapus',
        cancelText: 'Batal',
        isDanger: true
      });
      if (!ok) return;

      btnDelete.disabled = true;
      btnDelete.textContent = 'Menghapus…';

      const { error } = await supabase
        .from('agenda_events')
        .delete()
        .eq('id', id);

      btnDelete.disabled = false;
      btnDelete.textContent = 'Hapus Agenda';

      if (error) {
        console.error('Error hapus agenda:', error);
        showToast('Gagal menghapus agenda');
        return;
      }

      showToast('Agenda telah dihapus');
      closeAgendaSheet();
      broadcastLiveSync('agenda_sync');
      await loadAgendaEvents();
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();
    });
  }
}

/* ==============================================================================
   MANAJEMEN KATEGORI KUSTOM (Tambah, Edit, Hapus)
   ============================================================================== */

export function openCategoryManager() {
  const sheet = document.getElementById('sheetCategoryManager');
  const backdrop = document.getElementById('sheetBackdrop');
  if (!sheet) return;

  renderCategoryPalette();
  renderCategoryList();
  resetCategoryForm();

  if (backdrop) backdrop.classList.add('active');
  sheet.classList.add('active');
}

export function closeCategoryManager() {
  const sheet = document.getElementById('sheetCategoryManager');
  if (sheet) sheet.classList.remove('active');
  renderCategoryChips();
}

function renderCategoryPalette() {
  const row = document.getElementById('catPaletteRow');
  if (!row) return;

  row.innerHTML = COLOR_PALETTE.map(c => `
    <button type="button" class="cat-color-choice ${c === selectedPaletteColor ? 'selected' : ''}" data-color="${c}" style="background:${c};"></button>
  `).join('');

  row.querySelectorAll('.cat-color-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPaletteColor = btn.dataset.color;
      renderCategoryPalette();
    });
  });
}

function renderCategoryList() {
  const container = document.getElementById('categoryListContainer');
  if (!container) return;

  if (customCategories.length === 0) {
    container.innerHTML = `<div style="text-align:center; font-size:12px; color:var(--ink-soft); padding:10px;">Belum ada kategori</div>`;
    return;
  }

  container.innerHTML = customCategories.map(cat => `
    <div class="cat-manage-item">
      <div class="cat-item-left">
        <span class="cat-dot" style="background:${cat.color}"></span>
        <span>${escapeHtml(cat.name)}</span>
      </div>
      <div class="cat-actions">
        <button type="button" class="cat-manage-btn edit" data-key="${escapeHtml(cat.key)}">Ubah</button>
        <button type="button" class="cat-manage-btn delete" data-key="${escapeHtml(cat.key)}">Hapus</button>
      </div>
    </div>
  `).join('');

  // Hook Edit
  container.querySelectorAll('.cat-manage-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const cat = customCategories.find(c => c.key === key);
      if (!cat) return;

      document.getElementById('editCatKey').value = cat.key;
      document.getElementById('catNameInput').value = cat.name;
      selectedPaletteColor = cat.color;
      renderCategoryPalette();

      document.getElementById('btnSaveCategory').textContent = 'Simpan Perubahan';
      document.getElementById('btnCancelEditCat').style.display = 'block';
      document.getElementById('catNameInput').focus();
    });
  });

  // Hook Hapus
  container.querySelectorAll('.cat-manage-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const cat = customCategories.find(c => c.key === key);
      if (!cat) return;

      if (customCategories.length <= 1) {
        showToast('Minimal harus ada 1 kategori');
        return;
      }

      const ok = await showConfirmModal({
        title: 'Hapus Kategori',
        message: `Yakin ingin menghapus kategori "${cat.name}"?`,
        confirmText: 'Hapus',
        cancelText: 'Batal',
        isDanger: true
      });
      if (!ok) return;

      customCategories = customCategories.filter(c => c.key !== key);

      // Alihkan agenda yang memakai kategori ini ke kategori fallback
      const fallbackKey = customCategories[0]?.key || 'kencan';
      agendaEvents.forEach(evt => {
        if (evt.category === key) {
          evt.category = fallbackKey;
        }
      });

      // Hapus dari Supabase jika ada
      const coupleId = state.profile?.couple_id;
      if (isSupabaseConfigured() && coupleId) {
        try {
          await supabase
            .from('agenda_categories')
            .delete()
            .eq('couple_id', coupleId)
            .eq('key', key);

          await supabase
            .from('agenda_events')
            .update({ category: fallbackKey })
            .eq('couple_id', coupleId)
            .eq('category', key);
        } catch (_) {}
      }

      await saveCategories();
      broadcastLiveSync('categories_sync');
      renderCategoryList();
      renderCategoryChips();
      renderCalendarLegend();
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();
      showToast(`Kategori "${cat.name}" dihapus`);
    });
  });
}

function resetCategoryForm() {
  const keyInput = document.getElementById('editCatKey');
  const nameInput = document.getElementById('catNameInput');
  const btnSave = document.getElementById('btnSaveCategory');
  const btnCancel = document.getElementById('btnCancelEditCat');

  if (keyInput) keyInput.value = '';
  if (nameInput) nameInput.value = '';
  if (btnSave) btnSave.textContent = 'Tambah Kategori';
  if (btnCancel) btnCancel.style.display = 'none';
  selectedPaletteColor = COLOR_PALETTE[0];
  renderCategoryPalette();
}

function setupCategoryManagerHandlers() {
  const btnClose = document.getElementById('btnCloseCatManager');
  const btnSave = document.getElementById('btnSaveCategory');
  const btnCancel = document.getElementById('btnCancelEditCat');
  const nameInput = document.getElementById('catNameInput');

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeCategoryManager();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      resetCategoryForm();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const name = nameInput?.value.trim();
      const editKey = document.getElementById('editCatKey')?.value;

      if (!name) {
        showToast('Ketik nama kategori terlebih dahulu');
        nameInput?.focus();
        return;
      }

      btnSave.disabled = true;

      if (editKey) {
        // Mode Ubah
        const idx = customCategories.findIndex(c => c.key === editKey);
        if (idx !== -1) {
          customCategories[idx].name = name;
          customCategories[idx].color = selectedPaletteColor;
        }
        showToast('Kategori berhasil diperbarui');
      } else {
        // Mode Tambah Baru
        const newKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);
        customCategories.push({
          key: newKey,
          name: name,
          color: selectedPaletteColor
        });
        showToast('Kategori baru ditambahkan');
      }

      await saveCategories();
      broadcastLiveSync('categories_sync');
      resetCategoryForm();
      renderCategoryList();
      renderCategoryChips();
      renderCalendarLegend();
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();

      btnSave.disabled = false;
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==============================================================================
// BERDUA — Agenda & Kalender Bersama (Fase 2)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state } from './app.js';
import { showToast } from './fx.js';

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const CAT_COLOR = {
  kencan: 'var(--terra)',
  ibadah: 'var(--sage)',
  kerja: '#8FA3B8',
  spesial: 'var(--amber)'
};

export const CAT_CLASS = {
  kencan: 'cat-kencan',
  ibadah: 'cat-ibadah',
  kerja: 'cat-kerja',
  spesial: 'cat-spesial'
};

// State internal modul Agenda
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDate = formatDateKey(new Date());
let agendaEvents = [];

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
 * Inisialisasi modul Agenda
 */
export async function initAgenda() {
  setupDomEvents();
  await loadAgendaEvents();
  renderCalendar();
  renderDayList();
  renderUpcomingAgenda();
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
        dot.style.background = CAT_COLOR[evt.category] || 'var(--terra)';
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

    return `
      <div class="agenda-row" data-id="${evt.id}" style="border-bottom:1.5px solid var(--line); cursor:pointer;">
        <span class="cat-dot ${CAT_CLASS[evt.category] || 'cat-kencan'}"></span>
        <div class="a-info">
          <div class="a-title">${escapeHtml(evt.title)}</div>
          <div class="a-sub">${subText}</div>
        </div>
        <div style="font-size: 13px; color: var(--ink-faint); font-weight: 800; padding: 0 4px;">›</div>
      </div>
    `;
  }).join('');

  // Tautkan klik baris agenda untuk membuka sheet edit
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
        <span class="cat-dot ${CAT_CLASS[evt.category] || 'cat-kencan'}"></span>
      </div>
    `;
  }).join('');
}

/**
 * Setup DOM listeners untuk navigasi bulan, FAB, dan modal
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

  // Setup form & bottom-sheet handlers
  setupSheetHandlers();
}

/**
 * Membuka Bottom Sheet Agenda (Tambah / Edit)
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
    categoryInput.value = existingEvt.category || 'kencan';
    btnDelete.style.display = 'block';
  } else {
    titleEl.textContent = 'Tambah Agenda';
    idInput.value = '';
    titleInput.value = '';
    dateInput.value = selectedDate;
    timeInput.value = '';
    locationInput.value = '';
    categoryInput.value = 'kencan';
    btnDelete.style.display = 'none';
  }

  // Update chip terpilih
  updateCategoryChips(categoryInput.value);

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

function updateCategoryChips(activeCat) {
  document.querySelectorAll('#agendaCategoryChips .chip-btn').forEach(btn => {
    if (btn.dataset.cat === activeCat) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function setupSheetHandlers() {
  const form = document.getElementById('formAgenda');
  const backdrop = document.getElementById('sheetBackdrop');
  const btnDelete = document.getElementById('btnDeleteAgenda');
  const categoryInput = document.getElementById('agendaCategory');

  if (backdrop) {
    backdrop.addEventListener('click', closeAgendaSheet);
  }

  // Pilih kategori chip
  document.querySelectorAll('#agendaCategoryChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      categoryInput.value = cat;
      updateCategoryChips(cat);
    });
  });

  // Submit Simpan (Insert / Update)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('agendaId').value;
      const title = document.getElementById('agendaTitle').value.trim();
      const date = document.getElementById('agendaDate').value;
      const time = document.getElementById('agendaTime').value || null;
      const location = document.getElementById('agendaLocation').value.trim() || null;
      const category = categoryInput.value || 'kencan';

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

      let err;
      if (id) {
        // Update
        const { error } = await supabase
          .from('agenda_events')
          .update({ title, event_date: date, event_time: time, location, category })
          .eq('id', id);
        err = error;
      } else {
        // Insert
        const { error } = await supabase
          .from('agenda_events')
          .insert(payload);
        err = error;
      }

      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Agenda';

      if (err) {
        console.error('Error simpan agenda:', err);
        showToast('Gagal menyimpan agenda');
        return;
      }

      showToast(id ? 'Agenda berhasil diperbarui' : 'Agenda baru disimpan');
      closeAgendaSheet();
      await loadAgendaEvents();
      selectedDate = date;
      const [y, m] = date.split('-').map(Number);
      currentYear = y;
      currentMonth = m - 1;
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();
    });
  }

  // Hapus Agenda
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = document.getElementById('agendaId').value;
      if (!id) return;
      if (!confirm('Hapus agenda ini?')) return;

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
      await loadAgendaEvents();
      renderCalendar();
      renderDayList();
      renderUpcomingAgenda();
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

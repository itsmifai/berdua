// ==============================================================================
// BERDUA — Kupon Hadiah & Poin XP Controller (Fase 5)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state, broadcastLiveSync, lockXpFor } from './app.js';
import { showToast, launchConfetti, shakeElement, showConfirmModal } from './fx.js';
import { updateXpDisplays } from './misi.js';

export const COUPON_ICONS = {
  gift: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z"/></svg>`,
  food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,
  movie: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>`,
  custom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
};

let coupons = [];
let redemptions = [];
let couponHandlersInitialized = false;
let isSubmittingCoupon = false;

/**
 * Inisialisasi modul Poin & Kupon
 */
export async function initPoin() {
  if (!couponHandlersInitialized) {
    setupCouponDomEvents();
    couponHandlersInitialized = true;
  }
  await loadCouponsData();
  renderCoupons();
  renderGiftStrip();
  renderRedemptions();
}

/**
 * Memuat kupon aktif dan riwayat penukaran dari Supabase
 */
export async function loadCouponsData() {
  if (!isSupabaseConfigured() || !state.profile?.couple_id) return;

  const coupleId = state.profile.couple_id;

  // 1. Ambil kupon aktif
  const { data: cData, error: cErr } = await supabase
    .from('coupons')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_active', true)
    .order('price_xp', { ascending: true });

  if (!cErr && cData) {
    coupons = cData;
  }

  // 2. Ambil riwayat penukaran (3 terakhir)
  const { data: rData, error: rErr } = await supabase
    .from('coupon_redemptions')
    .select('*, coupons(name), profiles:redeemed_by(display_name)')
    .eq('couple_id', coupleId)
    .order('redeemed_at', { ascending: false })
    .limit(3);

  if (!rErr && rData) {
    redemptions = rData;
  }
}

/**
 * Render daftar toko kupon di tab "Poin"
 */
export function renderCoupons() {
  const container = document.getElementById('coupons-container');
  if (!container) return;

  if (coupons.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <svg class="sad-blob" viewBox="0 0 100 100"><use href="#blob-sad"/></svg>
          <p>Belum ada kupon. Buat kupon hadiah pertamamu!</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = coupons.map(c => {
    const iconSvg = COUPON_ICONS[c.icon_key] || COUPON_ICONS.gift;

    return `
      <div class="coupon" data-id="${c.id}" style="cursor:pointer;">
        <div class="coupon-icon">
          ${iconSvg}
        </div>
        <div class="coupon-body">
          <div class="coupon-name">${escapeHtml(c.name)}</div>
          <div style="font-size:11px; color:var(--ink-soft); font-weight:600; margin-top:2px;">Ketuk untuk edit/hapus</div>
        </div>
        <button type="button" class="coupon-price" data-id="${c.id}" data-price="${c.price_xp}">
          ${c.price_xp} XP
        </button>
      </div>
    `;
  }).join('');

  // Klik card untuk edit/hapus kupon
  container.querySelectorAll('.coupon').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.coupon-price')) return;
      const couponId = card.dataset.id;
      const c = coupons.find(x => x.id === couponId);
      if (c) openCouponSheet(c);
    });
  });

  // Tautkan tombol redeem pada tiap kupon
  container.querySelectorAll('.coupon-price').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const couponId = btn.dataset.id;
      const c = coupons.find(x => x.id === couponId);
      if (c) handleRedeemCoupon(c, btn);
    });
  });
}

/**
 * Menangani penukaran kupon (Redeem)
 */
export async function handleRedeemCoupon(coupon, btn) {
  const currentXp = state.profile?.xp_balance || 0;

  if (currentXp < coupon.price_xp) {
    showToast('XP kurang! Selesaikan misi dulu');
    const xpCard = document.getElementById('xpBalanceCard');
    shakeElement(xpCard);
    return;
  }

  const ok = await showConfirmModal({
    title: 'Tukar Kupon Hadiah',
    message: `Tukar "${coupon.name}" dengan ${coupon.price_xp} XP sekarang?`,
    confirmText: 'Tukar Sekarang',
    cancelText: 'Nanti Dulu',
    isDanger: false
  });
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = 'Menukar…';

  // 1. Coba via RPC redeem_coupon
  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_coupon_id: coupon.id
  });

  if (error) {
    console.warn('RPC redeem gagal, mencoba transaksi manual:', error.message);

    // Fallback transaksi manual bila RPC belum ada
    const { error: insErr } = await supabase
      .from('coupon_redemptions')
      .insert({
        couple_id: state.profile.couple_id,
        coupon_id: coupon.id,
        redeemed_by: state.profile.id,
        price_xp: coupon.price_xp,
        status: 'redeemed'
      });

    if (insErr) {
      btn.disabled = false;
      btn.textContent = `${coupon.price_xp} XP`;
      showToast('Gagal menukarkan kupon');
      return;
    }

    state.profile.xp_balance = Math.max(0, currentXp - coupon.price_xp);
  } else {
    state.profile.xp_balance = data.remaining_xp;
  }

  // Lock XP agar Realtime echo tidak override nilai yang baru saja dikurangi
  lockXpFor(4000);

  btn.disabled = false;
  btn.textContent = `${coupon.price_xp} XP`;

  launchConfetti(btn);
  showToast(`Kupon didapat! −${coupon.price_xp} XP`);

  updateXpDisplays();
  broadcastLiveSync('coupon_sync');
  broadcastLiveSync('profile_sync', { userId: state.profile?.id, xp_balance: state.profile?.xp_balance });
  await loadCouponsData();
  renderRedemptions();
}

/**
 * Render strip promosi kupon termurah di tab "Hari Ini"
 */
export function renderGiftStrip() {
  const strip = document.getElementById('giftStrip');
  const txt = document.getElementById('giftStripText');
  const sub = document.getElementById('giftStripSub');
  if (!strip || !txt) return;

  if (coupons.length === 0) {
    strip.style.display = 'none';
    return;
  }

  const cheapest = coupons[0]; // Terurut berdasarkan price_xp asc
  strip.style.display = 'flex';
  txt.textContent = `${cheapest.price_xp} XP = ${cheapest.name}!`;
  sub.textContent = 'Kupon termurah menantimu';
}

/**
 * Render riwayat penukaran kupon (3 terakhir)
 */
export function renderRedemptions() {
  const container = document.getElementById('redemptions-history');
  if (!container) return;

  if (redemptions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:12px;">
        <p>Belum ada kupon yang ditukar</p>
      </div>
    `;
    return;
  }

  container.innerHTML = redemptions.map(r => {
    const couponName = r.coupons?.name || 'Kupon Hadiah';
    const userName = r.profiles?.display_name || (r.redeemed_by === state.profile?.id ? 'Kamu' : 'Dia');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 4px;border-bottom:1.5px solid var(--line);">
        <div>
          <div style="font-weight:700;font-size:13.5px;">${escapeHtml(couponName)}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);font-weight:600;">Ditebus oleh ${escapeHtml(userName)}</div>
        </div>
        <span style="font-size:12px;font-weight:800;color:var(--terra);background:var(--terra-soft);padding:4px 8px;border-radius:8px;">
          −${r.price_xp} XP
        </span>
      </div>
    `;
  }).join('');
}

/**
 * Setup DOM listeners untuk bottom sheet tambah kupon
 */
function setupCouponDomEvents() {
  const btnOpen = document.getElementById('btnOpenAddCoupon');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openCouponSheet();
    });
  }

  setupCouponSheetHandlers();
}

/**
 * Membuka Bottom Sheet Bikin / Edit Kupon
 */
export function openCouponSheet(existingCoupon = null) {
  const sheet = document.getElementById('sheetCoupon');
  const backdrop = document.getElementById('sheetBackdrop');
  if (!sheet || !backdrop) return;

  const titleEl = document.getElementById('sheetCouponTitle');
  const idInput = document.getElementById('couponId');
  const nameInput = document.getElementById('couponName');
  const priceInput = document.getElementById('couponPrice');
  const iconInput = document.getElementById('couponIconKey');
  const btnSave = document.getElementById('btnSaveCoupon');
  const btnDelete = document.getElementById('btnDeleteCoupon');

  if (existingCoupon) {
    if (titleEl) titleEl.textContent = 'Edit Kupon Hadiah';
    if (idInput) idInput.value = existingCoupon.id;
    if (nameInput) nameInput.value = existingCoupon.name;
    if (priceInput) priceInput.value = existingCoupon.price_xp;
    if (iconInput) iconInput.value = existingCoupon.icon_key || 'gift';
    if (btnSave) btnSave.textContent = 'Simpan Perubahan';
    if (btnDelete) btnDelete.style.display = 'block';

    updatePriceChips(String(existingCoupon.price_xp));
    updateIconChips(existingCoupon.icon_key || 'gift');
  } else {
    if (titleEl) titleEl.textContent = 'Bikin Kupon Hadiah';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '100';
    if (iconInput) iconInput.value = 'gift';
    if (btnSave) btnSave.textContent = 'Bikin Kupon';
    if (btnDelete) btnDelete.style.display = 'none';

    updatePriceChips('100');
    updateIconChips('gift');
  }

  backdrop.classList.add('active');
  sheet.classList.add('active');
}

/**
 * Menutup Bottom Sheet Bikin Kupon
 */
export function closeCouponSheet() {
  const sheet = document.getElementById('sheetCoupon');
  const backdrop = document.getElementById('sheetBackdrop');
  if (sheet) sheet.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function updatePriceChips(val) {
  document.querySelectorAll('#couponPriceChips .chip-btn').forEach(btn => {
    if (btn.dataset.price === val) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

function updateIconChips(val) {
  document.querySelectorAll('#couponIconChips .chip-btn').forEach(btn => {
    if (btn.dataset.icon === val) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

function setupCouponSheetHandlers() {
  const form = document.getElementById('formCoupon');
  const priceInput = document.getElementById('couponPrice');
  const iconInput = document.getElementById('couponIconKey');
  const btnDelete = document.getElementById('btnDeleteCoupon');

  // Pilih harga chip
  document.querySelectorAll('#couponPriceChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.price;
      priceInput.value = p;
      updatePriceChips(p);
    });
  });

  // Pilih ikon chip
  document.querySelectorAll('#couponIconChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ico = btn.dataset.icon;
      iconInput.value = ico;
      updateIconChips(ico);
    });
  });

  // Hapus Kupon
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const id = document.getElementById('couponId')?.value;
      if (!id) return;

      const ok = await showConfirmModal({
        title: 'Hapus Kupon Hadiah',
        message: 'Yakin ingin menghapus kupon ini dari toko hadiah?',
        confirmText: 'Hapus',
        cancelText: 'Batal',
        isDanger: true
      });
      if (!ok) return;

      btnDelete.disabled = true;
      btnDelete.textContent = 'Menghapus…';

      try {
        const { error } = await supabase
          .from('coupons')
          .update({ is_active: false })
          .eq('id', id);

        if (error) {
          console.error('Error delete coupon:', error);
          showToast('Gagal menghapus kupon');
          return;
        }

        showToast('Kupon hadiah berhasil dihapus');
        closeCouponSheet();
        broadcastLiveSync('coupon_sync');
        await loadCouponsData();
        renderCoupons();
        renderGiftStrip();
      } finally {
        btnDelete.disabled = false;
        btnDelete.textContent = 'Hapus Kupon';
      }
    });
  }

  // Submit Simpan Kupon (Insert / Update)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingCoupon) return;

      const id = document.getElementById('couponId')?.value;
      const name = document.getElementById('couponName').value.trim();
      const price = parseInt(priceInput.value || '100', 10);
      const iconKey = iconInput.value || 'gift';

      if (!name) {
        showToast('Nama kupon wajib diisi');
        return;
      }

      if (price < 10 || price > 5000) {
        showToast('Harga XP antara 10 - 5000');
        return;
      }

      const btnSave = document.getElementById('btnSaveCoupon');
      btnSave.disabled = true;
      btnSave.textContent = 'Menyimpan…';
      isSubmittingCoupon = true;

      try {
        let err;
        if (id) {
          // Update
          const { error } = await supabase
            .from('coupons')
            .update({
              name,
              price_xp: price,
              icon_key: iconKey
            })
            .eq('id', id);
          err = error;
        } else {
          // Insert
          const { error } = await supabase
            .from('coupons')
            .insert({
              couple_id: state.profile.couple_id,
              name,
              price_xp: price,
              icon_key: iconKey,
              is_active: true,
              created_by: state.profile.id
            });
          err = error;
        }

        if (err) {
          console.error('Error save coupon:', err);
          showToast('Gagal menyimpan kupon');
          return;
        }

        showToast(id ? 'Kupon berhasil diperbarui!' : 'Kupon hadiah baru berhasil dibuat!');
        closeCouponSheet();
        broadcastLiveSync('coupon_sync');
        await loadCouponsData();
        renderCoupons();
        renderGiftStrip();
      } catch (ex) {
        console.error('Exception bikin kupon:', ex);
        showToast('Terjadi kesalahan saat membuat kupon');
      } finally {
        isSubmittingCoupon = false;
        btnSave.disabled = false;
        btnSave.textContent = id ? 'Simpan Perubahan' : 'Bikin Kupon';
      }
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

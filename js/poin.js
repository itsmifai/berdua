// ==============================================================================
// BERDUA — Kupon Hadiah & Poin XP Controller (Fase 5)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { state } from './app.js';
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
      <div class="coupon" data-id="${c.id}">
        <div class="coupon-icon">
          ${iconSvg}
        </div>
        <div class="coupon-body">
          <div class="coupon-name">${escapeHtml(c.name)}</div>
        </div>
        <button type="button" class="coupon-price" data-id="${c.id}" data-price="${c.price_xp}">
          ${c.price_xp} XP
        </button>
      </div>
    `;
  }).join('');

  // Tautkan tombol redeem pada tiap kupon
  container.querySelectorAll('.coupon-price').forEach(btn => {
    btn.addEventListener('click', () => {
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

  btn.disabled = false;
  btn.textContent = `${coupon.price_xp} XP`;

  launchConfetti(btn);
  showToast(`Kupon didapat! −${coupon.price_xp} XP`);

  updateXpDisplays();
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
 * Membuka Bottom Sheet Bikin Kupon
 */
export function openCouponSheet() {
  const sheet = document.getElementById('sheetCoupon');
  const backdrop = document.getElementById('sheetBackdrop');
  if (!sheet || !backdrop) return;

  document.getElementById('couponName').value = '';
  document.getElementById('couponPrice').value = '100';
  document.getElementById('couponIconKey').value = 'gift';

  updatePriceChips('100');
  updateIconChips('gift');

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

  // Submit Simpan Kupon
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingCoupon) return;

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

        if (error) {
          console.error('Error create coupon:', error);
          showToast('Gagal membuat kupon');
          return;
        }

        showToast('Kupon hadiah baru berhasil dibuat!');
        closeCouponSheet();
        await loadCouponsData();
        renderCoupons();
        renderGiftStrip();
      } catch (ex) {
        console.error('Exception bikin kupon:', ex);
        showToast('Terjadi kesalahan saat membuat kupon');
      } finally {
        isSubmittingCoupon = false;
        btnSave.disabled = false;
        btnSave.textContent = 'Bikin Kupon';
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

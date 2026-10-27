// ==============================================================================
// BERDUA — Effects & UI Utilities (Confetti, Toast, Sound/Anim)
// ==============================================================================

let toastTimer = null;

/**
 * Menampilkan pesan toast floating di atas bottom nav
 * @param {string} msg Teks pesan
 * @param {number} duration Durasi tampil dalam milidetik (default 1800ms)
 */
export function showToast(msg, duration = 1800) {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = msg;
  toastEl.classList.add('show');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

/**
 * Partikel Confetti menggunakan Web Animations API
 * Disalin langsung dari prototype-v2.html
 * @param {HTMLElement} originEl Elemen pemicu letupan partikel
 */
export function launchConfetti(originEl) {
  const container = document.querySelector('.phone') || document.body;
  const pr = container.getBoundingClientRect();
  const r = originEl.getBoundingClientRect();
  const colors = ['#E2725B', '#F5A623', '#7D9B76', '#8FA3B8', '#FFD98A'];

  for (let i = 0; i < 24; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = (r.left - pr.left + r.width / 2) + 'px';
    c.style.top = (r.top - pr.top + r.height / 2) + 'px';
    container.appendChild(c);

    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 95;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 45;

    c.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 85}px) rotate(${Math.random() * 540}deg) scale(0.4)`, opacity: 0 }
      ],
      {
        duration: 700 + Math.random() * 500,
        easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)'
      }
    ).onfinish = () => c.remove();
  }
}

/**
 * Efek goyang/hop pada elemen maskot
 * @param {HTMLElement} el Elemen avatar/maskot
 */
export function hopElement(el) {
  if (!el) return;
  el.classList.add('hop');
  setTimeout(() => el.classList.remove('hop'), 850);
}

/**
 * Efek getar halus untuk peringatan saldo kurang
 * @param {HTMLElement} el Elemen kartu saldo
 */
export function shakeElement(el) {
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 450);
}

/**
 * Menampilkan modal konfirmasi custom in-app (menggantikan window.confirm)
 * @returns {Promise<boolean>} Resolves true jika user konfirmasi, false jika batal
 */
export function showConfirmModal({
  title = 'Konfirmasi',
  message = '',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = true
} = {}) {
  return new Promise((resolve) => {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">${escapeModalText(title)}</div>
        <div class="modal-message">${escapeModalText(message)}</div>
        <div class="modal-actions">
          <button type="button" class="modal-btn-cancel">${escapeModalText(cancelText)}</button>
          <button type="button" class="modal-btn-confirm ${isDanger ? 'is-danger' : ''}">${escapeModalText(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('active'));

    const cleanup = (result) => {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 250);
      resolve(result);
    };

    backdrop.querySelector('.modal-btn-confirm').addEventListener('click', () => cleanup(true));
    backdrop.querySelector('.modal-btn-cancel').addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

/**
 * Menampilkan modal pemberitahuan custom in-app (menggantikan window.alert)
 * @returns {Promise<void>} Resolves saat ditutup
 */
export function showAlertModal({
  title = 'Pemberitahuan',
  message = '',
  okText = 'Mengerti'
} = {}) {
  return new Promise((resolve) => {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">${escapeModalText(title)}</div>
        <div class="modal-message">${escapeModalText(message)}</div>
        <div class="modal-actions">
          <button type="button" class="modal-btn-confirm">${escapeModalText(okText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('active'));

    const cleanup = () => {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 250);
      resolve();
    };

    backdrop.querySelector('.modal-btn-confirm').addEventListener('click', cleanup);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup();
    });
  });
}

/**
 * Menampilkan modal input prompt custom in-app (menggantikan window.prompt)
 * @returns {Promise<string|null>} Resolves string input jika user simpan, null jika batal
 */
export function showPromptModal({
  title = 'Ubah Teks',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Simpan',
  cancelText = 'Batal'
} = {}) {
  return new Promise((resolve) => {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">${escapeModalText(title)}</div>
        ${message ? `<div class="modal-message" style="margin-bottom:14px;">${escapeModalText(message)}</div>` : ''}
        <input type="text" id="modalInputPrompt" class="form-input" style="margin-bottom:20px; font-size:15px; text-align:center;" value="${escapeModalText(defaultValue)}" placeholder="${escapeModalText(placeholder)}" maxlength="30">
        <div class="modal-actions">
          <button type="button" class="modal-btn-cancel">${escapeModalText(cancelText)}</button>
          <button type="button" class="modal-btn-confirm">${escapeModalText(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add('active');
      const input = backdrop.querySelector('#modalInputPrompt');
      if (input) {
        input.focus();
        input.select();
      }
    });

    const cleanup = (val) => {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 250);
      resolve(val);
    };

    const confirmBtn = backdrop.querySelector('.modal-btn-confirm');
    const inputEl = backdrop.querySelector('#modalInputPrompt');

    const handleConfirm = () => {
      const val = inputEl?.value.trim() || '';
      cleanup(val);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        cleanup(null);
      }
    });

    backdrop.querySelector('.modal-btn-cancel').addEventListener('click', () => cleanup(null));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(null);
    });
  });
}

function escapeModalText(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

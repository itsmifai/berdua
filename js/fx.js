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

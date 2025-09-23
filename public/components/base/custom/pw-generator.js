// public/js/users/password-tools.js
(function () {
  function getCryptoRand() {
    if (window.crypto && window.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      return a[0] / 0xFFFFFFFF;
    }
    return Math.random();
  }
  function pick(str) { return str.charAt(Math.floor(getCryptoRand() * str.length)); }

  function generatePassword(len = 14) {
    const U = 'ABCDEFGHJKMNPQRSTUVWXYZ';     // без I, O
    const L = 'abcdefghjkmnpqrstuvwxyz';     // без l, o
    const D = '23456789';                    // без 0,1
    const S = '!@#$%^&*-_=+?';
    const ALL = U + L + D + S;

    // обов'язково по симв. з кожного класу
    let out = pick(U) + pick(L) + pick(D) + pick(S);
    for (let i = out.length; i < len; i++) out += pick(ALL);

    // Фішер-Йєтс
    const arr = out.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(getCryptoRand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); } catch (_) { }
  }

  function init(opts) {
    const sel = (q) => typeof q === 'string' ? document.querySelector(q) : q;
    const input = sel(opts.input);
    const toggle = sel(opts.toggle);
    const genBtn = sel(opts.gen);
    const hint = sel(opts.hint);
    const len = Number(opts.length || 14);

    if (toggle && input) {
      toggle.addEventListener('click', function () {
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        this.innerHTML = isPwd
          ? '<span class="linearicons-eye-close"></span>'
          : '<span class="linearicons-eye"></span>';
      });
    }

    if (genBtn && input) {
      genBtn.addEventListener('click', async function () {
        const pwd = generatePassword(len);
        // ❷ відразу вставляємо в поле
        input.value = pwd;
        input.dispatchEvent(new Event('input'));
        await copyToClipboard(pwd);

        if (hint) {
          const prev = hint.textContent;
          hint.textContent = 'Згенеровано і скопійовано в буфер ✔';
          setTimeout(() => { hint.textContent = prev || ''; }, 2000);
        }
      });
    }
  }

  // експорт у глобал на випадок багаторазового використання
  window.PasswordTools = { init, generatePassword };
})();

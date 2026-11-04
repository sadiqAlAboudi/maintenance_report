/**
 * نظام التوثيق والمصادقة لتقارير الصيانة - جامعة القادسية
 */

/* ========================================================
   1. خوارزمية SHA-256 دقيقة ومستقلة تماماً
   ======================================================== */
function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;

  // الثوابت الرياضية القياسية لـ SHA-256
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : ((w[i - 16] + s0 + w[i - 7] + s1) | 0))) | 0;
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (8 * b)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

async function sha256(message) {
  const text = message.trim();
  if (window.crypto && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (_) {}
  }
  return sha256Sync(text);
}

/* ========================================================
   بيانات الاعتماد المشفرة
   ======================================================== */
const AUTH_CONFIG = {
  // admin
  userHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
  // qu@2026 (الناتج الرياضي الدقيق)
  passHash: "1706ba9b6265e3bf6c5b908d374a509e4c59960d4d3ff9c25e6f6e0124adc01e"
};

/* ========================================================
   2. إدارة تسجيل الدخول وتأمين الصفحة
   ======================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  // منع الإغلاق بواسطة زر Esc أو أي حدث إلغاء
  loginModal.addEventListener('cancel', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && loginModal.open) {
      e.preventDefault();
    }
  });

  // إعادة الفتح تلقائياً في حال أُغلق المودال دون إتمام المصادقة
  loginModal.addEventListener('close', () => {
    if (sessionStorage.getItem('qu_auth') !== 'granted') {
      loginModal.showModal();
    }
  });

  // فحص حالة الجلسة الحالية
  if (sessionStorage.getItem('qu_auth') === 'granted') {
    document.body.classList.remove('locked');
  } else {
    loginModal.showModal();
  }

  // معالجة محاولة تسجيل الدخول
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const u = document.getElementById('u_name').value;
    const p = document.getElementById('u_pass').value;

    const [enteredUserHash, enteredPassHash] = await Promise.all([sha256(u), sha256(p)]);

    if (enteredUserHash === AUTH_CONFIG.userHash && enteredPassHash === AUTH_CONFIG.passHash) {
      sessionStorage.setItem('qu_auth', 'granted');
      document.body.classList.remove('locked');
      loginModal.close();
    } else {
      loginError.style.display = 'block';
    }
  });

  // ضبط التاريخ تلقائياً إلى تاريخ اليوم
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(d => d.value = today);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  /* ========================================================
     3. إدارة التوقيع اليدوي على الشاشة
     ======================================================== */
  const dialog = document.getElementById('sigModal');
  const pad = document.getElementById('pad');
  const ctx = pad.getContext('2d');
  let target = null, drawing = false, dpr = 1;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = pad.getBoundingClientRect();
    pad.width = rect.width * dpr;
    pad.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
  }

  function getPos(e) {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function resetBounds() {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
  }

  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    drawing = true;
    const p = getPos(e);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  const stop = e => {
    if (!drawing) return;
    drawing = false;
    try { pad.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  pad.addEventListener('pointerup', stop);
  pad.addEventListener('pointercancel', stop);

  document.querySelectorAll('figure').forEach(fig => {
    const c = fig.querySelector('canvas');
    const b = fig.querySelector('button');
    c.addEventListener('click', () => {
      target = c;
      dialog.showModal();
      resize();
      resetBounds();
      ctx.clearRect(0, 0, pad.width, pad.height);
    });
    b.addEventListener('click', e => {
      e.stopPropagation();
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
    });
  });

  const btns = dialog.querySelectorAll('footer button');
  btns[0].addEventListener('click', () => dialog.close());
  btns[1].addEventListener('click', () => {
    ctx.clearRect(0, 0, pad.width, pad.height);
    resetBounds();
  });
  btns[2].addEventListener('click', () => {
    if (target && minX < maxX) {
      const tCtx = target.getContext('2d');
      tCtx.clearRect(0, 0, target.width, target.height);
      const padGap = 16;
      const sw = (maxX - minX) + padGap * 2;
      const sh = (maxY - minY) + padGap * 2;
      const sx = Math.max(0, minX - padGap) * dpr;
      const sy = Math.max(0, minY - padGap) * dpr;
      const sW = sw * dpr;
      const sH = sh * dpr;
      const scale = Math.min((target.width * 0.9) / sw, (target.height * 0.85) / sh);
      const dx = (target.width - sw * scale) / 2;
      const dy = (target.height - sh * scale) / 2;
      tCtx.drawImage(pad, sx, sy, sW, sH, dx, dy, sw * scale, sh * scale);
    }
    dialog.close();
  });

  /* ========================================================
     4. تصدير التقرير بصيغة PDF
     ======================================================== */
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const prevText = saveBtn.innerHTML;
    saveBtn.textContent = 'جاري المعالجة...';

    const el = document.getElementById('report');
    const inputs = el.querySelectorAll('input, textarea');
    const originalPlaceholders = [];
    const originalTypes = [];

    inputs.forEach(inp => {
      originalPlaceholders.push(inp.getAttribute('placeholder'));
      inp.removeAttribute('placeholder');

      if (inp.tagName === 'INPUT') {
        originalTypes.push(inp.type);
        if (inp.type === 'date') inp.type = 'text';
        inp.setAttribute('value', inp.value);
      } else {
        originalTypes.push(null);
        inp.textContent = inp.value;
      }
    });

    el.querySelectorAll('select').forEach(sel => {
      Array.from(sel.options).forEach(opt => {
        if (opt.value === sel.value) {
          opt.setAttribute('selected', 'selected');
        } else {
          opt.removeAttribute('selected');
        }
      });
    });

    const hiddenEls = el.querySelectorAll('figcaption button, figure small');
    hiddenEls.forEach(h => h.style.display = 'none');
    el.setAttribute('data-pdf', 'true');
    void el.offsetWidth;

    try {
      const dataUrl = await htmlToImage.toJpeg(el, {
        quality: 0.82,
        pixelRatio: 2,
        width: 794,
        height: 1123,
        backgroundColor: '#ffffff'
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      pdf.save('تقرير_صيانة.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      el.removeAttribute('data-pdf');
      hiddenEls.forEach(h => h.style.display = '');
      inputs.forEach((inp, i) => {
        if (originalPlaceholders[i] !== null) inp.setAttribute('placeholder', originalPlaceholders[i]);
        if (originalTypes[i] !== null) inp.type = originalTypes[i];
      });
      saveBtn.disabled = false;
      saveBtn.innerHTML = prevText;
    }
  });
});
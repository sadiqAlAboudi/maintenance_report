/**
 * Maintenance Report Client Application
 * University of Al-Qadisiyah - Computer & Network Maintenance Division
 */

function showModalAlert(message, title = 'تنبيه', isConfirm = false) {
  return new Promise(resolve => {
    const modal = document.getElementById('alertModal');
    if (!modal) {
      if (isConfirm) {
        resolve(window.confirm(message));
      } else {
        window.alert(message);
        resolve(true);
      }
      return;
    }

    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    const cancelBtn = document.getElementById('alertCancelBtn');
    const confirmBtn = document.getElementById('alertConfirmBtn');
    cancelBtn.style.display = isConfirm ? 'inline-block' : 'none';
    confirmBtn.textContent = isConfirm ? 'تأكيد' : 'حسناً';

    const finish = val => {
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.close();
      resolve(val);
    };

    confirmBtn.onclick = () => finish(true);
    cancelBtn.onclick = () => finish(false);
    modal.showModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const nameModal = document.getElementById('nameModal');
  const nameForm = document.getElementById('nameForm');
  const pdfFilenameInput = document.getElementById('pdf_filename');
  const cancelNameBtn = document.getElementById('cancelNameBtn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const f1 = document.getElementById('f1');
  const f5 = document.getElementById('f5');
  const f6 = document.getElementById('f6');
  const f8 = document.getElementById('f8');

  // Initialize today's date in ISO format (YYYY-MM-DD)
  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updateDatePrintDisplay = () => {
    const f6Print = document.getElementById('f6_print');
    const f8Print = document.getElementById('f8_print');
    if (f6Print && f6) {
      f6Print.textContent = f6.value ? f6.value.replace(/-/g, '/') : '';
    }
    if (f8Print && f8) {
      f8Print.textContent = f8.value ? f8.value.replace(/-/g, '/') : '';
    }
  };

  const resetDates = () => {
    const today = getTodayISO();
    if (f6) f6.value = today;
    if (f8) f8.value = today;
    updateDatePrintDisplay();
  };

  resetDates();

  [f6, f8].forEach(input => {
    if (!input) return;
    input.addEventListener('input', updateDatePrintDisplay);
    input.addEventListener('change', updateDatePrintDisplay);
    input.addEventListener('click', () => {
      try {
        if (typeof input.showPicker === 'function') {
          input.showPicker();
        }
      } catch (_) {}
    });
  });

  window.addEventListener('beforeprint', updateDatePrintDisplay);

  // Keyboard shortcut: Ctrl+S to trigger PDF export
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (saveBtn) saveBtn.click();
    }
  });

  // Reset form fields
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const ok = await showModalAlert('هل ترغب بتفريغ حقول الاستمارة لبدء تقرير جديد؟', 'تأكيد التفريغ', true);
      if (!ok) return;
      document.querySelectorAll('#report input:not(#f5), #report textarea').forEach(el => (el.value = ''));
      document.querySelectorAll('#report canvas').forEach(c => {
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
      const fRes = document.getElementById('f_res');
      if (fRes) fRes.selectedIndex = 0;
      resetDates();
    });
  }

  // Register Service Worker for static assets
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // ==========================================
  // Digital Signature Pad
  // ==========================================
  const sigModal = document.getElementById('sigModal');
  const pad = document.getElementById('pad');
  const ctx = pad ? pad.getContext('2d') : null;
  const sigCancel = document.getElementById('sigCancel');
  const sigUndo = document.getElementById('sigUndo');
  const sigClear = document.getElementById('sigClear');
  const sigAccept = document.getElementById('sigAccept');

  let target = null;
  let drawing = false;
  let dpr = 1;
  let strokes = [];
  let currentStroke = null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function recalculateBounds() {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
    for (const stroke of strokes) {
      for (const pt of stroke) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
  }

  function redrawPad() {
    if (!ctx || !pad) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pad.width, pad.height);
    ctx.restore();

    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    for (const stroke of strokes) {
      if (!stroke.length) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    recalculateBounds();
  }

  function resizePad() {
    if (!pad || !ctx) return;
    dpr = window.devicePixelRatio || 1;
    const rect = pad.getBoundingClientRect();
    pad.width = rect.width * dpr;
    pad.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    redrawPad();
  }

  function getPos(e) {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  if (pad) {
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch (_) {}
      drawing = true;
      const p = getPos(e);
      currentStroke = [p];
      strokes.push(currentStroke);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });

    pad.addEventListener('pointermove', e => {
      if (!drawing || !currentStroke) return;
      e.preventDefault();
      const p = getPos(e);
      currentStroke.push(p);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    const stopDrawing = e => {
      if (!drawing) return;
      drawing = false;
      currentStroke = null;
      try { pad.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    pad.addEventListener('pointerup', stopDrawing);
    pad.addEventListener('pointercancel', stopDrawing);
  }

  document.querySelectorAll('figure').forEach(fig => {
    const c = fig.querySelector('canvas');
    const b = fig.querySelector('button');
    if (c) {
      c.addEventListener('click', () => {
        target = c;
        strokes = [];
        if (sigModal) {
          sigModal.showModal();
          resizePad();
        }
      });
    }
    if (b && c) {
      b.addEventListener('click', e => {
        e.stopPropagation();
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
    }
  });

  if (sigCancel) sigCancel.addEventListener('click', () => sigModal.close());

  if (sigUndo) {
    sigUndo.addEventListener('click', () => {
      if (strokes.length) {
        strokes.pop();
        redrawPad();
      }
    });
  }

  if (sigClear) {
    sigClear.addEventListener('click', () => {
      strokes = [];
      redrawPad();
    });
  }

  if (sigAccept) {
    sigAccept.addEventListener('click', () => {
      if (target && minX < maxX && minY < maxY) {
        const tCtx = target.getContext('2d');
        tCtx.clearRect(0, 0, target.width, target.height);
        const padGap = 16;
        const x1 = Math.max(0, minX - padGap);
        const y1 = Math.max(0, minY - padGap);
        const x2 = Math.min(pad.width / dpr, maxX + padGap);
        const y2 = Math.min(pad.height / dpr, maxY + padGap);
        const sw = Math.max(1, x2 - x1);
        const sh = Math.max(1, y2 - y1);
        const sx = x1 * dpr;
        const sy = y1 * dpr;
        const sW = Math.min(pad.width - sx, sw * dpr);
        const sH = Math.min(pad.height - sy, sh * dpr);
        const scale = Math.min((target.width * 0.9) / sw, (target.height * 0.85) / sh);
        const dx = (target.width - sw * scale) / 2;
        const dy = (target.height - sh * scale) / 2;
        tCtx.drawImage(pad, sx, sy, sW, sH, dx, dy, sw * scale, sh * scale);
      }
      if (sigModal) sigModal.close();
    });
  }

  // ==========================================
  // PDF Export & Printing
  // ==========================================
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!f1 || !f1.value.trim()) {
        await showModalAlert('يرجى إدخال الجهة الطالبة للصيانة أولاً.', 'حقل مطلوب');
        if (f1) f1.focus();
        return;
      }
      const cleanDept = f1.value.trim().replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
      const rawDate = (f6 && f6.value) || getTodayISO();
      const dateVal = rawDate.replace(/[\/\.\-]/g, '_');
      if (pdfFilenameInput) {
        pdfFilenameInput.value = `تقرير_صيانة_${cleanDept}_${dateVal}`;
      }
      if (nameModal) {
        nameModal.showModal();
        if (pdfFilenameInput) pdfFilenameInput.select();
      }
    });
  }

  if (cancelNameBtn && nameModal) {
    cancelNameBtn.addEventListener('click', () => nameModal.close());
  }

  if (nameForm) {
    nameForm.addEventListener('submit', () => {
      let chosenName = pdfFilenameInput ? pdfFilenameInput.value.trim().replace(/[\/\\?%*:|"<>]/g, '-').replace(/\.pdf$/i, '') : '';
      if (!chosenName) chosenName = 'تقرير_صيانة';
      if (nameModal) nameModal.close();

      const originalTitle = document.title;
      document.title = chosenName;
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    });
  }
});

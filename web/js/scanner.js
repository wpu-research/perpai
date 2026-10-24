// Kamera ile QR okuma: BarcodeDetector varsa onu, yoksa jsQR'ı kullanır.
// Kamera yoksa (masaüstü, izin reddi) kod ya da dükkân no elle girilebilir.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
let jsqrLoading = null;
const loadJsQR = () => jsqrLoading || (jsqrLoading = new Promise((res, rej) => {
  if (window.jsQR) return res(window.jsQR);
  const s = document.createElement('script'); s.src = JSQR_URL;
  s.onload = () => res(window.jsQR); s.onerror = () => rej(new Error('jsQR yüklenemedi'));
  document.head.appendChild(s);
}));

export function openScanner({ parse, onResult, onClose }) {
  const el = document.createElement('div');
  el.className = 'qrscan';
  el.innerHTML = `
    <div class="qs-cam"><video playsinline muted></video><div class="qs-frame"></div><div class="qs-msg">Kamera açılıyor…</div></div>
    <div class="qs-sheet">
      <div class="qs-title">QR okut, konumunu bul</div>
      <div class="qs-sub">Dükkân kapısındaki, asansördeki ya da koridordaki PerpAI QR'ını çerçeveye al.</div>
      <form class="qs-form"><label class="sr" for="qsInput">Kod ya da dükkân no</label>
        <input id="qsInput" placeholder="Kod ya da dükkân no (ör. A 1350, E19-11)" autocomplete="off">
        <button type="submit">Git</button></form>
      <div class="qs-err" hidden></div>
      <div class="qs-row"><a href="qr.html" target="_blank" rel="noopener">QR kartlarını yazdır</a><button type="button" class="qs-close">Kapat</button></div>
    </div>`;
  document.body.appendChild(el);
  const video = el.querySelector('video'), msg = el.querySelector('.qs-msg'), err = el.querySelector('.qs-err');
  let stream = null, timer = null, closed = false;

  const close = (q) => {
    if (closed) return; closed = true;
    clearInterval(timer);
    stream?.getTracks().forEach(t => t.stop());
    el.remove();
    if (q) onResult(q); else onClose?.();
  };
  const handle = (text) => {
    const q = parse(text);
    if (q) { navigator.vibrate?.(60); close(q); return true; }
    err.hidden = false; err.textContent = `"${text.slice(0, 60)}" bir PerpAI konumu değil.`;
    return false;
  };
  el.querySelector('.qs-close').onclick = () => close(null);
  el.querySelector('.qs-form').onsubmit = (e) => { e.preventDefault(); const v = el.querySelector('#qsInput').value; if (v.trim()) handle(v); };

  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'Bu tarayıcıda kamera yok — kodu elle gir.'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
    } catch (e) {
      msg.textContent = 'Kameraya izin verilmedi — kodu elle gir.'; return;
    }
    if (closed) { stream.getTracks().forEach(t => t.stop()); return; }
    video.srcObject = stream; await video.play().catch(() => {});
    msg.textContent = 'QR aranıyor…';
    let detect;
    if ('BarcodeDetector' in window) {
      try {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes('qr_code')) {
          const bd = new window.BarcodeDetector({ formats: ['qr_code'] });
          detect = async () => { const r = await bd.detect(video); return r[0]?.rawValue; };
        }
      } catch { /* jsQR'a düş */ }
    }
    if (!detect) {
      const jsQR = await loadJsQR().catch(() => null);
      if (!jsQR) { msg.textContent = 'QR okuyucu yüklenemedi — kodu elle gir.'; return; }
      const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
      detect = async () => {
        const w = video.videoWidth, h = video.videoHeight; if (!w) return null;
        const sc = Math.min(1, 640 / w); cv.width = w * sc; cv.height = h * sc;
        ctx.drawImage(video, 0, 0, cv.width, cv.height);
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data;
      };
    }
    let busy = false, last = '';
    timer = setInterval(async () => {
      if (busy || closed) return; busy = true;
      try { const t = await detect(); if (t && t !== last) { last = t; handle(t); } } catch { /* sonraki kare */ }
      busy = false;
    }, 220);
  })();
}

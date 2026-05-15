// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const root = document.documentElement;

// ===== Image upload =====
function bindImageInput(inputId, targetId) {
  $(inputId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      $(targetId).setAttribute('src', ev.target.result);
    };
    reader.readAsDataURL(file);
  });
}

// bindImageInput('logoInput', 'logoImg');
bindImageInput('mainImageInput', 'mainImg');
bindImageInput('cutoutImageInput', 'cutoutImg');

// ===== Text inputs =====
function bindText(inputId, targetId, isHtml = false) {
  $(inputId).addEventListener('input', (e) => {
    if (isHtml) {
      $(targetId).innerHTML = e.target.value;
    } else {
      $(targetId).textContent = e.target.value;
    }
  });
}

bindText('weightInput', 'weightText');
bindText('voucher1Title', 'v1Title');
bindText('voucher2Title', 'v2Title');
bindText('badgeLine1', 'badgeL1');
bindText('badgeLine2', 'badgeL2');

// Special: voucher value with small "K"
function bindVoucherValue(inputId, targetId) {
  $(inputId).addEventListener('input', (e) => {
    const val = e.target.value.trim();
    const match = val.match(/^(\d+)\s*([A-Za-z]*)$/);
    if (match) {
      $(targetId).innerHTML = `${match[1]}<small>${match[2]}</small>`;
    } else {
      $(targetId).textContent = val;
    }
  });
}

bindVoucherValue('voucher1Value', 'v1Value');
bindVoucherValue('voucher2Value', 'v2Value');

// ===== Toggle ẩn/hiện voucher & badge =====
function bindToggle(inputId, className) {
  const input = $(inputId);
  const template = $('template');
  const apply = () => template.classList.toggle(className, !input.checked);
  input.addEventListener('change', apply);
  apply();
}

bindToggle('showVoucher1', 'hide-v1');
bindToggle('showVoucher2', 'hide-v2');
bindToggle('showBadge', 'hide-badge');

// ===== Color controls =====
function bindColor(inputId, cssVar) {
  $(inputId).addEventListener('input', (e) => {
    root.style.setProperty(cssVar, e.target.value);
  });
}

bindColor('colorBg', '--color-bg');
bindColor('colorAccent', '--color-accent');
bindColor('colorText', '--color-text');
bindColor('colorCutout', '--color-cutout');

// ===== Presets =====
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    const { bg, bg2, accent, text, cutout } = btn.dataset;
    root.style.setProperty('--color-bg', bg);
    if (bg2) root.style.setProperty('--color-bg2', bg2);
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-text', text);
    const cutoutColor = cutout || accent;
    root.style.setProperty('--color-cutout', cutoutColor);
    $('colorBg').value = bg;
    $('colorAccent').value = accent;
    $('colorText').value = text;
    $('colorCutout').value = cutoutColor;
  });
});

// ===== Download as PNG (uses modern-screenshot: better Vietnamese font support) =====
async function waitForLibrary(timeoutMs = 8000) {
  const start = Date.now();
  while (!window.modernScreenshot) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Không tải được thư viện modern-screenshot (kiểm tra mạng)');
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

async function waitForImages(node) {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
      setTimeout(done, 5000);
    });
  }));
}

async function waitForFonts() {
  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    const vietChars = 'ƯỜẨẰẶỢÒàáảãạăằẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ';
    for (const family of ['"Baloo 2"', '"Be Vietnam Pro"', '"Pacifico"', '"Playfair Display"']) {
      try { await document.fonts.load(`800 20px ${family}`, vietChars); } catch {}
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  } catch (e) {
    console.warn('[font wait]', e);
  }
}

// Fetch Google Fonts CSS + every woff2 it references, encode as base64,
// then inject as <style> so the fonts are PART of the document.
// modern-screenshot reads document <style> rules → embeds correctly in foreignObject.
let _embedFontsPromise = null;
async function embedGoogleFontsInline() {
  if (_embedFontsPromise) return _embedFontsPromise;
  if (document.getElementById('embedded-fonts-style')) return;

  _embedFontsPromise = (async () => {
    const link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
    if (!link) return;

    const cssText = await fetch(link.href).then(r => r.text());

    // Extract all https://fonts.gstatic.com/... URLs
    const urlSet = new Set();
    cssText.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, u) => { urlSet.add(u); return _; });
    const urls = [...urlSet];

    // Fetch each font as base64
    const dataMap = {};
    await Promise.all(urls.map(async (u) => {
      try {
        const buf = await fetch(u).then(r => r.arrayBuffer());
        // ArrayBuffer → base64 (chunked to avoid stack overflow)
        const bytes = new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        dataMap[u] = `data:font/woff2;base64,${b64}`;
      } catch (e) {
        console.warn('font fetch failed:', u, e);
      }
    }));

    // Replace URLs inside CSS
    let inlined = cssText;
    for (const [u, d] of Object.entries(dataMap)) {
      inlined = inlined.split(u).join(d);
    }

    // Inject as <style> — modern-screenshot will pick this up
    const style = document.createElement('style');
    style.id = 'embedded-fonts-style';
    style.textContent = inlined;
    document.head.appendChild(style);

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    console.log(`[fonts] embedded ${urls.length} woff2 inline`);
  })();
  return _embedFontsPromise;
}

// ===== Render & nén dưới 2MB =====
const MAX_BYTES = 2 * 1024 * 1024;

function fmtSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + 'MB';
}

function downscaleCanvas(srcCanvas, ratio) {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(srcCanvas.width * ratio));
  out.height = Math.max(1, Math.round(srcCanvas.height * ratio));
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, out.width, out.height);
  return out;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function renderUnderSize(node, maxBytes) {
  // Render 1 lần ở scale 2 với alpha — sau đó nén tại canvas (nhanh, không re-render DOM)
  const canvas = await window.modernScreenshot.domToCanvas(node, {
    scale: 2,
    backgroundColor: null,
  });

  // 1) PNG lossless, hạ scale dần dần để vừa 2MB (giữ alpha → bo góc nguyên vẹn)
  for (const ratio of [1, 0.85, 0.75, 0.6, 0.5]) {
    const c = ratio === 1 ? canvas : downscaleCanvas(canvas, ratio);
    const blob = await canvasToBlob(c, 'image/png');
    console.log(`[export] PNG x${(ratio*2).toFixed(2)} ${c.width}×${c.height} = ${fmtSize(blob.size)}`);
    if (blob.size <= maxBytes) return { blob, ext: 'png' };
  }

  // 2) Fallback JPEG ở scale 2 — fill bg để 4 góc bo không bị màu lạ
  const bg = getComputedStyle(node).backgroundColor || '#ffd9e6';
  const filled = document.createElement('canvas');
  filled.width = canvas.width;
  filled.height = canvas.height;
  const fctx = filled.getContext('2d');
  fctx.fillStyle = bg;
  fctx.fillRect(0, 0, filled.width, filled.height);
  fctx.drawImage(canvas, 0, 0);

  let blob;
  for (const q of [0.95, 0.92, 0.88, 0.85, 0.8, 0.75]) {
    blob = await canvasToBlob(filled, 'image/jpeg', q);
    console.log(`[export] JPEG q=${q} = ${fmtSize(blob.size)}`);
    if (blob.size <= maxBytes) return { blob, ext: 'jpg' };
  }
  return { blob, ext: 'jpg' };
}

$('downloadBtn').addEventListener('click', async () => {
  const btn = $('downloadBtn');
  const original = btn.textContent;
  btn.disabled = true;

  try {
    btn.textContent = 'Đang tải thư viện...';
    await waitForLibrary();

    btn.textContent = 'Đang tải font...';
    await waitForFonts();

    btn.textContent = 'Đang nhúng font...';
    await embedGoogleFontsInline();

    const node = $('template');

    btn.textContent = 'Đang tải ảnh...';
    await waitForImages(node);

    btn.textContent = 'Đang render...';

    // Tạm bỏ transform responsive (mobile) để screenshot ra đúng 1000×1000
    const prevTransform = node.style.transform;
    const prevPosition = node.style.position;
    node.style.transform = 'none';
    node.style.position = 'static';

    let blob, ext;
    try {
      ({ blob, ext } = await renderUnderSize(node, MAX_BYTES));
    } finally {
      node.style.transform = prevTransform;
      node.style.position = prevPosition;
    }

    if (!blob) throw new Error('Không tạo được blob (canvas tainted - cần chạy qua HTTP server)');

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `template-cuu-shop.${ext}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('[Download error]', err);
    alert('Lỗi tải template:\n' + err.message + '\n\nMẹo: chạy qua HTTP server (python3 -m http.server). F12 → Console để xem chi tiết.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

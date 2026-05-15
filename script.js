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

bindImageInput('logoInput', 'logoImg');
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

// ===== Color controls =====
function bindColor(inputId, cssVar) {
  $(inputId).addEventListener('input', (e) => {
    root.style.setProperty(cssVar, e.target.value);
  });
}

bindColor('colorBg', '--color-bg');
bindColor('colorAccent', '--color-accent');
bindColor('colorText', '--color-text');

// ===== Presets =====
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    const { bg, bg2, accent, text } = btn.dataset;
    root.style.setProperty('--color-bg', bg);
    if (bg2) root.style.setProperty('--color-bg2', bg2);
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-text', text);
    $('colorBg').value = bg;
    $('colorAccent').value = accent;
    $('colorText').value = text;
  });
});

// ===== Download as PNG (uses html-to-image: supports filter/drop-shadow/aspect-ratio) =====
async function waitForLibrary(timeoutMs = 8000) {
  const start = Date.now();
  while (!window.htmlToImage) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Không tải được thư viện html-to-image (kiểm tra mạng)');
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

$('downloadBtn').addEventListener('click', async () => {
  const btn = $('downloadBtn');
  const original = btn.textContent;
  btn.textContent = 'Đang xử lý...';
  btn.disabled = true;

  try {
    await waitForLibrary();

    const node = $('template');

    // Use toBlob to avoid data-URL size limits on big PNGs
    const blob = await window.htmlToImage.toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: null,
      style: { transform: 'none' },
    });

    if (!blob) throw new Error('Không tạo được blob ảnh (canvas có thể bị tainted - chạy qua http server thay vì file://)');

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'template-cuu-shop.png';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('[Download error]', err);
    alert('Lỗi tải template:\n' + err.message + '\n\nMẹo: nếu đang mở bằng file:// hãy chạy qua HTTP server (python3 -m http.server). Mở DevTools (F12) → Console để xem chi tiết.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

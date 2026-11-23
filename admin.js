const OWNER = 'fadhlanqital';
const REPOSITORY = 'fadhlanqital.github.io';
const BRANCH = 'main';
const CONTENT_PATH = 'portfolio-content.json';
const API = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const editor = $('#editor');
const editorContent = $('#editorContent');
const gate = $('#githubGate');
let githubToken = '';
let portfolio = null;
let activeTab = 'site';
let selectedProjectId = '';
let selectedProjectRef = null;
let pendingUploads = [];
let pendingDeletes = new Set();
let localPreviewAssets = new Map();
let previewTimer = 0;
let mediaLibraryFiles = [];
let mediaLibraryError = '';
let mediaPickerTarget = null;
const BACKGROUND_DEFAULTS = {
  homeHero: { image: 'assets/personal-02.webp', opacity: 24, overlay: 42, blur: 0, saturation: 70, positionX: 70, positionY: 50, zoom: 110 },
  personalCategory: { image: 'assets/study-01.webp', opacity: 18, overlay: 57, blur: 0, saturation: 65, positionX: 70, positionY: 50, zoom: 112 },
  gameArtCategory: { image: 'assets/polri-01.webp', opacity: 18, overlay: 58, blur: 0, saturation: 65, positionX: 70, positionY: 50, zoom: 112 },
  developmentCategory: { image: 'assets/paranoia-03.webp', opacity: 17, overlay: 60, blur: 1, saturation: 60, positionX: 70, positionY: 50, zoom: 112 },
  aboutOpening: { image: 'assets/anima-wide.webp', opacity: 14, overlay: 64, blur: 1, saturation: 55, positionX: 28, positionY: 50, zoom: 110 }
};
const BACKGROUND_LABELS = {
  homeHero: ['Beranda · Hero', 'Layer gambar atmosferik di belakang teks dan gambar utama hero.'],
  personalCategory: ['Kategori · Personal Artwork', 'Background hanya berada di area judul/pengantar, bukan di belakang grid karya.'],
  gameArtCategory: ['Kategori · 2D Game Art', 'Background hanya berada di area judul/pengantar, bukan di belakang grid karya.'],
  developmentCategory: ['Kategori · Game Development', 'Background hanya berada di area judul/pengantar proyek.'],
  aboutOpening: ['About · Pembuka', 'Background berada di area pengantar About, di belakang foto dan teks.']
};
const APPEARANCE_DEFAULTS = {
  headingTextColor: '#f1f0f4', bodyTextColor: '#a7adbb', uiTextColor: '#e6e3ee', labelTextColor: '#b4acd8',
  captionTextColor: '#f5f3fb', captionBackgroundColor: '#080a10',
  headingTextScale: 100, featuredImageScale: 100, bodyTextSize: 13, uiTextSize: 12, labelTextSize: 10, captionTextSize: 11,
  sectionSpacingScale: 100, contentGapScale: 100, pageGutterScale: 100, heroImageScale: 100, backgrounds: BACKGROUND_DEFAULTS
};
const DEFAULT_SITE_LABELS = {
  brandHome: 'home', contentLoadError: 'Portfolio content could not be loaded. Please reload the page in a moment.',
  openNavigation: 'Open navigation', closeNavigation: 'Close navigation',
  closeArtwork: 'Close artwork', previousArtwork: 'Previous artwork', nextArtwork: 'Next artwork',
  artworkView: 'Artwork view', slideView: 'Slide view', gridView: 'Grid view',
  showImage: 'Show image', collectionCoverAlt: 'collection cover',
  projectArtworkAlt: 'project artwork', featuredArtworkAlt: 'featured artwork', featuredVisual: 'FEATURED VISUAL'
};
const ARTWORK_TYPE_SUGGESTIONS = [
  'Digital Illustration', 'Traditional Drawing', 'Sprite / Sprite Sheet', 'Comic / Manga',
  'Character Concept', 'Character Animation', 'Game Asset', 'Environment Art',
  'Cutscene Illustration', 'Gameplay Capture', 'Game UI / Interface', 'Study / Experiment', 'Other'
];
const MEDIA_IMAGE_PATTERN = /\.(?:jpe?g|png|webp|gif|avif|svg|ico|bmp|tiff?)$/i;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function status(element, message, kind = '') {
  element.textContent = message;
  element.classList.toggle('is-error', kind === 'error');
  element.classList.toggle('is-success', kind === 'success');
}

function apiPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub menolak permintaan (${response.status}).`);
  return data;
}

function decodeBase64Utf8(encoded) {
  const binary = atob(encoded.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const block = 0x8000;
  for (let index = 0; index < data.length; index += block) {
    binary += String.fromCharCode(...data.subarray(index, index + block));
  }
  return btoa(binary);
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((item, key) => item[key], object);
  target[last] = value;
}

function normalizeAppearance(site) {
  const savedAppearance = site.appearance || {};
  site.appearance = { ...APPEARANCE_DEFAULTS, ...savedAppearance };
  site.appearance.backgrounds = Object.fromEntries(Object.entries(BACKGROUND_DEFAULTS).map(([key, defaults]) => [
    key, { ...defaults, ...(savedAppearance.backgrounds?.[key] || {}) }
  ]));
  return site.appearance;
}

function normalizeSiteLabels(site) {
  site.labels = { ...DEFAULT_SITE_LABELS, ...(site.labels || {}) };
  return site.labels;
}

function safeHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function safeBackgroundCssUrl(value) {
  const source = publicAsset(String(value || '').trim());
  if (!source || !/^(https?:\/\/|blob:|data:image\/(?:png|jpeg|webp|gif);|\/|\.\/|assets\/|[a-z0-9_.-]+\.(?:jpe?g|png|webp|gif|avif|svg|ico|bmp|tiff?)(?:[?#].*)?$)/i.test(source)) return 'none';
  return `url("${encodeURI(source).replace(/["']/g, '%22')}")`;
}

function applyAppearance(site, target = document.documentElement) {
  const appearance = normalizeAppearance(site);
  const number = (key, fallback, min, max) => Math.max(min, Math.min(max, Number(appearance[key]) || fallback));
  const sectionScale = number('sectionSpacingScale', 100, 60, 160) / 100;
  const contentScale = number('contentGapScale', 100, 60, 160) / 100;
  const gutterScale = number('pageGutterScale', 100, 75, 140) / 100;
  const px = (base, scale) => `${Number((base * scale).toFixed(1))}px`;
  const vw = (base, scale) => `${Number((base * scale).toFixed(2))}vw`;
  const backgroundVariables = {};
  Object.entries(BACKGROUND_DEFAULTS).forEach(([key, defaults]) => {
    const config = { ...defaults, ...(appearance.backgrounds?.[key] || {}) };
    const slug = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
    const clampValue = (value, min, max, fallback) => {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
    };
    backgroundVariables[`--portfolio-bg-${slug}-image`] = safeBackgroundCssUrl(config.image);
    backgroundVariables[`--portfolio-bg-${slug}-opacity`] = String(clampValue(config.opacity, 0, 55, defaults.opacity) / 100);
    backgroundVariables[`--portfolio-bg-${slug}-overlay`] = String(clampValue(config.overlay, 0, 90, defaults.overlay) / 100);
    backgroundVariables[`--portfolio-bg-${slug}-blur`] = `${clampValue(config.blur, 0, 12, defaults.blur)}px`;
    backgroundVariables[`--portfolio-bg-${slug}-saturation`] = `${clampValue(config.saturation, 0, 150, defaults.saturation)}%`;
    backgroundVariables[`--portfolio-bg-${slug}-position`] = `${clampValue(config.positionX, 0, 100, defaults.positionX)}% ${clampValue(config.positionY, 0, 100, defaults.positionY)}%`;
    backgroundVariables[`--portfolio-bg-${slug}-zoom`] = String(clampValue(config.zoom, 100, 160, defaults.zoom) / 100);
  });
  Object.entries(backgroundVariables).forEach(([property, value]) => target.style.setProperty(property, value));
  const previewKey = target.dataset.backgroundPreview;
  if (previewKey && BACKGROUND_DEFAULTS[previewKey]) {
    const defaults = BACKGROUND_DEFAULTS[previewKey];
    const config = { ...defaults, ...(appearance.backgrounds?.[previewKey] || {}) };
    const slug = previewKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
    const clampValue = (value, min, max, fallback) => {
      const numeric = Number(value);
      return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : fallback));
    };
    target.style.setProperty('--admin-background-image', `var(--portfolio-bg-${slug}-image)`);
    target.style.setProperty('--admin-background-opacity', String(clampValue(config.opacity, 0, 55, defaults.opacity) / 100));
    target.style.setProperty('--admin-background-overlay', String(clampValue(config.overlay, 0, 90, defaults.overlay) / 100));
    target.style.setProperty('--admin-background-blur', `${clampValue(config.blur, 0, 12, defaults.blur)}px`);
    target.style.setProperty('--admin-background-saturation', `${clampValue(config.saturation, 0, 150, defaults.saturation)}%`);
    target.style.setProperty('--admin-background-position', `${clampValue(config.positionX, 0, 100, defaults.positionX)}% ${clampValue(config.positionY, 0, 100, defaults.positionY)}%`);
    target.style.setProperty('--admin-background-zoom', String(clampValue(config.zoom, 100, 160, defaults.zoom) / 100));
  }
  const spacingVariables = {
    '--portfolio-preview-section-pad': px(24, sectionScale), '--portfolio-preview-section-gap': px(22, sectionScale), '--portfolio-preview-content-gap': px(12, contentScale), '--portfolio-preview-side-pad': px(24, gutterScale), '--portfolio-preview-min-height': px(Math.max(245, 190 * sectionScale), 1),
    '--portfolio-page-gutter': `clamp(${px(22, gutterScale)}, ${vw(7, gutterScale)}, ${px(112, gutterScale)})`,
    '--portfolio-page-gutter-wide': `clamp(${px(22, gutterScale)}, ${vw(8, gutterScale)}, ${px(120, gutterScale)})`,
    '--portfolio-page-gutter-narrative': `clamp(${px(22, gutterScale)}, ${vw(10, gutterScale)}, ${px(155, gutterScale)})`,
    '--portfolio-page-gutter-mobile': px(22, gutterScale),
    '--portfolio-story-gutter-mobile': px(16, gutterScale),
    '--portfolio-pair-gutter-mobile': px(18, gutterScale),
    '--portfolio-art-intro-top': px(80, sectionScale), '--portfolio-art-intro-bottom': px(44, sectionScale),
    '--portfolio-art-intro-top-mobile': px(58, sectionScale), '--portfolio-art-intro-bottom-mobile': px(32, sectionScale),
    '--portfolio-art-controls-space': px(18, sectionScale), '--portfolio-art-controls-space-mobile': px(15, sectionScale),
    '--portfolio-art-feature-top': px(44, sectionScale), '--portfolio-art-feature-bottom': px(26, sectionScale),
    '--portfolio-art-feature-top-mobile': px(28, sectionScale), '--portfolio-art-feature-bottom-mobile': px(18, sectionScale),
    '--portfolio-dev-intro-top': px(80, sectionScale), '--portfolio-dev-intro-bottom': px(48, sectionScale),
    '--portfolio-dev-intro-top-mobile': px(58, sectionScale), '--portfolio-dev-intro-bottom-mobile': px(32, sectionScale),
    '--portfolio-dev-page-bottom': px(90, sectionScale),
    '--portfolio-dev-project-gap': px(Math.max(1, 1 + (sectionScale - 1) * 30), 1),
    '--portfolio-project-opening-space-min': px(45, sectionScale), '--portfolio-project-opening-space-fluid': vw(8, sectionScale), '--portfolio-project-opening-space-max': px(115, sectionScale), '--portfolio-project-opening-space-mobile-top': px(30, sectionScale), '--portfolio-project-opening-space-mobile-bottom': px(42, sectionScale),
    '--portfolio-project-narrative-space-min': px(75, sectionScale), '--portfolio-project-narrative-space-fluid': vw(10, sectionScale), '--portfolio-project-narrative-space-max': px(140, sectionScale), '--portfolio-project-narrative-space-mobile': px(65, sectionScale),
    '--portfolio-story-space-min': px(35, sectionScale), '--portfolio-story-space-fluid': vw(6, sectionScale), '--portfolio-story-space-max': px(86, sectionScale), '--portfolio-story-space-mobile': px(33, sectionScale),
    '--portfolio-story-pair-space-min': px(35, sectionScale), '--portfolio-story-pair-space-fluid': vw(6, sectionScale), '--portfolio-story-pair-space-max': px(85, sectionScale), '--portfolio-story-pair-space-mobile': px(30, sectionScale),
    '--portfolio-cutscene-space-min': px(54, sectionScale), '--portfolio-cutscene-space-fluid': vw(8, sectionScale), '--portfolio-cutscene-space-max': px(110, sectionScale),
    '--portfolio-cutscene-heading-gap-min': px(32, sectionScale), '--portfolio-cutscene-heading-gap-fluid': vw(5, sectionScale), '--portfolio-cutscene-heading-gap-max': px(70, sectionScale),
    '--portfolio-cutscene-frame-gap-min': px(34, sectionScale), '--portfolio-cutscene-frame-gap-fluid': vw(5, sectionScale), '--portfolio-cutscene-frame-gap-max': px(68, sectionScale),
    '--portfolio-artwork-group-gap-min': px(34, sectionScale), '--portfolio-artwork-group-gap-fluid': vw(5, sectionScale), '--portfolio-artwork-group-gap-max': px(64, sectionScale), '--portfolio-artwork-group-gap-mobile': px(36, sectionScale),
    '--portfolio-case-section-space-min': px(42, sectionScale), '--portfolio-case-section-space-fluid': vw(6, sectionScale), '--portfolio-case-section-space-max': px(82, sectionScale),
    '--portfolio-project-facts-gap-min': px(25, contentScale), '--portfolio-project-facts-gap-fluid': vw(6, contentScale), '--portfolio-project-facts-gap-max': px(85, contentScale),
    '--portfolio-project-narrative-gap': px(50, contentScale), '--portfolio-project-narrative-gap-mobile': px(22, contentScale),
    '--portfolio-story-pair-gap-min': px(16, contentScale), '--portfolio-story-pair-gap-fluid': vw(3, contentScale), '--portfolio-story-pair-gap-max': px(42, contentScale),
    '--portfolio-asset-grid-gap-min': px(12, contentScale), '--portfolio-asset-grid-gap-fluid': vw(2, contentScale), '--portfolio-asset-grid-gap-max': px(22, contentScale),
    '--portfolio-gap-filter': px(9, contentScale), '--portfolio-gap-grid': px(18, contentScale), '--portfolio-gap-grid-tablet': px(14, contentScale), '--portfolio-gap-rail': px(20, contentScale),
    '--portfolio-gap-intro': px(35, contentScale), '--portfolio-gap-controls': px(20, contentScale), '--portfolio-gap-story-head': px(20, contentScale), '--portfolio-story-head-margin': px(22, contentScale), '--portfolio-type-heading-gap': px(17, contentScale), '--portfolio-feature-top-gap': px(15, contentScale), '--portfolio-gap-micro': px(18, contentScale),
    '--portfolio-gap-asset-strip': px(14, contentScale), '--portfolio-gap-gameplay': px(14, contentScale), '--portfolio-gap-pair': px(18, contentScale), '--portfolio-gap-mobile-asset-strip': px(10, contentScale), '--portfolio-gap-mobile-asset-grid': px(9, contentScale), '--portfolio-gap-mobile-pair': px(12, contentScale), '--portfolio-gap-mobile-type-heading': px(12, contentScale),
    '--portfolio-gap-mobile-filter': px(7, contentScale), '--portfolio-gap-mobile-intro': px(21, contentScale), '--portfolio-gap-mobile-dev-intro': px(22, contentScale),
    '--portfolio-gap-mobile-controls': px(20, contentScale), '--portfolio-gap-mobile-rail': px(12, contentScale), '--portfolio-gap-mobile-grid': px(10, contentScale), '--portfolio-gap-mobile-story-pair': px(25, contentScale)
  };
  Object.entries(spacingVariables).forEach(([property, value]) => target.style.setProperty(property, value));
  target.style.setProperty('--portfolio-heading-color', safeHexColor(appearance.headingTextColor, APPEARANCE_DEFAULTS.headingTextColor));
  target.style.setProperty('--portfolio-body-color', safeHexColor(appearance.bodyTextColor, APPEARANCE_DEFAULTS.bodyTextColor));
  target.style.setProperty('--portfolio-ui-color', safeHexColor(appearance.uiTextColor, APPEARANCE_DEFAULTS.uiTextColor));
  target.style.setProperty('--portfolio-label-color', safeHexColor(appearance.labelTextColor, APPEARANCE_DEFAULTS.labelTextColor));
  target.style.setProperty('--portfolio-caption-color', safeHexColor(appearance.captionTextColor, APPEARANCE_DEFAULTS.captionTextColor));
  target.style.setProperty('--portfolio-caption-background', safeHexColor(appearance.captionBackgroundColor, APPEARANCE_DEFAULTS.captionBackgroundColor));
  target.style.setProperty('--portfolio-heading-scale', String(number('headingTextScale', 100, 85, 120) / 100));
  target.style.setProperty('--portfolio-featured-image-scale', String(number('featuredImageScale', 100, 40, 100) / 100));
  target.style.setProperty('--portfolio-hero-image-scale', String(number('heroImageScale', 100, 50, 145) / 100));
  target.style.setProperty('--portfolio-body-size', `${number('bodyTextSize', 13, 12, 18)}px`);
  target.style.setProperty('--portfolio-ui-size', `${number('uiTextSize', 12, 10, 18)}px`);
  target.style.setProperty('--portfolio-label-size', `${number('labelTextSize', 10, 9, 15)}px`);
  target.style.setProperty('--portfolio-caption-size', `${number('captionTextSize', 11, 10, 16)}px`);
}

function appearanceRange(path, label, min, max, hint, unit = 'px') {
  const value = Number(getPath(portfolio, path) ?? min);
  return `<label class="field appearance-range"><span class="field-label">${escapeHtml(label)}<output data-range-output="${escapeHtml(path)}" data-unit="${escapeHtml(unit)}">${value}${escapeHtml(unit)}</output></span><input type="range" min="${min}" max="${max}" step="1" value="${value}" data-path="${escapeHtml(path)}" data-unit="${escapeHtml(unit)}"><small>${escapeHtml(hint)}</small></label>`;
}

function renderAppearanceEditor() {
  return `<section class="settings-group appearance-settings"><div class="group-heading"><div><h2>Tampilan teks dan warna</h2><p>Atur keterbacaan website. Perubahan tersimpan saat Anda menekan Terbitkan perubahan.</p></div></div><div class="field-grid">
    ${field('site.appearance.headingTextColor', 'Warna judul', 'color')}
    ${field('site.appearance.bodyTextColor', 'Warna teks isi', 'color')}
    ${field('site.appearance.uiTextColor', 'Warna tautan dan tombol', 'color')}
    ${field('site.appearance.labelTextColor', 'Warna label dan metadata', 'color')}
    ${field('site.appearance.captionTextColor', 'Warna teks caption gambar', 'color')}
    ${field('site.appearance.captionBackgroundColor', 'Warna latar caption gambar', 'color')}
    ${appearanceRange('site.appearance.headingTextScale', 'Ukuran judul', 85, 120, 'Skala semua judul utama. 100% adalah ukuran awal.', '%')}
    ${appearanceRange('site.appearance.featuredImageScale', 'Ukuran gambar Featured Disciplines', 40, 100, 'Atur skala karya di dalam panel landscape. Background panel tetap.', '%')}
    ${appearanceRange('site.appearance.heroImageScale', 'Ukuran gambar Hero', 50, 145, 'Perbesar atau perkecil gambar utama di bagian Hero beranda.', '%')}
    ${appearanceRange('site.appearance.bodyTextSize', 'Ukuran teks isi', 12, 18, 'Berlaku untuk paragraf dan deskripsi.')}
    ${appearanceRange('site.appearance.uiTextSize', 'Ukuran navbar, tautan, filter, dan tombol', 10, 18, 'Berlaku pada menu utama, tab kategori, filter karya, tautan, dan tombol.')}
    ${appearanceRange('site.appearance.labelTextSize', 'Ukuran label dan metadata', 9, 15, 'Berlaku untuk label kecil, metadata, dan catatan kategori.')}
    ${appearanceRange('site.appearance.captionTextSize', 'Ukuran caption gambar', 10, 16, 'Berlaku untuk judul kecil pada gambar portofolio.')}
  </div><div class="hero-size-preview" id="heroImageSizePreview"><div class="hero-size-preview-copy"><span>HOME · HERO</span><strong data-hero-preview-title>${escapeHtml(portfolio.site.home.heroTitle)}</strong><em data-hero-preview-emphasis>${escapeHtml(portfolio.site.home.heroEmphasis)}</em><small>Preview skala gambar utama</small></div><div class="hero-size-preview-art"><img data-hero-preview-image src="${escapeHtml(publicAsset(portfolio.site.home.heroImage))}" alt="Preview gambar utama Hero"></div></div><div class="appearance-spacing"><div class="group-heading"><div><h3>Ruang dan jarak</h3><p>Atur jarak antar-section, jarak antar-konten, dan ruang di sisi halaman. Panel contoh di bawah ikut berubah; buka Pratinjau website untuk melihat seluruh halaman.</p></div></div><div class="field-grid">
    ${appearanceRange('site.appearance.sectionSpacingScale', 'Jarak antar-section', 60, 160, 'Mengatur jarak antar-section, termasuk kelompok jenis pada Grid View Personal Artwork.', '%')}
    ${appearanceRange('site.appearance.contentGapScale', 'Jarak antar-konten', 60, 160, 'Atur jarak filter, kartu grid, metadata, dan kelompok gambar di halaman proyek.', '%')}
    ${appearanceRange('site.appearance.pageGutterScale', 'Padding sisi halaman', 75, 140, 'Atur lebar ruang di sisi kiri dan kanan halaman kategori dan detail proyek.', '%')}
  </div><div class="spacing-preview" id="spacingPreview"><div class="spacing-preview-heading"><span>PREVIEW RUANG & JARAK</span><small>Jarak panel, jarak tile, dan padding sisi berubah bersama slider.</small></div><div class="spacing-preview-viewport"><div class="spacing-preview-page"><section class="spacing-preview-section"><div class="spacing-preview-section-head"><span>01 / PERSONAL ARTWORK</span><b>12 VISUALS</b></div><div class="spacing-preview-content"><div class="spacing-preview-tile"><i></i><span></span></div><div class="spacing-preview-tile"><i></i><span></span></div><div class="spacing-preview-tile"><i></i><span></span></div></div></section><section class="spacing-preview-section"><div class="spacing-preview-section-head"><span>02 / PROJECT DETAILS</span><b>03 SECTIONS</b></div><div class="spacing-preview-content"><div class="spacing-preview-tile is-wide"><i></i><span></span></div><div class="spacing-preview-tile is-wide"><i></i><span></span></div></div></section></div></div><div class="spacing-preview-legend"><span><i class="legend-section"></i> Jarak antar-section</span><span><i class="legend-content"></i> Jarak antar-konten</span><span><i class="legend-gutter"></i> Padding sisi halaman</span></div></div></div><div class="background-settings"><div class="group-heading"><div><h3>Background gambar</h3><p>Pilih karya sebagai background, lalu atur tampilannya. Preview kecil mengikuti perubahan saat itu juga; gunakan Pratinjau website untuk melihat penempatan di halaman sebenarnya.</p></div></div>${Object.keys(BACKGROUND_DEFAULTS).map(backgroundSettingEditor).join('')}</div><div class="appearance-preview" id="appearancePreview"><div class="appearance-preview-layout"><div class="appearance-preview-art"><span class="appearance-preview-kicker">CONTOH JUDUL BAGIAN</span><p class="appearance-preview-body">Contoh teks isi portofolio untuk melihat ukuran dan warnanya.</p><a class="appearance-preview-link" href="#">CONTOH TAUTAN / TOMBOL ↗</a><span class="appearance-preview-label">LABEL KATEGORI · METADATA</span><span class="appearance-preview-caption">PERSONAL ARTWORK / CONTOH CAPTION</span></div><div class="appearance-preview-image-example"><div class="appearance-preview-image-stage"><img class="appearance-preview-image" src="assets/personal-02.webp" alt="Contoh karya portrait di dalam panel landscape"></div><span class="appearance-preview-image-label">PREVIEW KARYA DALAM PANEL LANDSCAPE</span></div></div></div></section>`;
}

function backgroundSettingEditor(key) {
  const [label, hint] = BACKGROUND_LABELS[key];
  const base = `site.appearance.backgrounds.${key}`;
  return `<details class="background-setting"><summary><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(hint)}</small></span><span class="background-setting-chevron" aria-hidden="true">⌄</span></summary><div class="background-setting-body"><div class="field-grid">
    ${imageField(`${base}.image`, 'Gambar background', 'Pilih/upload gambar atau masukkan path/URL. Kosongkan path untuk menghapus background area ini.')}
    ${appearanceRange(`${base}.opacity`, 'Transparansi gambar', 0, 55, 'Atur seberapa terlihat gambar background.', '%')}
    ${appearanceRange(`${base}.overlay`, 'Gelap overlay', 0, 90, 'Lapisan gelap untuk menjaga teks tetap mudah dibaca.', '%')}
    ${appearanceRange(`${base}.blur`, 'Blur gambar', 0, 12, 'Lembutkan detail background.', 'px')}
    ${appearanceRange(`${base}.saturation`, 'Saturasi warna', 0, 150, 'Atur intensitas warna background.', '%')}
    ${appearanceRange(`${base}.positionX`, 'Posisi horizontal', 0, 100, 'Geser fokus gambar ke kiri atau kanan.', '%')}
    ${appearanceRange(`${base}.positionY`, 'Posisi vertikal', 0, 100, 'Geser fokus gambar ke atas atau bawah.', '%')}
    ${appearanceRange(`${base}.zoom`, 'Zoom / ukuran gambar', 100, 160, 'Perbesar atau perkecil crop background.', '%')}
  </div><div class="background-preview" data-background-preview="${escapeHtml(key)}"><div class="background-preview-image"></div><div class="background-preview-overlay"></div><div class="background-preview-copy"><span>PREVIEW BACKGROUND</span><strong>${escapeHtml(label)}</strong><small>Contoh teks di atas gambar</small></div></div></div></details>`;
}

function field(path, label, type = 'text', hint = '') {
  const value = getPath(portfolio, path);
  const safeValue = escapeHtml(Array.isArray(value) ? value.join('\n') : value ?? '');
  const control = type === 'textarea' || type === 'lines'
    ? `<textarea data-path="${escapeHtml(path)}" ${type === 'lines' ? 'data-lines="true"' : ''}>${safeValue}</textarea>`
    : `<input type="${type}" data-path="${escapeHtml(path)}" value="${safeValue}">`;
  return `<label class="field"><span class="field-label">${escapeHtml(label)}</span>${control}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</label>`;
}

function imageField(path, label, hint = '') {
  const value = String(getPath(portfolio, path) || '');
  const preview = value ? publicAsset(value) : '';
  return `<div class="field"><span class="field-label">${escapeHtml(label)}</span><div class="image-control"><div><input type="text" data-path="${escapeHtml(path)}" data-original-asset="${escapeHtml(value)}" value="${escapeHtml(value)}" placeholder="Path atau URL gambar"><div class="media-field-actions"><button class="button button-quiet button-small" type="button" data-media-target="path" data-media-path="${escapeHtml(path)}">Pilih dari website</button><label class="button button-quiet button-small media-upload-button">Upload baru<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload-path="${escapeHtml(path)}" aria-label="Unggah ${escapeHtml(label)}"></label></div></div><img class="image-preview" src="${escapeHtml(preview)}" alt="Pratinjau ${escapeHtml(label)}" ${preview ? '' : 'hidden'}></div>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</div>`;
}

function renderSiteEditor() {
  const groups = [
    { title: 'Identitas dan metadata', fields: [
      ['site.title', 'Judul website / tab browser'], ['site.description', 'Deskripsi website', 'textarea'], ['site.language', 'Kode bahasa website (contoh: en atau id)'],
      ['site.brandName', 'Nama brand'], ['site.brandMonogram', 'Monogram logo'],
      ['site.meta.openGraphImage', 'Gambar pratinjau tautan', 'image'], ['site.meta.favicon', 'File favicon', 'image']
    ] },
    { title: 'Navigasi dan footer', fields: [
      ['site.navigation.home', 'Label Beranda'], ['site.about.navLabel', 'Label About'], ['site.navigation.contact', 'Label tombol kontak'],
      ['site.navigation.footerTop', 'Tautan kembali ke atas'], ['site.navigation.viewerHelp', 'Petunjuk galeri layar penuh'],
      ['site.footerRole', 'Peran pada footer'], ['site.copyright', 'Teks hak cipta']
    ] },
    { title: 'Beranda · Hero', fields: [
      ['site.home.heroIndex', 'Label kecil di atas hero'], ['site.home.heroKicker', 'Label profesi'], ['site.home.heroTitle', 'Judul hero'],
      ['site.home.heroEmphasis', 'Judul hero miring'], ['site.home.heroIntro', 'Kalimat pembuka', 'textarea'],
      ['site.home.heroImageAlt', 'Deskripsi gambar hero (alt)'], ['site.home.heroSideNote', 'Catatan sisi hero'],
      ['site.home.heroPrimaryCta', 'Tombol utama hero'], ['site.home.heroSecondaryCta', 'Tombol kedua hero'], ['site.home.heroScrollLabel', 'Teks petunjuk scroll']
    ] },
    { title: 'Beranda · Karya pilihan dan disiplin', fields: [
      ['site.home.spotlightEyebrow', 'Label bagian karya pilihan'], ['site.home.spotlightTitle', 'Judul karya pilihan'],
      ['site.home.spotlightEmphasis', 'Judul miring karya pilihan'], ['site.home.spotlightDescription', 'Pengantar karya pilihan', 'textarea'],
      ['site.home.spotlightLink', 'Teks tautan project'], ['site.home.personalLink', 'Teks tautan koleksi personal'],
      ['site.home.featuredTopLeft', 'Label atas carousel disiplin'], ['site.home.featuredTopRight', 'Teks sisi kanan carousel']
    ] },
    { title: 'Beranda · Gambar dan project utama', fields: [
      ['site.home.heroImage', 'Gambar hero', 'image'], ['site.home.spotlightProjectId', 'Project 2D Game Art yang tampil pertama', 'project-select']
    ] },
    { title: 'Tentang saya dan kontak', fields: [
      ['site.about.eyebrow', 'Label halaman About'], ['site.about.titleLine', 'Judul About'], ['site.about.titleEmphasis', 'Judul About miring'],
      ['site.about.imageAlt', 'Deskripsi foto profil (alt)'], ['site.about.lead', 'Pengantar About'],
      ['site.about.paragraphOne', 'Paragraf pertama', 'textarea'], ['site.about.paragraphTwo', 'Paragraf kedua', 'textarea'],
      ['site.about.skillsTitle', 'Judul keahlian'], ['site.about.skills', 'Daftar keahlian · satu per baris', 'lines'],
      ['site.about.contactEyebrow', 'Label kontak'], ['site.about.contactTitle', 'Judul kontak'],
      ['site.about.contactEmphasis', 'Judul kontak miring'], ['site.about.image', 'Foto profil', 'image']
    ] },
    { title: 'Label antarmuka website', fields: Object.entries(portfolio.site.labels).map(([key]) => [`site.labels.${key}`, key.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase())]) }
  ];
  const groupMarkup = groups.map(group => `<section class="settings-group"><div class="group-heading"><div><h2>${escapeHtml(group.title)}</h2></div></div><div class="field-grid">${group.fields.map(([path, label, type = 'text']) => {
    if (type === 'image') return imageField(path, label);
    if (type === 'project-select') return projectSelectField(path, label);
    return field(path, label, type);
  }).join('')}</div></section>`).join('');
  return `${renderAppearanceEditor()}${groupMarkup}${renderContactsEditor()}`;
}

function renderContactsEditor() {
  const contacts = portfolio.site.about.contacts || [];
  return `<section class="settings-group"><div class="group-heading"><div><h2>Tautan kontak dan sosial</h2><p>Tambahkan, ubah, atau hapus email, telepon, dan tautan sosial yang tampil di halaman About.</p></div><button class="button button-primary button-small" type="button" data-action="add-contact">+ Tambah tautan</button></div><div class="gallery-list">${contacts.map((contact, index) => `<div class="category-card"><div class="category-fields"><div class="field-grid"><label class="field"><span class="field-label">Label tautan</span><input value="${escapeHtml(contact.label)}" data-contact-index="${index}" data-contact-field="label"></label><label class="field"><span class="field-label">Teks yang ditampilkan</span><input value="${escapeHtml(contact.value)}" data-contact-index="${index}" data-contact-field="value"></label><label class="field field-wide"><span class="field-label">Alamat tautan</span><input value="${escapeHtml(contact.href)}" data-contact-index="${index}" data-contact-field="href"></label><label class="check-field"><input type="checkbox" data-contact-index="${index}" data-contact-field="newWindow" ${contact.newWindow ? 'checked' : ''}> Buka di tab baru</label><button class="button button-danger button-small" type="button" data-action="remove-contact" data-index="${index}">Hapus tautan</button></div></div></div>`).join('') || '<div class="empty-card">Belum ada tautan kontak.</div>'}</div></section>`;
}

function projectSelectField(path, label) {
  const value = getPath(portfolio, path) || '';
  const featuredGameArt = path === 'site.home.spotlightProjectId';
  const projects = portfolio.projects.filter(project => project.published !== false && (!featuredGameArt || project.category === 'game-art'));
  const options = projects.map(project => `<option value="${escapeHtml(project.id)}" ${project.id === value ? 'selected' : ''}>${escapeHtml(project.title)}</option>`).join('');
  const placeholder = featuredGameArt ? 'Pilih project 2D Game Art' : 'Pilih project';
  const note = featuredGameArt ? 'Project ini mendapat urutan pertama di bagian karya pilihan Home.' : 'Pilih project yang ditampilkan di beranda.';
  return `<label class="field"><span class="field-label">${escapeHtml(label)}</span><select data-path="${escapeHtml(path)}"><option value="">${placeholder}</option>${options}</select><small>${note}</small></label>`;
}

const categoryTextFields = [
  ['name', 'Nama kategori'], ['slug', 'Alamat kategori / hash'], ['navLabel', 'Label navigasi'],
  ['featuredLabel', 'Label carousel'], ['featuredKicker', 'Teks kecil carousel'], ['featuredTitle', 'Judul carousel'],
  ['featuredEmphasis', 'Judul miring carousel'], ['featuredDescription', 'Deskripsi carousel', 'textarea'], ['featuredCta', 'Tombol carousel'],
  ['pageEyebrow', 'Label halaman kategori'], ['pageTitle', 'Judul halaman'], ['pageEmphasis', 'Judul miring halaman'],
  ['pageDescription', 'Deskripsi halaman', 'textarea'], ['collectionLabel', 'Label koleksi'], ['filterLabel', 'Label filter'],
  ['secondaryFilterLabel', 'Label filter kedua']
];

function renderCategoriesEditor() {
  const cards = portfolio.categories.map((category, index) => `<article class="category-card"><div class="category-titlebar"><div><strong>${escapeHtml(category.name || 'Kategori baru')}</strong><small>ID internal: ${escapeHtml(category.id)}</small></div><div class="project-actions"><button class="icon-button" type="button" data-action="move-category" data-index="${index}" data-direction="-1" aria-label="Naikkan urutan kategori" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-action="move-category" data-index="${index}" data-direction="1" aria-label="Turunkan urutan kategori" ${index === portfolio.categories.length - 1 ? 'disabled' : ''}>↓</button><button class="button button-danger button-small" type="button" data-action="delete-category" data-index="${index}">Hapus kategori</button></div></div><div class="category-fields"><div class="category-grid">${categoryTextFields.map(([key, label, type = 'text']) => fieldForCategory(index, key, label, type)).join('')}<label class="field"><span class="field-label">Tata letak halaman</span><select data-category-index="${index}" data-category-field="layout"><option value="artwork-rail" ${category.layout === 'artwork-rail' ? 'selected' : ''}>Galeri gambar horizontal</option><option value="project-list" ${category.layout === 'project-list' ? 'selected' : ''}>Daftar proyek</option></select><small>Kategori baru dapat memakai salah satu tata letak ini.</small></label></div></div></article>`).join('');
  return `<div class="section-heading"><div><h2>Kategori website</h2><p>Nama, teks carousel, deskripsi, tautan, dan label navigasi setiap kategori dapat diubah di sini.</p></div><button class="button button-primary" type="button" data-action="add-category">+ Tambah kategori</button></div>${cards || '<div class="empty-card"><strong>Belum ada kategori</strong>Tambahkan kategori untuk mengelompokkan proyek.</div>'}${renderPersonalArtworkTypeOrder()}`;
}

function personalArtworkTypes() {
  const category = portfolio.categories.find(item => item.id === 'personal');
  if (!category) return [];
  const counts = new Map();
  portfolio.projects.filter(project => project.category === category.id).forEach(project => {
    (project.gallery || []).forEach(image => {
      const label = String(image.type || '').trim() || 'Belum dikategorikan';
      const key = label.toLocaleLowerCase();
      counts.set(key, { label, count: (counts.get(key)?.count || 0) + 1 });
    });
  });
  const savedOrder = Array.isArray(category.artworkTypeOrder) ? category.artworkTypeOrder : [];
  const ordered = savedOrder.map(label => counts.get(String(label).toLocaleLowerCase())).filter(Boolean);
  const known = new Set(ordered.map(item => item.label.toLocaleLowerCase()));
  const additions = [...counts.values()].filter(item => !known.has(item.label.toLocaleLowerCase())).sort((a, b) => a.label.localeCompare(b.label));
  return [...ordered, ...additions];
}

function renderPersonalArtworkTypeOrder() {
  const category = portfolio.categories.find(item => item.id === 'personal');
  if (!category) return '';
  const types = personalArtworkTypes();
  const rows = types.map((type, index) => `<div class="artwork-type-order-row"><span class="artwork-type-order-number">${String(index + 1).padStart(2, '0')}</span><div class="artwork-type-order-copy"><strong>${escapeHtml(type.label)}</strong><small>${type.count} karya</small></div><div class="artwork-type-order-controls"><button class="icon-button" type="button" data-action="move-artwork-type" data-category-id="${escapeHtml(category.id)}" data-index="${index}" data-direction="-1" aria-label="Naikkan ${escapeHtml(type.label)}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-action="move-artwork-type" data-category-id="${escapeHtml(category.id)}" data-index="${index}" data-direction="1" aria-label="Turunkan ${escapeHtml(type.label)}" ${index === types.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('');
  return `<section class="settings-group artwork-type-order-editor"><div class="group-heading"><div><h2>Urutan jenis karya · Personal Artwork</h2><p>Gunakan panah untuk mengatur urutan section pada Grid View dan urutan filter jenis karya. Jenis baru akan ditambahkan setelah jenis yang sudah diurutkan.</p></div></div><div class="artwork-type-order-list">${rows || '<div class="empty-card">Belum ada jenis karya. Isi kolom Jenis karya pada gambar di Proyek & galeri terlebih dahulu.</div>'}</div></section>`;
}

function fieldForCategory(index, key, label, type) {
  const value = portfolio.categories[index][key] ?? '';
  const control = type === 'textarea' ? `<textarea data-category-index="${index}" data-category-field="${escapeHtml(key)}">${escapeHtml(value)}</textarea>` : `<input type="text" data-category-index="${index}" data-category-field="${escapeHtml(key)}" value="${escapeHtml(value)}">`;
  return `<label class="field"><span class="field-label">${escapeHtml(label)}</span>${control}</label>`;
}

function renderProjectsEditor() {
  if (!portfolio.projects.length) return `<div class="empty-card"><strong>Belum ada proyek</strong>Tambahkan proyek dan mulai susun galeri portofolio.</div><button class="button button-primary" data-action="add-project" type="button">+ Tambah proyek</button>`;
  const project = portfolio.projects.includes(selectedProjectRef) ? selectedProjectRef : portfolio.projects.find(item => item.id === selectedProjectId) || portfolio.projects[0];
  selectedProjectRef = project; selectedProjectId = project.id;
  const orderedProjects = [...portfolio.projects].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const list = orderedProjects.map((item, index) => `<div class="project-order-row"><button class="project-select ${item === project ? 'is-active' : ''}" type="button" data-action="select-project" data-project-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title || 'Proyek baru')}</strong><small>${escapeHtml(portfolio.categories.find(category => category.id === item.category)?.name || 'Tanpa kategori')} · ${(item.gallery || []).length} gambar${item.published === false ? ' · Draft' : ''}</small></button><div class="project-order-controls"><span>${String(index + 1).padStart(2, '0')}</span><button class="icon-button" type="button" data-action="move-project-order" data-project-id="${escapeHtml(item.id)}" data-direction="-1" aria-label="Naikkan urutan ${escapeHtml(item.title)}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-action="move-project-order" data-project-id="${escapeHtml(item.id)}" data-direction="1" aria-label="Turunkan urutan ${escapeHtml(item.title)}" ${index === orderedProjects.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('');
  return `<div class="project-workspace"><aside class="project-list-panel"><div class="project-list-heading"><span>URUTAN SEMUA PROYEK</span><button class="button button-primary button-small" type="button" data-action="add-project">+ Baru</button></div><small class="project-order-hint">Panah mengatur urutan proyek di halaman kategorinya.</small><div class="project-list">${list}</div></aside>${renderProjectForm(project)}</div>`;
}

function adminYouTubeId(value = '') {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) return '';
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    const id = url.pathname === '/watch' ? url.searchParams.get('v') || '' : match?.[1] || '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}

function adminVimeoEmbedUrl(value = '') {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || !['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    let idIndex = -1;
    parts.forEach((part, index) => { if (/^\d{5,}$/.test(part) && (host !== 'player.vimeo.com' || parts[index - 1] === 'video')) idIndex = index; });
    if (idIndex < 0) return '';
    const id = parts[idIndex];
    const pathHash = parts[idIndex + 1] && /^[A-Za-z0-9_-]+$/.test(parts[idIndex + 1]) ? parts[idIndex + 1] : '';
    const hash = url.searchParams.get('h') || pathHash;
    return `https://player.vimeo.com/video/${id}${hash ? `?h=${encodeURIComponent(hash)}` : ''}`;
  } catch { return ''; }
}

function adminDirectVideoUrl(value = '') {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && /\.(?:mp4|webm)$/i.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}

function renderAdminVideoPreview(section) {
  const source = section.videoSource || 'local';
  if (source === 'youtube') {
    const id = adminYouTubeId(section.videoUrl);
    return id ? `<iframe class="story-video-preview" src="https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1" title="Pratinjau video YouTube" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : '<small>Masukkan tautan YouTube yang valid untuk melihat pratinjau.</small>';
  }
  if (source === 'vimeo') {
    const embedUrl = adminVimeoEmbedUrl(section.videoUrl);
    return embedUrl ? `<iframe class="story-video-preview" src="${escapeHtml(embedUrl)}" title="Pratinjau video Vimeo" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : '<small>Masukkan tautan Vimeo yang bisa disematkan.</small>';
  }
  if (source === 'direct') {
    const url = adminDirectVideoUrl(section.videoUrl);
    return url ? `<video class="story-video-preview" controls playsinline preload="metadata" src="${escapeHtml(url)}"></video>` : '<small>Masukkan tautan langsung HTTPS yang berakhir .mp4 atau .webm.</small>';
  }
  return section.video ? `<video class="story-video-preview" controls playsinline preload="metadata" src="${escapeHtml(publicAsset(section.video))}"></video>` : '<small>Preview video lokal akan muncul setelah berkas dipilih.</small>';
}

function renderProjectForm(project) {
  if (!project) return '<div class="empty-card">Pilih proyek untuk mengeditnya.</div>';
  const categoryOptions = portfolio.categories.map(category => `<option value="${escapeHtml(category.id)}" ${category.id === project.category ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('');
  const detail = project.detail ||= { narrativeTitle: '', narrative: '', sections: [] };
  const gallery = project.gallery ||= [];
  const galleryMarkup = gallery.map((image, index) => `<div class="gallery-item"><img src="${escapeHtml(publicAsset(image.image))}" alt="Pratinjau" loading="lazy"><input type="text" class="gallery-path" value="${escapeHtml(image.image)}" data-original-image="${escapeHtml(image.image)}" data-gallery-index="${index}" data-gallery-field="image" aria-label="Path gambar ${index + 1}"><input type="text" value="${escapeHtml(image.caption)}" data-gallery-index="${index}" data-gallery-field="caption" aria-label="Caption gambar ${index + 1}" placeholder="Caption / judul karya"><input type="text" value="${escapeHtml(image.type || '')}" data-gallery-index="${index}" data-gallery-field="type" aria-label="Jenis karya gambar ${index + 1}" placeholder="Jenis karya" list="artworkTypeSuggestions-${index}"><datalist id="artworkTypeSuggestions-${index}">${ARTWORK_TYPE_SUGGESTIONS.map(type => `<option value="${escapeHtml(type)}"></option>`).join('')}</datalist><div class="gallery-controls"><button class="icon-button" type="button" data-action="move-gallery" data-index="${index}" data-direction="-1" aria-label="Naikkan urutan" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-action="move-gallery" data-index="${index}" data-direction="1" aria-label="Turunkan urutan" ${index === gallery.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-button" type="button" data-action="remove-gallery" data-index="${index}" aria-label="Hapus gambar dari galeri">×</button></div></div>`).join('');
  const sectionsMarkup = (detail.sections || []).map((section, sectionIndex) => {
    const layouts = [
      ['wide', 'Gambar lebar'], ['asset-strip', 'Deretan aset (geser)'], ['asset-grid', 'Grid · tampilkan semua'],
      ['paired', 'Gambar berpasangan'], ['sequence', 'Urutan cerita'], ['gameplay', 'Gameplay · video']
    ];
    const videoSource = section.videoSource || 'local';
    const videoPreview = renderAdminVideoPreview(section);
    const videoSourceSelect = `<label class="field"><span class="field-label">Sumber video</span><select data-story-index="${sectionIndex}" data-story-field="videoSource"><option value="local" ${videoSource === 'local' ? 'selected' : ''}>Upload dari perangkat</option><option value="youtube" ${videoSource === 'youtube' ? 'selected' : ''}>Tautan YouTube</option><option value="vimeo" ${videoSource === 'vimeo' ? 'selected' : ''}>Tautan Vimeo</option><option value="direct" ${videoSource === 'direct' ? 'selected' : ''}>Tautan MP4/WebM langsung</option></select></label>`;
    const videoSourceInput = videoSource === 'local'
      ? `<label class="field"><span class="field-label">Berkas video · MP4 atau WebM</span><input type="text" value="${escapeHtml(section.video || '')}" placeholder="assets/nama-video.mp4" data-original-video="${escapeHtml(section.video || '')}" data-story-index="${sectionIndex}" data-story-field="video"><input type="file" accept="video/mp4,video/webm,.mp4,.webm" data-upload-story-video="${sectionIndex}"><small>Upload otomatis mengatur tata letak ke Gameplay. Video disimpan dalam format asli; maksimum 40 MB.</small></label>`
      : `<label class="field"><span class="field-label">${videoSource === 'youtube' ? 'Tautan video YouTube' : videoSource === 'vimeo' ? 'Tautan video Vimeo' : 'Tautan langsung MP4/WebM'}</span><input type="url" value="${escapeHtml(section.videoUrl || '')}" placeholder="${videoSource === 'youtube' ? 'https://youtu.be/xxxxxxxxxxx' : videoSource === 'vimeo' ? 'https://vimeo.com/123456789' : 'https://domain.com/video.mp4'}" data-story-index="${sectionIndex}" data-story-field="videoUrl"><small>${videoSource === 'youtube' ? 'Tempel tautan tonton atau berbagi YouTube. Video harus mengizinkan pemutaran embed.' : videoSource === 'vimeo' ? 'Tempel tautan Vimeo. Pastikan video diizinkan untuk disematkan.' : 'Gunakan URL HTTPS publik yang berakhir .mp4 atau .webm.'}</small></label>`;
    const videoControls = `<div class="story-video-field">${videoSourceSelect}${videoSourceInput}${videoPreview}</div>`;
    return `<article class="story-item">
      <div class="story-item-top"><strong>SEKSI CERITA ${String(sectionIndex + 1).padStart(2, '0')}</strong><div class="project-actions"><button class="icon-button" type="button" data-action="move-story" data-index="${sectionIndex}" data-direction="-1" aria-label="Naikkan urutan seksi" ${sectionIndex === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-action="move-story" data-index="${sectionIndex}" data-direction="1" aria-label="Turunkan urutan seksi" ${sectionIndex === detail.sections.length - 1 ? 'disabled' : ''}>↓</button><button class="button button-danger button-small" type="button" data-action="remove-story" data-index="${sectionIndex}">Hapus seksi</button></div></div>
      <div class="story-fields"><label class="field"><span class="field-label">Judul seksi</span><input value="${escapeHtml(section.title)}" data-story-index="${sectionIndex}" data-story-field="title"></label><label class="field"><span class="field-label">Subjudul seksi</span><input value="${escapeHtml(section.subtitle)}" data-story-index="${sectionIndex}" data-story-field="subtitle"></label><label class="field"><span class="field-label">Tata letak</span><select data-story-index="${sectionIndex}" data-story-field="layout">${layouts.map(([value, label]) => `<option value="${value}" ${section.layout === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-story-index="${sectionIndex}" data-story-field="beforeNarrative" ${section.beforeNarrative ? 'checked' : ''}> Tampilkan sebelum narasi Visual contributions</label>${videoControls}</div>
      <small class="story-images-help">Centang aset galeri yang ingin ditampilkan di seksi ini. Unggah GIF melalui Galeri gambar terlebih dahulu.</small>
      <div class="story-images">${gallery.map((image, imageIndex) => `<label class="image-choice"><input type="checkbox" data-story-images="${sectionIndex}" value="${imageIndex}" ${section.images?.includes(imageIndex) ? 'checked' : ''}><span>${String(imageIndex + 1).padStart(2, '0')} · ${escapeHtml(image.caption || image.image)}${image.type ? ` · ${escapeHtml(image.type)}` : ''}</span></label>`).join('') || '<small>Tambahkan gambar ke galeri untuk memilihnya.</small>'}</div>
    </article>`;
  }).join('');
  return `<section class="project-editor"><div class="project-titlebar"><div><span class="eyebrow">EDIT PROYEK</span><h2>${escapeHtml(project.title || 'Proyek baru')}</h2></div><div class="project-actions"><button class="button button-danger button-small" type="button" data-action="delete-project">Hapus proyek</button></div></div><div class="field-grid"><label class="field"><span class="field-label">ID proyek / URL detail</span><input type="text" value="${escapeHtml(project.id)}" data-project-field="id" ${project._new ? '' : 'readonly'} pattern="[a-z0-9-]+" required><small>Gunakan huruf kecil, angka, dan tanda hubung.</small></label><label class="field"><span class="field-label">Kategori</span><select data-project-field="category">${categoryOptions}</select></label><label class="field"><span class="field-label">Judul proyek</span><input value="${escapeHtml(project.title)}" data-project-field="title" required></label><label class="field"><span class="field-label">Judul singkat</span><input value="${escapeHtml(project.shortTitle)}" data-project-field="shortTitle"></label><label class="field"><span class="field-label">Tahun</span><input value="${escapeHtml(project.year)}" data-project-field="year"></label><label class="field"><span class="field-label">Peran</span><input value="${escapeHtml(project.role)}" data-project-field="role"></label><label class="field"><span class="field-label">Kontribusi</span><input value="${escapeHtml(project.contribution)}" data-project-field="contribution"></label><label class="field"><span class="field-label">Subjudul</span><input value="${escapeHtml(project.subtitle)}" data-project-field="subtitle"></label><label class="field field-wide"><span class="field-label">Deskripsi</span><textarea data-project-field="description">${escapeHtml(project.description)}</textarea></label><label class="field"><span class="field-label">Gambar cover · path atau URL</span><input value="${escapeHtml(project.cover)}" data-original-cover="${escapeHtml(project.cover)}" data-project-field="cover"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload-project-cover="true"></label><label class="field"><span class="field-label">Urutan tampil</span><input type="number" min="0" step="1" value="${Number(project.sortOrder || 0)}" data-project-field="sortOrder"></label><label class="check-field"><input type="checkbox" data-project-field="published" ${project.published !== false ? 'checked' : ''}> Tampilkan di website publik</label></div><section class="subsection"><div class="subsection-heading"><div><h3>Gambar sampul</h3><p>Upload gambar biasa akan dioptimalkan ke WebP; GIF tetap bergerak.</p></div></div>${imageFieldForProjectCover(project)}</section><section class="subsection"><div class="subsection-heading"><div><h3>Galeri gambar (${gallery.length})</h3><p>JPG, PNG, WebP, dan GIF dapat diunggah. GIF disimpan tanpa diubah agar animasinya tetap aktif. Video ditambahkan pada seksi gameplay.</p></div><label class="button button-quiet button-small">+ Unggah gambar<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload-gallery multiple hidden></label></div><div class="gallery-list">${galleryMarkup || '<div class="empty-card">Belum ada gambar di galeri.</div>'}</div></section><section class="subsection"><div class="subsection-heading"><div><h3>Halaman detail proyek</h3><p>Atur narasi, video gameplay, serta kelompok gambar pada studi kasus ini.</p></div></div><div class="field-grid"><label class="field"><span class="field-label">Judul narasi</span><input value="${escapeHtml(detail.narrativeTitle)}" data-project-path="detail.narrativeTitle"></label><label class="field field-wide"><span class="field-label">Narasi</span><textarea data-project-path="detail.narrative">${escapeHtml(detail.narrative)}</textarea></label></div><div class="subsection"><div class="subsection-heading"><h3>Seksi cerita dan susunan medianya</h3><button class="button button-quiet button-small" type="button" data-action="add-story">+ Tambah seksi</button></div><div class="story-list">${sectionsMarkup || '<div class="empty-card">Belum ada seksi cerita. Tambahkan seksi untuk menampilkan gambar atau video pada halaman detail.</div>'}</div></div></section>`;
}
function imageFieldForProjectCover(project) {
  const value = project.cover || '';
  return `<div class="image-control"><div><small>Gambar cover yang terpilih: <span data-project-cover-label>${escapeHtml(value || 'belum ada')}</span></small></div><img class="image-preview" data-project-cover-preview src="${escapeHtml(publicAsset(value))}" alt="Pratinjau cover" ${value ? '' : 'hidden'}></div>`;
}

function publicAsset(value = '') {
  if (!value) return '';
  if (localPreviewAssets.has(value)) return localPreviewAssets.get(value);
  if (/^(https?:|data:|blob:|\/|\.\/)/i.test(value)) return value;
  if (value.startsWith('assets/')) return value;
  if (/\.[a-z0-9]{2,5}$/i.test(value)) return value;
  return `assets/${value}.webp`;
}

function sendSitePreview() {
  if (!portfolio) return;
  const frame = $('#portfolioPreview');
  if (!frame?.dataset.ready || !frame.contentWindow) return;
  const content = JSON.parse(JSON.stringify(portfolio, (key, value) => key === '_new' ? undefined : value));
  frame.contentWindow.postMessage({
    type: 'portfolio-admin-preview',
    content,
    assets: Object.fromEntries(localPreviewAssets)
  }, location.origin);
}

function scheduleSitePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(sendSitePreview, 120);
}

function openSitePreview() {
  const overlay = $('#previewOverlay');
  const frame = $('#portfolioPreview');
  overlay.hidden = false;
  document.body.classList.add('preview-open');
  if (!frame.getAttribute('src')) frame.src = new URL('index.html?adminPreview=1#home', location.href).href;
  else scheduleSitePreview();
  $('#closePreviewButton').focus();
}

function closeSitePreview() {
  $('#previewOverlay').hidden = true;
  document.body.classList.remove('preview-open');
  $('#previewButton').focus();
}

function renderEditor() {
  $$('.editor-tab').forEach(button => button.classList.toggle('is-active', button.dataset.tab === activeTab));
  editorContent.innerHTML = activeTab === 'site' ? renderSiteEditor() : activeTab === 'categories' ? renderCategoriesEditor() : renderProjectsEditor();
  enhanceMediaFields();
  updateAppearancePreview();
  scheduleSitePreview();
}

async function connect(token) {
  githubToken = token;
  mediaLibraryFiles = [];
  mediaLibraryError = '';
  const response = await githubRequest(`/contents/${apiPath(CONTENT_PATH)}?ref=${encodeURIComponent(BRANCH)}`);
  const parsed = JSON.parse(decodeBase64Utf8(response.content));
  if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.projects) || !parsed.site) throw new Error('Struktur portfolio-content.json belum sesuai.');
  normalizeAppearance(parsed.site);
  normalizeSiteLabels(parsed.site);
  portfolio = parsed;
  pendingUploads = [];
  pendingDeletes = new Set();
  selectedProjectId = portfolio.projects[0]?.id || '';
  selectedProjectRef = portfolio.projects[0] || null;
  try { await loadMediaLibrary(); }
  catch (error) { mediaLibraryError = error.message; }
}

async function loadMediaLibrary() {
  mediaLibraryError = '';
  const ref = await githubRequest(`/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const commit = await githubRequest(`/git/commits/${ref.object.sha}`);
  const tree = await githubRequest(`/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new Error('Repositori terlalu besar untuk dipindai sekaligus. Anda masih bisa mengunggah file baru.');
  mediaLibraryFiles = tree.tree
    .filter(entry => entry.type === 'blob' && MEDIA_IMAGE_PATTERN.test(entry.path))
    .map(entry => ({ path: entry.path, name: entry.path.split('/').pop() }));
}

function mediaPathFromValue(value) {
  const source = String(value || '').trim();
  if (!source || /^(https?:|data:|blob:|\/\/)/i.test(source)) return '';
  if (source.startsWith('/assets/')) return source.slice(1);
  if (source.startsWith('./')) return source.slice(2);
  if (source.startsWith('assets/') || MEDIA_IMAGE_PATTERN.test(source)) return source;
  if (!source.includes('/') && !source.includes('.')) return `assets/${source}.webp`;
  return '';
}

function availableMediaFiles() {
  const files = new Map(mediaLibraryFiles.map(file => [file.path, file]));
  const referenced = [portfolio.site.home.heroImage, portfolio.site.about.image, portfolio.site.meta.openGraphImage, portfolio.site.meta.favicon];
  Object.values(portfolio.site.appearance?.backgrounds || {}).forEach(config => referenced.push(config?.image));
  portfolio.projects.forEach(project => {
    referenced.push(project.cover);
    (project.gallery || []).forEach(image => referenced.push(image.image));
  });
  referenced.map(mediaPathFromValue).filter(Boolean).forEach(path => {
    if (!files.has(path)) files.set(path, { path, name: path.split('/').pop() });
  });
  pendingUploads.filter(upload => MEDIA_IMAGE_PATTERN.test(upload.path)).forEach(upload => {
    if (!files.has(upload.path)) files.set(upload.path, { path: upload.path, name: upload.path.split('/').pop() });
  });
  return [...files.values()].filter(file => !pendingDeletes.has(file.path)).sort((a, b) => a.path.localeCompare(b.path));
}

function enhanceMediaFields() {
  const makeButton = (label, target, extra = {}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-quiet button-small media-pick-button';
    button.textContent = label;
    button.dataset.mediaTarget = target;
    Object.entries(extra).forEach(([key, value]) => { button.dataset[key] = String(value); });
    return button;
  };
  const coverInput = $('[data-project-field="cover"]', editorContent);
  if (coverInput && !coverInput.closest('.media-field-actions')) {
    const field = coverInput.closest('.field');
    const fileInput = $('[data-upload-project-cover]', field);
    const actions = document.createElement('div');
    actions.className = 'media-field-actions';
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'button button-quiet button-small media-upload-button';
    uploadLabel.append('Upload baru');
    if (fileInput) uploadLabel.append(fileInput);
    coverInput.before(actions);
    actions.append(coverInput, makeButton('Pilih dari website', 'cover'), uploadLabel);
  }
  $$('[data-gallery-field="image"]', editorContent).forEach(input => {
    if (input.closest('.gallery-image-path')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'gallery-image-path';
    input.before(wrapper);
    wrapper.append(input, makeButton('Pilih', 'gallery-image', { index: input.dataset.galleryIndex }));
  });
  const uploadInput = $('[data-upload-gallery]', editorContent);
  const heading = uploadInput?.closest('.subsection-heading');
  if (heading && !heading.querySelector('[data-media-target="gallery-add"]')) {
    heading.classList.add('gallery-actions-heading');
    heading.insertBefore(makeButton('+ Pilih dari website', 'gallery-add'), uploadInput.closest('label'));
  }
}

function renderMediaPicker() {
  const query = ($('#mediaPickerSearch')?.value || '').trim().toLocaleLowerCase();
  const files = availableMediaFiles().filter(file => `${file.name} ${file.path}`.toLocaleLowerCase().includes(query));
  const statusLine = $('#mediaPickerStatus');
  const grid = $('#mediaPickerGrid');
  if (mediaLibraryError) {
    statusLine.innerHTML = `Daftar repositori belum dapat dimuat: ${escapeHtml(mediaLibraryError)} <button class="button button-quiet button-small" type="button" data-media-reload>Muat ulang</button>`;
  } else {
    statusLine.textContent = `${files.length} gambar tersedia${pendingUploads.some(upload => MEDIA_IMAGE_PATTERN.test(upload.path)) ? ' · file yang baru diunggah juga muncul di sini' : ''}.`;
  }
  grid.innerHTML = files.map(file => {
    const isPending = pendingUploads.some(upload => upload.path === file.path);
    return `<button class="media-choice-card" type="button" data-media-choice="${escapeHtml(file.path)}"><span class="media-choice-image"><img src="${escapeHtml(publicAsset(file.path))}" alt="" loading="lazy"></span><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${isPending ? 'Belum diterbitkan' : escapeHtml(file.path)}</small></button>`;
  }).join('') || `<div class="media-picker-empty">${query ? 'Tidak ada file yang cocok dengan pencarian.' : 'Belum ada gambar di repositori. Anda tetap dapat mengunggah file baru.'}</div>`;
}

function openMediaPicker(target) {
  mediaPickerTarget = target;
  const modal = $('#mediaPicker');
  $('#mediaPickerSearch').value = '';
  renderMediaPicker();
  modal.hidden = false;
  document.body.classList.add('media-picker-open');
  $('#mediaPickerSearch').focus();
}

function closeMediaPicker() {
  $('#mediaPicker').hidden = true;
  document.body.classList.remove('media-picker-open');
  mediaPickerTarget = null;
}

function applyMediaSelection(path) {
  const target = mediaPickerTarget;
  const project = getCurrentProject();
  if (!target || !portfolio) return;
  if (target.type === 'path') {
    const oldValue = getPath(portfolio, target.path);
    setPath(portfolio, target.path, path);
    queueUnusedAsset(oldValue);
  } else if (target.type === 'cover' && project) {
    const oldValue = project.cover;
    project.cover = path;
    queueUnusedAsset(oldValue);
  } else if (target.type === 'gallery-image' && project) {
    const image = project.gallery[Number(target.index)];
    if (!image) return;
    const oldValue = image.image;
    image.image = path;
    queueUnusedAsset(oldValue);
  } else if (target.type === 'gallery-add' && project) {
    const filename = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    project.gallery.push({ image: path, caption: filename, type: '' });
  }
  closeMediaPicker();
  renderEditor();
  scheduleSitePreview();
  status($('#saveStatus'), 'Gambar dipilih. Terbitkan perubahan untuk menampilkannya di website.', 'success');
}

function getCurrentProject() {
  return portfolio.projects.includes(selectedProjectRef) ? selectedProjectRef : portfolio.projects.find(project => project.id === selectedProjectId) || null;
}

function repositoryAssetPath(value) {
  if (typeof value !== 'string' || !value) return '';
  if (/^(https?:|data:|blob:|\/|\.\/)/i.test(value)) return '';
  if (value.startsWith('assets/')) return value;
  if (value.includes('/') || value.includes('.')) return '';
  return `assets/${value}.webp`;
}

function isAssetReferenced(path) {
  const matches = value => repositoryAssetPath(value) === path;
  const siteImages = [portfolio.site.home.heroImage, portfolio.site.about.image, portfolio.site.meta.openGraphImage, portfolio.site.meta.favicon];
  Object.values(portfolio.site.appearance?.backgrounds || {}).forEach(config => siteImages.push(config?.image));
  if (siteImages.some(matches)) return true;
  return portfolio.projects.some(project => matches(project.cover) || project.gallery.some(image => matches(image.image)) || (project.detail?.sections || []).some(section => matches(section.video)));
}

function queueUnusedAsset(path) {
  const repoPath = repositoryAssetPath(path);
  if (!repoPath || isAssetReferenced(repoPath)) return;
  const previewUrl = localPreviewAssets.get(repoPath);
  if (previewUrl) { URL.revokeObjectURL(previewUrl); localPreviewAssets.delete(repoPath); }
  const pending = pendingUploads.findIndex(upload => upload.path === repoPath);
  if (pending >= 0) pendingUploads.splice(pending, 1);
  else pendingDeletes.add(repoPath);
}

function updateFromInput(target, eventType = 'change') {
  if (target.dataset.path) {
    const path = target.dataset.path;
    const oldValue = getPath(portfolio, path);
    const value = target.dataset.lines === 'true' ? target.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : target.type === 'range' ? Number(target.value) : target.value;
    setPath(portfolio, path, value);
    if (target.type === 'range') {
      const output = $$('[data-range-output]', editorContent).find(item => item.dataset.rangeOutput === path);
      if (output) output.textContent = `${value}${target.dataset.unit || 'px'}`;
    }
    if (path.startsWith('site.appearance.') || ['site.home.heroImage', 'site.home.heroTitle', 'site.home.heroEmphasis'].includes(path)) updateAppearancePreview();
    if (target.closest('.image-control') && eventType === 'change') {
      const originalValue = target.dataset.originalAsset || oldValue;
      if (originalValue !== value) queueUnusedAsset(originalValue);
      target.dataset.originalAsset = value;
    }
    if (target.type === 'text' && target.closest('.image-control')) {
      const preview = $('.image-preview', target.closest('.image-control'));
      if (preview) { preview.src = publicAsset(value); preview.hidden = !value; }
    }
    return;
  }
  if (target.dataset.categoryIndex !== undefined) {
    const category = portfolio.categories[Number(target.dataset.categoryIndex)];
    category[target.dataset.categoryField] = target.value;
    return;
  }
  if (target.dataset.contactIndex !== undefined) {
    const contact = portfolio.site.about.contacts[Number(target.dataset.contactIndex)];
    if (contact) contact[target.dataset.contactField] = target.type === 'checkbox' ? target.checked : target.value;
    return;
  }
  if (target.dataset.projectField) {
    const project = getCurrentProject(); if (!project) return;
    const key = target.dataset.projectField;
    const oldValue = project[key];
    let value = target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'sortOrder') value = Number(value || 0);
    if (key === 'id' && project._new) {
      const oldId = project.id; project.id = value.toLowerCase(); selectedProjectId = project.id || oldId;
      if (portfolio.site.home.spotlightProjectId === oldId) portfolio.site.home.spotlightProjectId = project.id;
    } else project[key] = value;
    if (key === 'cover') {
      const preview = $('[data-project-cover-preview]', editorContent);
      const label = $('[data-project-cover-label]', editorContent);
      if (preview) { preview.src = publicAsset(value); preview.hidden = !value; }
      if (label) label.textContent = value || 'belum ada';
    }
    if (key === 'cover' && eventType === 'change') {
      const originalValue = target.dataset.originalCover || oldValue;
      if (originalValue !== value) queueUnusedAsset(originalValue);
      target.dataset.originalCover = value;
    }
    return;
  }
  if (target.dataset.projectPath) {
    const project = getCurrentProject(); if (project) setPath(project, target.dataset.projectPath, target.value);
    return;
  }
  if (target.dataset.galleryIndex !== undefined) {
    const project = getCurrentProject(); if (!project) return;
    const image = project.gallery[Number(target.dataset.galleryIndex)]; if (!image) return;
    const key = target.dataset.galleryField; const oldValue = image[key]; image[key] = target.value;
    if (key === 'image' && eventType === 'change') {
      const originalValue = target.dataset.originalImage || oldValue;
      if (originalValue !== target.value) queueUnusedAsset(originalValue);
      target.dataset.originalImage = target.value;
    }
    return;
  }
  if (target.dataset.storyIndex !== undefined) {
    const project = getCurrentProject(); const section = project?.detail?.sections?.[Number(target.dataset.storyIndex)];
    if (!section) return;
    const key = target.dataset.storyField;
    const oldValue = section[key];
    const value = target.type === 'checkbox' ? target.checked : target.value;
    section[key] = value;
    if (key === 'videoSource') section.layout = 'gameplay';
    if (key === 'video' && eventType === 'change') {
      const originalValue = target.dataset.originalVideo || oldValue;
      if (originalValue !== value) queueUnusedAsset(originalValue);
      target.dataset.originalVideo = value;
    }
  }
}

function updateAppearancePreview() {
  if (!portfolio?.site) return;
  const spacingPreview = $('#spacingPreview', editorContent);
  if (spacingPreview) applyAppearance(portfolio.site, spacingPreview);
  const preview = $('#appearancePreview', editorContent);
  if (preview) applyAppearance(portfolio.site, preview);
  $$('[data-background-preview]', editorContent).forEach(target => applyAppearance(portfolio.site, target));
  const heroPreview = $('#heroImageSizePreview', editorContent);
  if (heroPreview) {
    applyAppearance(portfolio.site, heroPreview);
    const image = $('[data-hero-preview-image]', heroPreview);
    const title = $('[data-hero-preview-title]', heroPreview);
    const emphasis = $('[data-hero-preview-emphasis]', heroPreview);
    const source = portfolio.site.home.heroImage;
    if (image) { image.src = publicAsset(source); image.hidden = !source; }
    if (title) title.textContent = portfolio.site.home.heroTitle || '';
    if (emphasis) emphasis.textContent = portfolio.site.home.heroEmphasis || '';
  }
}

function addCategory() {
  const base = `category-${portfolio.categories.length + 1}`;
  const category = {
    id: base, slug: base, name: 'Kategori baru', navLabel: 'Kategori baru', layout: 'artwork-rail',
    featuredLabel: 'KATEGORI BARU', featuredKicker: 'KATEGORI PORTOFOLIO', featuredTitle: 'Judul', featuredEmphasis: 'kategori.',
    featuredDescription: 'Tulis deskripsi kategori.', featuredCta: 'LIHAT KATEGORI', pageEyebrow: 'KATEGORI PORTOFOLIO',
    pageTitle: 'Judul', pageEmphasis: 'kategori.', pageDescription: 'Tulis pengantar halaman kategori.', collectionLabel: 'KOLEKSI / KATEGORI BARU', filterLabel: 'SEMUA KARYA'
  };
  portfolio.categories.push(category);
  activeTab = 'categories'; renderEditor();
}

function deleteCategory(index) {
  const category = portfolio.categories[index];
  if (portfolio.projects.some(project => project.category === category.id)) {
    alert('Pindahkan proyek pada kategori ini ke kategori lain sebelum menghapusnya.'); return;
  }
  if (!confirm(`Hapus kategori “${category.name}”?`)) return;
  portfolio.categories.splice(index, 1); renderEditor();
}

function addProject() {
  if (!portfolio.categories.length) { alert('Tambahkan kategori terlebih dahulu.'); return; }
  const nextSortOrder = Math.max(0, ...portfolio.projects.map(item => Number(item.sortOrder) || 0)) + 1;
  const project = {
    id: `proyek-baru-${Date.now().toString(36)}`, title: 'Proyek baru', shortTitle: 'Proyek baru', category: portfolio.categories[0].id,
    year: '', role: '', contribution: '', subtitle: '', description: '', cover: '', sortOrder: nextSortOrder,
    published: true, gallery: [], detail: { narrativeTitle: 'Judul cerita proyek', narrative: 'Tulis cerita singkat proyek.', sections: [] }, _new: true
  };
  portfolio.projects.push(project); selectedProjectId = project.id; selectedProjectRef = project; activeTab = 'projects'; renderEditor();
}

function moveProjectOrder(projectId, direction) {
  const ordered = [...portfolio.projects].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const index = ordered.findIndex(project => project.id === projectId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= ordered.length) return;
  [ordered[index], ordered[destination]] = [ordered[destination], ordered[index]];
  ordered.forEach((project, order) => { project.sortOrder = order + 1; });
  renderEditor();
}

function movePersonalArtworkType(index, direction) {
  const category = portfolio.categories.find(item => item.id === 'personal');
  if (!category) return;
  const types = personalArtworkTypes();
  const destination = index + direction;
  if (destination < 0 || destination >= types.length) return;
  [types[index], types[destination]] = [types[destination], types[index]];
  category.artworkTypeOrder = types.map(type => type.label);
  renderEditor();
}

function removeGalleryImage(project, index) {
  const [removed] = project.gallery.splice(index, 1);
  if (project.cover === removed.image) project.cover = project.gallery[0]?.image || '';
  project.detail.sections = (project.detail.sections || []).map(section => ({
    ...section,
    images: (section.images || []).filter(imageIndex => imageIndex !== index).map(imageIndex => imageIndex > index ? imageIndex - 1 : imageIndex)
  }));
  queueUnusedAsset(removed.image);
  renderEditor();
}

function moveGalleryImage(project, index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= project.gallery.length) return;
  [project.gallery[index], project.gallery[destination]] = [project.gallery[destination], project.gallery[index]];
  project.detail.sections = (project.detail.sections || []).map(section => ({
    ...section,
    images: (section.images || []).map(imageIndex => imageIndex === index ? destination : imageIndex === destination ? index : imageIndex)
  }));
  renderEditor();
}

function deleteProject() {
  const project = getCurrentProject(); if (!project) return;
  if (!confirm(`Hapus proyek “${project.title}” dari website?`)) return;
  const oldId = project.id;
  portfolio.projects = portfolio.projects.filter(item => item !== project);
  project.gallery.forEach(image => queueUnusedAsset(image.image));
  (project.detail?.sections || []).forEach(section => queueUnusedAsset(section.video));
  queueUnusedAsset(project.cover);
  if (portfolio.site.home.spotlightProjectId === oldId) portfolio.site.home.spotlightProjectId = portfolio.projects.find(item => item.category === 'game-art' && item.published !== false)?.id || '';
  selectedProjectRef = portfolio.projects[0] || null;
  selectedProjectId = selectedProjectRef?.id || '';
  renderEditor();
}

function addStorySection() {
  const project = getCurrentProject(); if (!project) return;
  project.detail.sections ||= [];
  project.detail.sections.push({ title: 'SEKSI CERITA BARU', subtitle: project.shortTitle, layout: 'wide', videoSource: 'local', images: [] });
  renderEditor();
}

function moveStorySection(index, direction) {
  const project = getCurrentProject();
  const sections = project?.detail?.sections || [];
  const destination = index + direction;
  if (destination < 0 || destination >= sections.length) return;
  [sections[index], sections[destination]] = [sections[destination], sections[index]];
  renderEditor();
}

async function optimizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('Browser tidak dapat mengolah gambar ini.');
  if (blob.size > 6 * 1024 * 1024) throw new Error('Ukuran hasil gambar masih terlalu besar (maksimum 6 MB).');
  return blob;
}

function imageSlug(name) {
  return name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'gambar';
}

async function classifyUpload(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'mp4' || file.type === 'video/mp4') return { kind: 'video', extension: 'mp4' };
  if (extension === 'webm' || file.type === 'video/webm') return { kind: 'video', extension: 'webm' };
  const signature = await file.slice(0, 6).text();
  if (extension === 'gif' || file.type === 'image/gif' || signature === 'GIF87a' || signature === 'GIF89a') return { kind: 'gif', extension: 'gif' };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension) || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { kind: 'image', extension: 'webp' };
  throw new Error(`Format “.${extension}” belum didukung. Gunakan JPG, PNG, WebP, GIF, MP4, atau WebM.`);
}

async function stageUpload(file, uploadType) {
  if (file.size > 40 * 1024 * 1024) throw new Error(`“${file.name}” lebih dari batas 40 MB per berkas. Kompres video atau GIF lalu coba lagi.`);
  const blob = uploadType.kind === 'image' ? await optimizeImage(file) : file;
  const path = `assets/${imageSlug(file.name)}-${Date.now().toString(36)}-${(pendingUploads.length + 1).toString(36)}.${uploadType.extension}`;
  const previewUrl = URL.createObjectURL(blob);
  pendingUploads.push({ path, content: encodeBase64(await blob.arrayBuffer()), previewUrl });
  localPreviewAssets.set(path, previewUrl);
  return path;
}

async function handleFileUpload(input) {
  const files = [...input.files]; if (!files.length) return;
  const isVideoSlot = input.dataset.uploadStoryVideo !== undefined;
  const button = $('#publishButton'); button.disabled = true;
  const saveStatus = $('#saveStatus');
  try {
    const classified = await Promise.all(files.map(async file => ({ file, type: await classifyUpload(file) })));
    const oversized = classified.find(({ file }) => file.size > 40 * 1024 * 1024);
    if (oversized) throw new Error(`“${oversized.file.name}” lebih dari batas 40 MB per berkas. Kompres video atau GIF lalu coba lagi.`);
    if (classified.some(({ type }) => isVideoSlot ? type.kind !== 'video' : type.kind === 'video')) {
      throw new Error(isVideoSlot ? 'Slot gameplay menerima video MP4 atau WebM.' : 'Pilih gambar untuk cover/galeri. Video diunggah melalui field video pada seksi cerita.');
    }
    for (const { file, type } of classified) {
      const path = await stageUpload(file, type);
      if (isVideoSlot) {
        const project = getCurrentProject();
        const section = project?.detail?.sections?.[Number(input.dataset.uploadStoryVideo)];
        if (!section) throw new Error('Seksi video tidak ditemukan.');
        const oldValue = section.video;
        section.video = path;
        section.videoSource = 'local';
        section.layout = 'gameplay';
        queueUnusedAsset(oldValue);
      } else if (input.dataset.uploadPath) {
        const oldValue = getPath(portfolio, input.dataset.uploadPath);
        setPath(portfolio, input.dataset.uploadPath, path);
        queueUnusedAsset(oldValue);
      } else {
        const project = getCurrentProject();
        if (!project) throw new Error('Pilih proyek terlebih dahulu.');
        if (input.dataset.uploadProjectCover !== undefined) {
          const oldValue = project.cover; project.cover = path; queueUnusedAsset(oldValue);
        } else if (input.dataset.uploadGallery !== undefined) {
          project.gallery.push({ image: path, caption: file.name.replace(/\.[^.]+$/, ''), type: '' });
        }
      }
    }
    const noun = isVideoSlot ? 'video' : 'gambar/GIF';
    status(saveStatus, `${files.length} berkas ${noun} siap diterbitkan bersama perubahan konten.`, 'success');
    renderEditor();
  } catch (error) {
    status(saveStatus, error.message, 'error');
  } finally {
    button.disabled = false; input.value = '';
  }
}

function handleStoryImages(input) {
  const project = getCurrentProject(); if (!project) return;
  const sectionIndex = Number(input.dataset.storyImages);
  const selected = $$(`input[data-story-images="${sectionIndex}"]:checked`, editorContent).map(checkbox => Number(checkbox.value));
  project.detail.sections[sectionIndex].images = selected;
}

function validatePortfolio() {
  const reservedSlugs = new Set(['home', 'about', 'contact', 'project', 'statement']);
  const categoryIds = new Set();
  const categorySlugs = new Set();
  if (!portfolio.categories.length) return 'Buat setidaknya satu kategori.';
  for (const category of portfolio.categories) {
    if (!/^[a-z0-9-]+$/.test(category.id || '')) return `ID kategori “${category.name}” tidak valid.`;
    if (categoryIds.has(category.id)) return `ID kategori “${category.id}” dipakai lebih dari sekali.`;
    if (!/^[a-z0-9-]+$/.test(category.slug || '') || reservedSlugs.has(category.slug)) return `Alamat kategori “${category.name}” harus berupa huruf kecil, angka, atau tanda hubung dan tidak boleh memakai alamat khusus.`;
    if (categorySlugs.has(category.slug)) return `Alamat kategori “${category.slug}” dipakai lebih dari sekali.`;
    categoryIds.add(category.id); categorySlugs.add(category.slug);
  }
  const projectIds = new Set();
  for (const project of portfolio.projects) {
    if (!/^[a-z0-9-]+$/.test(project.id || '')) return `ID proyek “${project.title}” tidak valid.`;
    if (projectIds.has(project.id)) return `ID proyek “${project.id}” dipakai lebih dari sekali.`;
    if (!categoryIds.has(project.category)) return `Pilih kategori yang tersedia untuk proyek “${project.title}”.`;
    if (!project.title?.trim()) return 'Setiap proyek harus memiliki judul.';
    for (const section of project.detail?.sections || []) {
      if ((section.images || []).some(index => !Number.isInteger(index) || index < 0 || index >= project.gallery.length)) return `Periksa susunan gambar pada proyek “${project.title}”.`;
    }
    projectIds.add(project.id);
  }
  const featuredGameArtProject = portfolio.projects.find(project => project.id === portfolio.site.home.spotlightProjectId);
  if (portfolio.site.home.spotlightProjectId && (!featuredGameArtProject || featuredGameArtProject.category !== 'game-art' || featuredGameArtProject.published === false)) return 'Pilih project 2D Game Art yang masih dipublikasikan untuk bagian karya pilihan Home.';
  return '';
}

function handleEditorClick(event) {
  const mediaButton = event.target.closest('[data-media-target]');
  if (mediaButton) {
    event.preventDefault();
    openMediaPicker({ type: mediaButton.dataset.mediaTarget, path: mediaButton.dataset.mediaPath, index: mediaButton.dataset.index });
    return;
  }
  const tab = event.target.closest('[data-tab]');
  if (tab) { activeTab = tab.dataset.tab; renderEditor(); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'add-category') addCategory();
  if (action === 'delete-category') deleteCategory(Number(button.dataset.index));
  if (action === 'move-category') { const index = Number(button.dataset.index); const destination = index + Number(button.dataset.direction); if (destination >= 0 && destination < portfolio.categories.length) { [portfolio.categories[index], portfolio.categories[destination]] = [portfolio.categories[destination], portfolio.categories[index]]; renderEditor(); } }
  if (action === 'move-artwork-type') movePersonalArtworkType(Number(button.dataset.index), Number(button.dataset.direction));
  if (action === 'move-project-order') moveProjectOrder(button.dataset.projectId, Number(button.dataset.direction));
  if (action === 'add-project') addProject();
  if (action === 'select-project') { selectedProjectId = button.dataset.projectId; selectedProjectRef = portfolio.projects.find(project => project.id === selectedProjectId) || null; renderEditor(); }
  if (action === 'delete-project') deleteProject();
  if (action === 'remove-gallery') { const project = getCurrentProject(); if (project) removeGalleryImage(project, Number(button.dataset.index)); }
  if (action === 'move-gallery') { const project = getCurrentProject(); if (project) moveGalleryImage(project, Number(button.dataset.index), Number(button.dataset.direction)); }
  if (action === 'add-story') addStorySection();
  if (action === 'add-contact') { portfolio.site.about.contacts.push({ label: 'Tautan baru', value: 'Teks tautan', href: 'https://', newWindow: true }); renderEditor(); }
  if (action === 'remove-contact') { portfolio.site.about.contacts.splice(Number(button.dataset.index), 1); renderEditor(); }
  if (action === 'move-story') moveStorySection(Number(button.dataset.index), Number(button.dataset.direction));
  if (action === 'remove-story') { const project = getCurrentProject(); if (project) { const [removed] = project.detail.sections.splice(Number(button.dataset.index), 1); queueUnusedAsset(removed?.video); renderEditor(); } }
}

async function publishChanges() {
  if (!portfolio) return;
  const button = $('#publishButton'); const saveStatus = $('#saveStatus');
  const validationError = validatePortfolio();
  if (validationError) { status(saveStatus, validationError, 'error'); return; }
  button.disabled = true; status(saveStatus, 'Membuat commit dan menerbitkan perubahan…');
  try {
    const ref = await githubRequest(`/git/ref/heads/${encodeURIComponent(BRANCH)}`);
    const parentSha = ref.object.sha;
    const parent = await githubRequest(`/git/commits/${parentSha}`);
    const currentTree = await githubRequest(`/git/trees/${parent.tree.sha}?recursive=1`);
    const existingPaths = new Set(currentTree.tree.map(entry => entry.path));
    const entries = [];
    const contentJson = JSON.stringify(portfolio, (key, value) => key === '_new' ? undefined : value, 2);
    const contentBytes = new TextEncoder().encode(`${contentJson}\n`);
    const contentBlob = await githubRequest('/git/blobs', { method: 'POST', body: JSON.stringify({ content: encodeBase64(contentBytes), encoding: 'base64' }) });
    entries.push({ path: CONTENT_PATH, mode: '100644', type: 'blob', sha: contentBlob.sha });
    const deletedPaths = new Set();
    for (const upload of pendingUploads) {
      const blob = await githubRequest('/git/blobs', { method: 'POST', body: JSON.stringify({ content: upload.content, encoding: 'base64' }) });
      entries.push({ path: upload.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const path of pendingDeletes) {
      if (existingPaths.has(path) && !isAssetReferenced(path) && !pendingUploads.some(upload => upload.path === path)) {
        entries.push({ path, mode: '100644', type: 'blob', sha: null });
        deletedPaths.add(path);
      }
    }
    const tree = await githubRequest('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }) });
    const commit = await githubRequest('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Update portfolio content from admin editor', tree: tree.sha, parents: [parentSha] }) });
    await githubRequest(`/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    mediaLibraryFiles = mediaLibraryFiles.filter(file => !deletedPaths.has(file.path));
    pendingUploads.filter(upload => MEDIA_IMAGE_PATTERN.test(upload.path)).forEach(upload => {
      if (!mediaLibraryFiles.some(file => file.path === upload.path)) mediaLibraryFiles.push({ path: upload.path, name: upload.path.split('/').pop() });
    });
    pendingUploads = []; pendingDeletes = new Set();
    portfolio.projects.forEach(project => { delete project._new; });
    status(saveStatus, 'Perubahan berhasil disimpan. GitHub Pages sedang menerbitkan website; prosesnya biasanya memerlukan beberapa menit.', 'success');
  } catch (error) {
    status(saveStatus, `Perubahan belum diterbitkan: ${error.message}`, 'error');
  } finally { button.disabled = false; }
}

$('#connectForm').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#githubToken'); const button = $('#connectButton'); const gateStatus = $('#gateStatus');
  const token = input.value.trim(); if (!token) return;
  button.disabled = true; status(gateStatus, 'Memeriksa token dan memuat konten repositori…');
  try {
    await connect(token);
    input.value = '';
    gate.hidden = true; editor.hidden = false;
    renderEditor();
    status($('#saveStatus'), 'Terhubung. Edit konten, lalu klik Terbitkan perubahan.', 'success');
  } catch (error) {
    githubToken = ''; status(gateStatus, `Tidak dapat terhubung: ${error.message}`, 'error');
  } finally { button.disabled = false; }
});

editorContent.addEventListener('input', event => { updateFromInput(event.target, event.type); scheduleSitePreview(); });
editorContent.addEventListener('change', event => {
  const input = event.target;
  if (input.type === 'file') { handleFileUpload(input); return; }
  if (input.dataset.storyImages !== undefined) { handleStoryImages(input); scheduleSitePreview(); return; }
  if (['videoSource', 'videoUrl', 'video'].includes(input.dataset.storyField)) {
    updateFromInput(input, event.type);
    renderEditor();
    return;
  }
  updateFromInput(input, event.type);
  scheduleSitePreview();
});
editor.addEventListener('click', handleEditorClick);
$('#publishButton').addEventListener('click', publishChanges);
$('#previewButton').addEventListener('click', openSitePreview);
$('#closePreviewButton').addEventListener('click', closeSitePreview);
$('#mediaPickerClose').addEventListener('click', closeMediaPicker);
$('#mediaPickerSearch').addEventListener('input', renderMediaPicker);
$('#mediaPicker').addEventListener('click', event => {
  if (event.target.id === 'mediaPicker') { closeMediaPicker(); return; }
  const choice = event.target.closest('[data-media-choice]');
  if (choice) { applyMediaSelection(choice.dataset.mediaChoice); return; }
  if (event.target.closest('[data-media-reload]')) {
    loadMediaLibrary().then(renderMediaPicker).catch(error => { mediaLibraryError = error.message; renderMediaPicker(); });
  }
});
$('#portfolioPreview').addEventListener('load', event => {
  event.currentTarget.dataset.ready = 'true';
  sendSitePreview();
});
$$('[data-preview-size]').forEach(button => button.addEventListener('click', () => {
  const isMobile = button.dataset.previewSize === 'mobile';
  $('#portfolioPreview').classList.toggle('is-mobile', isMobile);
  $$('[data-preview-size]').forEach(option => {
    const selected = option === button;
    option.classList.toggle('is-active', selected);
    option.setAttribute('aria-pressed', String(selected));
  });
}));
$('#previewOverlay').addEventListener('click', event => { if (event.target.id === 'previewOverlay') closeSitePreview(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!$('#mediaPicker').hidden) closeMediaPicker();
  else if (!$('#previewOverlay').hidden) closeSitePreview();
});
$('#logoutButton').addEventListener('click', () => {
  githubToken = ''; portfolio = null; pendingUploads = []; pendingDeletes.clear();
  mediaLibraryFiles = []; mediaLibraryError = '';
  localPreviewAssets.forEach(url => URL.revokeObjectURL(url)); localPreviewAssets.clear();
  $('#previewOverlay').hidden = true; document.body.classList.remove('preview-open');
  selectedProjectRef = null; selectedProjectId = '';
  editor.hidden = true; gate.hidden = false; activeTab = 'site';
  status($('#gateStatus'), 'Koneksi diputus.');
});

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
const APPEARANCE_DEFAULTS = {
  headingTextColor: '#f1f0f4', bodyTextColor: '#a7adbb', uiTextColor: '#e6e3ee', labelTextColor: '#b4acd8',
  captionTextColor: '#f5f3fb', captionBackgroundColor: '#080a10',
  headingTextScale: 100, featuredImageScale: 100, bodyTextSize: 13, uiTextSize: 12, labelTextSize: 10, captionTextSize: 11
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
  site.appearance = { ...APPEARANCE_DEFAULTS, ...(site.appearance || {}) };
  return site.appearance;
}

function normalizeSiteLabels(site) {
  site.labels = { ...DEFAULT_SITE_LABELS, ...(site.labels || {}) };
  return site.labels;
}

function safeHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function applyAppearance(site, target = document.documentElement) {
  const appearance = normalizeAppearance(site);
  const number = (key, fallback, min, max) => Math.max(min, Math.min(max, Number(appearance[key]) || fallback));
  target.style.setProperty('--portfolio-heading-color', safeHexColor(appearance.headingTextColor, APPEARANCE_DEFAULTS.headingTextColor));
  target.style.setProperty('--portfolio-body-color', safeHexColor(appearance.bodyTextColor, APPEARANCE_DEFAULTS.bodyTextColor));
  target.style.setProperty('--portfolio-ui-color', safeHexColor(appearance.uiTextColor, APPEARANCE_DEFAULTS.uiTextColor));
  target.style.setProperty('--portfolio-label-color', safeHexColor(appearance.labelTextColor, APPEARANCE_DEFAULTS.labelTextColor));
  target.style.setProperty('--portfolio-caption-color', safeHexColor(appearance.captionTextColor, APPEARANCE_DEFAULTS.captionTextColor));
  target.style.setProperty('--portfolio-caption-background', safeHexColor(appearance.captionBackgroundColor, APPEARANCE_DEFAULTS.captionBackgroundColor));
  target.style.setProperty('--portfolio-heading-scale', String(number('headingTextScale', 100, 85, 120) / 100));
  target.style.setProperty('--portfolio-featured-image-scale', String(number('featuredImageScale', 100, 40, 100) / 100));
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
    ${appearanceRange('site.appearance.bodyTextSize', 'Ukuran teks isi', 12, 18, 'Berlaku untuk paragraf dan deskripsi.')}
    ${appearanceRange('site.appearance.uiTextSize', 'Ukuran navbar, tautan, filter, dan tombol', 10, 18, 'Berlaku pada menu utama, tab kategori, filter karya, tautan, dan tombol.')}
    ${appearanceRange('site.appearance.labelTextSize', 'Ukuran label dan metadata', 9, 15, 'Berlaku untuk label kecil, metadata, dan catatan kategori.')}
    ${appearanceRange('site.appearance.captionTextSize', 'Ukuran caption gambar', 10, 16, 'Berlaku untuk judul kecil pada gambar portofolio.')}
  </div><div class="appearance-preview" id="appearancePreview"><div class="appearance-preview-layout"><div class="appearance-preview-art"><span class="appearance-preview-kicker">CONTOH JUDUL BAGIAN</span><p class="appearance-preview-body">Contoh teks isi portofolio untuk melihat ukuran dan warnanya.</p><a class="appearance-preview-link" href="#">CONTOH TAUTAN / TOMBOL ↗</a><span class="appearance-preview-label">LABEL KATEGORI · METADATA</span><span class="appearance-preview-caption">PERSONAL ARTWORK / CONTOH CAPTION</span></div><div class="appearance-preview-image-example"><div class="appearance-preview-image-stage"><img class="appearance-preview-image" src="assets/personal-02.webp" alt="Contoh karya portrait di dalam panel landscape"></div><span class="appearance-preview-image-label">PREVIEW KARYA DALAM PANEL LANDSCAPE</span></div></div></div></section>`;
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
  const preview = value ? (value.startsWith('http') || value.startsWith('/') ? value : value.startsWith('assets/') ? value : `assets/${value}.webp`) : '';
  return `<div class="field"><span class="field-label">${escapeHtml(label)}</span><div class="image-control"><div><input type="text" data-path="${escapeHtml(path)}" data-original-asset="${escapeHtml(value)}" value="${escapeHtml(value)}" placeholder="Nama file atau URL"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload-path="${escapeHtml(path)}" aria-label="Unggah ${escapeHtml(label)}"></div><img class="image-preview" src="${escapeHtml(preview)}" alt="Pratinjau ${escapeHtml(label)}" ${preview ? '' : 'hidden'}></div>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</div>`;
}

function renderSiteEditor() {
  const groups = [
    { title: 'Identitas dan metadata', fields: [
      ['site.title', 'Judul website / tab browser'], ['site.description', 'Deskripsi website', 'textarea'], ['site.language', 'Kode bahasa website (contoh: en atau id)'],
      ['site.brandName', 'Nama brand'], ['site.brandMonogram', 'Monogram logo'],
      ['site.meta.openGraphImage', 'Gambar pratinjau tautan', 'image'], ['site.meta.favicon', 'File favicon', 'text']
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
  return `<div class="section-heading"><div><h2>Kategori website</h2><p>Nama, teks carousel, deskripsi, tautan, dan label navigasi setiap kategori dapat diubah di sini.</p></div><button class="button button-primary" type="button" data-action="add-category">+ Tambah kategori</button></div>${cards || '<div class="empty-card"><strong>Belum ada kategori</strong>Tambahkan kategori untuk mengelompokkan proyek.</div>'}`;
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
  const list = [...portfolio.projects].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map(item => `<button class="project-select ${item === project ? 'is-active' : ''}" type="button" data-action="select-project" data-project-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title || 'Proyek baru')}</strong><small>${escapeHtml(portfolio.categories.find(category => category.id === item.category)?.name || 'Tanpa kategori')} · ${(item.gallery || []).length} gambar${item.published === false ? ' · Draft' : ''}</small></button>`).join('');
  return `<div class="project-workspace"><aside class="project-list-panel"><div class="project-list-heading"><span>DAFTAR PROYEK</span><button class="button button-primary button-small" type="button" data-action="add-project">+ Baru</button></div><div class="project-list">${list}</div></aside>${renderProjectForm(project)}</div>`;
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
  updateAppearancePreview();
  scheduleSitePreview();
}

async function connect(token) {
  githubToken = token;
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
  const siteImages = [portfolio.site.home.heroImage, portfolio.site.about.image, portfolio.site.meta.openGraphImage];
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
    if (path.startsWith('site.appearance.')) updateAppearancePreview();
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
  const preview = $('#appearancePreview', editorContent);
  if (preview) applyAppearance(portfolio.site, preview);
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
  const project = {
    id: `proyek-baru-${Date.now().toString(36)}`, title: 'Proyek baru', shortTitle: 'Proyek baru', category: portfolio.categories[0].id,
    year: '', role: '', contribution: '', subtitle: '', description: '', cover: '', sortOrder: portfolio.projects.length,
    published: true, gallery: [], detail: { narrativeTitle: 'Judul cerita proyek', narrative: 'Tulis cerita singkat proyek.', sections: [] }, _new: true
  };
  portfolio.projects.push(project); selectedProjectId = project.id; selectedProjectRef = project; activeTab = 'projects'; renderEditor();
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

function classifyUpload(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'mp4' || file.type === 'video/mp4') return { kind: 'video', extension: 'mp4' };
  if (extension === 'webm' || file.type === 'video/webm') return { kind: 'video', extension: 'webm' };
  if (extension === 'gif' || file.type === 'image/gif') return { kind: 'gif', extension: 'gif' };
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
    const classified = files.map(file => ({ file, type: classifyUpload(file) }));
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
  const tab = event.target.closest('[data-tab]');
  if (tab) { activeTab = tab.dataset.tab; renderEditor(); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  if (action === 'add-category') addCategory();
  if (action === 'delete-category') deleteCategory(Number(button.dataset.index));
  if (action === 'move-category') { const index = Number(button.dataset.index); const destination = index + Number(button.dataset.direction); if (destination >= 0 && destination < portfolio.categories.length) { [portfolio.categories[index], portfolio.categories[destination]] = [portfolio.categories[destination], portfolio.categories[index]]; renderEditor(); } }
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
    for (const upload of pendingUploads) {
      const blob = await githubRequest('/git/blobs', { method: 'POST', body: JSON.stringify({ content: upload.content, encoding: 'base64' }) });
      entries.push({ path: upload.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const path of pendingDeletes) {
      if (existingPaths.has(path) && !isAssetReferenced(path) && !pendingUploads.some(upload => upload.path === path)) entries.push({ path, mode: '100644', type: 'blob', sha: null });
    }
    const tree = await githubRequest('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }) });
    const commit = await githubRequest('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Update portfolio content from admin editor', tree: tree.sha, parents: [parentSha] }) });
    await githubRequest(`/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
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
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#previewOverlay').hidden) closeSitePreview(); });
$('#logoutButton').addEventListener('click', () => {
  githubToken = ''; portfolio = null; pendingUploads = []; pendingDeletes.clear();
  localPreviewAssets.forEach(url => URL.revokeObjectURL(url)); localPreviewAssets.clear();
  $('#previewOverlay').hidden = true; document.body.classList.remove('preview-open');
  selectedProjectRef = null; selectedProjectId = '';
  editor.hidden = true; gate.hidden = false; activeTab = 'site';
  status($('#gateStatus'), 'Koneksi diputus.');
});

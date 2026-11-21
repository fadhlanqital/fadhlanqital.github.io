let portfolio = null;
let categories = [];
let currentCategoryFilter = 'all';
let viewerCollection = [];
let viewerIndex = 0;
let suppressRailClick = false;
let suppressFeaturedClick = false;
let featuredCarouselCleanup = null;
let adminPreviewDataReceived = false;
let previewAssetOverrides = {};
const DEFAULT_APPEARANCE = {
  headingTextColor: '#f1f0f4', bodyTextColor: '#a7adbb', labelTextColor: '#b4acd8',
  captionTextColor: '#f5f3fb', captionBackgroundColor: '#080a10',
  bodyTextSize: 13, labelTextSize: 10, captionTextSize: 11
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');
const nav = $('#mainNav');
const menuToggle = $('#menuToggle');
const viewer = $('#viewer');
const viewerImage = $('#viewerImage');
const viewerCaption = $('#viewerCaption');
const adminPreviewMode = new URLSearchParams(location.search).get('adminPreview') === '1';

function applyAppearance(site) {
  const appearance = { ...DEFAULT_APPEARANCE, ...(site.appearance || {}) };
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
  const size = (value, fallback, min, max) => `${Math.max(min, Math.min(max, Number(value) || fallback))}px`;
  const root = document.documentElement.style;
  root.setProperty('--portfolio-heading-color', color(appearance.headingTextColor, DEFAULT_APPEARANCE.headingTextColor));
  root.setProperty('--portfolio-body-color', color(appearance.bodyTextColor, DEFAULT_APPEARANCE.bodyTextColor));
  root.setProperty('--portfolio-label-color', color(appearance.labelTextColor, DEFAULT_APPEARANCE.labelTextColor));
  root.setProperty('--portfolio-caption-color', color(appearance.captionTextColor, DEFAULT_APPEARANCE.captionTextColor));
  root.setProperty('--portfolio-caption-background', color(appearance.captionBackgroundColor, DEFAULT_APPEARANCE.captionBackgroundColor));
  root.setProperty('--portfolio-body-size', size(appearance.bodyTextSize, 13, 12, 18));
  root.setProperty('--portfolio-label-size', size(appearance.labelTextSize, 10, 9, 15));
  root.setProperty('--portfolio-caption-size', size(appearance.captionTextSize, 11, 10, 16));
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function asset(source = '') {
  if (!source) return '';
  if (previewAssetOverrides[source]) return previewAssetOverrides[source];
  if (/^(https?:|data:|blob:|\/|\.\/)/i.test(source)) return source;
  if (source.startsWith('assets/')) return source;
  if (/\.[a-z0-9]{2,5}$/i.test(source)) return source;
  return `assets/${source}.webp`;
}

function safeHref(value = '') {
  const href = String(value).trim();
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(href) ? href : '#';
}

function titleMarkup(line, emphasis = '') {
  return `${esc(line)}${emphasis ? `<br><em>${esc(emphasis)}</em>` : ''}`;
}

function allProjects() {
  return [...(portfolio?.projects || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function visibleProjects(categoryId = null) {
  return allProjects().filter(project => project.published !== false && (!categoryId || project.category === categoryId));
}

function categoryForProject(project) {
  return categories.find(category => category.id === project?.category) || categories[0];
}

function imageButton(project, index, extra = '') {
  const image = project.gallery?.[index];
  if (!image) return '';
  return `<button class="story-image ${esc(extra)}" type="button" data-view-project="${esc(project.id)}" data-view-index="${index}" aria-label="${esc(portfolio.site.labels.fullSize)}: ${esc(image.caption)}"><img src="${esc(asset(image.image))}" alt="${esc(project.shortTitle)} — ${esc(image.caption)}" loading="lazy"></button>`;
}

function updateChrome() {
  const site = portfolio.site;
  applyAppearance(site);
  document.title = site.title;
  document.documentElement.lang = site.language || 'en';
  const metaDescription = $('meta[name="description"]');
  const ogTitle = $('meta[property="og:title"]');
  const ogDescription = $('meta[property="og:description"]');
  const ogImage = $('meta[property="og:image"]');
  if (metaDescription) metaDescription.content = site.description;
  if (ogTitle) ogTitle.content = site.title;
  if (ogDescription) ogDescription.content = site.description;
  if (ogImage) ogImage.content = new URL(asset(site.meta.openGraphImage), location.href).href;
  const favicon = $('link[rel="icon"]');
  if (favicon) favicon.href = asset(site.meta.favicon);

  $$('.brand').forEach(brand => {
    const monogram = $('.brand-monogram', brand);
    const name = $('.brand-name', brand);
    if (monogram) monogram.textContent = site.brandMonogram;
    if (name) name.textContent = site.brandName;
    brand.setAttribute('aria-label', `${site.brandName} home`);
  });
  nav.innerHTML = [
    `<a href="#home" data-nav="home">${esc(site.navigation.home)}</a>`,
    ...categories.map(category => `<a href="#${esc(category.slug)}" data-nav="${esc(category.slug)}">${esc(category.navLabel || category.name)}</a>`),
    `<a href="#about" data-nav="about">${esc(site.about.navLabel)}</a>`,
    `<a href="#contact" class="nav-contact" data-nav="contact">${esc(site.navigation.contact)} <span>↗</span></a>`
  ].join('');
  $('.footer-role').textContent = site.footerRole;
  $('.footer-copy').textContent = site.copyright;
  $('.footer-top').textContent = site.navigation.footerTop;
  $('.viewer-help').textContent = site.navigation.viewerHelp;
}

function featuredCategories() {
  return categories.map(category => ({
    ...category,
    items: visibleProjects(category.id).flatMap(project => (project.gallery || []).map((image, index) => ({
      ...image,
      index,
      projectId: project.id,
      projectName: project.shortTitle || project.title,
      year: project.year
    })))
  })).filter(category => category.items.length);
}

function renderFeaturedCarousel() {
  const featured = featuredCategories();
  if (!featured.length) return `<section class="featured-preview"><p class="eyebrow">${esc(portfolio.site.labels.portfolioPreparing)}</p></section>`;
  const category = featured[0];
  const item = category.items[0];
  const total = String(featured.length).padStart(2, '0');
  return `<section class="featured-preview" id="featuredPreview" aria-label="${esc(portfolio.site.home.featuredTopLeft)}">
    <div class="featured-preview-top"><span>${esc(portfolio.site.home.featuredTopLeft)}</span><span>${esc(portfolio.site.home.featuredTopRight)}</span></div>
    <div class="featured-category-nav" id="featuredCategoryNav" role="tablist" aria-label="${esc(portfolio.site.labels.chooseCategory)}">
      ${featured.map((cat, index) => `<button type="button" class="featured-category-tab ${index === 0 ? 'is-active' : ''}" data-category-index="${index}" role="tab" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}"><span class="featured-category-num">${String(index + 1).padStart(2, '0')}</span><span class="featured-category-name">${esc(cat.featuredLabel)}</span><span class="featured-category-count">${cat.items.length} ${esc(portfolio.site.labels.works)}</span></button>`).join('')}
    </div>
    <div class="featured-preview-main">
      <div class="featured-preview-copy" aria-live="polite" aria-atomic="true">
        <span class="eyebrow" id="featuredCategoryKicker">${esc(category.featuredKicker)}</span>
        <h2 id="featuredTitle">${titleMarkup(category.featuredTitle, category.featuredEmphasis)}</h2>
        <p id="featuredDescription">${esc(category.featuredDescription)}</p>
        <a class="featured-cta" id="featuredLink" href="#${esc(category.slug)}">${esc(category.featuredCta)} <span>↗</span></a>
        <div class="featured-category-controls" aria-label="${esc(portfolio.site.labels.categoryNavigation)}"><button class="featured-arrow" id="featuredCategoryPrev" type="button" aria-label="${esc(portfolio.site.labels.previous)}">←</button><span class="featured-counter"><b id="featuredCategoryCurrent">01</b><i>/</i> <span>${total}</span></span><button class="featured-arrow" id="featuredCategoryNext" type="button" aria-label="${esc(portfolio.site.labels.next)}">→</button></div>
      </div>
      <div class="featured-preview-stage" id="featuredStage" aria-label="${esc(portfolio.site.labels.artworkPreviews)}">
        <span class="featured-stage-ornament" aria-hidden="true">${esc(portfolio.site.brandMonogram)}</span><div class="featured-stage-halo" aria-hidden="true"></div>
        <button class="featured-image-trigger" id="featuredImageTrigger" type="button" data-view-project="${esc(item.projectId)}" data-view-index="${item.index}" aria-label="${esc(portfolio.site.labels.fullSize)}: ${esc(item.caption)}"><img id="featuredImage" src="${esc(asset(item.image))}" alt="${esc(item.projectName)} — ${esc(item.caption)}" draggable="false" fetchpriority="high"></button>
        <button class="featured-arrow featured-inner-arrow featured-inner-prev" id="featuredImagePrev" type="button" aria-label="${esc(portfolio.site.labels.previous)}">←</button><button class="featured-arrow featured-inner-arrow featured-inner-next" id="featuredImageNext" type="button" aria-label="${esc(portfolio.site.labels.next)}">→</button>
        <div class="featured-stage-foot"><span id="featuredStageLabel">${esc(item.projectName)} / ${esc(item.caption)}</span><span><b id="featuredImageCurrent">01</b> — <span id="featuredImageTotal">${String(category.items.length).padStart(2, '0')}</span></span></div>
        <span class="featured-image-hint">${esc(portfolio.site.labels.featuredImageHint)}</span>
      </div>
    </div>
    <div class="featured-preview-bottom"><div class="featured-preview-caption"><span>${esc(portfolio.site.labels.imagePreview)}</span><span id="featuredPreviewHint">${esc(portfolio.site.labels.browseWorksPrefix)} ${category.items.length} ${esc(portfolio.site.labels.browseWorksSuffix)}</span></div><div class="featured-thumbnails" id="featuredThumbnails" role="group" aria-label="${esc(portfolio.site.labels.chooseCategory)}">${category.items.slice(0, 5).map((thumb, index) => `<button type="button" class="featured-thumb ${index === 0 ? 'is-active' : ''}" data-inner-index="${index}" aria-label="Show image ${index + 1}: ${esc(thumb.caption)}" aria-pressed="${index === 0}"><img src="${esc(asset(thumb.image))}" alt="" loading="lazy"><span>${String(index + 1).padStart(2, '0')}</span></button>`).join('')}</div><div class="featured-image-autoplay"><span class="featured-autoplay-note"><span class="autoplay-dot"></span> ${esc(portfolio.site.labels.imagePreview)}</span><button class="featured-pause" id="featuredPause" type="button" aria-label="${esc(portfolio.site.labels.pause)}">Ⅱ <span>${esc(portfolio.site.labels.pause)}</span></button></div></div>
  </section>`;
}

function renderHome() {
  const home = portfolio.site.home;
  const personalCategory = categories.find(category => category.id === 'personal') || categories.find(category => category.layout === 'artwork-rail');
  const personal = visibleProjects(personalCategory?.id)[0];
  const personalGallery = personal?.gallery || [];
  const sideIndexes = [3, 10].map(index => Math.min(index, Math.max(0, personalGallery.length - 1))).filter((index, position, list) => personalGallery.length && list.indexOf(index) === position);
  const spotlight = visibleProjects().find(project => project.id === home.spotlightProjectId) || visibleProjects('game-art')[0] || visibleProjects()[0];
  const spotlightCategory = categoryForProject(spotlight);
  const personalSection = personal ? `<section class="personal-chapter">
      <div class="personal-heading reveal"><div><span class="eyebrow">${esc(home.personalEyebrow)} · ${personalGallery.length} ${esc(portfolio.site.labels.visuals)}</span><h2>${titleMarkup(home.personalTitle, home.personalEmphasis)}</h2></div><p>${esc(home.personalDescription)}</p></div>
      <div class="personal-composition"><a class="personal-main-visual" href="#${esc(personalCategory.slug)}" aria-label="${esc(home.personalCoverLabel)}"><img src="${esc(asset(personal.cover || personalGallery[0]?.image))}" alt="${esc(personal.shortTitle)} collection cover"><span class="visual-corner">${esc(home.personalCoverLabel)}</span></a><div class="personal-side-visuals">${sideIndexes.map((index, position) => imageButton(personal, index, position === 0 ? 'personal-sketch' : 'personal-study')).join('')}<div class="personal-side-copy"><span class="micro">${esc(home.personalSideLabel)}</span><h3>${titleMarkup(home.personalSideTitle, home.personalSideEmphasis)}</h3><a class="link-arrow" href="#${esc(personalCategory.slug)}">${esc(home.personalLink)} <span>↗</span></a></div></div></div>
      <div class="personal-foot"><span>${esc(home.personalFooterLabel)} · ${personalGallery.length} ${esc(portfolio.site.labels.visuals)}</span><a href="#${esc(personalCategory.slug)}">${esc(home.personalFooterLink)}</a></div>
    </section>` : '';
  const spotlightSection = spotlight ? `<section class="feature-chapter"><div class="chapter-head reveal"><div><span class="eyebrow">${esc(home.spotlightEyebrow)}</span><h2>${titleMarkup(home.spotlightTitle, home.spotlightEmphasis)}</h2></div><p>${esc(home.spotlightDescription)}</p></div><a class="feature-cover" href="#project/${esc(spotlight.id)}" aria-label="${esc(portfolio.site.labels.openProject)} ${esc(spotlight.title)}"><img class="desktop-feature-art" src="${esc(asset(spotlight.cover || spotlight.gallery[0]?.image))}" alt="${esc(home.spotlightImageAlt)}"><img class="mobile-feature-art" src="${esc(asset(spotlight.gallery[0]?.image || spotlight.cover))}" alt="${esc(home.spotlightMobileImageAlt)}"><div class="feature-cover-copy"><span class="eyebrow">${esc(spotlightCategory?.featuredLabel || '')}${spotlight.year ? ` · ${esc(spotlight.year)}` : ''}</span><h3>${esc(spotlight.shortTitle)}</h3><p>${esc(spotlight.subtitle)}</p><span class="link-arrow">${esc(home.spotlightLink)} <span>↗</span></span></div></a><div class="chapter-ribbon"><span>${esc(home.spotlightRibbon)}</span><strong>${esc(portfolio.site.labels.projectIndex)} ${String(allProjects().indexOf(spotlight) + 1).padStart(2, '0')} / ${String(allProjects().length).padStart(2, '0')}</strong><span>${esc(home.spotlightLink).toUpperCase()} ↗</span></div></section>` : '';
  const categoryRows = categories.map((category, index) => `<a class="discipline-row" href="#${esc(category.slug)}"><span class="discipline-num">${String(index + 1).padStart(2, '0')}</span><h3>${esc(category.name)}</h3><p>${esc(category.featuredDescription)}</p><span class="row-arrow">↗</span></a>`).join('');
  return `<div class="page home-page">${renderFeaturedCarousel()}<section class="home-hero"><div class="hero-copy"><div class="hero-index">${esc(home.heroIndex)}</div><span class="eyebrow">${esc(home.heroKicker)}</span><h1>${titleMarkup(home.heroTitle, home.heroEmphasis)}</h1><p class="hero-intro">${esc(home.heroIntro)}</p><div class="hero-ctas"><a class="button-light" href="#${esc(personalCategory?.slug || 'about')}">${esc(home.heroPrimaryCta)} <span>↗</span></a><a class="link-arrow" href="#about">${esc(home.heroSecondaryCta)} <span>↗</span></a></div></div><figure class="hero-art"><img src="${esc(asset(home.heroImage))}" alt="${esc(home.heroImageAlt)}"></figure><span class="hero-side-note">${esc(home.heroSideNote)}</span><a class="hero-scroll" href="#statement">${esc(home.heroScrollLabel)}</a><span class="hero-orbit orbit-one" aria-hidden="true"></span><span class="hero-orbit orbit-two" aria-hidden="true"></span></section><section class="statement-band" id="statement"><div class="statement-top"><span>${esc(home.statementEyebrow)}</span><span>${esc(home.statementMeta)}</span></div><blockquote class="reveal">${esc(home.statement)}</blockquote><div class="statement-foot">${esc(home.statementFooter)}</div></section>${personalSection}${spotlightSection}<section class="dual-chapter"><div class="dual-chapter-head reveal"><div><span class="eyebrow">${esc(home.categorySummaryEyebrow)}</span><h2>${titleMarkup(home.categorySummaryTitle, home.categorySummaryEmphasis)}</h2></div><p>${esc(home.categorySummaryDescription)}</p></div><div class="discipline-list">${categoryRows}</div></section></div>`;
}

function renderArtworkCategory(category, categoryProjects) {
  const projectsForPage = categoryProjects;
  const selected = currentCategoryFilter === 'all' ? projectsForPage : projectsForPage.filter(project => project.id === currentCategoryFilter);
  const items = selected.flatMap(project => (project.gallery || []).map((image, index) => ({ project, ...image, index })));
  const total = projectsForPage.reduce((count, project) => count + (project.gallery || []).length, 0);
  const filterMarkup = projectsForPage.length > 1
    ? `<div class="filter-list"><button type="button" class="filter-btn ${currentCategoryFilter === 'all' ? 'active' : ''}" data-filter="all">${esc(category.filterLabel || 'ALL')} <span>${String(total).padStart(2, '0')}</span></button>${projectsForPage.map(project => `<button type="button" class="filter-btn ${currentCategoryFilter === project.id ? 'active' : ''}" data-filter="${esc(project.id)}">${esc(project.shortTitle)} <span>${String(project.gallery.length).padStart(2, '0')}</span></button>`).join('')}</div>`
    : `<div class="filter-list"><span class="filter-btn active static-filter">${esc(category.filterLabel || category.name)} <span>${String(total).padStart(2, '0')}</span></span>${category.secondaryFilterLabel ? `<span class="filter-btn static-filter">${esc(category.secondaryFilterLabel)}</span>` : ''}</div>`;
  return `<div class="page artworks-page ${category.id === 'personal' ? 'personal-artwork-page' : 'game-art-page'}"><section class="artworks-intro"><div><span class="eyebrow">${esc(category.pageEyebrow)} · ${String(total).padStart(2, '0')} ${esc(portfolio.site.labels.visuals)}</span><h1>${titleMarkup(category.pageTitle, category.pageEmphasis)}</h1></div><p>${esc(category.pageDescription)}</p></section><div class="artwork-controls">${filterMarkup}<span class="artwork-count"><b>${items.length}</b> / ${items.length} ${esc(portfolio.site.labels.visuals)}</span></div><section class="artwork-feature"><div class="artwork-feature-top"><span>${esc(category.collectionLabel || `${portfolio.site.labels.collection} / ${category.name.toUpperCase()}`)}</span><span>${esc(portfolio.site.labels.dragToExplore)}</span></div><div class="artwork-track-wrap"><div class="artwork-track" id="artworkTrack">${items.map((item, index) => `<figure class="artwork-slide" data-view-project="${esc(item.project.id)}" data-view-index="${item.index}" tabindex="0" role="button" aria-label="${esc(portfolio.site.labels.fullSize)}: ${esc(item.caption)}"><img src="${esc(asset(item.image))}" alt="${esc(item.project.shortTitle)} — ${esc(item.caption)}" loading="${index < 3 ? 'eager' : 'lazy'}"><figcaption>${esc(item.project.shortTitle).toUpperCase()} / ${esc(item.caption)}</figcaption><span class="slide-num">${String(index + 1).padStart(2, '0')} — ${String(items.length).padStart(2, '0')}</span></figure>`).join('')}</div></div><div class="artwork-track-bottom"><span>${esc(portfolio.site.labels.frameProgress)}</span><div class="artwork-progress"><span id="artProgress"></span></div><div class="art-track-nav"><button class="round-arrow" id="artPrev" aria-label="${esc(portfolio.site.labels.previous)}">←</button><button class="round-arrow" id="artNext" aria-label="${esc(portfolio.site.labels.next)}">→</button></div></div></section></div>`;
}

function renderProjectCategory(category, categoryProjects) {
  return `<div class="page dev-page"><section class="dev-intro"><div><span class="eyebrow">${esc(category.pageEyebrow)}</span><h1>${titleMarkup(category.pageTitle, category.pageEmphasis)}</h1></div><p>${esc(category.pageDescription)}</p></section><div class="dev-project-stack">${categoryProjects.length ? categoryProjects.map((project, index) => `<a class="dev-project" href="#project/${esc(project.id)}"><div class="dev-visual"><img src="${esc(asset(project.cover || project.gallery[0]?.image))}" alt="${esc(project.shortTitle)} project artwork"></div><div class="dev-copy" data-number="${String(index + 1).padStart(2, '0')}"><div><span class="dev-meta">${esc(project.year)} &nbsp; / &nbsp; ${esc(category.featuredLabel)}</span><h2>${esc(project.title)}</h2><p>${esc(project.description)}</p></div><div class="dev-project-link"><span>${esc(project.subtitle || project.role)}</span><span>↗</span></div></div></a>`).join('') : `<p>${esc(portfolio.site.labels.noProjects)}</p>`}</div></div>`;
}

function renderCategory(category) {
  const categoryProjects = visibleProjects(category.id);
  if (category.layout === 'project-list') return renderProjectCategory(category, categoryProjects);
  return renderArtworkCategory(category, categoryProjects);
}

function renderStorySection(project, section, sectionIndex) {
  const images = (section.images || []).filter(index => project.gallery[index]);
  const layout = section.layout || 'wide';
  const buttons = images.map(index => imageButton(project, index, layout === 'asset-strip' ? 'asset-image' : layout === 'paired' ? 'polri-board-image' : 'wide')).join('');
  if (layout === 'sequence') {
    return `<section class="cutscene-sequence"><div class="cutscene-heading"><span class="eyebrow">${esc(section.title)}</span><h2>${esc(section.subtitle || '')}</h2></div>${images.map((index, imageIndex) => `<div class="cutscene-frame"><span class="cutscene-index">${esc(portfolio.site.labels.visualSequence)} ${String(imageIndex + 1).padStart(2, '0')}</span>${imageButton(project, index, 'wide')}</div>`).join('')}</section>`;
  }
  const groupClass = layout === 'paired' ? 'polri-board-pair' : layout === 'asset-strip' ? 'case-study-images asset-strip' : 'case-study-images';
  return `<section class="story-plate ${sectionIndex % 2 ? 'midnight' : 'dark'}"><div class="story-plate-head"><span>${esc(section.title)}</span><span>${esc(section.subtitle || project.shortTitle)}</span></div><div class="${groupClass}">${buttons}</div></section>`;
}

function renderProject(id) {
  const project = allProjects().find(item => item.id === id && item.published !== false);
  if (!project) return `<div class="page project-page"><section class="project-opening"><div class="project-opening-copy"><h1>${esc(portfolio.site.labels.projectNotFound)}</h1></div></section></div>`;
  const category = categoryForProject(project);
  const projectList = visibleProjects(category?.id);
  const projectIndex = projectList.findIndex(item => item.id === project.id);
  const previous = projectList[(projectIndex - 1 + projectList.length) % projectList.length];
  const next = projectList[(projectIndex + 1) % projectList.length];
  const detail = project.detail || {};
  const labels = portfolio.site.labels;
  const facts = [
    [labels.year, project.year], [labels.role, project.role], [labels.discipline, category?.name],
    [project.contribution ? labels.contribution : labels.visuals, project.contribution || `${String(project.gallery.length).padStart(2, '0')} ${labels.selectedPieces}`]
  ].filter(([, value]) => value);
  const sections = detail.sections?.length ? detail.sections : [{ title: '01 / FEATURED VISUAL', subtitle: project.shortTitle, layout: 'wide', images: project.gallery.map((_, index) => index) }];
  const yearLabel = project.year ? ` · ${esc(project.year)}` : '';
  return `<div class="page project-page"><section class="project-opening"><img src="${esc(asset(project.cover || project.gallery[0]?.image))}" alt="${esc(project.title)} — featured artwork"><span class="project-opening-index">${esc(labels.projectIndex)} ${String(allProjects().indexOf(project) + 1).padStart(2, '0')} / ${String(allProjects().length).padStart(2, '0')}</span><div class="project-opening-copy"><span class="eyebrow">${esc(category?.featuredLabel || category?.name || '')}${yearLabel}</span><h1>${esc(project.shortTitle)}</h1><p>${esc(project.subtitle)}</p></div></section><div class="project-facts">${facts.map(([label, value]) => `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div><section class="project-narrative"><h2>${esc(detail.narrativeTitle || project.shortTitle)}</h2><p>${esc(detail.narrative || project.description)}</p></section>${sections.map((section, index) => renderStorySection(project, section, index)).join('')}<div class="project-end"><a href="#${esc(category?.slug || 'home')}"><span>←</span> ${esc(portfolio.site.labels.backToCategory)} · ${esc(category?.name || '')}</a>${projectList.length > 1 ? `<a href="#project/${esc(previous.id)}">${esc(portfolio.site.labels.previousProject)}</a><a href="#project/${esc(next.id)}">${esc(portfolio.site.labels.nextProject)} <span>↗</span></a>` : ''}</div></div>`;
}

function renderAbout() {
  const about = portfolio.site.about;
  const skills = about.skills.map(skill => `<span>${esc(skill)}</span>`).join('');
  const contactItems = (about.contacts || []).map(contact => `<a href="${esc(safeHref(contact.href))}" ${contact.newWindow ? 'target="_blank" rel="noreferrer"' : ''}>${esc(contact.value || contact.label)} <span>↗</span></a>`).join('');
  return `<div class="page about-page"><section class="about-opening"><figure class="about-image"><img src="${esc(asset(about.image))}" alt="${esc(about.imageAlt)}"><figcaption>${esc(portfolio.site.brandName)} / ${esc(portfolio.site.footerRole)}</figcaption></figure><div class="about-copy"><span class="eyebrow dark">${esc(about.eyebrow)}</span><h1>${titleMarkup(about.titleLine, about.titleEmphasis)}</h1><p class="lead">${esc(about.lead)}</p><p>${esc(about.paragraphOne)}</p><p>${esc(about.paragraphTwo)}</p></div></section><section class="skills-band"><h2>${esc(about.skillsTitle)}</h2><div class="skills-list">${skills}</div></section><section class="contact-band" id="contact"><div><span class="eyebrow dark">${esc(about.contactEyebrow)}</span><h2>${titleMarkup(about.contactTitle, about.contactEmphasis)}</h2></div><div class="contact-list">${contactItems}</div></section></div>`;
}

function setNav(page, projectId = '') {
  let active = page;
  if (page === 'project') active = categoryForProject(allProjects().find(item => item.id === projectId))?.slug || '';
  $$('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === active));
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

function render(page, id = '') {
  if (featuredCarouselCleanup) { featuredCarouselCleanup(); featuredCarouselCleanup = null; }
  const category = categories.find(item => item.slug === page);
  const validPage = category || ['home', 'about', 'project'].includes(page) ? page : 'home';
  setNav(validPage, id);
  if (validPage === 'home') app.innerHTML = renderHome();
  else if (validPage === 'about') app.innerHTML = renderAbout();
  else if (validPage === 'project') app.innerHTML = renderProject(id);
  else { currentCategoryFilter = 'all'; app.innerHTML = renderCategory(category); }
  const currentProject = validPage === 'project' ? allProjects().find(project => project.id === id) : null;
  if (currentProject) document.title = `${currentProject.title} — ${portfolio.site.brandName}`;
  else document.title = validPage === 'home' ? portfolio.site.title : `${category?.name || portfolio.site.about.navLabel} — ${portfolio.site.brandName}`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  observeReveals();
  if (category?.layout === 'artwork-rail') setupArtworkRail();
  if (validPage === 'home') featuredCarouselCleanup = setupFeaturedCarousel();
}

function route() {
  if (!portfolio) return;
  const raw = location.hash.replace(/^#/, '') || 'home';
  if (raw === 'statement') { requestAnimationFrame(() => $('#statement')?.scrollIntoView({ behavior: 'smooth' })); return; }
  if (raw === 'contact') { render('about'); requestAnimationFrame(() => $('#contact')?.scrollIntoView({ behavior: 'smooth' })); return; }
  const [page, id] = raw.split('/');
  render(page, id);
}

function observeReveals() {
  const elements = $$('.reveal');
  if (!('IntersectionObserver' in window)) { elements.forEach(element => element.classList.add('visible')); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: .13 });
  elements.forEach(element => observer.observe(element));
}

function setupFeaturedCarousel() {
  const root = $('#featuredPreview');
  const featured = featuredCategories();
  if (!root || !featured.length) return null;
  const stage = $('#featuredStage', root);
  const imageTrigger = $('#featuredImageTrigger', root);
  const image = $('#featuredImage', root);
  const categoryTabs = $$('.featured-category-tab', root);
  const title = $('#featuredTitle', root);
  const kicker = $('#featuredCategoryKicker', root);
  const description = $('#featuredDescription', root);
  const link = $('#featuredLink', root);
  const categoryCurrent = $('#featuredCategoryCurrent', root);
  const imageCurrent = $('#featuredImageCurrent', root);
  const imageTotal = $('#featuredImageTotal', root);
  const stageLabel = $('#featuredStageLabel', root);
  const previewHint = $('#featuredPreviewHint', root);
  const thumbnails = $('#featuredThumbnails', root);
  const pauseButton = $('#featuredPause', root);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = 5600;
  let categoryIndex = 0;
  let imageIndex = 0;
  let timer = null;
  let deadline = 0;
  let remaining = duration;
  let manuallyPaused = reducedMotion;
  let hoverPaused = false;
  let focusPaused = false;
  let pointerStart = null;
  let activeCategory = featured[0];
  const isPaused = () => manuallyPaused || hoverPaused || focusPaused || document.hidden || reducedMotion;
  const stopTimer = () => { if (timer) { clearTimeout(timer); timer = null; remaining = Math.max(0, deadline - Date.now()); } };
  const schedule = () => { if (!isPaused() && !timer) { deadline = Date.now() + remaining; timer = setTimeout(() => { timer = null; remaining = duration; showImage(imageIndex + 1); }, remaining); } };
  const syncPause = () => {
    const paused = isPaused(); root.classList.toggle('is-paused', paused);
    if (paused) stopTimer(); else schedule();
    pauseButton.innerHTML = manuallyPaused ? `▶ <span>${esc(portfolio.site.labels.play)}</span>` : `Ⅱ <span>${esc(portfolio.site.labels.pause)}</span>`;
    pauseButton.setAttribute('aria-label', manuallyPaused ? portfolio.site.labels.play : portfolio.site.labels.pause);
  };
  function renderThumbnails() {
    const items = activeCategory.items;
    const count = Math.min(5, items.length);
    const start = Math.max(0, Math.min(imageIndex - 2, items.length - count));
    thumbnails.innerHTML = items.slice(start, start + count).map((item, offset) => {
      const actual = start + offset; const active = actual === imageIndex;
      return `<button type="button" class="featured-thumb ${active ? 'is-active' : ''}" data-inner-index="${actual}" aria-label="Show image ${actual + 1}: ${esc(item.caption)}" aria-pressed="${active}"><img src="${esc(asset(item.image))}" alt="" loading="lazy"><span>${String(actual + 1).padStart(2, '0')}</span></button>`;
    }).join('');
  }
  function showImage(next, resetTimer = true) {
    const items = activeCategory.items; imageIndex = (next + items.length) % items.length;
    const item = items[imageIndex];
    imageTrigger.dataset.viewProject = item.projectId; imageTrigger.dataset.viewIndex = String(item.index);
    imageTrigger.setAttribute('aria-label', `${portfolio.site.labels.fullSize}: ${item.projectName} — ${item.caption}`);
    image.alt = `${item.projectName} — ${item.caption}`; image.classList.remove('image-change'); image.src = asset(item.image); void image.offsetWidth; image.classList.add('image-change');
    imageCurrent.textContent = String(imageIndex + 1).padStart(2, '0'); imageTotal.textContent = String(items.length).padStart(2, '0');
    stageLabel.textContent = `${item.projectName} / ${item.caption}`; renderThumbnails();
    if (resetTimer) { stopTimer(); remaining = duration; schedule(); }
  }
  function showCategory(next) {
    categoryIndex = (next + featured.length) % featured.length; activeCategory = featured[categoryIndex];
    categoryTabs.forEach((tab, index) => { const active = index === categoryIndex; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    kicker.textContent = activeCategory.featuredKicker; title.innerHTML = titleMarkup(activeCategory.featuredTitle, activeCategory.featuredEmphasis);
    description.textContent = activeCategory.featuredDescription; link.href = `#${activeCategory.slug}`; link.innerHTML = `${esc(activeCategory.featuredCta)} <span>↗</span>`;
  categoryCurrent.textContent = String(categoryIndex + 1).padStart(2, '0'); previewHint.textContent = `${portfolio.site.labels.browseWorksPrefix} ${activeCategory.items.length} ${portfolio.site.labels.browseWorksSuffix}`;
    root.dataset.activeCategory = activeCategory.id; showImage(0);
  }
  $('#featuredCategoryPrev', root).addEventListener('click', () => showCategory(categoryIndex - 1));
  $('#featuredCategoryNext', root).addEventListener('click', () => showCategory(categoryIndex + 1));
  categoryTabs.forEach(tab => tab.addEventListener('click', () => showCategory(Number(tab.dataset.categoryIndex))));
  $('#featuredImagePrev', root).addEventListener('click', () => showImage(imageIndex - 1));
  $('#featuredImageNext', root).addEventListener('click', () => showImage(imageIndex + 1));
  thumbnails.addEventListener('click', event => { const button = event.target.closest('[data-inner-index]'); if (button) showImage(Number(button.dataset.innerIndex)); });
  pauseButton.addEventListener('click', () => { manuallyPaused = !manuallyPaused; if (!manuallyPaused) focusPaused = false; syncPause(); });
  root.addEventListener('pointerenter', () => { hoverPaused = true; syncPause(); });
  root.addEventListener('pointerleave', () => { hoverPaused = false; syncPause(); });
  root.addEventListener('focusin', () => { focusPaused = true; syncPause(); });
  root.addEventListener('focusout', () => requestAnimationFrame(() => { focusPaused = root.contains(document.activeElement); syncPause(); }));
  const visibilityHandler = () => syncPause(); document.addEventListener('visibilitychange', visibilityHandler);
  stage.addEventListener('pointerdown', event => { if (!event.target.closest('button:not(#featuredImageTrigger)')) pointerStart = { x: event.clientX, y: event.clientY }; }, { passive: true });
  stage.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x; const dy = event.clientY - pointerStart.y; pointerStart = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15) { suppressFeaturedClick = true; showImage(imageIndex + (dx < 0 ? 1 : -1)); setTimeout(() => suppressFeaturedClick = false, 350); }
  }, { passive: true });
  stage.addEventListener('pointercancel', () => { pointerStart = null; }, { passive: true });
  stage.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(imageIndex - 1); } if (event.key === 'ArrowRight') { event.preventDefault(); showImage(imageIndex + 1); } });
  categoryTabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1; const next = (index + direction + featured.length) % featured.length; showCategory(next); categoryTabs[next].focus(); }
  }));
  showCategory(0); syncPause();
  return () => { stopTimer(); document.removeEventListener('visibilitychange', visibilityHandler); };
}

function setupArtworkRail() {
  const track = $('#artworkTrack'); if (!track) return;
  const progress = $('#artProgress');
  const update = () => { const max = track.scrollWidth - track.clientWidth; const ratio = max > 0 ? track.scrollLeft / max : 0; progress.style.width = `${Math.max(8, ratio * 100)}%`; };
  track.addEventListener('scroll', update, { passive: true }); update();
  $('#artPrev').addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * .78, behavior: 'smooth' }));
  $('#artNext').addEventListener('click', () => track.scrollBy({ left: track.clientWidth * .78, behavior: 'smooth' }));
  let down = false; let startX = 0; let scrollLeft = 0;
  track.addEventListener('pointerdown', event => { down = true; startX = event.clientX; scrollLeft = track.scrollLeft; track.classList.add('dragging'); track.setPointerCapture(event.pointerId); });
  track.addEventListener('pointermove', event => { if (!down) return; if (Math.abs(event.clientX - startX) > 5) suppressRailClick = true; track.scrollLeft = scrollLeft - (event.clientX - startX); });
  const end = () => { down = false; track.classList.remove('dragging'); if (suppressRailClick) setTimeout(() => suppressRailClick = false, 140); };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end); track.addEventListener('pointerleave', end);
}

function openViewer(projectId, index) {
  const project = allProjects().find(item => item.id === projectId); if (!project) return;
  viewerCollection = project.gallery.map(image => ({ src: asset(image.image), caption: image.caption, alt: `${project.shortTitle} — ${image.caption}` }));
  viewerIndex = Math.max(0, Math.min(index, viewerCollection.length - 1)); updateViewer(); viewer.classList.add('open'); viewer.setAttribute('aria-hidden', 'false'); document.body.classList.add('locked');
}
function updateViewer() { const item = viewerCollection[viewerIndex]; if (!item) return; viewerImage.src = item.src; viewerImage.alt = item.alt; viewerCaption.textContent = `${item.caption} · ${viewerIndex + 1} / ${viewerCollection.length}`; }
function closeViewer() { viewer.classList.remove('open'); viewer.setAttribute('aria-hidden', 'true'); document.body.classList.remove('locked'); }
function stepViewer(direction) { if (!viewerCollection.length) return; viewerIndex = (viewerIndex + direction + viewerCollection.length) % viewerCollection.length; updateViewer(); }

app.addEventListener('click', event => {
  const filter = event.target.closest('[data-filter]');
  if (filter) { currentCategoryFilter = filter.dataset.filter; const category = categories.find(item => item.slug === location.hash.slice(1)); app.innerHTML = renderCategory(category); setupArtworkRail(); return; }
  const image = event.target.closest('[data-view-project]');
  if (image) { if (suppressRailClick || suppressFeaturedClick) { event.preventDefault(); return; } openViewer(image.dataset.viewProject, Number(image.dataset.viewIndex)); }
});
app.addEventListener('keydown', event => { const image = event.target.closest('[data-view-project][role="button"]'); if (image && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openViewer(image.dataset.viewProject, Number(image.dataset.viewIndex)); } });
menuToggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); });
nav.addEventListener('click', event => { if (event.target.closest('a')) { nav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); } });
$('#viewerClose').addEventListener('click', closeViewer); $('#viewerPrev').addEventListener('click', () => stepViewer(-1)); $('#viewerNext').addEventListener('click', () => stepViewer(1));
viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); });
document.addEventListener('keydown', event => { if (!viewer.classList.contains('open')) return; if (event.key === 'Escape') closeViewer(); if (event.key === 'ArrowLeft') stepViewer(-1); if (event.key === 'ArrowRight') stepViewer(1); });
window.addEventListener('hashchange', route);
window.addEventListener('scroll', () => $('#siteHeader').classList.toggle('scrolled', window.scrollY > 25), { passive: true });

function renderPortfolioData(data) {
  if (!data?.site || !Array.isArray(data.categories) || !Array.isArray(data.projects)) return;
  portfolio = data;
  categories = data.categories;
  updateChrome();
  route();
}

window.addEventListener('message', event => {
  if (!adminPreviewMode || event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'portfolio-admin-preview') return;
  adminPreviewDataReceived = true;
  previewAssetOverrides = event.data.assets && typeof event.data.assets === 'object' ? event.data.assets : {};
  renderPortfolioData(event.data.content);
});

fetch(`portfolio-content.json?v=${Date.now()}`, { cache: 'no-store' })
  .then(response => { if (!response.ok) throw new Error('Konten portofolio tidak dapat dimuat.'); return response.json(); })
  .then(data => {
    if (!adminPreviewDataReceived) renderPortfolioData(data);
  })
  .catch(error => { if (adminPreviewDataReceived) return; console.error(error); app.innerHTML = '<section class="page"><p>Konten portofolio belum dapat dimuat. Muat ulang halaman beberapa saat lagi.</p></section>'; });

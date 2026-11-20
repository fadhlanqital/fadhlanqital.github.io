const projects = [
  {
    id:'personal-artworks', title:'Personal Artwork', shortTitle:'Personal Artwork', category:'personal', year:'', role:'Personal Artwork',
    subtitle:'Personal illustration · Independent Study · Visual exploration',
    description:'A combined collection of personal projects and environment illustrations from the Independent Study Program under the Kampus Merdeka Initiative.',
    cover:'study-05', gallery:[
      ['personal-01','Personal Artwork 01'],['personal-02','Personal Artwork 02'],['personal-03','Personal Artwork 03'],['personal-04','Personal Artwork 04'],['personal-05','Personal Artwork 05'],['personal-06','Personal Artwork 06'],['personal-07','Personal Artwork 07'],['personal-08','Personal Artwork 08'],
      ['study-01','Independent Study — Forest Study 01'],['study-02','Independent Study — Forest Study 02'],['study-03','Independent Study — Forest Study 03'],['study-04','Independent Study — Forest Study 04'],['study-05','Independent Study — Forest Study 05']
    ]
  },
  {
    id:'anima', title:'Anima: The Fallen Heroes & Mystic Forest', shortTitle:'Anima', category:'game-art', year:'2024', role:'Game Artist / Illustrator',
    subtitle:'Character concept · Sprite assets · Gameplay · Cutscenes',
    description:'Selected visual work for Anima: The Fallen Heroes & Mystic Forest, including character concept art, sprite character assets, gameplay visuals and cutscene illustrations.',
    cover:'anima-forest-art', gallery:[
      ['anima-forest-art','Mystic forest environment'],['anima-wide','Environment artwork'],['anima-character','Character concept'],['anima-sprite-01','Sprite character asset'],['anima-sprite-02','Sprite character asset'],['anima-sprite-03','Sprite animation sheet'],['anima-sprite-04','Sprite animation sheet'],['anima-sprite-05','Character sprite'],['anima-sprite-06','Character sprite'],['anima-sprite-07','Character sprite'],['anima-gameplay','Gameplay'],['anima-cutscene-01','Cutscene illustration'],['anima-cutscene-02','Cutscene illustration'],['anima-cutscene-03','Cutscene illustration'],['anima-cutscene-04','Cutscene illustration'],['anima-cutscene-05','Cutscene illustration'],['anima-divider','Game visual artwork']
    ]
  },
  {
    id:'polri-quiz', title:'POLRI Quiz Game', shortTitle:'POLRI Quiz Game', category:'game-art', year:'2025', role:'Game Artist / Illustrator / Animator', subtitle:'Company project · Prototype',
    description:'Visual and animation asset contributions for the POLRI Quiz Game prototype, presented through character artwork and animation asset boards.', cover:'polri-01', gallery:[
      ['polri-01','Character animation asset'],['polri-02','Character animation asset'],['polri-03','Animation sprite sheet'],['polri-04','Animation sprite sheet'],['polri-05','Character animation asset'],['polri-06','Character animation asset'],['polri-07','Animation sprite sheet'],['polri-08','Animation sprite sheet']
    ]
  },
  {
    id:'paranoia', title:'Paranoia Activity', shortTitle:'Paranoia Activity', category:'development', year:'2024', role:'Game Developer', contribution:'Overall game development', subtitle:'Personal project',
    description:'A personal game development project. Fadhlan’s role covered overall game development. The portfolio presents the title screen and selected first-person gameplay views.', cover:'paranoia-01', gallery:[
      ['paranoia-01','Gameplay environment'],['paranoia-02','Gameplay screen'],['paranoia-03','Game title screen'],['paranoia-04','Game environment'],['paranoia-05','Gameplay detail'],['paranoia-06','Gameplay detail'],['paranoia-07','Game visual']
    ]
  },
  {
    id:'digitrix', title:'Digtrix', shortTitle:'Digtrix', category:'development', year:'2025', role:'Game Developer', contribution:'Overall game development', subtitle:'Company project · Available on Play Store',
    description:'A company game project presented in the portfolio as available on the Play Store. Fadhlan contributed to the overall game development. The showcase includes the game identity, menu and selected numerical puzzle gameplay screens.', cover:'digitrix-05', gallery:[
      ['digitrix-01','Game screen'],['digitrix-02','Game screen'],['digitrix-03','Game screen'],['digitrix-04','Game logo and interface'],['digitrix-05','Game interface overview']
    ]
  },
  {
    id:'matakata', title:'MataKata', shortTitle:'MataKata', category:'development', year:'2025', role:'Game Developer', contribution:'Overall game development', subtitle:'Company project · Available on Play Store',
    description:'A company game project listed in the original portfolio as available on the Play Store. Fadhlan contributed to the overall game development. The showcase includes the game identity, menu and selected word puzzle gameplay screens.', cover:'matakata-04', gallery:[
      ['matakata-01','Game logo'],['matakata-02','Gameplay interface'],['matakata-03','Game title screen'],['matakata-04','Game interface overview'],['matakata-05','Gameplay screen']
    ]
  }
];
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const asset = name => `assets/${name}.webp`;
const app = $('#app');
const nav = $('#mainNav');
const menuToggle = $('#menuToggle');
const viewer = $('#viewer');
const viewerImage = $('#viewerImage');
const viewerCaption = $('#viewerCaption');
let currentGameArtFilter='all';
let viewerCollection=[];
let viewerIndex=0;
let artRailItems=[];
let suppressRailClick=false;
let suppressFeaturedClick=false;
let featuredCarouselCleanup=null;

const personalProject=projects.find(p=>p.id==='personal-artworks');
const personalArtworks=personalProject.gallery;
const gameArtProjects=projects.filter(p=>p.category==='game-art');
const devProjects=projects.filter(p=>p.category==='development');
const totalPersonalArtworks=personalArtworks.length;
const totalGameArtworks=gameArtProjects.reduce((n,p)=>n+p.gallery.length,0);

// Three featured disciplines. Each category contains its own independent image carousel.
const featuredCategories = [
  {
    id:'personal-artwork',
    label:'PERSONAL ARTWORK',
    kicker:'01 / PERSONAL COLLECTION',
    title:'Personal<br><em>Artwork.</em>',
    description:'Personal illustrations, sketchbook explorations and selected environment studies from the Independent Study Program.',
    cta:'EXPLORE PERSONAL ARTWORK',
    href:'#personal-artwork',
    projectIds:['personal-artworks']
  },
  {
    id:'game-art',
    label:'2D GAME ART',
    kicker:'02 / GAME ART & ILLUSTRATION',
    title:'2D Game<br><em>Artist.</em>',
    description:'Character concepts, 2D game assets, sprite animation and cutscene artwork from Anima and POLRI Quiz Game.',
    cta:'EXPLORE GAME ART',
    href:'#game-art',
    projectIds:['anima','polri-quiz']
  },
  {
    id:'game-development',
    label:'GAME DEVELOPMENT',
    kicker:'03 / INTERACTIVE PROJECTS',
    title:'Game<br><em>Development.</em>',
    description:'Selected gameplay screens and interface previews from Paranoia Activity, Digtrix and MataKata.',
    cta:'EXPLORE GAME PROJECTS',
    href:'#game-development',
    projectIds:['paranoia','digitrix','matakata']
  }
].map(category => ({
  ...category,
  items: category.projectIds.flatMap(projectId => {
    const project = projects.find(p => p.id === projectId);
    return project.gallery.map(([image, caption], index) => ({
      image, caption, index, projectId,
      projectName: project.shortTitle,
      year: project.year
    }));
  })
}));

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function catLabel(p){return p.category==='personal'?'PERSONAL ARTWORK':p.category==='game-art'?'2D GAME ART':'GAME DEVELOPMENT';}
function imageButton(project,index,extra=''){
  const [name,caption]=project.gallery[index];
  return `<button class="story-image ${extra}" type="button" data-view-project="${project.id}" data-view-index="${index}" aria-label="View ${esc(caption)}"><img src="${asset(name)}" alt="${esc(project.shortTitle)} — ${esc(caption)}" loading="lazy"></button>`;
}
function go(hash){location.hash=hash;}
function setNav(page){
  let activePage=page;
  if(page==='project'){
    const project=projects.find(p=>p.id===location.hash.split('/')[1]);
    activePage=project?.category==='development'?'game-development':project?.category==='game-art'?'game-art':'personal-artwork';
  }
  $$('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===activePage));
  nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');
}

function renderFeaturedCarousel(){
  const category = featuredCategories[0];
  const item = category.items[0];
  const thumbnails = category.items.slice(0,5);
  return `<section class="featured-preview" id="featuredPreview" aria-label="Featured portfolio categories">
    <div class="featured-preview-top">
      <span>FQ / FEATURED DISCIPLINES</span>
      <span>THREE WORLDS · ONE PORTFOLIO</span>
    </div>

    <div class="featured-category-nav" id="featuredCategoryNav" role="tablist" aria-label="Choose portfolio category">
      ${featuredCategories.map((cat,i)=>`<button type="button" class="featured-category-tab ${i===0?'is-active':''}" data-category-index="${i}" role="tab" aria-selected="${i===0?'true':'false'}" tabindex="${i===0?'0':'-1'}"><span class="featured-category-num">0${i+1}</span><span class="featured-category-name">${esc(cat.label)}</span><span class="featured-category-count">${cat.items.length} WORKS</span></button>`).join('')}
    </div>

    <div class="featured-preview-main">
      <div class="featured-preview-copy" aria-live="polite" aria-atomic="true">
        <span class="eyebrow" id="featuredCategoryKicker">${esc(category.kicker)}</span>
        <h2 id="featuredTitle">${category.title}</h2>
        <p id="featuredDescription">${esc(category.description)}</p>
        <a class="featured-cta" id="featuredLink" href="${category.href}">${esc(category.cta)} <span>↗</span></a>
        <div class="featured-category-controls" aria-label="Category navigation">
          <button class="featured-arrow" id="featuredCategoryPrev" type="button" aria-label="Previous category">←</button>
          <span class="featured-counter"><b id="featuredCategoryCurrent">01</b><i>/</i> <span>03</span></span>
          <button class="featured-arrow" id="featuredCategoryNext" type="button" aria-label="Next category">→</button>
        </div>
      </div>

      <div class="featured-preview-stage" id="featuredStage" aria-label="Artwork previews. Use arrows or swipe to browse images.">
        <span class="featured-stage-ornament" aria-hidden="true">FQ.</span>
        <div class="featured-stage-halo" aria-hidden="true"></div>
        <button class="featured-image-trigger" id="featuredImageTrigger" type="button" data-view-project="${item.projectId}" data-view-index="${item.index}" aria-label="View ${esc(item.caption)} full size">
          <img id="featuredImage" src="${asset(item.image)}" alt="${esc(item.projectName)} — ${esc(item.caption)}" draggable="false" fetchpriority="high">
        </button>
        <button class="featured-arrow featured-inner-arrow featured-inner-prev" id="featuredImagePrev" type="button" aria-label="Previous image">←</button>
        <button class="featured-arrow featured-inner-arrow featured-inner-next" id="featuredImageNext" type="button" aria-label="Next image">→</button>
        <div class="featured-stage-foot"><span id="featuredStageLabel">${esc(item.projectName)} / ${esc(item.caption)}</span><span><b id="featuredImageCurrent">01</b> — <span id="featuredImageTotal">${String(category.items.length).padStart(2,'0')}</span></span></div>
        <span class="featured-image-hint">CLICK IMAGE TO VIEW FULL SIZE ↗</span>
      </div>
    </div>

    <div class="featured-preview-bottom">
      <div class="featured-preview-caption"><span>IMAGE PREVIEW</span><span id="featuredPreviewHint">BROWSE ${category.items.length} WORKS IN THIS CATEGORY</span></div>
      <div class="featured-thumbnails" id="featuredThumbnails" role="group" aria-label="Choose artwork preview">
        ${thumbnails.map((thumb,i)=>`<button type="button" class="featured-thumb ${i===0?'is-active':''}" data-inner-index="${i}" aria-label="Show image ${i+1}: ${esc(thumb.caption)}" aria-pressed="${i===0?'true':'false'}"><img src="${asset(thumb.image)}" alt="" loading="lazy"><span>0${i+1}</span></button>`).join('')}
      </div>
      <div class="featured-image-autoplay">
        <span class="featured-autoplay-note"><span class="autoplay-dot"></span> IMAGE PREVIEW</span>
        <button class="featured-pause" id="featuredPause" type="button" aria-label="Pause image preview">Ⅱ <span>PAUSE</span></button>
      </div>
    </div>
  </section>`;
}

function renderHome(){
  const personal=projects.find(p=>p.id==='personal-artworks');
  const anima=projects.find(p=>p.id==='anima');
  return `<div class="page home-page">
    ${renderFeaturedCarousel()}
    <section class="home-hero">
      <div class="hero-copy">
        <div class="hero-index">PORTFOLIO 2025—2026 <span>·</span> INDONESIA</div>
        <span class="eyebrow">2D ARTIST & GAME DEVELOPER</span>
        <h1>Worlds beyond<br><em>the familiar.</em></h1>
        <p class="hero-intro">I'm Fadhlan Qital. I create illustrations, 2D game assets and interactive experiences, drawn to surreal ideas, atmospheric spaces and expressive visual storytelling.</p>
        <div class="hero-ctas"><a class="button-light" href="#personal-artwork">Explore personal artwork <span>↗</span></a><a class="link-arrow" href="#about">Meet the artist <span>↗</span></a></div>
      </div>
      <figure class="hero-art"><img src="${asset('hero-portrait')}" alt="Original illustrated character artwork by Fadhlan Qital"></figure>
      <span class="hero-side-note">A PERSONAL COLLECTION OF ART & INTERACTIVE WORLDS</span>
      <a class="hero-scroll" href="#statement">SCROLL TO EXPLORE</a>
      <span class="hero-orbit orbit-one" aria-hidden="true"></span><span class="hero-orbit orbit-two" aria-hidden="true"></span>
    </section>

    <section class="statement-band" id="statement">
      <div class="statement-top"><span>01 / CREATIVE PRACTICE</span><span>REALITY × IMAGINATION</span></div>
      <blockquote class="reveal">Art, atmosphere &amp; <em>worlds beyond the familiar.</em></blockquote>
      <div class="statement-foot">PERSONAL ARTWORK · GAME ART · GAME DEVELOPMENT</div>
    </section>

    <section class="personal-chapter">
      <div class="personal-heading reveal"><div><span class="eyebrow">02 / FIRST COLLECTION · 13 VISUALS</span><h2>Personal<br><em>Artwork.</em></h2></div><p>Personal illustrations, sketchbook explorations and environment studies — including selected work from the Independent Study Program.</p></div>
      <div class="personal-composition">
        <a class="personal-main-visual" href="#personal-artwork" aria-label="Explore Personal Artwork collection"><img src="${asset('study-05')}" alt="Dark forest environment illustration from the Personal Artwork collection"><span class="visual-corner">ENTER COLLECTION ↗</span></a>
        <div class="personal-side-visuals">
          ${imageButton(personal,3,'personal-sketch')}
          ${imageButton(personal,10,'personal-study')}
          <div class="personal-side-copy"><span class="micro">PERSONAL COLLECTION</span><h3>Fragments of<br><em>other worlds.</em></h3><a class="link-arrow" href="#personal-artwork">View all personal artwork <span>↗</span></a></div>
        </div>
      </div>
      <div class="personal-foot"><span>PERSONAL ILLUSTRATION · SKETCHBOOK · INDEPENDENT STUDY</span><a href="#personal-artwork">OPEN PERSONAL ARTWORK ↗</a></div>
    </section>

    <section class="feature-chapter">
      <div class="chapter-head reveal"><div><span class="eyebrow">03 / 2D GAME ART</span><h2>A world to<br><em>step into.</em></h2></div><p>Visual work for Anima: The Fallen Heroes & Mystic Forest — from environment artwork to characters, assets and cutscenes.</p></div>
      <a class="feature-cover" href="#project/anima" aria-label="Explore Anima project"><img class="desktop-feature-art" src="${asset('anima-wide')}" alt="Anima — environment artwork"><img class="mobile-feature-art" src="${asset('anima-forest-art')}" alt="Anima — forest artwork"><div class="feature-cover-copy"><span class="eyebrow">2D GAME ART · 2024</span><h3>ANIMA</h3><p>The Fallen Heroes & Mystic Forest</p><span class="link-arrow">Explore project <span>↗</span></span></div></a>
      <div class="chapter-ribbon"><span>CHARACTER · SPRITE · GAMEPLAY · CUTSCENE</span><strong>PROJECT 02 / 06</strong><span>VIEW CASE STUDY ↗</span></div>
    </section>

    <section class="dual-chapter">
      <div class="dual-chapter-head reveal"><div><span class="eyebrow">04 / THREE CREATIVE DISCIPLINES</span><h2>Three paths,<br><em>one visual world.</em></h2></div><p>Explore each side of the portfolio separately: personal expression, production-ready 2D game art, and interactive game development.</p></div>
      <div class="discipline-list">
        <a class="discipline-row" href="#personal-artwork"><span class="discipline-num">01</span><h3>Personal<br>Artwork</h3><p>Personal illustrations, sketchbook explorations and Independent Study environment artwork.</p><span class="row-arrow">↗</span></a>
        <a class="discipline-row" href="#game-art"><span class="discipline-num">02</span><h3>2D Game<br>Art</h3><p>Character concepts, sprite assets, animation and cutscene artwork from Anima and POLRI Quiz Game.</p><span class="row-arrow">↗</span></a>
        <a class="discipline-row" href="#game-development"><span class="discipline-num">03</span><h3>Game<br>Development</h3><p>Paranoia Activity, Digtrix and MataKata — gameplay screens and interface previews.</p><span class="row-arrow">↗</span></a>
      </div>
    </section>
  </div>`;
}
function renderPersonalArtwork(){
  const project=personalProject;
  const items=project.gallery.map(([image,caption],index)=>({project,image,caption,index}));
  artRailItems=items;
  return `<div class="page artworks-page personal-artwork-page">
    <section class="artworks-intro"><div><span class="eyebrow">01 / PERSONAL COLLECTION · ${String(items.length).padStart(2,'0')} VISUALS</span><h1>Personal<br><em>Artwork.</em></h1></div><p>Personal illustrations, sketchbook explorations and selected environment studies from the Independent Study Program. A collection of visual experiments and worlds shaped by personal curiosity.</p></section>
    <div class="artwork-controls"><div class="filter-list"><span class="filter-btn active static-filter">PERSONAL ARTWORK <span>${String(items.length).padStart(2,'0')}</span></span><span class="filter-btn static-filter">INDEPENDENT STUDY INCLUDED</span></div><span class="artwork-count"><b>${items.length}</b> / ${items.length} VISUALS</span></div>
    <section class="artwork-feature">
      <div class="artwork-feature-top"><span>COLLECTION / PERSONAL ARTWORK</span><span>DRAG OR SCROLL TO EXPLORE →</span></div>
      <div class="artwork-track-wrap"><div class="artwork-track" id="artworkTrack">${items.map((item,i)=>`<figure class="artwork-slide" data-view-project="${item.project.id}" data-view-index="${item.index}" tabindex="0" role="button" aria-label="View ${esc(item.caption)}"><img src="${asset(item.image)}" alt="${esc(item.project.shortTitle)} — ${esc(item.caption)}" loading="${i<3?'eager':'lazy'}"><figcaption>PERSONAL ARTWORK / ${esc(item.caption)}</figcaption><span class="slide-num">${String(i+1).padStart(2,'0')} — ${String(items.length).padStart(2,'0')}</span></figure>`).join('')}</div></div>
      <div class="artwork-bottom"><span>ONE FRAME AT A TIME</span><div class="artwork-progress"><span id="artProgress"></span></div><div class="art-track-nav"><button class="round-arrow" id="artPrev" aria-label="Previous artwork">←</button><button class="round-arrow" id="artNext" aria-label="Next artwork">→</button></div></div>
    </section>
  </div>`;
}
function renderGameArt(){
  const items=gameArtProjects.flatMap(project=>project.gallery.map(([image,caption],index)=>({project,image,caption,index})));
  const filtered=currentGameArtFilter==='all'?items:items.filter(item=>item.project.id===currentGameArtFilter);
  artRailItems=filtered;
  const filters=[
    {id:'all',label:'All 2D Game Art',count:totalGameArtworks},
    ...gameArtProjects.map(project=>({id:project.id,label:project.shortTitle,count:project.gallery.length}))
  ];
  const currentProject=gameArtProjects.find(project=>project.id===currentGameArtFilter);
  return `<div class="page artworks-page game-art-page">
    <section class="artworks-intro"><div><span class="eyebrow">02 / GAME ART COLLECTION · ${String(totalGameArtworks).padStart(2,'0')} VISUALS</span><h1>2D Game<br><em>Art.</em></h1></div><p>Artwork created for interactive projects: character concepts, environment visuals, sprite assets, animation and cutscene illustrations. Explore work from Anima and the POLRI Quiz Game prototype.</p></section>
    <div class="artwork-controls"><div class="filter-list">${filters.map(filter=>`<button type="button" class="filter-btn ${currentGameArtFilter===filter.id?'active':''}" data-filter="${filter.id}" aria-pressed="${currentGameArtFilter===filter.id}">${esc(filter.label)} <span>${String(filter.count).padStart(2,'0')}</span></button>`).join('')}</div><span class="artwork-count"><b>${filtered.length}</b> / ${totalGameArtworks} VISUALS</span></div>
    <section class="artwork-feature">
      <div class="artwork-feature-top"><span>COLLECTION / ${currentProject?esc(currentProject.shortTitle.toUpperCase()):'ALL 2D GAME ART'}</span><span>DRAG OR SCROLL TO EXPLORE →</span></div>
      <div class="artwork-track-wrap"><div class="artwork-track" id="artworkTrack">${filtered.map((item,i)=>`<figure class="artwork-slide" data-view-project="${item.project.id}" data-view-index="${item.index}" tabindex="0" role="button" aria-label="View ${esc(item.caption)}"><img src="${asset(item.image)}" alt="${esc(item.project.shortTitle)} — ${esc(item.caption)}" loading="${i<3?'eager':'lazy'}"><figcaption>${esc(item.project.shortTitle)} / ${esc(item.caption)}</figcaption><span class="slide-num">${String(i+1).padStart(2,'0')} — ${String(filtered.length).padStart(2,'0')}</span></figure>`).join('')}</div></div>
      <div class="artwork-bottom"><span>ONE FRAME AT A TIME</span><div class="artwork-progress"><span id="artProgress"></span></div><div class="art-track-nav"><button class="round-arrow" id="artPrev" aria-label="Previous artwork">←</button><button class="round-arrow" id="artNext" aria-label="Next artwork">→</button></div></div>
    </section>
    <section class="game-art-project-links"><div class="chapter-head reveal"><div><span class="eyebrow">PROJECT INDEX</span><h2>Art made<br><em>for worlds.</em></h2></div><p>Explore the complete visual contribution to each game project.</p></div><div class="discipline-list">${gameArtProjects.map((project,i)=>`<a class="discipline-row" href="#project/${project.id}"><span class="discipline-num">0${i+1}</span><h3>${esc(project.shortTitle)}</h3><p>${esc(project.subtitle)} · ${project.gallery.length} visuals</p><span class="row-arrow">↗</span></a>`).join('')}</div></section>
  </div>`;
}
function renderGameDevelopment(){
  return `<div class="page dev-page">
    <section class="dev-intro"><div><span class="eyebrow">03 / INTERACTIVE PROJECTS</span><h1>From idea<br>to <em>play.</em></h1></div><p>Personal and company game projects developed by Fadhlan. Each case study presents selected game screens, gameplay views and interface visuals.</p></section>
    <div class="dev-project-stack">${devProjects.map((p,i)=>`<a class="dev-project" href="#project/${p.id}"><div class="dev-visual"><img src="${asset(p.cover)}" alt="${esc(p.shortTitle)} project artwork"></div><div class="dev-copy" data-number="0${i+1}"><div><span class="dev-meta">${p.year} &nbsp; / &nbsp; GAME DEVELOPMENT</span><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p></div><div class="dev-project-link"><span>${esc(p.subtitle)} · Overall Game Development</span><span>↗</span></div></div></a>`).join('')}</div>
  </div>`;
}
function renderProject(id){
  const p=projects.find(x=>x.id===id)||projects[0];
  const pi=projects.indexOf(p),prev=projects[(pi-1+projects.length)%projects.length],next=projects[(pi+1)%projects.length];
  const g=p.gallery;
  const isPersonal=p.category==='personal';
  const hero=p.id==='anima'?'anima-forest-art':p.cover;
  const portraitCover=['digitrix','matakata'].includes(p.id);
  const yearLabel=p.year?` · ${esc(p.year)}`:'';
  const facts = isPersonal
    ? `<div class="fact"><span>COLLECTION</span><strong>Personal Artwork</strong></div><div class="fact"><span>CONTENT</span><strong>Personal projects & Independent Study</strong></div><div class="fact"><span>VISUALS</span><strong>${String(g.length).padStart(2,'0')} selected pieces</strong></div>`
    : `<div class="fact"><span>YEAR</span><strong>${esc(p.year)}</strong></div><div class="fact"><span>ROLE</span><strong>${esc(p.role)}</strong></div><div class="fact"><span>DISCIPLINE</span><strong>${p.category==='game-art'?'2D Game Art':'Game Development'}</strong></div><div class="fact"><span>${p.contribution?'CONTRIBUTION':'VISUALS'}</span><strong>${p.contribution?esc(p.contribution):`${String(g.length).padStart(2,'0')} selected pieces`}</strong></div>`;
  const intro=isPersonal
    ? 'This collection brings together personal projects and illustrations from the Independent Study Program under the Kampus Merdeka Initiative.'
    : p.id==='anima'
      ? 'Visual contributions for Anima: The Fallen Heroes & Mystic Forest, including character concept art, sprite character assets, gameplay visuals and a sequence of cutscene illustrations.'
      : p.id==='polri-quiz'
        ? 'Visual and animation asset contributions for the POLRI Quiz Game prototype, presented through character artwork and animation asset boards.'
        : p.description;
  let story='';

  if(p.id==='anima'){
    const section=(label,items,mode='wide')=>`<section class="story-plate dark case-study-section"><div class="story-plate-head"><span>${esc(label)}</span><span>ANIMA / THE FALLEN HEROES & MYSTIC FOREST</span></div><div class="case-study-images ${mode==='sequence'?'sequence-images':mode==='assets'?'asset-strip':''}">${items.map(index=>imageButton(p,index,mode==='sequence'?'wide':mode==='assets'?'asset-image':'wide')).join('')}</div></section>`;
    // Gallery order: 0 character concept; 1–7 sprite-related assets; 8 gameplay; 9–13 cutscenes; 14–16 environment/additional visuals.
    story = `${section('01 / CHARACTER CONCEPT',[0])}
      ${section('02 / SPRITE CHARACTER ASSETS',[1,2,3,4,5,6,7],'assets')}
      ${section('03 / GAMEPLAY VISUAL',[8])}
      <section class="cutscene-sequence"><div class="cutscene-heading"><span class="eyebrow">04 / CINEMATIC STORY SEQUENCE</span><h2>Cutscene<br><em>illustrations.</em></h2><p>Five cutscene illustrations presented in their original portfolio order.</p></div>${[9,10,11,12,13].map((index,i)=>`<div class="cutscene-frame"><span class="cutscene-index">SEQUENCE 0${i+1}</span>${imageButton(p,index,'wide')}</div>`).join('')}</section>
      ${section('05 / ENVIRONMENT & ADDITIONAL VISUALS',[14,15,16],'assets')}`;
  } else if(p.id==='polri-quiz'){
    const boardLabels=['ANIMATION ASSET BOARD 01','ANIMATION ASSET BOARD 02','ANIMATION ASSET BOARD 03','ANIMATION ASSET BOARD 04'];
    story=`<section class="polri-frame-intro"><span class="eyebrow">ANIMATION ASSET PRESENTATION</span><h2>Character<br><em>in motion.</em></h2><p>Four visual boards from the original prototype portfolio. Each extracted asset can be opened at full size for closer inspection.</p></section>
      ${boardLabels.map((label,i)=>`<section class="story-plate dark case-study-section"><div class="story-plate-head"><span>0${i+1} / ${label}</span><span>POLRI QUIZ GAME · PROTOTYPE</span></div><div class="polri-board-pair">${imageButton(p,i*2,'polri-board-image')}${imageButton(p,i*2+1,'polri-board-image')}</div></section>`).join('')}`;
  } else if(isPersonal){
    const personalCount=8;
    story=`<section class="story-plate dark"><div class="story-plate-head"><span>01 / PERSONAL PROJECTS</span><span>PERSONAL ARTWORK</span></div><div class="personal-detail-rail">${Array.from({length:personalCount},(_,i)=>imageButton(p,i,'wide')).join('')}</div></section>
      <section class="story-plate midnight"><div class="story-plate-head"><span>02 / INDEPENDENT STUDY</span><span>KAMPUS MERDEKA INITIATIVE</span></div><div class="personal-detail-rail">${Array.from({length:5},(_,i)=>imageButton(p,personalCount+i,'wide')).join('')}</div></section>`;
  } else {
    // Game Development: keep the project's original screenshot sequence, with no invented technical feature list.
    story=g.slice(1).map(([image,caption],i)=>`<section class="story-plate ${i%2?'midnight':'dark'}"><div class="story-plate-head"><span>GAME SHOWCASE / ${String(i+2).padStart(2,'0')}</span><span>${esc(p.shortTitle)} · ${esc(caption)}</span></div>${imageButton(p,i+1,'wide')}</section>`).join('');
  }

  const openingEyebrow=`${catLabel(p)}${yearLabel}`;
  const narrativeCopy=p.category==='development'
    ? `${esc(p.description)} Fadhlan's contribution covered the overall game development of this project.`
    : esc(intro);
  return `<div class="page project-page">
    <section class="project-opening ${portraitCover?'portrait':''}"><img src="${asset(hero)}" alt="${esc(p.title)} — featured artwork"><span class="project-opening-index">PROJECT ${String(pi+1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}</span><div class="project-opening-copy"><span class="eyebrow">${openingEyebrow}</span><h1>${esc(p.shortTitle)}</h1><p>${esc(p.subtitle)}</p></div></section>
    <div class="project-facts">${facts}</div>
    <section class="project-narrative"><h2>${p.id==='anima'?'Visual<br><em>contributions.</em>':p.id==='polri-quiz'?'Animation<br><em>assets.</em>':isPersonal?'Personal<br><em>collection.</em>':'Game<br><em>development.</em>'}</h2><p>${narrativeCopy}</p></section>
    ${p.id==='anima'?`<section class="story-plate dark"><div class="story-plate-head"><span>PROJECT COVER / ENVIRONMENT ART</span><span>ANIMA</span></div><button class="story-image wide" type="button" data-view-project="${p.id}" data-view-index="14"><img src="${asset('anima-forest-art')}" alt="Anima forest environment artwork"></button></section>`:p.id==='polri-quiz'?`<section class="story-plate dark"><div class="story-plate-head"><span>PROJECT COVER / CHARACTER ART</span><span>POLRI QUIZ GAME</span></div><button class="story-image wide" type="button" data-view-project="${p.id}" data-view-index="0"><img src="${asset('polri-01')}" alt="POLRI Quiz Game character artwork"></button></section>`:`<section class="story-plate dark"><div class="story-plate-head"><span>01 / FEATURED VISUAL</span><span>${esc(p.shortTitle)}${yearLabel}</span></div><button class="story-image wide" type="button" data-view-project="${p.id}" data-view-index="0"><img src="${asset(g[0][0])}" alt="${esc(p.shortTitle)} — ${esc(g[0][1])}"></button></section>`}
    ${story}
    <div class="project-end"><a href="#${p.category==='development'?'game-development':p.category==='game-art'?'game-art':'personal-artwork'}"><span>←</span> Back to ${p.category==='development'?'game projects':p.category==='game-art'?'2D game art':'personal artwork'}</a><a href="#project/${prev.id}">Previous project</a><a href="#project/${next.id}">Next project <span>↗</span></a></div>
  </div>`;
}
function renderAbout(){
  return `<div class="page about-page">
    <section class="about-opening"><figure class="about-image"><img src="${asset('profile-photo')}" alt="Portrait of Fadhlan Qital"><figcaption>FADHLAN QITAL / 2D ARTIST & GAME DEVELOPER</figcaption></figure><div class="about-copy"><span class="eyebrow dark">04 / ABOUT THE ARTIST</span><h1>Hello,<br>I'm <em>Fadhlan.</em></h1><p class="lead">I create visual stories and interactive experiences.</p><p>I work on concept art, illustrations and 2D game assets, while also developing game mechanics and features using Unity and C#.</p><p>I enjoy exploring ideas through characters, environments and expressive visuals. On the development side, I build games from prototype to release, including puzzle games, word games and small-scale independent projects.</p></div></section>
    <section class="skills-band"><h2>Tools & creative focus</h2><div class="skills-list"><span>UNITY</span><span>2D ART</span><span>ILLUSTRATION</span><span>GAME ASSETS</span><span>ANIMATION</span><span>C#</span></div></section>
    <section class="contact-band" id="contact"><div><span class="eyebrow dark">05 / CONTACT</span><h2>Let's make<br>something <em>memorable.</em></h2></div><div class="contact-list"><a href="mailto:112fadhlanikhtiari@gmail.com">112fadhlanikhtiari@gmail.com <span>↗</span></a><a href="https://www.deviantart.com/m0ngrell" target="_blank" rel="noreferrer">DeviantArt <span>↗</span></a><a href="https://www.instagram.com/fadhlanchaos/" target="_blank" rel="noreferrer">Instagram <span>↗</span></a><a href="tel:+628111028083">+62 811 1028 083 <span>↗</span></a></div></section>
  </div>`;
}

function render(page,id){
  if(!['home','personal-artwork','game-art','game-development','project','about'].includes(page))page='home';
  if(featuredCarouselCleanup){featuredCarouselCleanup();featuredCarouselCleanup=null;}
  setNav(page);
  if(page==='home')app.innerHTML=renderHome();
  if(page==='personal-artwork')app.innerHTML=renderPersonalArtwork();
  if(page==='game-art')app.innerHTML=renderGameArt();
  if(page==='game-development')app.innerHTML=renderGameDevelopment();
  if(page==='project')app.innerHTML=renderProject(id);
  if(page==='about')app.innerHTML=renderAbout();
  document.title=page==='project'?`${(projects.find(p=>p.id===id)||projects[0]).title} — Fadhlan Qital`:`${page==='home'?'Fadhlan Qital':page==='personal-artwork'?'Personal Artwork':page==='game-art'?'2D Game Art':page==='game-development'?'Game Development':'About'} — Portfolio`;
  window.scrollTo({top:0,behavior:'instant'});
  observeReveals();
  if(page==='personal-artwork'||page==='game-art')setupArtworkRail();
  if(page==='home')featuredCarouselCleanup=setupFeaturedCarousel();
}
function route(){
  const raw=location.hash.replace(/^#/,'')||'home';
  if(raw==='statement'){requestAnimationFrame(()=>$('#statement')?.scrollIntoView({behavior:'smooth'}));return;}
  if(raw==='artworks'){location.replace('#game-art');return;}
  const [page,id]=raw.split('/');
  if(page==='contact'){render('about');requestAnimationFrame(()=>$('#contact')?.scrollIntoView({behavior:'smooth'}));return;}
  render(page,id);
}
function observeReveals(){
  const els=$$('.reveal');
  if(!('IntersectionObserver'in window)){els.forEach(el=>el.classList.add('visible'));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.13});
  els.forEach(el=>observer.observe(el));
}
function setupFeaturedCarousel(){
  const root=$('#featuredPreview');
  if(!root)return null;
  const stage=$('#featuredStage',root);
  const imageTrigger=$('#featuredImageTrigger',root);
  const image=$('#featuredImage',root);
  const categoryTabs=$$('.featured-category-tab',root);
  const title=$('#featuredTitle',root);
  const kicker=$('#featuredCategoryKicker',root);
  const description=$('#featuredDescription',root);
  const link=$('#featuredLink',root);
  const categoryCurrent=$('#featuredCategoryCurrent',root);
  const imageCurrent=$('#featuredImageCurrent',root);
  const imageTotal=$('#featuredImageTotal',root);
  const stageLabel=$('#featuredStageLabel',root);
  const previewHint=$('#featuredPreviewHint',root);
  const thumbnails=$('#featuredThumbnails',root);
  const pauseButton=$('#featuredPause',root);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration=5600;
  let categoryIndex=0;
  let imageIndex=0;
  let timer=null;
  let deadline=0;
  let remaining=duration;
  let manualPaused=reducedMotion;
  let hoverPaused=false;
  let focusPaused=false;
  let pointerStart=null;
  let activeCategory=featuredCategories[0];

  const isPaused=()=>manualPaused||hoverPaused||focusPaused||document.hidden||reducedMotion;
  const stopTimer=()=>{
    if(timer){clearTimeout(timer);timer=null;remaining=Math.max(0,deadline-Date.now());}
  };
  const schedule=()=>{
    if(isPaused()||timer)return;
    deadline=Date.now()+remaining;
    timer=setTimeout(()=>{timer=null;remaining=duration;showImage(imageIndex+1);},remaining);
  };
  const syncPause=()=>{
    const paused=isPaused();
    root.classList.toggle('is-paused',paused);
    if(paused)stopTimer();else schedule();
    pauseButton.innerHTML=manualPaused?'▶ <span>PLAY</span>':'Ⅱ <span>PAUSE</span>';
    pauseButton.setAttribute('aria-label',manualPaused?'Resume image preview':'Pause image preview');
  };
  function renderThumbnails(){
    const items=activeCategory.items;
    const count=Math.min(5,items.length);
    const start=Math.max(0,Math.min(imageIndex-2,items.length-count));
    const visible=items.slice(start,start+count);
    thumbnails.innerHTML=visible.map((item,i)=>{
      const actualIndex=start+i;
      const active=actualIndex===imageIndex;
      return `<button type="button" class="featured-thumb ${active?'is-active':''}" data-inner-index="${actualIndex}" aria-label="Show image ${actualIndex+1}: ${esc(item.caption)}" aria-pressed="${active?'true':'false'}"><img src="${asset(item.image)}" alt="" loading="lazy"><span>${String(actualIndex+1).padStart(2,'0')}</span></button>`;
    }).join('');
  }
  function showImage(next,resetTimer=true){
    const items=activeCategory.items;
    imageIndex=(next+items.length)%items.length;
    const item=items[imageIndex];
    imageTrigger.dataset.viewProject=item.projectId;
    imageTrigger.dataset.viewIndex=String(item.index);
    imageTrigger.setAttribute('aria-label',`View ${item.projectName} — ${item.caption} full size`);
    image.alt=`${item.projectName} — ${item.caption}`;
    image.classList.remove('image-change');
    image.src=asset(item.image);
    void image.offsetWidth;
    image.classList.add('image-change');
    imageCurrent.textContent=String(imageIndex+1).padStart(2,'0');
    imageTotal.textContent=String(items.length).padStart(2,'0');
    stageLabel.textContent=`${item.projectName} / ${item.caption}`;
    renderThumbnails();
    if(resetTimer){stopTimer();remaining=duration;schedule();}
  }
  function showCategory(next){
    categoryIndex=(next+featuredCategories.length)%featuredCategories.length;
    activeCategory=featuredCategories[categoryIndex];
    categoryTabs.forEach((tab,i)=>{
      const active=i===categoryIndex;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
    });
    kicker.textContent=activeCategory.kicker;
    title.innerHTML=activeCategory.title;
    description.textContent=activeCategory.description;
    link.href=activeCategory.href;
    link.innerHTML=`${esc(activeCategory.cta)} <span>↗</span>`;
    categoryCurrent.textContent=String(categoryIndex+1).padStart(2,'0');
    previewHint.textContent=`BROWSE ${activeCategory.items.length} WORKS IN THIS CATEGORY`;
    root.dataset.activeCategory=activeCategory.id;
    showImage(0);
  }

  $('#featuredCategoryPrev',root).addEventListener('click',()=>showCategory(categoryIndex-1));
  $('#featuredCategoryNext',root).addEventListener('click',()=>showCategory(categoryIndex+1));
  categoryTabs.forEach(tab=>tab.addEventListener('click',()=>showCategory(Number(tab.dataset.categoryIndex))));
  $('#featuredImagePrev',root).addEventListener('click',()=>showImage(imageIndex-1));
  $('#featuredImageNext',root).addEventListener('click',()=>showImage(imageIndex+1));
  thumbnails.addEventListener('click',e=>{
    const thumb=e.target.closest('[data-inner-index]');
    if(thumb)showImage(Number(thumb.dataset.innerIndex));
  });
  pauseButton.addEventListener('click',()=>{manualPaused=!manualPaused;if(!manualPaused)focusPaused=false;syncPause();});
  root.addEventListener('pointerenter',()=>{hoverPaused=true;syncPause();});
  root.addEventListener('pointerleave',()=>{hoverPaused=false;syncPause();});
  root.addEventListener('focusin',()=>{focusPaused=true;syncPause();});
  root.addEventListener('focusout',()=>requestAnimationFrame(()=>{focusPaused=root.contains(document.activeElement);syncPause();}));
  const visibilityHandler=()=>syncPause();
  document.addEventListener('visibilitychange',visibilityHandler);

  stage.addEventListener('pointerdown',e=>{if(e.target.closest('button:not(#featuredImageTrigger)'))return;pointerStart={x:e.clientX,y:e.clientY};},{passive:true});
  stage.addEventListener('pointerup',e=>{
    if(!pointerStart)return;
    const dx=e.clientX-pointerStart.x;
    const dy=e.clientY-pointerStart.y;
    pointerStart=null;
    if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.15){
      suppressFeaturedClick=true;
      showImage(imageIndex+(dx<0?1:-1));
      setTimeout(()=>suppressFeaturedClick=false,350);
    }
  },{passive:true});
  stage.addEventListener('pointercancel',()=>{pointerStart=null;},{passive:true});
  stage.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();showImage(imageIndex-1);}
    if(e.key==='ArrowRight'){e.preventDefault();showImage(imageIndex+1);}
  });
  categoryTabs.forEach((tab,i)=>tab.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();const direction=e.key==='ArrowRight'?1:-1;
      const next=(i+direction+featuredCategories.length)%featuredCategories.length;
      showCategory(next);categoryTabs[next].focus();
    }
  }));
  showCategory(0);
  syncPause();
  return ()=>{stopTimer();document.removeEventListener('visibilitychange',visibilityHandler);};
}

function setupArtworkRail(){
  const track=$('#artworkTrack');if(!track)return;
  const progress=$('#artProgress');
  const update=()=>{const max=track.scrollWidth-track.clientWidth;const ratio=max>0?track.scrollLeft/max:0;progress.style.width=`${Math.max(8,ratio*100)}%`;};
  track.addEventListener('scroll',update,{passive:true});update();
  $('#artPrev').addEventListener('click',()=>track.scrollBy({left:-track.clientWidth*.78,behavior:'smooth'}));
  $('#artNext').addEventListener('click',()=>track.scrollBy({left:track.clientWidth*.78,behavior:'smooth'}));
  let down=false,startX=0,scrollLeft=0;
  track.addEventListener('pointerdown',e=>{down=true;startX=e.clientX;scrollLeft=track.scrollLeft;track.classList.add('dragging');track.setPointerCapture(e.pointerId);});
  track.addEventListener('pointermove',e=>{if(!down)return;if(Math.abs(e.clientX-startX)>5)suppressRailClick=true;track.scrollLeft=scrollLeft-(e.clientX-startX);});
  const end=()=>{down=false;track.classList.remove('dragging');if(suppressRailClick)setTimeout(()=>suppressRailClick=false,140);};
  track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);track.addEventListener('pointerleave',end);
}
function openViewer(projectId,index){
  const p=projects.find(x=>x.id===projectId);if(!p)return;
  viewerCollection=p.gallery.map(([name,caption])=>({src:asset(name),caption,alt:`${p.shortTitle} — ${caption}`}));
  viewerIndex=Math.max(0,Math.min(index,viewerCollection.length-1));updateViewer();viewer.classList.add('open');viewer.setAttribute('aria-hidden','false');document.body.classList.add('locked');
}
function updateViewer(){const item=viewerCollection[viewerIndex];viewerImage.src=item.src;viewerImage.alt=item.alt;viewerCaption.textContent=`${item.caption} · ${viewerIndex+1} / ${viewerCollection.length}`;}
function closeViewer(){viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true');document.body.classList.remove('locked');}
function stepViewer(dir){if(!viewerCollection.length)return;viewerIndex=(viewerIndex+dir+viewerCollection.length)%viewerCollection.length;updateViewer();}

app.addEventListener('click',e=>{
  const filter=e.target.closest('[data-filter]');
  if(filter){currentGameArtFilter=filter.dataset.filter;app.innerHTML=renderGameArt();setupArtworkRail();return;}
  const image=e.target.closest('[data-view-project]');
  if(image){if(suppressRailClick||suppressFeaturedClick){e.preventDefault();return;}openViewer(image.dataset.viewProject,Number(image.dataset.viewIndex));return;}
});
app.addEventListener('keydown',e=>{const image=e.target.closest('[data-view-project][role="button"]');if(image&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openViewer(image.dataset.viewProject,Number(image.dataset.viewIndex));}});
menuToggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));});
nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');}});
$('#viewerClose').addEventListener('click',closeViewer);$('#viewerPrev').addEventListener('click',()=>stepViewer(-1));$('#viewerNext').addEventListener('click',()=>stepViewer(1));
viewer.addEventListener('click',e=>{if(e.target===viewer)closeViewer();});
document.addEventListener('keydown',e=>{if(!viewer.classList.contains('open'))return;if(e.key==='Escape')closeViewer();if(e.key==='ArrowLeft')stepViewer(-1);if(e.key==='ArrowRight')stepViewer(1);});
window.addEventListener('hashchange',route);
window.addEventListener('scroll',()=>$('#siteHeader').classList.toggle('scrolled',window.scrollY>25),{passive:true});
route();

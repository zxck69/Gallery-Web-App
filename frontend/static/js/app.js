/* ═══════════════════════════════════════════════
   WOOF — Dog Gallery  |  app.js
   ═══════════════════════════════════════════════ */

const API = 'https://gallery-web-app-ohld.onrender.com'; 
const DOG_CEO = 'https://dog.ceo/api';
const PAGE_SIZE = 20;    // breeds per page
const IMG_PAGE_SIZE = 10; // images per page in modal

// ── State ────────────────────────────────────────
let allBreeds = [];          // [{ name, subBreeds[] }]
let filteredBreeds = [];
let displayedBreeds = [];
let likedUrls = new Set();
let likedBreeds = new Set();
let viewedBreeds = [];
let currentPage = 0;
let currentFilter = 'all';
let currentSort = 'az';
let mostLikedBreeds = [];   // [{breed, count}] from backend

let currentBreed = '';
let allBreedImages = [];
let displayedImgCount = 0;
let currentZoomUrl = '';
let currentZoomBreed = '';

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadLikes();
  loadViewed();
  loadBreeds();
  handleUrlRoute();
  bindControls();
});

// ── URL Routing ───────────────────────────────────
function handleUrlRoute() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const breedMatch = path.match(/^\/breed\/(.+)/);
  if (breedMatch) {
    const breed = decodeURIComponent(breedMatch[1]);
    const imgIdx = params.get('img') ? parseInt(params.get('img')) : null;
    openBreedModal(breed, imgIdx);
  }
}

function updateUrl(breed, imgIdx = null) {
  let url = `/breed/${encodeURIComponent(breed)}`;
  if (imgIdx !== null) url += `?img=${imgIdx}`;
  history.pushState({}, '', url);
}

function clearUrl() {
  history.pushState({}, '', '/');
}

window.addEventListener('popstate', () => {
  handleUrlRoute();
});

// ── Theme ─────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeIcon').textContent = saved === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('themeIcon').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ── Navigation ────────────────────────────────────
window.navigateTo = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  if (page === 'likes') renderLikedPage();
  if (page === 'home') clearUrl();
};

// ── Toast ─────────────────────────────────────────
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ── API Helpers ───────────────────────────────────
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('API Error:', url, e);
    throw e;
  }
}

// ── Load Breeds ───────────────────────────────────
async function loadBreeds() {
  renderSkeletons(PAGE_SIZE);
  try {
    const data = await apiFetch(`${DOG_CEO}/breeds/list/all`);
    allBreeds = [];
    for (const [breed, subs] of Object.entries(data.message)) {
      if (subs.length === 0) {
        allBreeds.push({ name: breed, subBreeds: [] });
      } else {
        for (const sub of subs) {
          allBreeds.push({ name: `${sub} ${breed}`, subBreeds: [], apiName: `${breed}/${sub}` });
        }
      }
    }
    applyFilterSort();
    prefetchFirstBreeds();
  } catch (e) {
    showBreedError();
  }
}

function prefetchFirstBreeds() {
  filteredBreeds.slice(0, 5).forEach(b => {
    fetch(`${API}/prefetch/${encodeURIComponent(b.apiName || b.name)}`).catch(() => {});
  });
}

function renderSkeletons(count) {
  const grid = document.getElementById('breedsGrid');
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    grid.innerHTML += `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>`;
  }
}

function showBreedError() {
  const grid = document.getElementById('breedsGrid');
  grid.innerHTML = `
    <div class="error-banner" style="grid-column:1/-1">
      ⚠️ Failed to load breeds. Check your connection.
      <button class="retry-btn" onclick="loadBreeds()">Retry</button>
    </div>`;
}

// ── Filter / Sort ─────────────────────────────────
function applyFilterSort() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();

  let breeds = [...allBreeds];

  // Filter
  if (currentFilter === 'liked') {
    breeds = breeds.filter(b => likedBreeds.has(b.name));
  } else if (currentFilter === 'viewed') {
    const viewedSet = new Set(viewedBreeds.map(v => v.breed));
    breeds = breeds.filter(b => viewedSet.has(b.name));
  }

  // Search
  if (query) {
    breeds = breeds.filter(b => b.name.toLowerCase().includes(query));
  }

  // Sort
  if (currentSort === 'az') {
    breeds.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'za') {
    breeds.sort((a, b) => b.name.localeCompare(a.name));
  } else if (currentSort === 'most-liked') {
    const countMap = {};
    mostLikedBreeds.forEach(b => { countMap[b.breed] = b.count; });
    breeds.sort((a, b) => (countMap[b.name] || 0) - (countMap[a.name] || 0));
  }

  filteredBreeds = breeds;
  currentPage = 0;
  renderBreeds(true);
}

function bindControls() {
  // Search
  const inp = document.getElementById('searchInput');
  inp.addEventListener('input', () => {
    document.getElementById('searchClear').style.display = inp.value ? 'block' : 'none';
    applyFilterSort();
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilterSort();
    });
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    applyFilterSort();
  });
}

window.clearSearch = function() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilterSort();
};

// ── Render Breeds ─────────────────────────────────
function renderBreeds(reset = false) {
  const grid = document.getElementById('breedsGrid');
  const empty = document.getElementById('emptyState');
  const loadWrap = document.getElementById('loadMoreWrap');

  if (reset) {
    grid.innerHTML = '';
    displayedBreeds = [];
  }

  const start = currentPage * PAGE_SIZE;
  const slice = filteredBreeds.slice(start, start + PAGE_SIZE);
  displayedBreeds = [...displayedBreeds, ...slice];

  if (filteredBreeds.length === 0) {
    empty.style.display = 'block';
    loadWrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  slice.forEach((breed, i) => {
    const card = document.createElement('div');
    card.className = 'breed-card';
    card.style.animationDelay = `${(i % PAGE_SIZE) * 0.03}s`;
    card.innerHTML = `
      <img class="breed-card-thumb loading" data-breed="${breed.apiName || breed.name}" src="" alt="${breed.name}" loading="lazy" />
      <div class="breed-card-body">
        <div>
          <div class="breed-card-name">${breed.name}</div>
        </div>
        <div class="breed-like-dot ${likedBreeds.has(breed.name) ? 'show' : ''}" id="dot-${slugify(breed.name)}"></div>
      </div>`;
    card.addEventListener('click', () => openBreedModal(breed.name));
    grid.appendChild(card);
    lazyLoadThumb(card.querySelector('img'), breed.apiName || breed.name);
  });

  currentPage++;
  const hasMore = filteredBreeds.length > displayedBreeds.length;
  loadWrap.style.display = hasMore ? 'block' : 'none';
}

window.loadMoreBreeds = function() {
  renderBreeds(false);
};

async function lazyLoadThumb(img, breedPath) {
  try {
    const data = await apiFetch(`${DOG_CEO}/breed/${breedPath}/images/random`);
    img.src = data.message;
    img.classList.remove('loading');
  } catch {
    img.src = '';
    img.classList.remove('loading');
    img.style.background = 'var(--bg3)';
  }
}

function slugify(s) { return s.replace(/\s+/g, '-'); }

// ── Viewed Breeds ─────────────────────────────────
async function loadViewed() {
  try {
    viewedBreeds = await apiFetch(`${API}/viewed`);
    renderRecentSection();
  } catch {}
}

function renderRecentSection() {
  const section = document.getElementById('recent-section');
  const list = document.getElementById('recent-list');
  if (!viewedBreeds.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = viewedBreeds.map(v => `
    <div class="recent-chip" onclick="openBreedModal('${v.breed}')">
      <span class="chip-icon">🐕</span>${v.breed}
    </div>`).join('');
}

async function recordView(breed) {
  try { await apiFetch(`${API}/viewed`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({breed}) }); }
  catch {}
  // Update local state
  viewedBreeds = viewedBreeds.filter(v => v.breed !== breed);
  viewedBreeds.unshift({ breed, last_viewed: new Date().toISOString() });
  viewedBreeds = viewedBreeds.slice(0, 5);
  renderRecentSection();
}

// ── Likes ─────────────────────────────────────────
async function loadLikes() {
  try {
    const likes = await apiFetch(`${API}/likes`);
    likes.forEach(l => {
      likedUrls.add(l.image_url);
      likedBreeds.add(l.breed);
    });
    updateLikeCount();

    // Load breed like counts for sort
    const bred = await apiFetch(`${API}/likes/breeds`);
    mostLikedBreeds = bred;
  } catch {}
}

function updateLikeCount() {
  const el = document.getElementById('like-count');
  el.textContent = likedUrls.size;
}

async function toggleLike(imageUrl, breed, btnEl) {
  const wasLiked = likedUrls.has(imageUrl);
  try {
    if (wasLiked) {
      await apiFetch(`${API}/like?image_url=${encodeURIComponent(imageUrl)}`, { method: 'DELETE' });
      likedUrls.delete(imageUrl);
      toast('Removed from likes');
    } else {
      await apiFetch(`${API}/like`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ image_url: imageUrl, breed }) });
      likedUrls.add(imageUrl);
      toast('❤️ Liked!', 'success');
    }
    if (btnEl) {
      btnEl.textContent = likedUrls.has(imageUrl) ? '♥ Liked' : '♡ Like';
      btnEl.classList.toggle('liked', likedUrls.has(imageUrl));
    }
    // Update likedBreeds
    likedBreeds = new Set();
    likedUrls.forEach(url => {
      // We track breed per url via a local map
    });
    updateLikeCount();
    updateBreedDot(breed);
  } catch (e) {
    toast('Failed to update like', 'error');
  }
}

const urlBreedMap = {};  // imageUrl → breed

function updateBreedDot(breed) {
  const dot = document.getElementById(`dot-${slugify(breed)}`);
  if (dot) {
    const hasLike = [...likedUrls].some(url => urlBreedMap[url] === breed);
    dot.classList.toggle('show', hasLike);
  }
}

// ── Breed Modal ───────────────────────────────────
window.openBreedModal = async function(breed, jumpToImg = null) {
  currentBreed = breed;
  allBreedImages = [];
  displayedImgCount = 0;

  document.getElementById('modalBreedName').textContent = breed;
  document.getElementById('modalImageCount').textContent = 'Loading images…';
  document.getElementById('modalImages').innerHTML = renderModalSkeletons(10);
  document.getElementById('modalLoadMore').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  updateUrl(breed);
  recordView(breed);

  const breedPath = getBreedPath(breed);

  try {
    const data = await apiFetch(`${DOG_CEO}/breed/${breedPath}/images`);
    allBreedImages = data.message || [];

    if (!allBreedImages.length) {
      document.getElementById('modalImages').innerHTML = '<p style="color:var(--text2);grid-column:1/-1;padding:40px;text-align:center;">No images available for this breed.</p>';
      document.getElementById('modalImageCount').textContent = '0 images';
      return;
    }

    document.getElementById('modalImageCount').textContent = `${allBreedImages.length} photos`;
    displayedImgCount = 0;
    renderModalImages(IMG_PAGE_SIZE, true);

    if (jumpToImg !== null) {
      setTimeout(() => {
        const imgs = document.querySelectorAll('.modal-img-wrap');
        if (imgs[jumpToImg]) imgs[jumpToImg].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  } catch {
    document.getElementById('modalImages').innerHTML = `
      <div class="error-banner" style="grid-column:1/-1">
        ⚠️ Failed to load images.
        <button class="retry-btn" onclick="openBreedModal('${breed}')">Retry</button>
      </div>`;
  }
};

function getBreedPath(breed) {
  // "sub breed" → breed/sub
  const parts = breed.split(' ');
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return breed;
}

function renderModalSkeletons(n) {
  return Array.from({ length: n }, () => `<div class="modal-skeleton"></div>`).join('');
}

function renderModalImages(count, reset = false) {
  const container = document.getElementById('modalImages');
  if (reset) container.innerHTML = '';

  const slice = allBreedImages.slice(displayedImgCount, displayedImgCount + count);
  displayedImgCount += slice.length;

  slice.forEach((url, idx) => {
    urlBreedMap[url] = currentBreed;
    const isLiked = likedUrls.has(url);
    const globalIdx = displayedImgCount - slice.length + idx;
    const wrap = document.createElement('div');
    wrap.className = 'modal-img-wrap';
    wrap.innerHTML = `
      <img src="${url}" alt="${currentBreed}" loading="lazy" onclick="openZoom('${url}', '${currentBreed}', ${globalIdx})" />
      <div class="modal-img-actions">
        <button class="img-action-btn ${isLiked ? 'liked' : ''}" onclick="handleLikeBtn(event, '${url}', '${currentBreed}', this)">${isLiked ? '♥ Liked' : '♡ Like'}</button>
        <button class="img-action-btn" onclick="shareImage(event, '${url}', '${currentBreed}', ${globalIdx})">↗</button>
      </div>`;
    container.appendChild(wrap);
  });

  const hasMore = displayedImgCount < allBreedImages.length;
  document.getElementById('modalLoadMore').style.display = hasMore ? 'block' : 'none';
}

window.loadMoreModalImages = function() { renderModalImages(IMG_PAGE_SIZE); };

window.handleLikeBtn = function(e, url, breed, btn) {
  e.stopPropagation();
  toggleLike(url, breed, btn);
};

window.closeModal = function(e) {
  if (e.target.id === 'modalOverlay') closeBreedModal();
};

window.closeBreedModal = function() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  clearUrl();
};

// ── Zoom ──────────────────────────────────────────
window.openZoom = function(url, breed, idx) {
  currentZoomUrl = url;
  currentZoomBreed = breed;
  document.getElementById('zoomImg').src = url;
  const likeBtn = document.getElementById('zoomLikeBtn');
  likeBtn.textContent = likedUrls.has(url) ? '♥ Liked' : '♡ Like';
  likeBtn.classList.toggle('liked', likedUrls.has(url));
  document.getElementById('zoomOverlay').classList.add('open');
};

window.closeZoom = function() {
  document.getElementById('zoomOverlay').classList.remove('open');
};

window.toggleLikeFromZoom = function() {
  const btn = document.getElementById('zoomLikeBtn');
  toggleLike(currentZoomUrl, currentZoomBreed, btn);
};

window.shareFromZoom = function() {
  shareImage(null, currentZoomUrl, currentZoomBreed, 0);
};

// ── Share ─────────────────────────────────────────
window.shareImage = async function(e, url, breed, idx) {
  if (e) e.stopPropagation();
  const shareUrl = `${window.location.origin}/breed/${encodeURIComponent(breed)}?img=${idx}`;
  const shareData = { title: `Check out this ${breed}!`, url: shareUrl };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      toast('Shared!', 'success');
      return;
    } catch {}
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(shareUrl);
    toast('📋 Link copied to clipboard!', 'success');
  } catch {
    toast('Could not copy link', 'error');
  }
};

// ── Liked Page ────────────────────────────────────
async function renderLikedPage() {
  const grid = document.getElementById('likedGrid');
  const empty = document.getElementById('likedEmpty');
  grid.innerHTML = '';

  try {
    const likes = await apiFetch(`${API}/likes`);
    if (!likes.length) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';

    likes.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'liked-card';
      card.style.animationDelay = `${i * 0.04}s`;
      card.innerHTML = `
        <img src="${item.image_url}" alt="${item.breed}" loading="lazy" />
        <div class="liked-card-overlay">
          <div class="liked-card-breed">${item.breed}</div>
          <div class="liked-card-actions">
            <button class="liked-action-btn" onclick="handleUnlikeLikedPage(event,'${item.image_url}','${item.breed}',this.closest('.liked-card'))">💔 Unlike</button>
            <button class="liked-action-btn" onclick="shareImage(event,'${item.image_url}','${item.breed}',0)">↗ Share</button>
          </div>
        </div>`;
      card.querySelector('img').addEventListener('click', () => openZoom(item.image_url, item.breed, 0));
      grid.appendChild(card);
    });
  } catch {
    grid.innerHTML = '<div class="error-banner">Failed to load liked images. <button class="retry-btn" onclick="renderLikedPage()">Retry</button></div>';
  }
}

window.handleUnlikeLikedPage = async function(e, url, breed, card) {
  e.stopPropagation();
  try {
    await apiFetch(`${API}/like?image_url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    likedUrls.delete(url);
    updateLikeCount();
    card.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => card.remove(), 300);
    toast('Removed from likes');
  } catch { toast('Failed', 'error'); }
};

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('zoomOverlay').classList.contains('open')) closeZoom();
    else if (document.getElementById('modalOverlay').classList.contains('open')) closeBreedModal();
  }
});

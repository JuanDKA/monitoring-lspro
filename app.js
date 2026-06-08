/* =============================================================
   MONITORING LSPro & LAB UJI — Application Logic
   ============================================================= */

/* ---- Inline Data (generated from Excel) ---- */
// Data diambil dari file Excel via Python script
// Kategori LSPro: Penanak Nasi, LED Swabalast, LED Tabung Swabalast, Kipas Angin, Lemari Pendingin, Dispenser Air Minum, LED Luminer, Pengondisi Udara
// Kategori Lab Uji: LED Swabalast, Penanak Nasi, Kipas Angin, Lemari Pendingin, Dispenser Air Minum, LED Luminer, Pengondisi Udara, Televisi, RDC

const RAW_DATA = {
  lspro: [],
  lab_uji: [],
  loaded: false
};

/* ============================================================
   STATE
   ============================================================ */
let state = {
  activeTab: 'lspro',        // 'lspro' | 'labuji'
  searchQuery: '',
  filterKategori: '',
  filterStatus: '',
  activeCategory: '',
  viewMode: 'grid',           // 'grid' | 'list'
  data: [],
  filteredData: []
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateFooterDate();

  // Search debounce
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    document.getElementById('searchClear').style.display = state.searchQuery ? 'block' : 'none';
    applyFilters();
  }, 200));

  // ---- Modal events (via addEventListener, bukan inline onclick) ----
  const overlay  = document.getElementById('modalOverlay');
  const modalBox = document.getElementById('modalBox');
  const closeBtn = document.getElementById('modalCloseBtn');

  // Klik tombol ✕
  closeBtn.addEventListener('click', () => closeModal());

  // Klik di luar modal (pada overlay gelap)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Pastikan klik di dalam modal box tidak menutup
  modalBox.addEventListener('click', (e) => e.stopPropagation());

  // Tombol Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });
});

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Gagal memuat data.json');
    const json = await res.json();
    RAW_DATA.lspro    = json.lspro    || [];
    RAW_DATA.lab_uji  = json.lab_uji  || [];
    RAW_DATA.loaded   = true;

    // Update last-update header
    if (json.generated_at) {
      document.getElementById('lastUpdate').textContent = `Diperbarui: ${json.generated_at}`;
    }

    switchTab(state.activeTab, false);
  } catch (err) {
    console.error(err);
    showError('Gagal memuat data. Pastikan file data.json ada di folder yang sama.');
  }
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function switchTab(tab, resetFiltersFlag = true) {
  state.activeTab = tab;

  // Update nav buttons
  document.getElementById('nav-lspro').classList.toggle('active', tab === 'lspro');
  document.getElementById('nav-labuji').classList.toggle('active', tab === 'labuji');

  // Set data source
  state.data = tab === 'lspro' ? RAW_DATA.lspro : RAW_DATA.lab_uji;

  if (resetFiltersFlag) {
    state.searchQuery   = '';
    state.filterKategori = '';
    state.filterStatus  = '';
    state.activeCategory = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    document.getElementById('filterKategori').value = '';
    document.getElementById('filterStatus').value  = '';
  }

  // Rebuild category filter options
  buildCategoryFilter();
  applyFilters();
}

/* ============================================================
   BUILD CATEGORY FILTER & PILLS
   ============================================================ */
function buildCategoryFilter() {
  const categoryCounts = {};
  state.data.forEach(d => {
    if (!categoryCounts[d.kategori]) categoryCounts[d.kategori] = 0;
    categoryCounts[d.kategori]++;
  });
  
  const categories = Object.keys(categoryCounts).sort();
  const sel = document.getElementById('filterKategori');
  sel.innerHTML = `<option value="">Semua Kategori (${state.data.length})</option>`;
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${cat} (${categoryCounts[cat]})`;
    sel.appendChild(opt);
  });
}

function setStatusFilter(status) {
  document.getElementById('filterStatus').value = status;
  applyFilters();
}

/* ============================================================
   FILTERS & RENDERING
   ============================================================ */
function applyFilters() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Compute status & days remaining for each record
  const withStatus = state.data.map(d => {
    const end = d.jangka_waktu ? new Date(d.jangka_waktu) : null;
    const start = d.mulai_berlaku ? new Date(d.mulai_berlaku) : null;
    let daysLeft = null;
    let status = 'aktif';

    if (end) {
      daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0)      status = 'kadaluarsa';
      else if (daysLeft <= 30) status = 'segera';
      else                    status = 'aktif';
    }

    return { ...d, end, start, daysLeft, status };
  });

  // Filter
  let filtered = withStatus.filter(d => {
    // Dropdown category filter
    const selKat = document.getElementById('filterKategori').value;
    if (selKat && d.kategori !== selKat) return false;
    // Status filter
    const selStatus = document.getElementById('filterStatus').value;
    if (selStatus && d.status !== selStatus) return false;
    // Search
    if (state.searchQuery) {
      const haystack = `${d.nama} ${d.alamat} ${d.kategori} ${d.keterangan}`.toLowerCase();
      if (!haystack.includes(state.searchQuery)) return false;
    }
    return true;
  });

  // Update stat cards visual active state
  const selStatus = document.getElementById('filterStatus').value;
  document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active-total', 'active-aktif', 'active-segera', 'active-kadaluarsa'));
  if (selStatus === '') document.getElementById('stat-total').classList.add('active-total');
  else if (selStatus === 'aktif') document.getElementById('stat-aktif').classList.add('active-aktif');
  else if (selStatus === 'segera') document.getElementById('stat-segera').classList.add('active-segera');
  else if (selStatus === 'kadaluarsa') document.getElementById('stat-kadaluarsa').classList.add('active-kadaluarsa');

  state.filteredData = filtered;

  updateStats(withStatus);
  renderCards(filtered);
  document.getElementById('resultsCount').textContent = `${filtered.length} data ditemukan`;
}

/* ============================================================
   UPDATE STATS
   ============================================================ */
function updateStats(allData) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total      = allData.length;
  const kadaluarsa = allData.filter(d => d.status === 'kadaluarsa').length;
  const segera     = allData.filter(d => d.status === 'segera').length;
  const aktif      = allData.filter(d => d.status === 'aktif').length;

  animateNumber('statTotal',      total);
  animateNumber('statAktif',      aktif);
  animateNumber('statSegera',     segera);
  animateNumber('statKadaluarsa', kadaluarsa);
}

/* ============================================================
   RENDER CARDS
   ============================================================ */
function renderCards(data) {
  const grid = document.getElementById('dataGrid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');

  // Hide loading
  if (loadingState) loadingState.style.display = 'none';

  if (data.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = '';
  data.forEach((item, idx) => {
    const card = createCard(item, idx);
    grid.appendChild(card);
  });
}

function createCard(item, idx) {
  const el = document.createElement('article');
  el.className = `data-card status-${item.status}`;
  el.style.animationDelay = `${Math.min(idx, 30) * 30}ms`;
  el.setAttribute('role', 'listitem');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${item.nama}, status ${item.status}`);

  const endFormatted   = item.end   ? formatDate(item.end)   : '—';
  const startFormatted = item.start ? formatDate(item.start) : '—';

  const statusLabel = {
    aktif: 'Masih Berlaku',
    segera: 'Segera Berakhir',
    kadaluarsa: 'Sudah Berakhir'
  }[item.status];

  const daysText = item.daysLeft !== null
    ? (item.daysLeft < 0
        ? `${Math.abs(item.daysLeft)} hari lalu`
        : `${item.daysLeft} hari lagi`)
    : '—';

  // Progress: how far through the appointment period
  let progressPct = 50;
  if (item.start && item.end) {
    const total = item.end - item.start;
    const elapsed = new Date() - item.start;
    progressPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  }

  el.innerHTML = `
    <div class="card-header">
      <span class="card-no">#${item.no || idx + 1}</span>
      <span class="status-badge badge-${item.status}">${statusLabel}</span>
    </div>
    <div class="card-body">
      <h3 class="card-nama">${escapeHtml(item.nama)}</h3>
      <div class="card-category">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        ${escapeHtml(item.kategori)}
      </div>
      <div class="card-dates">
        <div class="date-item">
          <div class="date-label">Mulai Berlaku</div>
          <div class="date-value">${startFormatted}</div>
        </div>
        <div class="date-item">
          <div class="date-label">Berakhir</div>
          <div class="date-value">${endFormatted}</div>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <span class="days-remaining days-${item.status}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span class="days-number">${daysText}</span>
      </span>
      <div class="progress-bar" title="Progress masa berlaku: ${progressPct}%">
        <div class="progress-fill fill-${item.status}" style="width: ${item.status === 'kadaluarsa' ? 100 : progressPct}%"></div>
      </div>
      <button class="card-detail-btn" onclick="openModal(${idx})" aria-label="Lihat detail ${escapeHtml(item.nama)}">
        Detail
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  `;

  el.addEventListener('click', (e) => {
    if (!e.target.closest('.card-detail-btn')) openModal(idx);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(idx); }
  });

  return el;
}

/* ============================================================
   MODAL
   ============================================================ */
function openModal(idx) {
  const item = state.filteredData[idx];
  if (!item) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const statusLabel = {
    aktif: 'Masih Berlaku',
    segera: 'Segera Berakhir',
    kadaluarsa: 'Sudah Berakhir'
  }[item.status];

  const endFormatted   = item.end   ? formatDate(item.end)   : '—';
  const startFormatted = item.start ? formatDate(item.start) : '—';

  const daysText = item.daysLeft !== null
    ? (item.daysLeft < 0
        ? `${Math.abs(item.daysLeft)} hari yang lalu`
        : `${item.daysLeft} hari lagi`)
    : '—';

  let progressPct = 50;
  if (item.start && item.end) {
    const total   = item.end - item.start;
    const elapsed = new Date() - item.start;
    progressPct   = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  }

  // Badge
  const badge = document.getElementById('modalBadge');
  badge.className = `modal-badge badge-${item.status}`;
  badge.textContent = statusLabel;

  document.getElementById('modalTitle').textContent    = item.nama;
  document.getElementById('modalCategory').textContent = `📦 ${item.kategori}`;

  const tabType = state.activeTab === 'lspro'
    ? 'Lembaga Sertifikasi Produk (LSPro)'
    : 'Laboratorium Pengujian';

  document.getElementById('modalBody').innerHTML = `
    <div>
      <div class="modal-section-title">Informasi Masa Berlaku</div>
      <div class="modal-info-grid">
        <div class="modal-info-item">
          <div class="modal-info-label">Mulai Berlaku</div>
          <div class="modal-info-value">${startFormatted}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Berakhir</div>
          <div class="modal-info-value">${endFormatted}</div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Sisa Masa Berlaku</div>
          <div class="modal-info-value" style="color:${item.status==='aktif'?'var(--green-l)':item.status==='segera'?'var(--orange-l)':'var(--red-l)'}">
            ${daysText}
          </div>
        </div>
        <div class="modal-info-item">
          <div class="modal-info-label">Jenis Lembaga</div>
          <div class="modal-info-value" style="font-size:0.8rem">${tabType}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="modal-section-title">Timeline Masa Berlaku</div>
      <div class="modal-timeline">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
          <span>Mulai: ${startFormatted}</span>
          <span>Berakhir: ${endFormatted}</span>
        </div>
        <div class="timeline-bar">
          <div class="timeline-fill fill-${item.status}" style="width:${item.status==='kadaluarsa'?100:progressPct}%"></div>
        </div>
        <div style="text-align:center;font-size:0.8rem;color:var(--text-muted)">
          Progress: ${item.status==='kadaluarsa'?'Sudah berakhir':progressPct+'% masa berlaku telah digunakan'}
        </div>
      </div>
    </div>

    <div>
      <div class="modal-section-title">Alamat</div>
      <div class="modal-alamat">${escapeHtml(item.alamat).replace(/\n/g, '<br>')}</div>
    </div>

    ${item.keterangan ? `
    <div>
      <div class="modal-section-title">Keterangan Akreditasi</div>
      <div class="modal-keterangan">${escapeHtml(item.keterangan).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
  `;

  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ============================================================
   CONTROLS
   ============================================================ */
function clearSearch() {
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

function resetFilters() {
  state.searchQuery    = '';
  state.filterKategori = '';
  state.filterStatus   = '';
  state.activeCategory = '';
  document.getElementById('searchInput').value    = '';
  document.getElementById('searchClear').style.display = 'none';
  document.getElementById('filterKategori').value = '';
  document.getElementById('filterStatus').value   = '';
  applyFilters();
}

function setView(mode) {
  state.viewMode = mode;
  const grid = document.getElementById('dataGrid');
  grid.classList.toggle('list-view', mode === 'list');
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
}

/* ============================================================
   UTILITIES
   ============================================================ */
function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function animateNumber(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateFooterDate() {
  const today = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('footerDate').textContent = today.toLocaleDateString('id-ID', opts);
}

function showError(msg) {
  const grid = document.getElementById('dataGrid');
  grid.innerHTML = `
    <div class="loading-state" style="color:var(--red-l)">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <p>${msg}</p>
    </div>
  `;
}

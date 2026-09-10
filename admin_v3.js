/* ============================================================
   ADMIN.JS — Manajemen Data LSPro & Lab Uji
   ============================================================ */

const API = 'http://localhost:8787';
const THRESHOLD = 60;

/* ---- State ---- */
let DB = { lspro: [], lab_uji: [], generated_at: '' };
let hasChanges = false;
let currentPage = 'lspro';

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  showPage('lspro');
  updateStats();
  updateBadges();

  // Tutup modal kalau klik overlay
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
  });

  // Escape key tutup modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Kategori dropdown di form: tampilkan input baru jika pilih "+ Tambah..."
  document.getElementById('f-kategori').addEventListener('change', function () {
    document.getElementById('f-kategori-new').style.display = this.value === '__new__' ? 'block' : 'none';
  });
});

/* ============================================================
   LOAD DATA dari server
   ============================================================ */
async function loadData() {
  try {
    const res  = await fetch(`${API}/data_v3.json?v=${Date.now()}`);
    const json = await res.json();
    DB.lspro          = json.lspro    || [];
    DB.lab_uji        = json.lab_uji  || [];
    DB.generated_at   = json.generated_at || '';
    hasChanges = false;
    setChangeIndicator(false);
  } catch (e) {
    showToast('Gagal memuat data dari server. Pastikan server.py sudah berjalan.', 'error');
    console.error(e);
  }
}

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */
function showPage(page) {
  currentPage = page;
  ['lspro','labuji','kategori'].forEach(p => {
    document.getElementById(`page-${p}`).style.display = p === page ? '' : 'none';
    document.getElementById(`nav-${p === 'labuji' ? 'labuji' : p}`).classList.toggle('active', p === page);
  });

  const titles = { lspro: 'Data LSPro', labuji: 'Data Lab Uji', kategori: 'Manajemen Kategori' };
  document.getElementById('topbarTitle').textContent = titles[page];

  if (page === 'lspro')    { renderTable('lspro');   buildKatFilter('lspro'); }
  if (page === 'labuji')   { renderTable('labuji');  buildKatFilter('labuji'); }
  if (page === 'kategori') renderKategori();
}

/* ============================================================
   STATUS HELPER
   ============================================================ */
function getStatus(jangka_waktu) {
  if (!jangka_waktu) return 'aktif';
  const today    = new Date(); today.setHours(0,0,0,0);
  const end      = new Date(jangka_waktu);
  const daysLeft = Math.ceil((end - today) / 86400000);
  if (daysLeft < 0)          return 'kadaluarsa';
  if (daysLeft <= THRESHOLD) return 'segera';
  return 'aktif';
}

function daysText(jangka_waktu) {
  if (!jangka_waktu) return '—';
  const today    = new Date(); today.setHours(0,0,0,0);
  const end      = new Date(jangka_waktu);
  const daysLeft = Math.ceil((end - today) / 86400000);
  if (daysLeft < 0)  return `${Math.abs(daysLeft)} hari lalu`;
  if (daysLeft === 0) return 'Hari ini!';
  return `${daysLeft} hari lagi`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   STATS & BADGES
   ============================================================ */
function updateStats() {
  const allData  = [...DB.lspro, ...DB.lab_uji];
  const segeara  = allData.filter(d => getStatus(d.jangka_waktu) === 'segera').length;
  const allKats  = new Set([...DB.lspro.map(d=>d.kategori), ...DB.lab_uji.map(d=>d.kategori)]);

  document.getElementById('st-lspro').textContent    = DB.lspro.length;
  document.getElementById('st-labuji').textContent   = DB.lab_uji.length;
  document.getElementById('st-kategori').textContent = allKats.size;
  document.getElementById('st-segera').textContent   = segeara;
}

function updateBadges() {
  document.getElementById('badge-lspro').textContent   = DB.lspro.length;
  document.getElementById('badge-labuji').textContent  = DB.lab_uji.length;
  const allKats = new Set([...DB.lspro.map(d=>d.kategori), ...DB.lab_uji.map(d=>d.kategori)]);
  document.getElementById('badge-kategori').textContent = allKats.size;
}

function setChangeIndicator(changed) {
  hasChanges = changed;
  const el = document.getElementById('changeIndicator');
  el.style.display = changed ? 'inline-flex' : 'none';
}

/* ============================================================
   BUILD KATEGORI FILTER
   ============================================================ */
function buildKatFilter(tab) {
  const dataArr = tab === 'lspro' ? DB.lspro : DB.lab_uji;
  const cats    = [...new Set(dataArr.map(d => d.kategori).filter(Boolean))].sort();
  const sel     = document.getElementById(`kat-${tab}`);
  const cur     = sel.value;
  sel.innerHTML = `<option value="">Semua Kategori</option>`;
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (c === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ============================================================
   RENDER TABLE
   ============================================================ */
function renderTable(tab) {
  const tbody    = document.getElementById(`tbody-${tab}`);
  const dataArr  = tab === 'lspro' ? DB.lspro : DB.lab_uji;
  const search   = (document.getElementById(`search-${tab}`)?.value || '').toLowerCase();
  const katFilter= document.getElementById(`kat-${tab}`)?.value || '';
  const statFilt = document.getElementById(`status-${tab}`)?.value || '';

  let filtered = dataArr.filter((d, i) => {
    if (katFilter  && d.kategori !== katFilter) return false;
    if (statFilter(d, statFilt))                return false;
    if (search) {
      const hay = `${d.nama} ${d.alamat} ${d.kategori} ${d.keterangan}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById(`count-${tab}`).textContent =
    `Menampilkan ${filtered.length} dari ${dataArr.length} data`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Tidak ada data ditemukan</span>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((d, fi) => {
    // Cari index asli di array untuk edit/hapus
    const realIdx = dataArr.indexOf(d);
    const st      = getStatus(d.jangka_waktu);
    const stLabel = {aktif:'Masih Berlaku', segera:'Segera Berakhir', kadaluarsa:'Sudah Berakhir'}[st];
    const stBadge = `badge-${st}`;
    return `
      <tr>
        <td style="color:var(--text-dim);font-size:0.78rem">${realIdx + 1}</td>
        <td class="td-nama">
          ${esc(d.nama)}
          <small>${esc(d.alamat?.substring(0, 60))}${d.alamat?.length > 60 ? '…' : ''}</small>
        </td>
        <td><span class="tag">${esc(d.kategori)}</span></td>
        <td style="font-size:0.8rem;white-space:nowrap">${fmtDate(d.mulai_berlaku)}</td>
        <td style="font-size:0.8rem;white-space:nowrap">
          ${fmtDate(d.jangka_waktu)}<br>
          <small style="color:var(--text-muted)">${daysText(d.jangka_waktu)}</small>
        </td>
        <td><span class="badge ${stBadge}">${stLabel}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="openForm('${tab}', ${realIdx})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('${tab}', ${realIdx})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function statFilter(d, f) {
  if (!f) return false;
  return getStatus(d.jangka_waktu) !== f;
}

/* ============================================================
   FORM — TAMBAH / EDIT
   ============================================================ */
function openForm(tab, idx = null) {
  document.getElementById('formTab').value = tab;
  document.getElementById('formIdx').value = idx !== null ? idx : '';

  // Populate kategori dropdown
  populateKatDropdown(tab);

  if (idx !== null) {
    const d = (tab === 'lspro' ? DB.lspro : DB.lab_uji)[idx];
    document.getElementById('modalFormTitle').textContent = 'Edit Lembaga';
    document.getElementById('f-nama').value       = d.nama       || '';
    document.getElementById('f-alamat').value     = d.alamat     || '';
    document.getElementById('f-mulai').value      = d.mulai_berlaku || '';
    document.getElementById('f-jangka').value     = d.jangka_waktu  || '';
    document.getElementById('f-keterangan').value = d.keterangan || '';
    document.getElementById('f-kategori').value   = d.kategori   || '';
  } else {
    document.getElementById('modalFormTitle').textContent = `Tambah ${tab === 'lspro' ? 'LSPro' : 'Lab Uji'} Baru`;
    document.getElementById('f-nama').value       = '';
    document.getElementById('f-alamat').value     = '';
    document.getElementById('f-mulai').value      = '';
    document.getElementById('f-jangka').value     = '';
    document.getElementById('f-keterangan').value = '';
    document.getElementById('f-kategori').value   = '';
  }
  document.getElementById('f-kategori-new').style.display = 'none';
  document.getElementById('f-kategori-new').value = '';

  document.getElementById('modalForm').classList.add('open');
  setTimeout(() => document.getElementById('f-nama').focus(), 100);
}

function populateKatDropdown(tab) {
  const allKats = [...new Set([...DB.lspro.map(d=>d.kategori), ...DB.lab_uji.map(d=>d.kategori)].filter(Boolean))].sort();
  const sel     = document.getElementById('f-kategori');
  sel.innerHTML = `<option value="">-- Pilih Kategori --</option>`;
  allKats.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    sel.appendChild(opt);
  });
  sel.innerHTML += `<option value="__new__">+ Tambah kategori baru...</option>`;
}

function closeForm() {
  document.getElementById('modalForm').classList.remove('open');
}

function saveForm() {
  const tab  = document.getElementById('formTab').value;
  const idx  = document.getElementById('formIdx').value;
  const nama = document.getElementById('f-nama').value.trim();
  const alamat     = document.getElementById('f-alamat').value.trim();
  const mulai      = document.getElementById('f-mulai').value;
  const jangka     = document.getElementById('f-jangka').value;
  const keterangan = document.getElementById('f-keterangan').value.trim();

  let kategori = document.getElementById('f-kategori').value;
  if (kategori === '__new__') {
    kategori = document.getElementById('f-kategori-new').value.trim();
    if (!kategori) { showToast('Nama kategori baru wajib diisi.', 'error'); return; }
  }

  if (!nama)     { showToast('Nama lembaga wajib diisi.', 'error'); return; }
  if (!alamat)   { showToast('Alamat wajib diisi.', 'error'); return; }
  if (!kategori) { showToast('Kategori wajib dipilih.', 'error'); return; }
  if (!mulai)    { showToast('Tanggal mulai berlaku wajib diisi.', 'error'); return; }
  if (!jangka)   { showToast('Tanggal berakhir wajib diisi.', 'error'); return; }

  const dataArr = tab === 'lspro' ? DB.lspro : DB.lab_uji;

  const entry = { nama, alamat, mulai_berlaku: mulai, jangka_waktu: jangka, keterangan, kategori };

  if (idx !== '') {
    // Pertahankan field 'no' yang ada
    entry.no = dataArr[parseInt(idx)].no || '';
    dataArr[parseInt(idx)] = entry;
    showToast('Data berhasil diperbarui!', 'success');
  } else {
    entry.no = String(dataArr.length + 1) + '.';
    dataArr.push(entry);
    showToast('Lembaga baru berhasil ditambahkan!', 'success');
  }

  closeForm();
  setChangeIndicator(true);
  renderTable(tab);
  buildKatFilter(tab);
  updateStats();
  updateBadges();
}

/* ============================================================
   DELETE
   ============================================================ */
function deleteItem(tab, idx) {
  const dataArr = tab === 'lspro' ? DB.lspro : DB.lab_uji;
  const nama    = dataArr[idx]?.nama || 'item ini';

  if (!confirm(`Hapus "${nama}"?\n\nTindakan ini tidak bisa dibatalkan.`)) return;

  dataArr.splice(idx, 1);
  // Re-number
  dataArr.forEach((d, i) => { d.no = String(i + 1) + '.'; });

  showToast('Data berhasil dihapus.', 'info');
  setChangeIndicator(true);
  renderTable(tab);
  buildKatFilter(tab);
  updateStats();
  updateBadges();
}

/* ============================================================
   KATEGORI PAGE
   ============================================================ */
function renderKategori() {
  const lsproKats  = [...new Set(DB.lspro.map(d=>d.kategori).filter(Boolean))].sort();
  const labujiKats = [...new Set(DB.lab_uji.map(d=>d.kategori).filter(Boolean))].sort();
  const allKats    = [...new Set([...lsproKats, ...labujiKats])].sort();

  const grid = document.getElementById('kat-grid');
  if (allKats.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted)">Belum ada kategori.</p>`;
    return;
  }

  grid.innerHTML = allKats.map(kat => {
    const lsproCount  = DB.lspro.filter(d  => d.kategori === kat).length;
    const labujiCount = DB.lab_uji.filter(d => d.kategori === kat).length;
    return `
      <div class="kat-card">
        <div class="kat-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <div class="kat-info">
          <div class="kat-name">${esc(kat)}</div>
          <div class="kat-count">LSPro: ${lsproCount} · Lab Uji: ${labujiCount}</div>
        </div>
        <div class="kat-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditKategori('${esc(kat)}')" title="Rename">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteKategori('${esc(kat)}')" title="Hapus">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function openAddKategori() {
  document.getElementById('modalKatTitle').textContent = 'Tambah Kategori Baru';
  document.getElementById('f-kat-name').value = '';
  document.getElementById('f-kat-old').value  = '';
  document.getElementById('modalKat').classList.add('open');
  setTimeout(() => document.getElementById('f-kat-name').focus(), 100);
}

function openEditKategori(oldName) {
  document.getElementById('modalKatTitle').textContent = 'Rename Kategori';
  document.getElementById('f-kat-name').value = oldName;
  document.getElementById('f-kat-old').value  = oldName;
  document.getElementById('modalKat').classList.add('open');
  setTimeout(() => document.getElementById('f-kat-name').focus(), 100);
}

function closeKatModal() {
  document.getElementById('modalKat').classList.remove('open');
}

function saveKategori() {
  const newName = document.getElementById('f-kat-name').value.trim();
  const oldName = document.getElementById('f-kat-old').value.trim();

  if (!newName) { showToast('Nama kategori tidak boleh kosong.', 'error'); return; }

  if (oldName) {
    // Rename: update semua lembaga yang pakai kategori lama
    DB.lspro.forEach(d  => { if (d.kategori === oldName) d.kategori = newName; });
    DB.lab_uji.forEach(d => { if (d.kategori === oldName) d.kategori = newName; });
    showToast(`Kategori "${oldName}" diubah menjadi "${newName}".`, 'success');
  } else {
    showToast(`Kategori "${newName}" siap dipakai saat tambah lembaga.`, 'info');
  }

  closeKatModal();
  setChangeIndicator(true);
  renderKategori();
  updateStats();
  updateBadges();
}

function deleteKategori(kat) {
  const lsproCount  = DB.lspro.filter(d  => d.kategori === kat).length;
  const labujiCount = DB.lab_uji.filter(d => d.kategori === kat).length;
  const total       = lsproCount + labujiCount;

  const msg = total > 0
    ? `Hapus kategori "${kat}"?\n\nKategori ini dipakai oleh ${total} lembaga.\nLembaga tersebut akan kehilangan kategorinya.`
    : `Hapus kategori "${kat}"?`;

  if (!confirm(msg)) return;

  DB.lspro.forEach(d  => { if (d.kategori === kat) d.kategori = ''; });
  DB.lab_uji.forEach(d => { if (d.kategori === kat) d.kategori = ''; });

  showToast(`Kategori "${kat}" dihapus.`, 'info');
  setChangeIndicator(true);
  renderKategori();
  updateStats();
  updateBadges();
}

/* ============================================================
   SAVE & PUSH
   ============================================================ */
function openPushModal() {
  document.getElementById('pushLog').classList.remove('visible');
  document.getElementById('pushLog').textContent = '';
  document.getElementById('modalPush').classList.add('open');
}

function closePushModal() {
  document.getElementById('modalPush').classList.remove('open');
}

async function saveData() {
  const btn = document.getElementById('btnSaveOnly');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    const res  = await fetch(`${API}/api/save_v3`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(DB)
    });
    const data = await res.json();
    if (data.ok) {
      showToast('✅ ' + data.message, 'success');
      setChangeIndicator(false);
      DB.generated_at = data.generated_at;
    } else {
      showToast('❌ ' + data.message, 'error');
    }
  } catch (e) {
    showToast('❌ Gagal konek ke server lokal. Pastikan server.py berjalan.', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg> Simpan Saja`;
  }
}

async function saveAndPush() {
  const btn      = document.getElementById('btnPush');
  const logEl    = document.getElementById('pushLog');
  const commitMsg= document.getElementById('commitMsg').value.trim() || 'update: data LSPro & Lab Uji';

  btn.disabled = true; btn.textContent = '⏳ Memproses...';
  logEl.classList.add('visible');
  logEl.textContent = '[1/2] Menyimpan data_v3.json...\n';

  try {
    // Step 1: Save
    const saveRes  = await fetch(`${API}/api/save_v3`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DB)
    });
    const saveData = await saveRes.json();
    if (!saveData.ok) throw new Error('Gagal simpan: ' + saveData.message);
    logEl.textContent += `✅ ${saveData.message}\n\n[2/2] Menjalankan git push...\n`;
    DB.generated_at = saveData.generated_at;
    setChangeIndicator(false);

    // Step 2: Push
    const pushRes  = await fetch(`${API}/api/push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMsg })
    });
    const pushData = await pushRes.json();
    if (pushData.ok) {
      logEl.textContent += `✅ ${pushData.message}\n\n--- Log Git ---\n${pushData.log}`;
      showToast('✅ Berhasil disimpan dan di-push ke GitHub!', 'success');
    } else {
      logEl.textContent += `❌ ${pushData.message}`;
      showToast('⚠️ Data tersimpan, tapi push gagal. Cek log.', 'error');
    }

  } catch (e) {
    logEl.textContent += `\n❌ Error: ${e.message}`;
    showToast('❌ Gagal. Pastikan server.py berjalan dan ada koneksi internet.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Simpan & Push GitHub`;
  }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'info') {
  const el = document.getElementById('adminToast');
  el.textContent = msg;
  el.className   = `show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 4500);
}

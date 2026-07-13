// ===== API HELPER =====
const API = '/api';
let authToken = localStorage.getItem('sdp_token') || null;

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['x-auth-token'] = authToken;
  const res = await fetch(API + url, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401) {
    authToken = null;
    localStorage.removeItem('sdp_token');
    localStorage.removeItem('sdp_user');
    currentUser = null;
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    throw new Error('Sesi berakhir');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ===== SSE REAL-TIME SYNC =====
let evtSource = null;
function connectSSE() {
  if (evtSource) evtSource.close();
  evtSource = new EventSource(API + '/events?token=' + encodeURIComponent(authToken || ''));
  evtSource.addEventListener('siswa', () => { if (currentActivePage === 'siswa') renderSiswaTable(); if (currentActivePage === 'dashboard') refreshDashboard(); });
  evtSource.addEventListener('jenisbayar', () => { if (currentActivePage === 'pembayaran') renderJenisBayarTable(); if (currentActivePage === 'transaksi') populateTransaksiForm(); });
  evtSource.addEventListener('transaksi', () => { if (currentActivePage === 'transaksi') renderTransaksiTable(); if (currentActivePage === 'dashboard') refreshDashboard(); });
  evtSource.addEventListener('stor', () => { if (currentActivePage === 'storbendahara') renderStorTable(); });
  evtSource.addEventListener('users', () => { if (currentActivePage === 'pengaturan') { renderUserTable(); renderChangePasswordSelect(); } });
  evtSource.addEventListener('profil', () => { if (currentActivePage === 'pengaturan') loadProfil(); });
  evtSource.onerror = () => { setTimeout(connectSSE, 5000); };
}

// ===== STATE =====
let DB = { users: [], siswa: [], jenisBayar: [], transaksi: [], stor: [], riwayatWa: [], profil: {} };
let currentUser = null;
let detailTransaksiId = null;
let currentActivePage = 'dashboard';

// ===== INIT =====
async function init() {
  const savedUser = localStorage.getItem('sdp_user');
  if (savedUser && authToken) {
    try {
      currentUser = JSON.parse(savedUser);
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      document.getElementById('currentUser').innerHTML = '<i class="fas fa-user"></i> ' + currentUser.nama;
      document.getElementById('currentDate').textContent = formatDate(new Date());
      document.getElementById('filterTanggal').value = new Date().toISOString().split('T')[0];
      await showPage('dashboard');
      return;
    } catch (e) {
      authToken = null;
      localStorage.removeItem('sdp_token');
      localStorage.removeItem('sdp_user');
    }
  }
  document.getElementById('currentDate').textContent = formatDate(new Date());
  document.getElementById('filterTanggal').value = new Date().toISOString().split('T')[0];
}

// ===== FORMAT HELPERS =====
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(date) {
  return new Date(date).toLocaleDateString('id-ID');
}

function getKelasText(kelas) {
  return `Kelas ${kelas}`;
}

function getKategoriBadge(kategori) {
  switch (kategori) {
    case 'LKS': return 'primary';
    case 'Aktivitas': return 'warning';
    case 'Iuran': return 'success';
    default: return 'info';
  }
}

function generateNoBayar() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(DB.transaksi.length + 1).padStart(4, '0');
  return `BYR-${y}${m}${d}-${seq}`;
}

function generateNoStor() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(DB.stor.length + 1).padStart(4, '0');
  return `STR-${y}${m}${d}-${seq}`;
}

function formatWaNumber(hp) {
  let num = hp.replace(/\D/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  if (!num.startsWith('62')) num = '62' + num;
  return num;
}

// ===== AUTH =====
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const user = await api('/login', { method: 'POST', body: { username, password } });
    authToken = user.token;
    currentUser = user;
    localStorage.setItem('sdp_token', user.token);
    localStorage.setItem('sdp_user', JSON.stringify({ id: user.id, nama: user.nama, username: user.username, role: user.role }));
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('currentUser').innerHTML = '<i class="fas fa-user"></i> ' + user.nama;
    document.getElementById('loginError').textContent = '';
    document.getElementById('currentDate').textContent = formatDate(new Date());
    document.getElementById('filterTanggal').value = new Date().toISOString().split('T')[0];
    showPage('dashboard');
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
  }
}

function handleLogout() {
  if (!confirm('Yakin ingin keluar?')) return;
  api('/logout', { method: 'POST' }).catch(() => {});
  authToken = null;
  currentUser = null;
  localStorage.removeItem('sdp_token');
  localStorage.removeItem('sdp_user');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// ===== NAVIGATION =====
async function showPage(page) {
  currentActivePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
  const pageMap = { dashboard: 'pageDashboard', siswa: 'pageSiswa', pembayaran: 'pagePembayaran', transaksi: 'pageTransaksi', storbendahara: 'pageStorbendahara', laporan: 'pageLaporan', whatsapp: 'pageWhatsapp', pengaturan: 'pagePengaturan' };
  const titleMap = { dashboard: 'Dashboard', siswa: 'Data Siswa', pembayaran: 'Jenis Pembayaran', transaksi: 'Transaksi', storbendahara: 'Stor ke Bendahara', laporan: 'Laporan', whatsapp: 'Kirim WhatsApp', pengaturan: 'Pengaturan' };
  document.getElementById(pageMap[page]).classList.add('active');
  document.getElementById('pageTitle').textContent = titleMap[page];
  const items = document.querySelectorAll('.sidebar-menu li');
  const idx = ['dashboard','siswa','pembayaran','transaksi','storbendahara','laporan','whatsapp','pengaturan'].indexOf(page);
  if (idx >= 0) items[idx].classList.add('active');
  try {
    const [users, siswa, jenisBayar, transaksi, stor, riwayatWa, profil] = await Promise.all([
      api('/users'), api('/siswa'), api('/jenisbayar'),
      api('/transaksi'), api('/stor'), api('/riwayat-wa'), api('/profil')
    ]);
    DB = { users, siswa, jenisBayar, transaksi, stor, riwayatWa, profil };
  } catch (e) { console.warn('Load error:', e); }
  connectSSE();
  const fn = { dashboard: refreshDashboard, siswa: renderSiswaTable, pembayaran: renderJenisBayarTable, transaksi: renderTransaksiTable, storbendahara: renderStorTable, laporan: generateLaporanHarian, whatsapp: populateWaSiswa, pengaturan: () => { renderUserTable(); renderChangePasswordSelect(); loadProfil(); } };
  if (fn[page]) fn[page]();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('show');
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ===== MODAL =====
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'transaksiModal') {
    populateTransaksiForm();
    document.getElementById('txTanggal').value = new Date().toISOString().split('T')[0];
  }
  if (id === 'storModal') document.getElementById('storTanggal').value = new Date().toISOString().split('T')[0];
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  ['siswaForm','jenisBayarForm','transaksiForm','storForm','userForm','changePasswordForm'].forEach(fId => {
    const f = document.getElementById(fId);
    if (f) f.reset();
  });
  document.getElementById('siswaEditId').value = '';
  document.getElementById('siswaModalTitle').textContent = 'Tambah Siswa';
  document.getElementById('jenisBayarEditId').value = '';
  document.getElementById('jenisBayarModalTitle').textContent = 'Tambah Jenis Pembayaran';
  document.getElementById('userEditId').value = '';
  document.getElementById('userModalTitle').textContent = 'Tambah User';
}

// ===== SISWA =====
async function handleSiswaForm(e) {
  e.preventDefault();
  const editId = document.getElementById('siswaEditId').value;
  const data = {
    nis: document.getElementById('siswaNis').value,
    nama: document.getElementById('siswaNama').value,
    kelas: document.getElementById('siswaKelas').value,
    angkatan: document.getElementById('siswaAngkatan').value,
    orangTua: document.getElementById('siswaOrangTua').value,
    noHp: document.getElementById('siswaNoHp').value,
    alamat: document.getElementById('siswaAlamat').value
  };
  if (editId) {
    await api(`/siswa/${editId}`, { method: 'PUT', body: data });
  } else {
    await api('/siswa', { method: 'POST', body: data });
  }
  DB.siswa = await api('/siswa');
  closeModal('siswaModal');
  renderSiswaTable();
}

function editSiswa(id) {
  const s = DB.siswa.find(x => x.id === id);
  if (!s) return;
  document.getElementById('siswaModalTitle').textContent = 'Edit Siswa';
  document.getElementById('siswaEditId').value = s.id;
  document.getElementById('siswaNis').value = s.nis;
  document.getElementById('siswaNama').value = s.nama;
  document.getElementById('siswaKelas').value = s.kelas;
  document.getElementById('siswaAngkatan').value = s.angkatan || '';
  document.getElementById('siswaOrangTua').value = s.orangTua || '';
  document.getElementById('siswaNoHp').value = s.noHp || '';
  document.getElementById('siswaAlamat').value = s.alamat || '';
  openModal('siswaModal');
}

async function deleteSiswa(id) {
  if (!confirm('Yakin ingin menghapus siswa ini?')) return;
  await api(`/siswa/${id}`, { method: 'DELETE' });
  DB.siswa = await api('/siswa');
  DB.transaksi = await api('/transaksi');
  renderSiswaTable();
}

function renderSiswaTable() {
  const tbody = document.getElementById('siswaTableBody');
  const search = (document.getElementById('searchSiswa')?.value || '').toLowerCase();
  const filtered = DB.siswa.filter(s =>
    s.nama.toLowerCase().includes(search) || (s.nis||'').includes(search) || (s.kelas||'').includes(search)
  );
  tbody.innerHTML = filtered.map((s, i) => `
    <tr>
      <td><input type="checkbox" class="siswa-check" value="${s.id}" onchange="updateBulkSiswaBtn()"></td>
      <td>${i + 1}</td>
      <td>${s.nis}</td>
      <td>${s.nama}</td>
      <td><span class="badge badge-primary">${getKelasText(s.kelas)}</span></td>
      <td>${s.orangTua || '-'}</td>
      <td>${s.noHp || '-'}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-info" onclick="editSiswa(${s.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-icon btn-danger" onclick="deleteSiswa(${s.id})" title="Hapus"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.getElementById('checkAllSiswa').checked = false;
  updateBulkSiswaBtn();
}

function filterSiswa() { renderSiswaTable(); }
function toggleAllSiswa(el) { document.querySelectorAll('.siswa-check').forEach(cb => cb.checked = el.checked); updateBulkSiswaBtn(); }
function updateBulkSiswaBtn() { document.getElementById('btnHapusSiswa').style.display = document.querySelectorAll('.siswa-check:checked').length > 0 ? '' : 'none'; }

async function bulkDeleteSiswa() {
  const ids = [...document.querySelectorAll('.siswa-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return;
  if (!confirm(`Hapus ${ids.length} siswa yang ditandai?`)) return;
  for (const id of ids) { await api(`/siswa/${id}`, { method: 'DELETE' }); }
  DB.siswa = await api('/siswa');
  DB.transaksi = await api('/transaksi');
  renderSiswaTable();
}

async function hapusSemuaSiswa() {
  if (!DB.siswa.length) return alert('Tidak ada data siswa!');
  if (!confirm('Hapus SEMUA siswa & transaksinya?')) return;
  await api('/siswa', { method: 'DELETE' });
  DB.siswa = [];
  DB.transaksi = await api('/transaksi');
  renderSiswaTable();
}

function exportSiswa() {
  let csv = 'NIS,Nama,Kelas,Angkatan,Orang Tua,No HP,Alamat\n';
  DB.siswa.forEach(s => { csv += `"${s.nis}","${s.nama}","${getKelasText(s.kelas)}","${s.angkatan||''}","${s.orangTua||''}","${s.noHp||''}","${s.alamat||''}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Data_Siswa.csv'; a.click();
}

// ===== JENIS BAYAR =====
async function handleJenisBayarForm(e) {
  e.preventDefault();
  const editId = document.getElementById('jenisBayarEditId').value;
  const data = {
    kode: document.getElementById('jenisBayarKode').value,
    nama: document.getElementById('jenisBayarNama').value,
    kategori: document.getElementById('jenisBayarKategori').value,
    nominal: parseInt(document.getElementById('jenisBayarNominal').value) || 0,
    tahun: document.getElementById('jenisBayarTahun').value,
    kelas: document.getElementById('jenisBayarKelas').value
  };
  if (editId) { await api(`/jenisbayar/${editId}`, { method: 'PUT', body: data }); }
  else { await api('/jenisbayar', { method: 'POST', body: data }); }
  DB.jenisBayar = await api('/jenisbayar');
  closeModal('jenisBayarModal');
  renderJenisBayarTable();
}

function editJenisBayar(id) {
  const j = DB.jenisBayar.find(x => x.id === id);
  if (!j) return;
  document.getElementById('jenisBayarModalTitle').textContent = 'Edit Jenis Pembayaran';
  document.getElementById('jenisBayarEditId').value = j.id;
  document.getElementById('jenisBayarKode').value = j.kode;
  document.getElementById('jenisBayarNama').value = j.nama;
  document.getElementById('jenisBayarKategori').value = j.kategori;
  document.getElementById('jenisBayarNominal').value = j.nominal;
  document.getElementById('jenisBayarTahun').value = j.tahun || '';
  document.getElementById('jenisBayarKelas').value = j.kelas || 'all';
  openModal('jenisBayarModal');
}

async function deleteJenisBayar(id) {
  if (!confirm('Hapus jenis pembayaran ini?')) return;
  await api(`/jenisbayar/${id}`, { method: 'DELETE' });
  DB.jenisBayar = await api('/jenisbayar');
  renderJenisBayarTable();
}

function renderJenisBayarTable() {
  const tbody = document.getElementById('jenisBayarBody');
  tbody.innerHTML = DB.jenisBayar.map((j, i) => `
    <tr>
      <td><input type="checkbox" class="jenisbayar-check" value="${j.id}" onchange="updateBulkJenisBayarBtn()"></td>
      <td>${i + 1}</td>
      <td><span class="badge badge-info">${j.kode}</span></td>
      <td>${j.nama}</td>
      <td><span class="badge badge-${getKategoriBadge(j.kategori)}">${j.kategori}</span></td>
      <td>${formatRupiah(j.nominal)}</td>
      <td>${j.tahun || '-'}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-info" onclick="editJenisBayar(${j.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-icon btn-danger" onclick="deleteJenisBayar(${j.id})" title="Hapus"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.getElementById('checkAllJenisBayar').checked = false;
  updateBulkJenisBayarBtn();
}

function toggleAllJenisBayar(el) { document.querySelectorAll('.jenisbayar-check').forEach(cb => cb.checked = el.checked); updateBulkJenisBayarBtn(); }
function updateBulkJenisBayarBtn() { document.getElementById('btnHapusJenisBayar').style.display = document.querySelectorAll('.jenisbayar-check:checked').length > 0 ? '' : 'none'; }

async function bulkDeleteJenisBayar() {
  const ids = [...document.querySelectorAll('.jenisbayar-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return;
  if (!confirm(`Hapus ${ids.length} jenis pembayaran?`)) return;
  for (const id of ids) { await api(`/jenisbayar/${id}`, { method: 'DELETE' }); }
  DB.jenisBayar = await api('/jenisbayar');
  renderJenisBayarTable();
}

async function hapusSemuaJenisBayar() {
  if (!DB.jenisBayar.length) return alert('Tidak ada data!');
  if (!confirm('Hapus SEMUA jenis pembayaran?')) return;
  await api('/jenisbayar', { method: 'DELETE' });
  DB.jenisBayar = [];
  renderJenisBayarTable();
}

// ===== TRANSAKSI =====
function populateTransaksiForm() {
  const select = document.getElementById('txSiswa');
  select.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
    DB.siswa.map(s => `<option value="${s.id}">${s.nama} (${getKelasText(s.kelas)})</option>`).join('');
}

function loadJenisBayarForSiswa() {
  const siswaId = parseInt(document.getElementById('txSiswa').value);
  const siswa = DB.siswa.find(s => s.id === siswaId);
  const select = document.getElementById('txJenis');
  if (!siswa) { select.innerHTML = '<option value="">-- Pilih Jenis --</option>'; document.getElementById('txKelas').value = ''; return; }
  document.getElementById('txKelas').value = getKelasText(siswa.kelas);
  const available = DB.jenisBayar.filter(jb => {
    if (jb.kelas === 'all') return true;
    if (jb.kelas.includes('-')) { const [min, max] = jb.kelas.split('-').map(Number); return parseInt(siswa.kelas) >= min && parseInt(siswa.kelas) <= max; }
    return jb.kelas === siswa.kelas;
  });
  select.innerHTML = '<option value="">-- Pilih Jenis --</option>' +
    available.map(jb => `<option value="${jb.id}">${jb.nama} - ${formatRupiah(jb.nominal)}</option>`).join('');
}

function updateTxNominal() {
  const jenisId = parseInt(document.getElementById('txJenis').value);
  const jb = DB.jenisBayar.find(j => j.id === jenisId);
  document.getElementById('txNominal').value = jb ? formatRupiah(jb.nominal) : '';
}

async function handleTransaksiForm(e) {
  e.preventDefault();
  const siswaId = parseInt(document.getElementById('txSiswa').value);
  const siswa = DB.siswa.find(s => s.id === siswaId);
  const jenisId = parseInt(document.getElementById('txJenis').value);
  const jenis = DB.jenisBayar.find(j => j.id === jenisId);
  if (!siswa || !jenis) return alert('Data tidak lengkap!');

  const tx = {
    noBayar: generateNoBayar(), tanggal: document.getElementById('txTanggal').value,
    siswaId: siswa.id, siswaNama: siswa.nama, siswaKelas: siswa.kelas,
    jenisId: jenis.id, jenisNama: jenis.nama, kategori: jenis.kategori,
    nominal: jenis.nominal, metode: document.getElementById('txMetode').value,
    keterangan: document.getElementById('txKeterangan').value,
    status: 'Lunas', waktu: new Date().toLocaleTimeString('id-ID')
  };

  await api('/transaksi', { method: 'POST', body: tx });
  DB.transaksi = await api('/transaksi');
  closeModal('transaksiModal');
  renderTransaksiTable();
  alert('Transaksi berhasil! No: ' + tx.noBayar);
}

function renderTransaksiTable() {
  const tbody = document.getElementById('transaksiBody');
  const search = (document.getElementById('searchTransaksi')?.value || '').toLowerCase();
  const filtered = DB.transaksi.filter(t =>
    (t.noBayar||'').toLowerCase().includes(search) || (t.siswaNama||'').toLowerCase().includes(search) || (t.jenisNama||'').toLowerCase().includes(search)
  );
  tbody.innerHTML = filtered.map((t, i) => `
    <tr>
      <td><input type="checkbox" class="transaksi-check" value="${t.id}" onchange="updateBulkTransaksiBtn()"></td>
      <td>${i + 1}</td>
      <td><span class="badge badge-info">${t.noBayar}</span></td>
      <td>${formatDateShort(t.tanggal)}</td>
      <td>${t.siswaNama}</td>
      <td><span class="badge badge-${getKategoriBadge(t.kategori)}">${t.jenisNama}</span></td>
      <td>${formatRupiah(t.nominal)}</td>
      <td><span class="badge badge-success">${t.status}</span></td>
      <td class="table-actions">
        <button class="btn btn-icon btn-info" onclick="detailTransaksi(${t.id})" title="Detail"><i class="fas fa-eye"></i></button>
        <button class="btn btn-icon btn-whatsapp" onclick="kirimWaStrukById(${t.id})" title="Kirim WA"><i class="fab fa-whatsapp"></i></button>
        <button class="btn btn-icon btn-danger" onclick="deleteTransaksi(${t.id})" title="Hapus"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.getElementById('checkAllTransaksi').checked = false;
  updateBulkTransaksiBtn();
}

function filterTransaksi() { renderTransaksiTable(); }
function toggleAllTransaksi(el) { document.querySelectorAll('.transaksi-check').forEach(cb => cb.checked = el.checked); updateBulkTransaksiBtn(); }
function updateBulkTransaksiBtn() { document.getElementById('btnHapusTransaksi').style.display = document.querySelectorAll('.transaksi-check:checked').length > 0 ? '' : 'none'; }

function detailTransaksi(id) {
  const t = DB.transaksi.find(x => x.id === id);
  if (!t) return;
  detailTransaksiId = id;
  document.getElementById('detailTransaksiContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">No. Bayar</span><span class="detail-value">${t.noBayar}</span></div>
    <div class="detail-row"><span class="detail-label">Tanggal</span><span class="detail-value">${formatDate(t.tanggal)} ${t.waktu||''}</span></div>
    <div class="detail-row"><span class="detail-label">Siswa</span><span class="detail-value">${t.siswaNama}</span></div>
    <div class="detail-row"><span class="detail-label">Kelas</span><span class="detail-value">${getKelasText(t.siswaKelas)}</span></div>
    <div class="detail-row"><span class="detail-label">Jenis</span><span class="detail-value">${t.jenisNama}</span></div>
    <div class="detail-row"><span class="detail-label">Kategori</span><span class="detail-value"><span class="badge badge-${getKategoriBadge(t.kategori)}">${t.kategori}</span></span></div>
    <div class="detail-row"><span class="detail-label">Nominal</span><span class="detail-value">${formatRupiah(t.nominal)}</span></div>
    <div class="detail-row"><span class="detail-label">Metode</span><span class="detail-value">${t.metode}</span></div>
    <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-success">${t.status}</span></span></div>
    ${t.keterangan ? `<div class="detail-row"><span class="detail-label">Keterangan</span><span class="detail-value">${t.keterangan}</span></div>` : ''}
  `;
  openModal('detailTransaksiModal');
}

async function deleteTransaksi(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  await api(`/transaksi/${id}`, { method: 'DELETE' });
  DB.transaksi = await api('/transaksi');
  renderTransaksiTable();
}

async function bulkDeleteTransaksi() {
  const ids = [...document.querySelectorAll('.transaksi-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return;
  if (!confirm(`Hapus ${ids.length} transaksi?`)) return;
  for (const id of ids) { await api(`/transaksi/${id}`, { method: 'DELETE' }); }
  DB.transaksi = await api('/transaksi');
  renderTransaksiTable();
}

async function hapusSemuaTransaksi() {
  if (!DB.transaksi.length) return alert('Tidak ada data!');
  if (!confirm('Hapus SEMUA transaksi?')) return;
  await api('/transaksi', { method: 'DELETE' });
  DB.transaksi = [];
  renderTransaksiTable();
}

// ===== STOR =====
async function handleStorForm(e) {
  e.preventDefault();
  const stor = {
    noStor: generateNoStor(), tanggal: document.getElementById('storTanggal').value,
    oleh: document.getElementById('storOleh').value,
    jumlah: parseInt(document.getElementById('storJumlah').value) || 0,
    catatan: document.getElementById('storCatatan').value
  };
  await api('/stor', { method: 'POST', body: stor });
  DB.stor = await api('/stor');
  closeModal('storModal');
  renderStorTable();
  alert('Berhasil! No: ' + stor.noStor);
}

function renderStorTable() {
  const tbody = document.getElementById('storBody');
  tbody.innerHTML = DB.stor.map((s, i) => `
    <tr>
      <td><input type="checkbox" class="stor-check" value="${s.id}" onchange="updateBulkStorBtn()"></td>
      <td>${i + 1}</td>
      <td><span class="badge badge-info">${s.noStor}</span></td>
      <td>${formatDateShort(s.tanggal)}</td>
      <td>${s.oleh || '-'}</td>
      <td>${formatRupiah(s.jumlah)}</td>
      <td>${s.catatan || '-'}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-info" onclick="printStorById(${s.id})" title="Cetak"><i class="fas fa-print"></i></button>
        <button class="btn btn-icon btn-danger" onclick="deleteStor(${s.id})" title="Hapus"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.getElementById('checkAllStor').checked = false;
  updateBulkStorBtn();
}

function toggleAllStor(el) { document.querySelectorAll('.stor-check').forEach(cb => cb.checked = el.checked); updateBulkStorBtn(); }
function updateBulkStorBtn() { document.getElementById('btnHapusStor').style.display = document.querySelectorAll('.stor-check:checked').length > 0 ? '' : 'none'; }

async function deleteStor(id) {
  if (!confirm('Hapus data stor ini?')) return;
  await api(`/stor/${id}`, { method: 'DELETE' });
  DB.stor = await api('/stor');
  renderStorTable();
}

async function bulkDeleteStor() {
  const ids = [...document.querySelectorAll('.stor-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return;
  if (!confirm(`Hapus ${ids.length} data stor?`)) return;
  for (const id of ids) { await api(`/stor/${id}`, { method: 'DELETE' }); }
  DB.stor = await api('/stor');
  renderStorTable();
}

async function hapusSemuaStor() {
  if (!DB.stor.length) return alert('Tidak ada data!');
  if (!confirm('Hapus SEMUA data stor?')) return;
  await api('/stor', { method: 'DELETE' });
  DB.stor = [];
  renderStorTable();
}

function printStorById(id) {
  const s = DB.stor.find(x => x.id === id);
  if (s) printStorData([s]);
}

function printStor() {
  if (!DB.stor.length) return alert('Belum ada data stor!');
  printStorData(DB.stor);
}

function printStorData(data) {
  let html = `<h2>SURAT SETOR / STOR KE BENDAHARA</h2><p>${DB.profil.namaSekolah || 'SD Negeri 1 Selopuro'}</p><hr>
    <table><thead><tr><th>No</th><th>No. Stor</th><th>Tanggal</th><th>Disetor Oleh</th><th>Jumlah</th><th>Catatan</th></tr></thead><tbody>`;
  let total = 0;
  data.forEach((s, i) => { total += s.jumlah; html += `<tr><td>${i+1}</td><td>${s.noStor}</td><td>${formatDateShort(s.tanggal)}</td><td>${s.oleh||''}</td><td>${formatRupiah(s.jumlah)}</td><td>${s.catatan||''}</td></tr>`; });
  html += `</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">TOTAL</td><td style="font-weight:bold;">${formatRupiah(total)}</td><td></td></tr></tfoot></table>
    <br><br><div style="display:flex;justify-content:space-between;margin-top:40px;">
    <div style="text-align:center;width:200px;"><p><strong>Yang Menyetor</strong></p><br><br><br><p>_________________</p></div>
    <div style="text-align:center;width:200px;"><p><strong>Bendahara</strong></p><br><br><br><p>_________________</p></div></div>`;
  document.getElementById('printArea').innerHTML = html;
  window.print();
}

// ===== DASHBOARD =====
function refreshDashboard() {
  document.getElementById('totalSiswa').textContent = DB.siswa.length;
  document.getElementById('totalLunas').textContent = DB.transaksi.length;
  const siswaBayar = new Set(DB.transaksi.map(t => t.siswaId));
  document.getElementById('totalBelumBayar').textContent = DB.siswa.length - siswaBayar.size;
  document.getElementById('totalPemasukan').textContent = formatRupiah(DB.transaksi.reduce((s, t) => s + t.nominal, 0));

  const recent = [...DB.transaksi].slice(0, 5);
  document.getElementById('recentTransactionsBody').innerHTML = recent.map(t => `
    <tr><td>${formatDateShort(t.tanggal)}</td><td>${t.siswaNama}</td>
    <td><span class="badge badge-${getKategoriBadge(t.kategori)}">${t.jenisNama}</span></td>
    <td>${formatRupiah(t.nominal)}</td></tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Belum ada transaksi</td></tr>';

  const colors = { LKS: '#3b82f6', Aktivitas: '#f97316', Iuran: '#22c55e', Lainnya: '#06b6d4' };
  let summaryHtml = '';
  DB.jenisBayar.forEach(jb => {
    const txs = DB.transaksi.filter(t => t.jenisId === jb.id);
    const total = txs.reduce((s, t) => s + t.nominal, 0);
    summaryHtml += `<div class="summary-item"><div class="summary-label"><div class="summary-dot" style="background:${colors[jb.kategori]||'#06b6d4'}"></div><span>${jb.nama}</span></div><div><span class="badge badge-info">${txs.length}</span> <span style="margin-left:8px;font-weight:600;">${formatRupiah(total)}</span></div></div>`;
  });
  document.getElementById('summaryList').innerHTML = summaryHtml || '<p style="text-align:center;color:#94a3b8;">Belum ada data</p>';
}

// ===== LAPORAN =====
function showLaporanTab(tab) {
  document.querySelectorAll('.laporan-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabMap = { harian:'laporanHarian', bulanan:'laporanBulanan', kelas:'laporanKelas', ringkasan:'laporanRingkasan', lpihak:'laporanLpihak' };
  document.getElementById(tabMap[tab]).classList.add('active');
  const idx = ['harian','bulanan','kelas','ringkasan','lpihak'].indexOf(tab);
  document.querySelectorAll('.tab-btn')[idx].classList.add('active');
  const tabFns = { harian: generateLaporanHarian, bulanan: generateLaporanBulanan, kelas: generateLaporanKelas, ringkasan: generateRingkasan, lpihak: generateLpihak };
  tabFns[tab]();
}

function generateLaporanHarian() {
  const tanggal = document.getElementById('filterTanggal').value;
  const filtered = DB.transaksi.filter(t => t.tanggal === tanggal);
  document.getElementById('laporanHarianBody').innerHTML = filtered.map((t, i) =>
    `<tr><td>${i+1}</td><td>${t.noBayar}</td><td>${t.siswaNama}</td><td>${getKelasText(t.siswaKelas)}</td><td>${t.jenisNama}</td><td>${formatRupiah(t.nominal)}</td><td>${t.waktu||''}</td></tr>`
  ).join('') || '<tr><td colspan="7" style="text-align:center;">Tidak ada transaksi</td></tr>';
  const total = filtered.reduce((s, t) => s + t.nominal, 0);
  document.getElementById('laporanHarianTotal').innerHTML = `<span>Total: <strong>${formatRupiah(total)}</strong></span><span>Jumlah: <strong>${filtered.length}</strong></span>`;
}

function generateLaporanBulanan() {
  const bulan = parseInt(document.getElementById('filterBulan').value);
  const tahun = parseInt(document.getElementById('filterTahun').value);
  const filtered = DB.transaksi.filter(t => { const d = new Date(t.tanggal); return (d.getMonth()+1) === bulan && d.getFullYear() === tahun; });
  document.getElementById('laporanBulananBody').innerHTML = filtered.map((t, i) =>
    `<tr><td>${i+1}</td><td>${t.noBayar}</td><td>${t.siswaNama}</td><td>${getKelasText(t.siswaKelas)}</td><td>${t.jenisNama}</td><td>${formatDateShort(t.tanggal)}</td><td>${formatRupiah(t.nominal)}</td></tr>`
  ).join('') || '<tr><td colspan="7" style="text-align:center;">Tidak ada transaksi</td></tr>';
  const total = filtered.reduce((s, t) => s + t.nominal, 0);
  document.getElementById('laporanBulananTotal').innerHTML = `<span>Total: <strong>${formatRupiah(total)}</strong></span><span>Jumlah: <strong>${filtered.length}</strong></span>`;
}

function generateLaporanKelas() {
  const kelas = document.getElementById('filterKelas').value;
  const siswaList = kelas ? DB.siswa.filter(s => s.kelas === kelas) : DB.siswa;
  document.getElementById('laporanKelasBody').innerHTML = siswaList.map((s, i) => {
    const txSiswa = DB.transaksi.filter(t => t.siswaId === s.id);
    const lks = txSiswa.filter(t => t.kategori === 'LKS').reduce((sum, t) => sum + t.nominal, 0);
    const akt = txSiswa.filter(t => t.kategori === 'Aktivitas').reduce((sum, t) => sum + t.nominal, 0);
    const iuran = txSiswa.filter(t => t.kategori === 'Iuran').reduce((sum, t) => sum + t.nominal, 0);
    const totalBayar = lks + akt + iuran;
    const totalTagihan = DB.jenisBayar.reduce((sum, jb) => {
      if (jb.kelas === 'all') return sum + jb.nominal;
      if (jb.kelas.includes('-')) { const parts = jb.kelas.split('-').map(Number); return (parseInt(s.kelas) >= parts[0] && parseInt(s.kelas) <= parts[1]) ? sum + jb.nominal : sum; }
      return jb.kelas === s.kelas ? sum + jb.nominal : sum;
    }, 0);
    const sisa = totalTagihan - totalBayar;
    let status, badge;
    if (sisa <= 0) { status = 'Lunas'; badge = 'badge-success'; }
    else if (totalBayar > 0) { status = 'Sebagian'; badge = 'badge-warning'; }
    else { status = 'Belum'; badge = 'badge-danger'; }
    return `<tr><td>${i+1}</td><td>${s.nama}</td><td>${getKelasText(s.kelas)}</td><td>${formatRupiah(lks)}</td><td>${formatRupiah(akt)}</td><td>${formatRupiah(iuran)}</td><td>${formatRupiah(totalBayar)}</td><td><span class="badge ${badge}">${status}</span></td></tr>`;
  }).join('');
}

function generateRingkasan() {
  const kelas = document.getElementById('filterRingkasanKelas').value;
  const statusFilter = document.getElementById('filterRingkasanStatus').value;
  const siswaList = kelas ? DB.siswa.filter(s => s.kelas === kelas) : DB.siswa;
  let totalLunas=0, totalBelum=0, totalSebagian=0;

  const rows = siswaList.map((s, i) => {
    const txSiswa = DB.transaksi.filter(t => t.siswaId === s.id);
    const totalBayar = txSiswa.reduce((sum, t) => sum + t.nominal, 0);
    const detailItems = DB.jenisBayar.filter(jb => {
      if (jb.kelas === 'all') return true;
      if (jb.kelas.includes('-')) { const [min,max] = jb.kelas.split('-').map(Number); return parseInt(s.kelas) >= min && parseInt(s.kelas) <= max; }
      return jb.kelas === s.kelas;
    });
    const totalTagihan = detailItems.reduce((sum, jb) => sum + jb.nominal, 0);
    const detailHtml = detailItems.map(jb => {
      const paid = txSiswa.filter(t => t.jenisId === jb.id).reduce((sum, t) => sum + t.nominal, 0);
      const color = paid >= jb.nominal ? '#16a34a' : (paid > 0 ? '#f97316' : '#dc2626');
      const icon = paid >= jb.nominal ? 'fa-check-circle' : (paid > 0 ? 'fa-clock' : 'fa-times-circle');
      return `<span class="item-tag" style="background:${color}15;color:${color};border:1px solid ${color}40;"><i class="fas ${icon}"></i> ${jb.nama}: ${formatRupiah(paid)}/${formatRupiah(jb.nominal)}</span>`;
    }).join(' ');
    const sisa = totalTagihan - totalBayar;
    let status, badgeClass;
    if (sisa <= 0) { status='Lunas'; badgeClass='badge-success'; totalLunas++; }
    else if (totalBayar > 0) { status='Sebagian'; badgeClass='badge-warning'; totalSebagian++; }
    else { status='Belum Bayar'; badgeClass='badge-danger'; totalBelum++; }
    if (statusFilter==='lunas' && status!=='Lunas') return null;
    if (statusFilter==='belum' && status!=='Belum Bayar') return null;
    if (statusFilter==='sebagian' && status!=='Sebagian') return null;
    return `<tr><td>${i+1}</td><td><strong>${s.nama}</strong></td><td><span class="badge badge-primary">${getKelasText(s.kelas)}</span></td><td>${s.orangTua||''}</td><td>${s.noHp||''}</td><td>${formatRupiah(totalTagihan)}</td><td style="color:var(--success);font-weight:600;">${formatRupiah(totalBayar)}</td><td style="color:${sisa>0?'var(--danger)':'var(--success)'};font-weight:600;">${formatRupiah(sisa>0?sisa:0)}</td><td><div class="item-tags-container">${detailHtml}</div></td><td><span class="badge ${badgeClass}">${status}</span></td></tr>`;
  }).filter(Boolean);

  document.getElementById('laporanRingkasanBody').innerHTML = rows.join('') || '<tr><td colspan="10" style="text-align:center;">Tidak ada data</td></tr>';
  document.getElementById('ringkasanStats').innerHTML = `
    <div class="ringkasan-stat-grid">
      <div class="ringkasan-stat blue"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${siswaList.length}</h3><p>Total Siswa</p></div></div>
      <div class="ringkasan-stat green"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-info"><h3>${totalLunas}</h3><p>Lunas</p></div></div>
      <div class="ringkasan-stat orange"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-info"><h3>${totalSebagian}</h3><p>Sebagian</p></div></div>
      <div class="ringkasan-stat red"><div class="stat-icon"><i class="fas fa-times-circle"></i></div><div class="stat-info"><h3>${totalBelum}</h3><p>Belum Bayar</p></div></div>
    </div>`;
}

function generateLpihak() {
  const kelas = document.getElementById('filterPiutangKelas').value;
  const siswaList = kelas ? DB.siswa.filter(s => s.kelas === kelas) : DB.siswa;
  document.getElementById('laporanPiutangBody').innerHTML = siswaList.map((s, i) => {
    const totalBayar = DB.transaksi.filter(t => t.siswaId === s.id).reduce((sum, t) => sum + t.nominal, 0);
    const totalTagihan = DB.jenisBayar.reduce((sum, jb) => {
      if (jb.kelas === 'all') return sum + jb.nominal;
      if (jb.kelas.includes('-')) { const parts = jb.kelas.split('-').map(Number); return (parseInt(s.kelas) >= parts[0] && parseInt(s.kelas) <= parts[1]) ? sum + jb.nominal : sum; }
      return jb.kelas === s.kelas ? sum + jb.nominal : sum;
    }, 0);
    return `<tr><td>${i+1}</td><td>${s.nama}</td><td>${getKelasText(s.kelas)}</td><td>${s.orangTua||''}</td><td>${s.noHp||''}</td><td>${formatRupiah(totalTagihan)}</td><td>${formatRupiah(totalBayar)}</td><td style="color:${(totalTagihan-totalBayar)>0?'var(--danger)':'var(--success)'};font-weight:600;">${formatRupiah(totalTagihan-totalBayar)}</td></tr>`;
  }).join('');
}

function printLaporan(type) {
  let title='', content='';
  switch(type) {
    case 'harian': {
      const tanggal = document.getElementById('filterTanggal').value;
      title='Laporan Harian';
      const filtered = DB.transaksi.filter(t => t.tanggal===tanggal);
      content=`<p>Tanggal: ${formatDate(tanggal)}</p><table><thead><tr><th>No</th><th>No. Bayar</th><th>Siswa</th><th>Kelas</th><th>Jenis</th><th>Nominal</th><th>Jam</th></tr></thead><tbody>`;
      let total=0; filtered.forEach((t,i)=>{total+=t.nominal; content+=`<tr><td>${i+1}</td><td>${t.noBayar}</td><td>${t.siswaNama}</td><td>${getKelasText(t.siswaKelas)}</td><td>${t.jenisNama}</td><td>${formatRupiah(t.nominal)}</td><td>${t.waktu||''}</td></tr>`;});
      content+=`</tbody><tfoot><tr><td colspan="5" style="text-align:right;font-weight:bold;">TOTAL</td><td style="font-weight:bold;">${formatRupiah(total)}</td><td></td></tr></tfoot></table>`;
      break;
    }
    case 'bulanan': {
      const bulan=document.getElementById('filterBulan').value, tahun=document.getElementById('filterTahun').value;
      const nb=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      title=`Laporan Bulanan - ${nb[bulan-1]} ${tahun}`;
      const filtered=DB.transaksi.filter(t=>{const d=new Date(t.tanggal);return(d.getMonth()+1)===parseInt(bulan)&&d.getFullYear()===parseInt(tahun);});
      content=`<table><thead><tr><th>No</th><th>No. Bayar</th><th>Siswa</th><th>Kelas</th><th>Jenis</th><th>Tanggal</th><th>Nominal</th></tr></thead><tbody>`;
      let total=0;filtered.forEach((t,i)=>{total+=t.nominal;content+=`<tr><td>${i+1}</td><td>${t.noBayar}</td><td>${t.siswaNama}</td><td>${getKelasText(t.siswaKelas)}</td><td>${t.jenisNama}</td><td>${formatDateShort(t.tanggal)}</td><td>${formatRupiah(t.nominal)}</td></tr>`;});
      content+=`</tbody><tfoot><tr><td colspan="6" style="text-align:right;font-weight:bold;">TOTAL</td><td style="font-weight:bold;">${formatRupiah(total)}</td></tr></tfoot></table>`;
      break;
    }
    case 'ringkasan': {
      title='Ringkasan Pembayaran Per Siswa';
      content=`<table><thead><tr><th>No</th><th>Nama</th><th>Kelas</th><th>Tagihan</th><th>Bayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>`;
      DB.siswa.forEach((s,i)=>{
        const totalBayar=DB.transaksi.filter(t=>t.siswaId===s.id).reduce((sum,t)=>sum+t.nominal,0);
        const totalTagihan=DB.jenisBayar.reduce((sum,jb)=>{if(jb.kelas==='all')return sum+jb.nominal;if(jb.kelas.includes('-')){const parts=jb.kelas.split('-').map(Number);return(parseInt(s.kelas)>=parts[0]&&parseInt(s.kelas)<=parts[1])?sum+jb.nominal:sum;}return jb.kelas===s.kelas?sum+jb.nominal:sum;},0);
        const sisa=totalTagihan-totalBayar;const status=sisa<=0?'Lunas':totalBayar>0?'Sebagian':'Belum';
        content+=`<tr><td>${i+1}</td><td>${s.nama}</td><td>${getKelasText(s.kelas)}</td><td>${formatRupiah(totalTagihan)}</td><td>${formatRupiah(totalBayar)}</td><td>${formatRupiah(sisa>0?sisa:0)}</td><td>${status}</td></tr>`;
      });
      content+=`</tbody></table>`;
      break;
    }
    case 'piutang': {
      title='Lampiran Piutang';
      content=`<table><thead><tr><th>No</th><th>Siswa</th><th>Kelas</th><th>Orang Tua</th><th>No HP</th><th>Tagihan</th><th>Terbayar</th><th>Sisa</th></tr></thead><tbody>`;
      DB.siswa.forEach((s,i)=>{
        const totalBayar=DB.transaksi.filter(t=>t.siswaId===s.id).reduce((sum,t)=>sum+t.nominal,0);
        const totalTagihan=DB.jenisBayar.reduce((sum,jb)=>{if(jb.kelas==='all')return sum+jb.nominal;if(jb.kelas.includes('-')){const parts=jb.kelas.split('-').map(Number);return(parseInt(s.kelas)>=parts[0]&&parseInt(s.kelas)<=parts[1])?sum+jb.nominal:sum;}return jb.kelas===s.kelas?sum+jb.nominal:sum;},0);
        content+=`<tr><td>${i+1}</td><td>${s.nama}</td><td>${getKelasText(s.kelas)}</td><td>${s.orangTua||''}</td><td>${s.noHp||''}</td><td>${formatRupiah(totalTagihan)}</td><td>${formatRupiah(totalBayar)}</td><td>${formatRupiah(totalTagihan-totalBayar)}</td></tr>`;
      });
      content+=`</tbody></table>`;
      break;
    }
  }
  document.getElementById('printArea').innerHTML=`<h2>${title}</h2><p>${DB.profil.namaSekolah||'SD Negeri 1 Selopuro'}</p><hr>${content}`;
  window.print();
}

// ===== WHATSAPP =====
function populateWaSiswa() {
  document.getElementById('waSiswa').innerHTML = '<option value="">-- Pilih Siswa --</option>' +
    DB.siswa.map(s => `<option value="${s.id}">${s.nama} - ${s.orangTua||''} (${s.noHp||''})</option>`).join('');
  previewWaMessage();
}

function previewWaMessage() {
  const template = document.getElementById('waTemplate').value;
  const siswa = DB.siswa.find(s => s.id === parseInt(document.getElementById('waSiswa').value));
  let msg = '';
  if (template === 'tagihan' && siswa) {
    const totalBayar = DB.transaksi.filter(t => t.siswaId === siswa.id).reduce((s,t) => s+t.nominal, 0);
    const totalTagihan = DB.jenisBayar.reduce((s,jb) => s+jb.nominal, 0);
    const sisa = totalTagihan - totalBayar;
    msg = `Yth. Bapak/Ibu ${siswa.orangTua||''},\n\nAssalamu'alaikum Wr. Wb.\n\nKami dari ${DB.profil.namaSekolah||'SD Negeri 1 Selopuro'} memberitahukan tagihan untuk ${siswa.nama} (${getKelasText(siswa.kelas)}):\n\nTagihan: ${formatRupiah(totalTagihan)}\nSudah Bayar: ${formatRupiah(totalBayar)}\nSisa: ${formatRupiah(sisa>0?sisa:0)}\n\n${sisa>0?'Mohon segera melakukan pembayaran.':'Alhamdulillah, tagihan lunas.'}\n\nWassalamu'alaikum Wr. Wb.`;
  } else if (template === 'reminder' && siswa) {
    msg = `Yth. Bapak/Ibu ${siswa.orangTua||''},\n\nKami ingatkan tagihan ${siswa.nama} (${getKelasText(siswa.kelas)}) masih ada yang belum diselesaikan.\n\nTerima kasih.\n${DB.profil.namaSekolah||'SD Negeri 1 Selopuro'}`;
  } else if (template === 'lunas' && siswa) {
    msg = `Yth. Bapak/Ibu ${siswa.orangTua||''},\n\nAlhamdulillah, pembayaran ${siswa.nama} telah LUNAS.\n\nTerima kasih.\n${DB.profil.namaSekolah||'SD Negeri 1 Selopuro'}`;
  } else if (template === 'stapor' && siswa) {
    msg = `Yth. Bapak/Ibu ${siswa.orangTua||''},\n\nMohon kesediaan menandatangani STAPOR untuk ${siswa.nama}.\n\nTerima kasih.\n${DB.profil.namaSekolah||'SD Negeri 1 Selopuro'}`;
  } else {
    msg = 'Pilih siswa terlebih dahulu.';
  }
  document.getElementById('waPreview').textContent = msg;
}

function kirimWaIndividu() {
  const siswa = DB.siswa.find(s => s.id === parseInt(document.getElementById('waSiswa').value));
  if (!siswa) return alert('Pilih siswa!');
  const msg = document.getElementById('waPreview').textContent;
  window.open(`https://wa.me/${formatWaNumber(siswa.noHp||'080000000000')}?text=${encodeURIComponent(msg)}`, '_blank');
  logWaRiwayat(siswa.nama, 'Individu');
}

function kirimWaSemua() {
  const belumBayarIds = new Set(DB.siswa.map(s => s.id));
  DB.transaksi.forEach(t => belumBayarIds.delete(t.siswaId));
  if (!belumBayarIds.size) return alert('Semua sudah bayar!');
  let count = 0;
  belumBayarIds.forEach(id => {
    const s = DB.siswa.find(x => x.id === id);
    if (s && s.noHp) {
      const msg = `Yth. ${s.orangTua||''},\n\nTagihan ${s.nama} (${getKelasText(s.kelas)}) masih ada yang belum dibayar.\nMohon segera bayar.\n\n${DB.profil.namaSekolah||'SDN 1 Selopuro'}`;
      setTimeout(() => window.open(`https://wa.me/${formatWaNumber(s.noHp)}?text=${encodeURIComponent(msg)}`, '_blank'), count*500);
      count++;
    }
  });
  logWaRiwayat(`${count} orang tua`, 'Bulk');
  alert(`Membuka ${count} chat WhatsApp.`);
}

function kirimWaGrup() {
  const msg = encodeURIComponent(`Assalamu'alaikum Wr. Wb.\n\nYth. Bapak/Ibu Wali Kelas,\n\nMohon informasikan tagihan LKS, Aktivitas & Iuran.\n\n${DB.profil.namaSekolah||'SDN 1 Selopuro'}`);
  window.open(`https://chat.whatsapp.com/?text=${msg}`, '_blank');
  logWaRiwayat('Grup Wali Kelas', 'Grup');
}

function kirimWaStrukById(id) {
  const t = DB.transaksi.find(x => x.id === id);
  if (!t) return;
  const siswa = DB.siswa.find(s => s.id === t.siswaId);
  const msg = `Yth. ${siswa?.orangTua||''},\n\nPembayaran ${t.siswaNama} diterima:\nNo: ${t.noBayar}\nTanggal: ${formatDate(t.tanggal)}\nJenis: ${t.jenisNama}\nNominal: ${formatRupiah(t.nominal)}\nStatus: LUNAS\n\n${DB.profil.namaSekolah||'SDN 1 Selopuro'}`;
  if (siswa && siswa.noHp) {
    window.open(`https://wa.me/${formatWaNumber(siswa.noHp)}?text=${encodeURIComponent(msg)}`, '_blank');
    logWaRiwayat(t.siswaNama, 'Struk');
  } else alert('No HP tidak tersedia!');
}

function kirimWaStruk() { if (detailTransaksiId) kirimWaStrukById(detailTransaksiId); }

async function logWaRiwayat(penerima, jenis) {
  const data = { tanggal: formatDateShort(new Date())+' '+new Date().toLocaleTimeString('id-ID'), penerima, jenis, status: 'Terkirim' };
  await api('/riwayat-wa', { method: 'POST', body: data });
  DB.riwayatWa = await api('/riwayat-wa');
  renderRiwayatWa();
}

function renderRiwayatWa() {
  document.getElementById('riwayatWaBody').innerHTML = DB.riwayatWa.map(r => `
    <tr><td>${r.tanggal||''}</td><td>${r.penerima||''}</td><td>${r.jenis||''}</td><td><span class="badge badge-success">${r.status||'Terkirim'}</span></td>
    <td><button class="btn btn-icon btn-whatsapp" onclick="kirimUlangWa('${(r.penerima||'').replace(/'/g,"\\'")}')" title="Kirim Ulang"><i class="fas fa-redo"></i></button></td></tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;">Belum ada riwayat</td></tr>';
}

function kirimUlangWa(penerima) {
  const s = DB.siswa.find(x => x.nama === penerima || x.orangTua === penerima);
  if (s) { document.getElementById('waSiswa').value = s.id; previewWaMessage(); }
}

// ===== PENGATURAN =====
function showPengaturanTab(tab) {
  document.querySelectorAll('.pengaturan-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.pengaturan-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab === 'akun' ? 'pengaturanAkun' : 'pengaturanProfil').classList.add('active');
  document.querySelectorAll('.pengaturan-tabs .tab-btn')[tab === 'akun' ? 0 : 1].classList.add('active');
}

function renderUserTable() {
  document.getElementById('userTableBody').innerHTML = DB.users.map((u, i) => {
    const sb = u.status==='aktif' ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Nonaktif</span>';
    const rb = u.role==='admin' ? 'badge-primary' : u.role==='bendahara' ? 'badge-success' : 'badge-info';
    return `<tr>
      <td><input type="checkbox" class="user-check" value="${u.id}" onchange="updateBulkUserBtn()"></td>
      <td>${i+1}</td><td><strong>${u.username}</strong></td><td>${u.nama}</td>
      <td><span class="badge ${rb}">${(u.role||'').charAt(0).toUpperCase()+(u.role||'').slice(1)}</span></td><td>${sb}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-info" onclick="editUser(${u.id})" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-icon btn-${u.status==='aktif'?'warning':'success'}" onclick="toggleUserStatus(${u.id})" title="${u.status==='aktif'?'Nonaktifkan':'Aktifkan'}"><i class="fas fa-${u.status==='aktif'?'ban':'check'}"></i></button>
        <button class="btn btn-icon btn-danger" onclick="deleteUser(${u.id})" title="Hapus"><i class="fas fa-trash"></i></button>
      </td></tr>`;
  }).join('');
  document.getElementById('checkAllUser').checked = false;
  updateBulkUserBtn();
}

async function handleUserForm(e) {
  e.preventDefault();
  const editId = document.getElementById('userEditId').value;
  const data = {
    username: document.getElementById('userUsername').value,
    nama: document.getElementById('userNama').value,
    password: document.getElementById('userPassword').value,
    role: document.getElementById('userRole').value
  };
  if (editId) {
    await api(`/users/${editId}`, { method: 'PUT', body: { ...data, status: 'aktif' } });
  } else {
    await api('/users', { method: 'POST', body: data });
  }
  DB.users = await api('/users');
  closeModal('userModal');
  renderUserTable();
  renderChangePasswordSelect();
}

function editUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userEditId').value = u.id;
  document.getElementById('userUsername').value = u.username;
  document.getElementById('userNama').value = u.nama;
  document.getElementById('userPassword').value = '********';
  document.getElementById('userRole').value = u.role;
  openModal('userModal');
}

async function deleteUser(id) {
  if (!confirm('Hapus user ini?')) return;
  await api(`/users/${id}`, { method: 'DELETE' });
  DB.users = await api('/users');
  renderUserTable();
  renderChangePasswordSelect();
}

async function toggleUserStatus(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  if (u.id === currentUser?.id) return alert('Tidak bisa nonaktifkan akun sendiri!');
  await api(`/users/${id}`, { method: 'PUT', body: { ...u, status: u.status === 'aktif' ? 'nonaktif' : 'aktif' } });
  DB.users = await api('/users');
  renderUserTable();
}

function toggleAllUser(el) { document.querySelectorAll('.user-check').forEach(cb => cb.checked = el.checked); updateBulkUserBtn(); }
function updateBulkUserBtn() { document.getElementById('btnHapusUser').style.display = document.querySelectorAll('.user-check:checked').length > 0 ? '' : 'none'; }

async function bulkDeleteUser() {
  const ids = [...document.querySelectorAll('.user-check:checked')].map(cb => parseInt(cb.value));
  if (!ids.length) return;
  if (ids.includes(currentUser?.id)) { alert('Tidak bisa hapus akun sendiri!'); return; }
  if (!confirm(`Hapus ${ids.length} user?`)) return;
  for (const id of ids) { await api(`/users/${id}`, { method: 'DELETE' }); }
  DB.users = await api('/users');
  renderUserTable();
  renderChangePasswordSelect();
}

async function hapusSemuaUser() {
  if (DB.users.length <= 1) return alert('Tidak ada user lain!');
  if (!confirm('Hapus SEMUA user kecuali akun login?')) return;
  await api(`/users?keepId=${currentUser.id}`, { method: 'DELETE' });
  DB.users = await api('/users');
  renderUserTable();
  renderChangePasswordSelect();
}

function renderChangePasswordSelect() {
  document.getElementById('cpUserSelect').innerHTML = '<option value="">-- Pilih User --</option>' +
    DB.users.map(u => `<option value="${u.id}">${u.nama} (${u.username})</option>`).join('');
}

function loadCurrentPassword() {}

async function handleChangePassword(e) {
  e.preventDefault();
  const userId = parseInt(document.getElementById('cpUserSelect').value);
  const passLama = document.getElementById('cpPassLama').value;
  const passBaru = document.getElementById('cpPassBaru').value;
  const passKonf = document.getElementById('cpPassKonfirmasi').value;
  if (!userId) return alert('Pilih user!');
  if (currentUser?.role !== 'admin' && currentUser?.id !== userId) return alert('Tidak punya akses!');
  if (passBaru !== passKonf) return alert('Password baru tidak cocok!');
  if (passBaru.length < 4) return alert('Password minimal 4 karakter!');
  try {
    await api('/change-password', { method: 'POST', body: { userId, passLama, passBaru } });
    document.getElementById('changePasswordForm').reset();
    alert('Password berhasil diubah!');
  } catch (err) { alert(err.message); }
}

function loadProfil() {
  const p = DB.profil || {};
  document.getElementById('profilNamaSekolah').value = p.namaSekolah || '';
  document.getElementById('profilNPSN').value = p.npsn || '';
  document.getElementById('profilAlamat').value = p.alamat || '';
  document.getElementById('profilTelp').value = p.telp || '';
  document.getElementById('profilEmail').value = p.email || '';
  document.getElementById('profilKepsek').value = p.kepsek || '';
  document.getElementById('profilBendahara').value = p.bendahara || '';
}

async function handleProfilForm(e) {
  e.preventDefault();
  const data = {
    namaSekolah: document.getElementById('profilNamaSekolah').value,
    npsn: document.getElementById('profilNPSN').value,
    alamat: document.getElementById('profilAlamat').value,
    telp: document.getElementById('profilTelp').value,
    email: document.getElementById('profilEmail').value,
    kepsek: document.getElementById('profilKepsek').value,
    bendahara: document.getElementById('profilBendahara').value
  };
  await api('/profil', { method: 'PUT', body: data });
  DB.profil = data;
  alert('Profil berhasil disimpan!');
}

// ===== START =====
init();

// ===== MANUAL SYNC =====
async function manualSync() {
  try {
    const indicator = document.getElementById('syncIndicator');
    const syncText = document.getElementById('syncText');
    if (indicator) { indicator.className = 'sync-indicator syncing'; }
    if (syncText) { syncText.textContent = 'Syncing...'; }

    await api('/sync', { method: 'POST' });

    const [users, siswa, jenisBayar, transaksi, stor, riwayatWa, profil] = await Promise.all([
      api('/users'), api('/siswa'), api('/jenisbayar'),
      api('/transaksi'), api('/stor'), api('/riwayat-wa'), api('/profil')
    ]);
    DB = { users, siswa, jenisBayar, transaksi, stor, riwayatWa, profil };

    if (indicator) { indicator.className = 'sync-indicator online'; }
    if (syncText) { syncText.textContent = 'Online'; }

    const fn = { dashboard: refreshDashboard, siswa: renderSiswaTable, pembayaran: renderJenisBayarTable, transaksi: renderTransaksiTable, storbendahara: renderStorTable, laporan: generateLaporanHarian, whatsapp: populateWaSiswa, pengaturan: () => { renderUserTable(); renderChangePasswordSelect(); loadProfil(); } };
    if (fn[currentActivePage]) fn[currentActivePage]();
    alert('Data berhasil di-sync!');
  } catch (e) {
    alert('Gagal sync: ' + e.message);
  }
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// ===== SUPABASE (optional for local) =====
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zizonqnqqgxrxqkivpzs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppem9ucW5xcWd4cnhxa2l2cHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MzU0MTYsImV4cCI6MjA5OTUxMTQxNn0.OARAvtw1YnH4GfQXZlU-r74XWmBxH8yrTO2p_Z0ZVc8';

try {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('  Supabase: terhubung');
} catch (e) {
  console.log('  Supabase: tidak tersedia, pakai file lokal');
}

// ===== JSON DATABASE =====
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('DB error:', e.message); }
  return null;
}
function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), 'utf8');
  } catch (e) {
    console.error('Gagal simpan DB:', e.message);
  }
}

const DEFAULTS = {
  profil: { namaSekolah: 'SD Negeri 1 Selopuro', npsn: '20310868', alamat: 'Jl. Merdeka No. 1, Desa Selopuro', telp: '(0354) 123456', email: 'sdnselopuro@gmail.com', kepsek: 'Drs. H. Ahmad Fauzi, M.Pd.', bendahara: 'Siti Aminah, S.Pd.' },
  users: [
    { id: 1, username: 'admin', password: 'esloji', nama: 'Administrator', role: 'admin', status: 'aktif' },
    { id: 2, username: 'operator', password: 'operator123', nama: 'Operator', role: 'operator', status: 'aktif' }
  ],
  siswa: [
    { id: 1, nis: '2026001', nama: 'Ahmad Rizki Pratama', kelas: '1', angkatan: '2026', orangTua: 'Budi Pratama', noHp: '081234567890', alamat: 'Jl. Merdeka No. 10' },
    { id: 2, nis: '2026002', nama: 'Siti Nurhaliza', kelas: '1', angkatan: '2026', orangTua: 'Hasanudin', noHp: '081234567891', alamat: 'Jl. Sudirman No. 5' },
    { id: 3, nis: '2026003', nama: 'Muhammad Fadil', kelas: '2', angkatan: '2026', orangTua: 'Ahmad Fadillah', noHp: '081234567892', alamat: 'Jl. Pahlawan No. 8' },
    { id: 4, nis: '2026004', nama: 'Aisyah Putri Ramadhani', kelas: '2', angkatan: '2026', orangTua: 'Ramadhani', noHp: '081234567893', alamat: 'Jl. Mawar No. 12' },
    { id: 5, nis: '2026005', nama: 'Rafif Ahmad Syahputra', kelas: '3', angkatan: '2026', orangTua: 'Syahputra', noHp: '081234567894', alamat: 'Jl. Kenanga No. 3' },
    { id: 6, nis: '2026006', nama: 'Fatimah Azzahra', kelas: '3', angkatan: '2026', orangTua: 'Abdullah', noHp: '081234567895', alamat: 'Jl. Melati No. 7' },
    { id: 7, nis: '2026007', nama: 'Dimas Aditya Pratama', kelas: '4', angkatan: '2026', orangTua: 'Agus Pratama', noHp: '081234567896', alamat: 'Jl. Flamboyan No. 4' },
    { id: 8, nis: '2026008', nama: 'Naura Syakira', kelas: '4', angkatan: '2026', orangTua: 'Syakir', noHp: '081234567897', alamat: 'Jl. Anggrek No. 9' },
    { id: 9, nis: '2026009', nama: 'Farhan Maulana', kelas: '5', angkatan: '2026', orangTua: 'Maulana', noHp: '081234567898', alamat: 'Jl. Dahlia No. 6' },
    { id: 10, nis: '2026010', nama: 'Kayla Azahra', kelas: '5', angkatan: '2026', orangTua: 'Azahara', noHp: '081234567899', alamat: 'Jl. Cendana No. 11' },
    { id: 11, nis: '2026011', nama: 'Arkan Prasetyo', kelas: '6', angkatan: '2026', orangTua: 'Prasetyo', noHp: '081234567800', alamat: 'Jl. Sudirman No. 15' },
    { id: 12, nis: '2026012', nama: 'Zahra Amalia Putri', kelas: '6', angkatan: '2026', orangTua: 'Amalia', noHp: '081234567801', alamat: 'Jl. Merdeka No. 20' }
  ],
  jenisBayar: [
    { id: 1, kode: 'LKS-MTK', nama: 'LKS Matematika', kategori: 'LKS', nominal: 35000, tahun: '2025/2026', kelas: 'all' },
    { id: 2, kode: 'LKS-IND', nama: 'LKS Bahasa Indonesia', kategori: 'LKS', nominal: 35000, tahun: '2025/2026', kelas: 'all' },
    { id: 3, kode: 'LKS-ENG', nama: 'LKS Bahasa Inggris', kategori: 'LKS', nominal: 35000, tahun: '2025/2026', kelas: 'all' },
    { id: 4, kode: 'LKS-IPA', nama: 'LKS IPA', kategori: 'LKS', nominal: 35000, tahun: '2025/2026', kelas: '3-6' },
    { id: 5, kode: 'AKT-OLA', nama: 'Aktivitas Olahraga', kategori: 'Aktivitas', nominal: 25000, tahun: '2025/2026', kelas: 'all' },
    { id: 6, kode: 'AKT-SEN', nama: 'Aktivitas Seni', kategori: 'Aktivitas', nominal: 20000, tahun: '2025/2026', kelas: 'all' },
    { id: 7, kode: 'AKT-PRM', nama: 'Perpisahan', kategori: 'Aktivitas', nominal: 50000, tahun: '2025/2026', kelas: '6' },
    { id: 8, kode: 'IUR-SPP', nama: 'SPP Bulanan', kategori: 'Iuran', nominal: 100000, tahun: '2025/2026', kelas: 'all' },
    { id: 9, kode: 'IUR-KAS', nama: 'Kas Kelas', kategori: 'Iuran', nominal: 15000, tahun: '2025/2026', kelas: 'all' },
    { id: 10, kode: 'IUR-KEG', nama: 'Iuran Kegiatan', kategori: 'Iuran', nominal: 30000, tahun: '2025/2026', kelas: 'all' }
  ],
  transaksi: [],
  stor: [],
  riwayatWa: []
};

// ===== SUPABASE HELPERS =====
const KEYS = ['profil', 'users', 'siswa', 'jenisBayar', 'transaksi', 'stor', 'riwayatWa'];

async function loadTableFromSupabase(key) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('data_store').select('value').eq('key', key).single();
    if (error || !data) return null;
    return data.value;
  } catch (e) { return null; }
}

async function saveTableToSupabase(key, value) {
  if (!supabase) return;
  try {
    await supabase.from('data_store').upsert({ key, value }, { onConflict: 'key' });
  } catch (e) {
    console.error('Supabase save error [' + key + ']:', e.message);
  }
}

async function syncFromSupabase() {
  if (!supabase) return false;
  console.log('  Syncing data dari Supabase...');
  try {
    const results = await Promise.all(KEYS.map(k => loadTableFromSupabase(k)));
    let synced = 0;
    KEYS.forEach((k, i) => {
      if (results[i] !== null && results[i] !== undefined) {
        DB[k] = results[i];
        synced++;
      }
    });
    if (synced > 0) {
      saveDB();
      console.log('  ' + synced + ' tabel berhasil di-sync dari Supabase');
    } else {
      console.log('  Tidak ada data di Supabase, pakai data lokal');
      await syncAllToSupabase();
    }
    return synced > 0;
  } catch (e) {
    console.log('  Supabase sync gagal:', e.message);
    return false;
  }
}

async function syncAllToSupabase() {
  if (!supabase) return;
  console.log('  Upload semua data ke Supabase...');
  try {
    await Promise.all(KEYS.map(k => saveTableToSupabase(k, DB[k])));
    console.log('  Semua data berhasil di-upload ke Supabase');
  } catch (e) {
    console.log('  Upload gagal:', e.message);
  }
}

async function syncToSupabase(key) {
  if (!supabase || !DB) return;
  await saveTableToSupabase(key, DB[key]);
}

let DB = loadDB();
if (!DB) DB = { ...DEFAULTS };
saveDB();

// Try to sync from Supabase on startup
syncFromSupabase().catch(() => {});

function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
let saveTimer = null;
function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveDB, 200); }
function scheduleSync(key) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveDB();
    await syncToSupabase(key);
  }, 200);
}

// ===== SESSIONS =====
const sessions = {};

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId, createdAt: Date.now() };
  return token;
}

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  const session = sessions[token];
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    delete sessions[token];
    return res.status(401).json({ error: 'Sesi expired, silakan login ulang' });
  }
  req.userId = session.userId;
  next();
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false }));

// ===== SSE =====
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
}

// ===== AUTH (public) =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Username atau password salah' });
  if (user.status === 'nonaktif') return res.status(403).json({ error: 'Akun dinonaktifkan' });
  const token = createSession(user.id);
  const { password: _, ...safe } = user;
  res.json({ ...safe, token });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) delete sessions[token];
  res.json({ ok: true });
});

// ===== SSE (auth required) =====
app.get('/api/events', (req, res) => {
  const token = req.query.token;
  if (!token || !sessions[token]) return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write(':\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ===== ALL PROTECTED ROUTES =====
app.use('/api', requireAuth);

// ===== PROFIL =====
app.get('/api/profil', (req, res) => res.json(DB.profil));
app.put('/api/profil', (req, res) => { Object.assign(DB.profil, req.body); scheduleSync('profil'); broadcast('profil', { action: 'update' }); res.json({ ok: true }); });

// ===== USERS =====
app.get('/api/users', (req, res) => res.json(DB.users.map(({ password: _, ...u }) => u)));
app.post('/api/users', (req, res) => {
  const { username, nama, password, role } = req.body;
  if (DB.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan' });
  const user = { id: nextId(DB.users), username, nama, password, role: role || 'operator', status: 'aktif' };
  DB.users.push(user); scheduleSync('users'); broadcast('users', { action: 'add', id: user.id });
  res.json({ id: user.id });
});
app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const u = DB.users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { username, nama, password, role, status } = req.body;
  u.username = username; u.nama = nama; u.role = role; u.status = status || 'aktif';
  if (password && password !== '********') u.password = password;
  scheduleSync('users'); broadcast('users', { action: 'update', id });
  res.json({ ok: true });
});
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  DB.users = DB.users.filter(u => u.id !== id); scheduleSync('users'); broadcast('users', { action: 'delete', id });
  res.json({ ok: true });
});
app.delete('/api/users', (req, res) => {
  const keepId = req.query.keepId ? parseInt(req.query.keepId) : null;
  DB.users = keepId ? DB.users.filter(u => u.id === keepId) : [];
  scheduleSync('users'); broadcast('users', { action: 'deleteAll' }); res.json({ ok: true });
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', (req, res) => {
  const { userId, passLama, passBaru } = req.body;
  const u = DB.users.find(x => x.id === userId);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (u.password !== passLama) return res.status(400).json({ error: 'Password lama salah' });
  u.password = passBaru; scheduleSync('users'); res.json({ ok: true });
});

// ===== SISWA =====
app.get('/api/siswa', (req, res) => res.json([...DB.siswa].sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))));
app.post('/api/siswa', (req, res) => {
  const s = { id: nextId(DB.siswa), nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' };
  DB.siswa.push(s); scheduleSync('siswa'); broadcast('siswa', { action: 'add', id: s.id }); res.json({ id: s.id });
});
app.put('/api/siswa/:id', (req, res) => {
  const id = parseInt(req.params.id); const idx = DB.siswa.findIndex(s => s.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Tidak ditemukan' });
  Object.assign(DB.siswa[idx], { nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' });
  scheduleSync('siswa'); broadcast('siswa', { action: 'update', id }); res.json({ ok: true });
});
app.delete('/api/siswa/:id', (req, res) => {
  const id = parseInt(req.params.id);
  DB.siswa = DB.siswa.filter(s => s.id !== id); DB.transaksi = DB.transaksi.filter(t => t.siswaId !== id);
  scheduleSync('siswa'); scheduleSync('transaksi'); broadcast('siswa', { action: 'delete', id }); res.json({ ok: true });
});
app.delete('/api/siswa', (req, res) => { DB.siswa = []; DB.transaksi = []; scheduleSync('siswa'); scheduleSync('transaksi'); broadcast('siswa', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== JENIS BAYAR =====
app.get('/api/jenisbayar', (req, res) => res.json([...DB.jenisBayar].sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kode.localeCompare(b.kode))));
app.post('/api/jenisbayar', (req, res) => {
  const j = { id: nextId(DB.jenisBayar), kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' };
  DB.jenisBayar.push(j); scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'add', id: j.id }); res.json({ id: j.id });
});
app.put('/api/jenisbayar/:id', (req, res) => {
  const id = parseInt(req.params.id); const idx = DB.jenisBayar.findIndex(j => j.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Tidak ditemukan' });
  Object.assign(DB.jenisBayar[idx], { kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' });
  scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'update', id }); res.json({ ok: true });
});
app.delete('/api/jenisbayar/:id', (req, res) => { const id = parseInt(req.params.id); DB.jenisBayar = DB.jenisBayar.filter(j => j.id !== id); scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'delete', id }); res.json({ ok: true }); });
app.delete('/api/jenisbayar', (req, res) => { DB.jenisBayar = []; scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== TRANSAKSI =====
app.get('/api/transaksi', (req, res) => res.json([...DB.transaksi].sort((a, b) => b.id - a.id)));
app.post('/api/transaksi', (req, res) => {
  const t = { id: nextId(DB.transaksi), noBayar: req.body.noBayar, tanggal: req.body.tanggal, siswaId: req.body.siswaId || 0, siswaNama: req.body.siswaNama || '', siswaKelas: req.body.siswaKelas || '', jenisId: req.body.jenisId || 0, jenisNama: req.body.jenisNama || '', kategori: req.body.kategori || '', nominal: req.body.nominal || 0, metode: req.body.metode || 'Tunai', keterangan: req.body.keterangan || '', status: req.body.status || 'Lunas', waktu: req.body.waktu || '' };
  DB.transaksi.push(t); scheduleSync('transaksi'); broadcast('transaksi', { action: 'add', id: t.id }); res.json({ id: t.id });
});
app.delete('/api/transaksi/:id', (req, res) => { const id = parseInt(req.params.id); DB.transaksi = DB.transaksi.filter(t => t.id !== id); scheduleSync('transaksi'); broadcast('transaksi', { action: 'delete', id }); res.json({ ok: true }); });
app.delete('/api/transaksi', (req, res) => { DB.transaksi = []; scheduleSync('transaksi'); broadcast('transaksi', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== STOR =====
app.get('/api/stor', (req, res) => res.json([...DB.stor].sort((a, b) => b.id - a.id)));
app.post('/api/stor', (req, res) => {
  const s = { id: nextId(DB.stor), noStor: req.body.noStor, tanggal: req.body.tanggal, oleh: req.body.oleh || '', jumlah: req.body.jumlah || 0, catatan: req.body.catatan || '' };
  DB.stor.push(s); scheduleSync('stor'); broadcast('stor', { action: 'add', id: s.id }); res.json({ id: s.id });
});
app.delete('/api/stor/:id', (req, res) => { const id = parseInt(req.params.id); DB.stor = DB.stor.filter(s => s.id !== id); scheduleSync('stor'); broadcast('stor', { action: 'delete', id }); res.json({ ok: true }); });
app.delete('/api/stor', (req, res) => { DB.stor = []; scheduleSync('stor'); broadcast('stor', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== RIWAYAT WA =====
app.get('/api/riwayat-wa', (req, res) => res.json([...DB.riwayatWa].sort((a, b) => b.id - a.id).slice(0, 100)));
app.post('/api/riwayat-wa', (req, res) => {
  const r = { id: nextId(DB.riwayatWa), tanggal: req.body.tanggal || '', penerima: req.body.penerima || '', jenis: req.body.jenis || '', status: req.body.status || 'Terkirim' };
  DB.riwayatWa.push(r); scheduleSync('riwayatWa'); res.json({ id: r.id });
});

// ===== FORCE SYNC =====
app.post('/api/sync', async (req, res) => {
  try {
    await syncFromSupabase();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Sync error' }); }
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ===== START =====
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  let ip = 'localhost';
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) { ip = iface.address; break; }
    }
  }
  const isCloud = !!process.env.RENDER;
  console.log('');
  console.log('  ============================================');
  console.log('    Sistem Pembayaran SD Negeri 1 Selopuro');
  console.log('  ============================================');
  if (isCloud) {
    console.log('    ONLINE  : https://' + (process.env.RENDER_EXTERNAL_HOSTNAME || 'app.render.com'));
    console.log('');
    console.log('    Aplikasi sudah online! Buka link di atas dari HP/PC manapun.');
  } else {
    console.log('    PC  : http://localhost:' + PORT);
    console.log('    HP  : http://' + ip + ':' + PORT);
  }
  console.log('    Login : admin / esloji');
  console.log('  ============================================');
  console.log('');
});

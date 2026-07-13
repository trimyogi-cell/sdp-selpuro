const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ===== SUPABASE =====
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zizonqnqqgxrxqkivpzs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppem9ucW5xcWd4cnhxa2l2cHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MzU0MTYsImV4cCI6MjA5OTUxMTQxNn0.OARAvtw1YnH4GfQXZlU-r74XWmBxH8yrTO2p_Z0ZVc8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== DATA KEYS =====
const KEYS = ['profil', 'users', 'siswa', 'jenisBayar', 'transaksi', 'stor', 'riwayatWa'];

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
async function loadTable(key) {
  try {
    const { data, error } = await supabase.from('data_store').select('value').eq('key', key).single();
    if (error) {
      console.error('Load error [' + key + ']:', error.message);
      return DEFAULTS[key] || [];
    }
    if (!data) return DEFAULTS[key] || [];
    return data.value;
  } catch (e) {
    console.error('Load exception [' + key + ']:', e.message);
    return DEFAULTS[key] || [];
  }
}

async function saveTable(key, value) {
  try {
    const { data, error } = await supabase.from('data_store').upsert({ key, value }, { onConflict: 'key' });
    if (error) {
      console.error('Save error [' + key + ']:', error.message, error.details || '');
    }
  } catch (e) {
    console.error('Save exception [' + key + ']:', e.message);
  }
}

// ===== IN-MEMORY CACHE =====
let DB = null;
let dbLoaded = false;

async function ensureDB() {
  if (dbLoaded && DB) return DB;
  DB = {};
  const results = await Promise.all(KEYS.map(k => loadTable(k)));
  KEYS.forEach((k, i) => { DB[k] = results[i]; });
  dbLoaded = true;
  return DB;
}

function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1; }

// ===== STATELESS TOKEN AUTH =====
const SECRET = process.env.JWT_SECRET || 'sdp-selopuro-secret-key-2026';

function createToken(userId) {
  const payload = JSON.stringify({ userId, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

function verifyToken(token) {
  try {
    const [payloadB64, sig] = token.split('.');
    const payload = Buffer.from(payloadB64, 'base64').toString();
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return null;
    return data.userId;
  } catch (e) { return null; }
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
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0, etag: false }));

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  const userId = verifyToken(token);
  if (!userId) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  req.userId = userId;
  next();
}

// ===== SSE =====
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
}

// ===== AUTH (public) =====
app.post('/api/login', async (req, res) => {
  try {
    const db = await ensureDB();
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });
    if (user.status === 'nonaktif') return res.status(403).json({ error: 'Akun dinonaktifkan' });
    const token = createToken(user.id);
    const { password: _, ...safe } = user;
    res.json({ ...safe, token });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => { res.json({ ok: true }); });

// ===== SSE =====
app.get('/api/events', (req, res) => {
  const token = req.query.token;
  if (!token || !verifyToken(token)) return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write(':\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ===== PROTECTED ROUTES =====
app.use('/api', requireAuth);

// ===== PROFIL =====
app.get('/api/profil', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json(db.profil);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/profil', async (req, res) => {
  try {
    const db = await ensureDB();
    Object.assign(db.profil, req.body);
    await saveTable('profil', db.profil);
    broadcast('profil', { action: 'update' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== USERS =====
app.get('/api/users', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json(db.users.map(({ password: _, ...u }) => u));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const db = await ensureDB();
    const { username, nama, password, role } = req.body;
    if (db.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan' });
    const user = { id: nextId(db.users), username, nama, password, role: role || 'operator', status: 'aktif' };
    db.users.push(user);
    await saveTable('users', db.users);
    broadcast('users', { action: 'add', id: user.id });
    res.json({ id: user.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    const u = db.users.find(x => x.id === id);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    const { username, nama, password, role, status } = req.body;
    u.username = username; u.nama = nama; u.role = role; u.status = status || 'aktif';
    if (password && password !== '********') u.password = password;
    await saveTable('users', db.users);
    broadcast('users', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    db.users = db.users.filter(u => u.id !== id);
    await saveTable('users', db.users);
    broadcast('users', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users', async (req, res) => {
  try {
    const db = await ensureDB();
    const keepId = req.query.keepId ? parseInt(req.query.keepId) : null;
    db.users = keepId ? db.users.filter(u => u.id === keepId) : [];
    await saveTable('users', db.users);
    broadcast('users', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', async (req, res) => {
  try {
    const db = await ensureDB();
    const { userId, passLama, passBaru } = req.body;
    const u = db.users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (u.password !== passLama) return res.status(400).json({ error: 'Password lama salah' });
    u.password = passBaru;
    await saveTable('users', db.users);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== SISWA =====
app.get('/api/siswa', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json([...db.siswa].sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/siswa', async (req, res) => {
  try {
    const db = await ensureDB();
    const s = { id: nextId(db.siswa), nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' };
    db.siswa.push(s);
    await saveTable('siswa', db.siswa);
    broadcast('siswa', { action: 'add', id: s.id });
    res.json({ id: s.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/siswa/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    const s = db.siswa.find(x => x.id === id);
    if (!s) return res.status(404).json({ error: 'Tidak ditemukan' });
    Object.assign(s, { nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' });
    await saveTable('siswa', db.siswa);
    broadcast('siswa', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    db.siswa = db.siswa.filter(s => s.id !== id);
    db.transaksi = db.transaksi.filter(t => t.siswaId !== id);
    await Promise.all([saveTable('siswa', db.siswa), saveTable('transaksi', db.transaksi)]);
    broadcast('siswa', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa', async (req, res) => {
  try {
    const db = await ensureDB();
    db.siswa = []; db.transaksi = [];
    await Promise.all([saveTable('siswa', db.siswa), saveTable('transaksi', db.transaksi)]);
    broadcast('siswa', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== JENIS BAYAR =====
app.get('/api/jenisbayar', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json([...db.jenisBayar].sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kode.localeCompare(b.kode)));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/jenisbayar', async (req, res) => {
  try {
    const db = await ensureDB();
    const j = { id: nextId(db.jenisBayar), kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' };
    db.jenisBayar.push(j);
    await saveTable('jenisBayar', db.jenisBayar);
    broadcast('jenisbayar', { action: 'add', id: j.id });
    res.json({ id: j.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/jenisbayar/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    const j = db.jenisBayar.find(x => x.id === id);
    if (!j) return res.status(404).json({ error: 'Tidak ditemukan' });
    Object.assign(j, { kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' });
    await saveTable('jenisBayar', db.jenisBayar);
    broadcast('jenisbayar', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    db.jenisBayar = db.jenisBayar.filter(j => j.id !== id);
    await saveTable('jenisBayar', db.jenisBayar);
    broadcast('jenisbayar', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar', async (req, res) => {
  try {
    const db = await ensureDB();
    db.jenisBayar = [];
    await saveTable('jenisBayar', db.jenisBayar);
    broadcast('jenisbayar', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== TRANSAKSI =====
app.get('/api/transaksi', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json([...db.transaksi].sort((a, b) => b.id - a.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/transaksi', async (req, res) => {
  try {
    const db = await ensureDB();
    const t = { id: nextId(db.transaksi), noBayar: req.body.noBayar, tanggal: req.body.tanggal, siswaId: req.body.siswaId || 0, siswaNama: req.body.siswaNama || '', siswaKelas: req.body.siswaKelas || '', jenisId: req.body.jenisId || 0, jenisNama: req.body.jenisNama || '', kategori: req.body.kategori || '', nominal: req.body.nominal || 0, metode: req.body.metode || 'Tunai', keterangan: req.body.keterangan || '', status: req.body.status || 'Lunas', waktu: req.body.waktu || '' };
    db.transaksi.push(t);
    await saveTable('transaksi', db.transaksi);
    broadcast('transaksi', { action: 'add', id: t.id });
    res.json({ id: t.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    db.transaksi = db.transaksi.filter(t => t.id !== id);
    await saveTable('transaksi', db.transaksi);
    broadcast('transaksi', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi', async (req, res) => {
  try {
    const db = await ensureDB();
    db.transaksi = [];
    await saveTable('transaksi', db.transaksi);
    broadcast('transaksi', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== STOR =====
app.get('/api/stor', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json([...db.stor].sort((a, b) => b.id - a.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/stor', async (req, res) => {
  try {
    const db = await ensureDB();
    const s = { id: nextId(db.stor), noStor: req.body.noStor, tanggal: req.body.tanggal, oleh: req.body.oleh || '', jumlah: req.body.jumlah || 0, catatan: req.body.catatan || '' };
    db.stor.push(s);
    await saveTable('stor', db.stor);
    broadcast('stor', { action: 'add', id: s.id });
    res.json({ id: s.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/stor/:id', async (req, res) => {
  try {
    const db = await ensureDB();
    const id = parseInt(req.params.id);
    db.stor = db.stor.filter(s => s.id !== id);
    await saveTable('stor', db.stor);
    broadcast('stor', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/stor', async (req, res) => {
  try {
    const db = await ensureDB();
    db.stor = [];
    await saveTable('stor', db.stor);
    broadcast('stor', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== RIWAYAT WA =====
app.get('/api/riwayat-wa', async (req, res) => {
  try {
    const db = await ensureDB();
    res.json([...db.riwayatWa].sort((a, b) => b.id - a.id).slice(0, 100));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/riwayat-wa', async (req, res) => {
  try {
    const db = await ensureDB();
    const r = { id: nextId(db.riwayatWa), tanggal: req.body.tanggal || '', penerima: req.body.penerima || '', jenis: req.body.jenis || '', status: req.body.status || 'Terkirim' };
    db.riwayatWa.push(r);
    await saveTable('riwayatWa', db.riwayatWa);
    res.json({ id: r.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== FORCE SYNC =====
app.post('/api/sync', async (req, res) => {
  try {
    dbLoaded = false;
    await ensureDB();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Sync error' }); }
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

module.exports = app;

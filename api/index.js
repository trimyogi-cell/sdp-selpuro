const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ===== SUPABASE =====
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zizonqnqqgxrxqkivpzs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppem9ucW5xcWd4cnhxa2l2cHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MzU0MTYsImV4cCI6MjA5OTUxMTQxNn0.OARAvtw1YnH4GfQXZlU-r74XWmBxH8yrTO2p_Z0ZVc8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULTS = {
  profil: { namaSekolah: 'SD Negeri 1 Selopuro', npsn: '20310868', alamat: 'Jl. Merdeka No. 1, Desa Selopuro', telp: '(0354) 123456', email: 'sdnselopuro@gmail.com', kepsek: 'Drs. H. Ahmad Fauzi, M.Pd.', bendahara: 'Siti Aminah, S.Pd.' },
  users: [
    { id: 1, username: 'admin', password: 'esloji', nama: 'Administrator', role: 'admin', status: 'aktif' },
    { id: 2, username: 'operator', password: 'operator123', nama: 'Operator', role: 'operator', status: 'aktif' }
  ],
  siswa: [],
  jenisBayar: [],
  transaksi: [],
  stor: [],
  riwayatWa: []
};

// ===== SUPABASE HELPERS =====
async function loadTable(key) {
  try {
    const { data, error } = await supabase.from('data_store').select('value').eq('key', key).single();
    if (error || !data) return structuredClone(DEFAULTS[key] || []);
    return data.value ?? structuredClone(DEFAULTS[key] || []);
  } catch (e) {
    return structuredClone(DEFAULTS[key] || []);
  }
}

async function saveTable(key, value) {
  try {
    const { error } = await supabase.from('data_store').upsert({ key, value }, { onConflict: 'key' });
    if (error) console.error('Save error [' + key + ']:', error.message);
  } catch (e) {
    console.error('Save exception [' + key + ']:', e.message);
  }
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
    const users = await loadTable('users');
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
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
  try { res.json(await loadTable('profil')); } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/profil', async (req, res) => {
  try {
    const profil = await loadTable('profil');
    Object.assign(profil, req.body);
    await saveTable('profil', profil);
    broadcast('profil', { action: 'update' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== USERS =====
app.get('/api/users', async (req, res) => {
  try {
    const users = await loadTable('users');
    res.json(users.map(({ password: _, ...u }) => u));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const users = await loadTable('users');
    const { username, nama, password, role } = req.body;
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan' });
    const user = { id: nextId(users), username, nama, password, role: role || 'operator', status: 'aktif' };
    users.push(user);
    await saveTable('users', users);
    broadcast('users', { action: 'add', id: user.id });
    res.json({ id: user.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const users = await loadTable('users');
    const id = parseInt(req.params.id);
    const u = users.find(x => x.id === id);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    const { username, nama, password, role, status } = req.body;
    u.username = username; u.nama = nama; u.role = role; u.status = status || 'aktif';
    if (password && password !== '********') u.password = password;
    await saveTable('users', users);
    broadcast('users', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const users = await loadTable('users');
    const id = parseInt(req.params.id);
    const filtered = users.filter(u => u.id !== id);
    await saveTable('users', filtered);
    broadcast('users', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users', async (req, res) => {
  try {
    const users = await loadTable('users');
    const keepId = req.query.keepId ? parseInt(req.query.keepId) : null;
    const filtered = keepId ? users.filter(u => u.id === keepId) : [];
    await saveTable('users', filtered);
    broadcast('users', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', async (req, res) => {
  try {
    const users = await loadTable('users');
    const { userId, passLama, passBaru } = req.body;
    const u = users.find(x => x.id === userId);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (u.password !== passLama) return res.status(400).json({ error: 'Password lama salah' });
    u.password = passBaru;
    await saveTable('users', users);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== SISWA =====
app.get('/api/siswa', async (req, res) => {
  try {
    const siswa = await loadTable('siswa');
    res.json([...siswa].sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/siswa', async (req, res) => {
  try {
    const siswa = await loadTable('siswa');
    const s = { id: nextId(siswa), nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' };
    siswa.push(s);
    await saveTable('siswa', siswa);
    broadcast('siswa', { action: 'add', id: s.id });
    res.json({ id: s.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/siswa/:id', async (req, res) => {
  try {
    const siswa = await loadTable('siswa');
    const id = parseInt(req.params.id);
    const s = siswa.find(x => x.id === id);
    if (!s) return res.status(404).json({ error: 'Tidak ditemukan' });
    Object.assign(s, { nis: req.body.nis, nama: req.body.nama, kelas: req.body.kelas, angkatan: req.body.angkatan || '', orangTua: req.body.orangTua || '', noHp: req.body.noHp || '', alamat: req.body.alamat || '' });
    await saveTable('siswa', siswa);
    broadcast('siswa', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [siswa, transaksi] = await Promise.all([loadTable('siswa'), loadTable('transaksi')]);
    const newSiswa = siswa.filter(s => s.id !== id);
    const newTransaksi = transaksi.filter(t => t.siswaId !== id);
    await Promise.all([saveTable('siswa', newSiswa), saveTable('transaksi', newTransaksi)]);
    broadcast('siswa', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa', async (req, res) => {
  try {
    await Promise.all([saveTable('siswa', []), saveTable('transaksi', [])]);
    broadcast('siswa', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== JENIS BAYAR =====
app.get('/api/jenisbayar', async (req, res) => {
  try {
    const jb = await loadTable('jenisBayar');
    res.json([...jb].sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kode.localeCompare(b.kode)));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/jenisbayar', async (req, res) => {
  try {
    const jb = await loadTable('jenisBayar');
    const j = { id: nextId(jb), kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' };
    jb.push(j);
    await saveTable('jenisBayar', jb);
    broadcast('jenisbayar', { action: 'add', id: j.id });
    res.json({ id: j.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/jenisbayar/:id', async (req, res) => {
  try {
    const jb = await loadTable('jenisBayar');
    const id = parseInt(req.params.id);
    const j = jb.find(x => x.id === id);
    if (!j) return res.status(404).json({ error: 'Tidak ditemukan' });
    Object.assign(j, { kode: req.body.kode, nama: req.body.nama, kategori: req.body.kategori, nominal: parseInt(req.body.nominal) || 0, tahun: req.body.tahun || '', kelas: req.body.kelas || 'all' });
    await saveTable('jenisBayar', jb);
    broadcast('jenisbayar', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar/:id', async (req, res) => {
  try {
    const jb = await loadTable('jenisBayar');
    const id = parseInt(req.params.id);
    await saveTable('jenisBayar', jb.filter(j => j.id !== id));
    broadcast('jenisbayar', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar', async (req, res) => {
  try {
    await saveTable('jenisBayar', []);
    broadcast('jenisbayar', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== TRANSAKSI =====
app.get('/api/transaksi', async (req, res) => {
  try {
    const t = await loadTable('transaksi');
    res.json([...t].sort((a, b) => b.id - a.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/transaksi', async (req, res) => {
  try {
    const t = await loadTable('transaksi');
    const tx = { id: nextId(t), noBayar: req.body.noBayar, tanggal: req.body.tanggal, siswaId: req.body.siswaId || 0, siswaNama: req.body.siswaNama || '', siswaKelas: req.body.siswaKelas || '', jenisId: req.body.jenisId || 0, jenisNama: req.body.jenisNama || '', kategori: req.body.kategori || '', nominal: req.body.nominal || 0, metode: req.body.metode || 'Tunai', keterangan: req.body.keterangan || '', status: req.body.status || 'Lunas', waktu: req.body.waktu || '' };
    t.push(tx);
    await saveTable('transaksi', t);
    broadcast('transaksi', { action: 'add', id: tx.id });
    res.json({ id: tx.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi/:id', async (req, res) => {
  try {
    const t = await loadTable('transaksi');
    const id = parseInt(req.params.id);
    await saveTable('transaksi', t.filter(x => x.id !== id));
    broadcast('transaksi', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi', async (req, res) => {
  try {
    await saveTable('transaksi', []);
    broadcast('transaksi', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== STOR =====
app.get('/api/stor', async (req, res) => {
  try {
    const s = await loadTable('stor');
    res.json([...s].sort((a, b) => b.id - a.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/stor', async (req, res) => {
  try {
    const s = await loadTable('stor');
    const item = { id: nextId(s), noStor: req.body.noStor, tanggal: req.body.tanggal, oleh: req.body.oleh || '', jumlah: req.body.jumlah || 0, catatan: req.body.catatan || '' };
    s.push(item);
    await saveTable('stor', s);
    broadcast('stor', { action: 'add', id: item.id });
    res.json({ id: item.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/stor/:id', async (req, res) => {
  try {
    const s = await loadTable('stor');
    const id = parseInt(req.params.id);
    await saveTable('stor', s.filter(x => x.id !== id));
    broadcast('stor', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/stor', async (req, res) => {
  try {
    await saveTable('stor', []);
    broadcast('stor', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== RIWAYAT WA =====
app.get('/api/riwayat-wa', async (req, res) => {
  try {
    const r = await loadTable('riwayatWa');
    res.json([...r].sort((a, b) => b.id - a.id).slice(0, 100));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/riwayat-wa', async (req, res) => {
  try {
    const r = await loadTable('riwayatWa');
    const item = { id: nextId(r), tanggal: req.body.tanggal || '', penerima: req.body.penerima || '', jenis: req.body.jenis || '', status: req.body.status || 'Terkirim' };
    r.push(item);
    await saveTable('riwayatWa', r);
    res.json({ id: item.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== FORCE SYNC =====
app.post('/api/sync', async (req, res) => {
  try { res.json({ ok: true }); } catch (e) { res.status(500).json({ error: 'Sync error' }); }
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

module.exports = app;

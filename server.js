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

// ===== SECURITY UTILS =====
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

function isPasswordHashed(pw) { return pw && typeof pw === 'string' && pw.includes(':') && pw.split(':').length === 2; }

// ===== RATE LIMITING =====
const loginAttempts = {};
function checkRateLimit(ip) {
  const now = Date.now();
  if (!loginAttempts[ip]) loginAttempts[ip] = [];
  loginAttempts[ip] = loginAttempts[ip].filter(t => now - t < 15 * 60 * 1000);
  if (loginAttempts[ip].length >= 8) return false;
  loginAttempts[ip].push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const ip in loginAttempts) {
    loginAttempts[ip] = loginAttempts[ip].filter(t => now - t < 15 * 60 * 1000);
    if (!loginAttempts[ip].length) delete loginAttempts[ip];
  }
}, 5 * 60 * 1000);

// ===== JSON DATABASE =====
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      if (content.length > 10 * 1024 * 1024) { console.error('DB file too large'); return null; }
      return JSON.parse(content);
    }
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
  siswa: [],
  jenisBayar: [],
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

// Migrate plaintext passwords to hashed
let pwChanged = false;
if (DB.users) {
  for (const u of DB.users) {
    if (u.password && !isPasswordHashed(u.password)) {
      u.password = hashPassword(u.password);
      pwChanged = true;
    }
  }
  if (pwChanged) saveDB();
}

syncFromSupabase().catch(() => {});

function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }
function getClientIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'; }
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

function createSession(userId, role) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId, role, createdAt: Date.now() };
  return token;
}

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  const session = sessions[token];
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    delete sessions[token];
    return res.status(401).json({ error: 'Sesi expired, silakan login ulang' });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Hanya admin yang bisa melakukan aksi ini' });
  next();
}

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '500kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
});
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
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi dalam 15 menit' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const user = DB.users.find(u => u.username === username);
  if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ error: 'Username atau password salah' });
  if (user.status === 'nonaktif') return res.status(403).json({ error: 'Akun dinonaktifkan' });
  const token = createSession(user.id, user.role);
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
app.put('/api/profil', requireAdmin, (req, res) => {
  const allowed = ['namaSekolah', 'npsn', 'alamat', 'telp', 'email', 'kepsek', 'bendahara', 'noHpAdmin'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) DB.profil[key] = String(req.body[key]).slice(0, 200);
  }
  scheduleSync('profil'); broadcast('profil', { action: 'update' }); res.json({ ok: true });
});

// ===== USERS (admin only) =====
app.get('/api/users', (req, res) => res.json(DB.users.map(({ password: _, ...u }) => u)));
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, nama, password, role } = req.body;
  if (!username || !nama || !password) return res.status(400).json({ error: 'Username, nama, dan password wajib diisi' });
  if (username.length < 3 || username.length > 30) return res.status(400).json({ error: 'Username 3-30 karakter' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  if (!['admin', 'operator', 'bendahara'].includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
  if (DB.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan' });
  const user = { id: nextId(DB.users), username, nama: String(nama).slice(0, 100), password: hashPassword(password), role: role || 'operator', status: 'aktif' };
  DB.users.push(user); scheduleSync('users'); broadcast('users', { action: 'add', id: user.id });
  res.json({ id: user.id });
});
app.put('/api/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  const u = DB.users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { username, nama, password, role, status } = req.body;
  if (username) u.username = String(username).slice(0, 30);
  if (nama) u.nama = String(nama).slice(0, 100);
  if (role && ['admin', 'operator', 'bendahara'].includes(role)) u.role = role;
  if (status) u.status = status;
  if (password && password !== '********' && password.length >= 6) u.password = hashPassword(password);
  scheduleSync('users'); broadcast('users', { action: 'update', id });
  res.json({ ok: true });
});
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  if (id === req.userId) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
  DB.users = DB.users.filter(u => u.id !== id); scheduleSync('users'); broadcast('users', { action: 'delete', id });
  res.json({ ok: true });
});
app.delete('/api/users', requireAdmin, (req, res) => {
  const keepId = req.query.keepId ? parseInt(req.query.keepId) : null;
  if (!keepId || isNaN(keepId)) return res.status(400).json({ error: 'keepId wajib diisi' });
  const filtered = DB.users.filter(u => u.id === keepId);
  if (!filtered.length) return res.status(400).json({ error: 'User keeper tidak ditemukan' });
  DB.users = filtered;
  scheduleSync('users'); broadcast('users', { action: 'deleteAll' }); res.json({ ok: true });
});

// ===== CHANGE PASSWORD (only self) =====
app.post('/api/change-password', (req, res) => {
  const { passLama, passBaru } = req.body;
  if (!passLama || !passBaru) return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
  if (passBaru.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  const u = DB.users.find(x => x.id === req.userId);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (!verifyPassword(passLama, u.password)) return res.status(400).json({ error: 'Password lama salah' });
  u.password = hashPassword(passBaru);
  scheduleSync('users'); res.json({ ok: true });
});

// ===== SISWA =====
app.get('/api/siswa', (req, res) => res.json([...DB.siswa].sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))));
app.post('/api/siswa', (req, res) => {
  const s = { id: nextId(DB.siswa), nis: String(req.body.nis || '').slice(0, 20), nama: String(req.body.nama || '').slice(0, 100), kelas: String(req.body.kelas || '').slice(0, 10), angkatan: String(req.body.angkatan || '').slice(0, 10), orangTua: String(req.body.orangTua || '').slice(0, 100), noHp: String(req.body.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20), alamat: String(req.body.alamat || '').slice(0, 200) };
  if (!s.nama) return res.status(400).json({ error: 'Nama siswa wajib diisi' });
  DB.siswa.push(s); scheduleSync('siswa'); broadcast('siswa', { action: 'add', id: s.id }); res.json({ id: s.id });
});
app.put('/api/siswa/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  const idx = DB.siswa.findIndex(s => s.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Tidak ditemukan' });
  const s = DB.siswa[idx];
  s.nis = String(req.body.nis || '').slice(0, 20);
  s.nama = String(req.body.nama || '').slice(0, 100);
  s.kelas = String(req.body.kelas || '').slice(0, 10);
  s.angkatan = String(req.body.angkatan || '').slice(0, 10);
  s.orangTua = String(req.body.orangTua || '').slice(0, 100);
  s.noHp = String(req.body.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20);
  s.alamat = String(req.body.alamat || '').slice(0, 200);
  scheduleSync('siswa'); broadcast('siswa', { action: 'update', id }); res.json({ ok: true });
});
app.delete('/api/siswa/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  DB.siswa = DB.siswa.filter(s => s.id !== id); DB.transaksi = DB.transaksi.filter(t => t.siswaId !== id);
  scheduleSync('siswa'); scheduleSync('transaksi'); broadcast('siswa', { action: 'delete', id }); res.json({ ok: true });
});
app.delete('/api/siswa', requireAdmin, (req, res) => { DB.siswa = []; DB.transaksi = []; scheduleSync('siswa'); scheduleSync('transaksi'); broadcast('siswa', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== JENIS BAYAR =====
app.get('/api/jenisbayar', (req, res) => res.json([...DB.jenisBayar].sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kode.localeCompare(b.kode))));
app.post('/api/jenisbayar', (req, res) => {
  const j = { id: nextId(DB.jenisBayar), kode: String(req.body.kode || '').slice(0, 20), nama: String(req.body.nama || '').slice(0, 100), kategori: String(req.body.kategori || '').slice(0, 30), nominal: Math.max(0, parseInt(req.body.nominal) || 0), tahun: String(req.body.tahun || '').slice(0, 20), kelas: String(req.body.kelas || 'all').slice(0, 10) };
  if (!j.nama) return res.status(400).json({ error: 'Nama jenis bayar wajib diisi' });
  DB.jenisBayar.push(j); scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'add', id: j.id }); res.json({ id: j.id });
});
app.put('/api/jenisbayar/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  const idx = DB.jenisBayar.findIndex(j => j.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Tidak ditemukan' });
  const j = DB.jenisBayar[idx];
  j.kode = String(req.body.kode || '').slice(0, 20);
  j.nama = String(req.body.nama || '').slice(0, 100);
  j.kategori = String(req.body.kategori || '').slice(0, 30);
  j.nominal = Math.max(0, parseInt(req.body.nominal) || 0);
  j.tahun = String(req.body.tahun || '').slice(0, 20);
  j.kelas = String(req.body.kelas || 'all').slice(0, 10);
  scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'update', id }); res.json({ ok: true });
});
app.delete('/api/jenisbayar/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  DB.jenisBayar = DB.jenisBayar.filter(j => j.id !== id); scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'delete', id }); res.json({ ok: true });
});
app.delete('/api/jenisbayar', requireAdmin, (req, res) => { DB.jenisBayar = []; scheduleSync('jenisBayar'); broadcast('jenisbayar', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== TRANSAKSI =====
app.get('/api/transaksi', (req, res) => res.json([...DB.transaksi].sort((a, b) => b.id - a.id)));
app.post('/api/transaksi', (req, res) => {
  const t = { id: nextId(DB.transaksi), noBayar: String(req.body.noBayar || '').slice(0, 30), tanggal: String(req.body.tanggal || '').slice(0, 30), siswaId: parseInt(req.body.siswaId) || 0, siswaNama: String(req.body.siswaNama || '').slice(0, 100), siswaKelas: String(req.body.siswaKelas || '').slice(0, 10), jenisId: parseInt(req.body.jenisId) || 0, jenisNama: String(req.body.jenisNama || '').slice(0, 100), kategori: String(req.body.kategori || '').slice(0, 30), nominal: Math.max(0, parseInt(req.body.nominal) || 0), metode: String(req.body.metode || 'Tunai').slice(0, 20), keterangan: String(req.body.keterangan || '').slice(0, 200), status: String(req.body.status || 'Lunas').slice(0, 20), waktu: String(req.body.waktu || '').slice(0, 30) };
  DB.transaksi.push(t); scheduleSync('transaksi'); broadcast('transaksi', { action: 'add', id: t.id }); res.json({ id: t.id });
});
app.delete('/api/transaksi/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  DB.transaksi = DB.transaksi.filter(t => t.id !== id); scheduleSync('transaksi'); broadcast('transaksi', { action: 'delete', id }); res.json({ ok: true });
});
app.delete('/api/transaksi', requireAdmin, (req, res) => { DB.transaksi = []; scheduleSync('transaksi'); broadcast('transaksi', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== STOR =====
app.get('/api/stor', (req, res) => res.json([...DB.stor].sort((a, b) => b.id - a.id)));
app.post('/api/stor', (req, res) => {
  const s = { id: nextId(DB.stor), noStor: String(req.body.noStor || '').slice(0, 30), tanggal: String(req.body.tanggal || '').slice(0, 30), oleh: String(req.body.oleh || '').slice(0, 100), jumlah: Math.max(0, parseInt(req.body.jumlah) || 0), catatan: String(req.body.catatan || '').slice(0, 200) };
  DB.stor.push(s); scheduleSync('stor'); broadcast('stor', { action: 'add', id: s.id }); res.json({ id: s.id });
});
app.delete('/api/stor/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
  DB.stor = DB.stor.filter(s => s.id !== id); scheduleSync('stor'); broadcast('stor', { action: 'delete', id }); res.json({ ok: true });
});
app.delete('/api/stor', requireAdmin, (req, res) => { DB.stor = []; scheduleSync('stor'); broadcast('stor', { action: 'deleteAll' }); res.json({ ok: true }); });

// ===== RIWAYAT WA =====
app.get('/api/riwayat-wa', (req, res) => res.json([...DB.riwayatWa].sort((a, b) => b.id - a.id).slice(0, 100)));
app.post('/api/riwayat-wa', (req, res) => {
  const r = { id: nextId(DB.riwayatWa), tanggal: String(req.body.tanggal || '').slice(0, 30), penerima: String(req.body.penerima || '').slice(0, 100), noHp: String(req.body.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20), jenis: String(req.body.jenis || '').slice(0, 20), status: String(req.body.status || 'Terkirim').slice(0, 20), pesan: String(req.body.pesan || '').slice(0, 2000) };
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
app.listen(PORT, '127.0.0.1', () => {
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

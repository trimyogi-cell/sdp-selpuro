const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ===== GITHUB STORAGE =====
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'trimyogi-cell/sdp-selpuro';
const GITHUB_FILE = 'database.json';
let dbCache = null;
let dbSha = null;
let saveQueue = null;

async function loadDatabase() {
  if (dbCache) return dbCache;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
    headers: {
      'Authorization': 'token ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'sdp-selpuro'
    }
  });
  if (res.status === 404) {
    dbCache = {};
    dbSha = null;
    return dbCache;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('GitHub load failed: ' + res.status + ' ' + (err.message || ''));
  }
  const data = await res.json();
  dbSha = data.sha;
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  dbCache = JSON.parse(content || '{}');
  return dbCache;
}async function flushSave() {
  if (!saveQueue) return;
  const payload = saveQueue;
  saveQueue = null;
  const content = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
  const body = { message: 'Auto-save data', content, sha: dbSha || undefined };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'sdp-selpuro'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('GitHub save failed:', res.status, err.message || '');
      if (res.status === 409) {
        dbSha = null;
        dbCache = null;
        const fresh = await loadDatabase();
        for (const k of Object.keys(payload)) fresh[k] = structuredClone(payload[k]);
        saveQueue = fresh;
        await flushSave();
      }
    } else {
      const data = await res.json();
      dbSha = data.content.sha;
    }
  } catch (e) {
    console.error('GitHub save exception:', e.message);
  }
}

async function loadTable(key) {
  try {
    const db = await loadDatabase();
    return structuredClone(db[key] !== undefined ? db[key] : (DEFAULTS[key] !== undefined ? DEFAULTS[key] : []));
  } catch (e) {
    console.error('Load error [' + key + ']:', e.message);
    return structuredClone(DEFAULTS[key] || []);
  }
}

async function saveTable(key, value) {
  try {
    const db = await loadDatabase();
    db[key] = structuredClone(value);
    saveQueue = db;
    await flushSave();
  } catch (e) {
    console.error('Save exception [' + key + ']:', e.message);
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

// ===== SECURITY UTILS =====
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':');
    const verify = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
  }
  return password === stored;
}

function isPasswordHashed(pw) { return pw && typeof pw === 'string' && pw.includes(':') && pw.split(':').length === 2; }

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

// ===== NEXT ID / IP =====
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1; }
function getClientIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'; }

// ===== STATELESS TOKEN AUTH =====
const SECRET = process.env.JWT_SECRET || crypto.createHmac('sha256', 'sdp-selpuro-v3').update(GITHUB_REPO).digest('hex');

function createToken(userId, role) {
  const payload = JSON.stringify({ userId, role, exp: Date.now() + 12 * 60 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + sig;
}

function verifyToken(token) {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, 'base64').toString();
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return null;
    return { userId: data.userId, role: data.role };
  } catch (e) { return null; }
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
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0, etag: false }));

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang' });
  req.userId = data.userId;
  req.userRole = data.role;
  next();
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Hanya admin yang bisa melakukan aksi ini' });
  next();
}

// ===== SSE =====
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
}

// ===== MIGRATE PLAINTEXT PASSWORDS =====
async function migratePasswords() {
  try {
    const users = await loadTable('users');
    let changed = false;
    for (const u of users) {
      if (u.password && !isPasswordHashed(u.password)) {
        u.password = hashPassword(u.password);
        changed = true;
      }
    }
    if (changed) await saveTable('users', users);
  } catch (e) { console.error('Password migration error:', e.message); }
}
migratePasswords();

// ===== AUTH (public) =====
app.post('/api/login', async (req, res) => {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi dalam 15 menit' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
    const users = await loadTable('users');
    const user = users.find(u => u.username === username);
    if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ error: 'Username atau password salah' });
    if (user.status === 'nonaktif') return res.status(403).json({ error: 'Akun dinonaktifkan' });
    if (!isPasswordHashed(user.password)) {
      user.password = hashPassword(password);
      await saveTable('users', users);
    }
    const token = createToken(user.id, user.role);
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

app.put('/api/profil', requireAdmin, async (req, res) => {
  try {
    const profil = await loadTable('profil');
    const allowed = ['namaSekolah', 'npsn', 'alamat', 'telp', 'email', 'kepsek', 'bendahara', 'noHpAdmin', 'namaAdmin'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) profil[key] = String(req.body[key]).slice(0, 200);
    }
    await saveTable('profil', profil);
    broadcast('profil', { action: 'update' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== USERS (admin only) =====
app.get('/api/users', async (req, res) => {
  try {
    const users = await loadTable('users');
    res.json(users.map(({ password: _, ...u }) => u));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, nama, password, role } = req.body;
    if (!username || !nama || !password) return res.status(400).json({ error: 'Username, nama, dan password wajib diisi' });
    if (username.length < 3 || username.length > 30) return res.status(400).json({ error: 'Username 3-30 karakter' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
    if (!['admin', 'operator', 'bendahara'].includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
    const users = await loadTable('users');
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan' });
    const user = { id: nextId(users), username, nama: nama.slice(0, 100), password: hashPassword(password), role: role || 'operator', status: 'aktif' };
    users.push(user);
    await saveTable('users', users);
    broadcast('users', { action: 'add', id: user.id });
    res.json({ id: user.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const users = await loadTable('users');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const u = users.find(x => x.id === id);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    const { username, nama, password, role, status } = req.body;
    if (username) u.username = String(username).slice(0, 30);
    if (nama) u.nama = String(nama).slice(0, 100);
    if (role && ['admin', 'operator', 'bendahara'].includes(role)) u.role = role;
    if (status) u.status = status;
    if (password && password !== '********' && password.length >= 6) u.password = hashPassword(password);
    await saveTable('users', users);
    broadcast('users', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const users = await loadTable('users');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    if (id === req.userId) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
    const filtered = users.filter(u => u.id !== id);
    await saveTable('users', filtered);
    broadcast('users', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await loadTable('users');
    const keepId = req.query.keepId ? parseInt(req.query.keepId) : null;
    if (!keepId || isNaN(keepId)) return res.status(400).json({ error: 'keepId wajib diisi' });
    const filtered = users.filter(u => u.id === keepId);
    if (!filtered.length) return res.status(400).json({ error: 'User keeper tidak ditemukan' });
    await saveTable('users', filtered);
    broadcast('users', { action: 'deleteAll' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== CHANGE PASSWORD =====
app.post('/api/change-password', async (req, res) => {
  try {
    const { passLama, passBaru } = req.body;
    if (!passLama || !passBaru) return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    if (passBaru.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    const users = await loadTable('users');
    const u = users.find(x => x.id === req.userId);
    if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (!verifyPassword(passLama, u.password)) return res.status(400).json({ error: 'Password lama salah' });
    u.password = hashPassword(passBaru);
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
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const ids = [];
    for (const item of items) {
      const s = { id: nextId(siswa), nis: String(item.nis || '').slice(0, 20), nama: String(item.nama || '').slice(0, 100), kelas: String(item.kelas || '').slice(0, 10), angkatan: String(item.angkatan || '').slice(0, 10), orangTua: String(item.orangTua || '').slice(0, 100), noHp: String(item.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20), alamat: String(item.alamat || '').slice(0, 200) };
      if (s.nama) { siswa.push(s); ids.push(s.id); }
    }
    await saveTable('siswa', siswa);
    broadcast('siswa', { action: 'add', ids });
    res.json({ ids });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/siswa/:id', async (req, res) => {
  try {
    const siswa = await loadTable('siswa');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const s = siswa.find(x => x.id === id);
    if (!s) return res.status(404).json({ error: 'Tidak ditemukan' });
    s.nis = String(req.body.nis || '').slice(0, 20);
    s.nama = String(req.body.nama || '').slice(0, 100);
    s.kelas = String(req.body.kelas || '').slice(0, 10);
    s.angkatan = String(req.body.angkatan || '').slice(0, 10);
    s.orangTua = String(req.body.orangTua || '').slice(0, 100);
    s.noHp = String(req.body.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20);
    s.alamat = String(req.body.alamat || '').slice(0, 200);
    await saveTable('siswa', siswa);
    broadcast('siswa', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const db = await loadDatabase();
    const siswa = structuredClone(db.siswa || []);
    const transaksi = structuredClone(db.transaksi || []);
    db.siswa = siswa.filter(s => s.id !== id);
    db.transaksi = transaksi.filter(t => t.siswaId !== id);
    saveQueue = db;
    await flushSave();
    broadcast('siswa', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/siswa', requireAdmin, async (req, res) => {
  try {
    const db = await loadDatabase();
    const ids = req.body.ids || null;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(Number));
      db.siswa = (db.siswa || []).filter(s => !idSet.has(s.id));
      db.transaksi = (db.transaksi || []).filter(t => !idSet.has(t.siswaId));
    } else {
      db.siswa = [];
      db.transaksi = [];
    }
    saveQueue = db;
    await flushSave();
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
    const j = { id: nextId(jb), kode: String(req.body.kode || '').slice(0, 20), nama: String(req.body.nama || '').slice(0, 100), kategori: String(req.body.kategori || '').slice(0, 30), nominal: Math.max(0, parseInt(req.body.nominal) || 0), tahun: String(req.body.tahun || '').slice(0, 20), kelas: String(req.body.kelas || 'all').slice(0, 10) };
    if (!j.nama) return res.status(400).json({ error: 'Nama jenis bayar wajib diisi' });
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
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const j = jb.find(x => x.id === id);
    if (!j) return res.status(404).json({ error: 'Tidak ditemukan' });
    j.kode = String(req.body.kode || '').slice(0, 20);
    j.nama = String(req.body.nama || '').slice(0, 100);
    j.kategori = String(req.body.kategori || '').slice(0, 30);
    j.nominal = Math.max(0, parseInt(req.body.nominal) || 0);
    j.tahun = String(req.body.tahun || '').slice(0, 20);
    j.kelas = String(req.body.kelas || 'all').slice(0, 10);
    await saveTable('jenisBayar', jb);
    broadcast('jenisbayar', { action: 'update', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar/:id', async (req, res) => {
  try {
    const jb = await loadTable('jenisBayar');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    await saveTable('jenisBayar', jb.filter(j => j.id !== id));
    broadcast('jenisbayar', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jenisbayar', requireAdmin, async (req, res) => {
  try {
    const db = await loadDatabase();
    const ids = req.body.ids || null;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(Number));
      db.jenisBayar = (db.jenisBayar || []).filter(j => !idSet.has(j.id));
    } else {
      db.jenisBayar = [];
    }
    saveQueue = db;
    await flushSave();
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
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const ids = [];
    for (const item of items) {
      const tx = { id: nextId(t), noBayar: String(item.noBayar || '').slice(0, 30), tanggal: String(item.tanggal || '').slice(0, 30), siswaId: parseInt(item.siswaId) || 0, siswaNama: String(item.siswaNama || '').slice(0, 100), siswaKelas: String(item.siswaKelas || '').slice(0, 10), jenisId: parseInt(item.jenisId) || 0, jenisNama: String(item.jenisNama || '').slice(0, 100), kategori: String(item.kategori || '').slice(0, 30), nominal: Math.max(0, parseInt(item.nominal) || 0), metode: String(item.metode || 'Tunai').slice(0, 20), keterangan: String(item.keterangan || '').slice(0, 200), status: String(item.status || 'Lunas').slice(0, 20), waktu: String(item.waktu || '').slice(0, 30) };
      t.push(tx);
      ids.push(tx.id);
    }
    await saveTable('transaksi', t);
    broadcast('transaksi', { action: 'add', ids });
    res.json({ ids });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi/:id', async (req, res) => {
  try {
    const t = await loadTable('transaksi');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    await saveTable('transaksi', t.filter(x => x.id !== id));
    broadcast('transaksi', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/transaksi', requireAdmin, async (req, res) => {
  try {
    const db = await loadDatabase();
    const ids = req.body.ids || null;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(Number));
      db.transaksi = (db.transaksi || []).filter(t => !idSet.has(t.id));
    } else {
      db.transaksi = [];
    }
    saveQueue = db;
    await flushSave();
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
    const item = { id: nextId(s), noStor: String(req.body.noStor || '').slice(0, 30), tanggal: String(req.body.tanggal || '').slice(0, 30), oleh: String(req.body.oleh || '').slice(0, 100), jumlah: Math.max(0, parseInt(req.body.jumlah) || 0), catatan: String(req.body.catatan || '').slice(0, 200) };
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
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    await saveTable('stor', s.filter(x => x.id !== id));
    broadcast('stor', { action: 'delete', id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/stor', requireAdmin, async (req, res) => {
  try {
    const db = await loadDatabase();
    const ids = req.body.ids || null;
    if (Array.isArray(ids) && ids.length > 0) {
      const idSet = new Set(ids.map(Number));
      db.stor = (db.stor || []).filter(s => !idSet.has(s.id));
    } else {
      db.stor = [];
    }
    saveQueue = db;
    await flushSave();
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
    const item = { id: nextId(r), tanggal: String(req.body.tanggal || '').slice(0, 30), penerima: String(req.body.penerima || '').slice(0, 100), noHp: String(req.body.noHp || '').replace(/[^0-9+\-\s]/g, '').slice(0, 20), jenis: String(req.body.jenis || '').slice(0, 20), status: String(req.body.status || 'Terkirim').slice(0, 20), pesan: String(req.body.pesan || '').slice(0, 2000) };
    r.push(item);
    await saveTable('riwayatWa', r);
    res.json({ id: item.id });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/riwayat-wa/:id', async (req, res) => {
  try {
    const r = await loadTable('riwayatWa');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const item = r.find(x => x.id === id);
    if (!item) return res.status(404).json({ error: 'Tidak ditemukan' });
    const allowed = ['tanggal', 'penerima', 'noHp', 'jenis', 'status', 'pesan'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) item[key] = String(req.body[key]).slice(key === 'pesan' ? 0 : 200);
    }
    await saveTable('riwayatWa', r);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/riwayat-wa/:id', async (req, res) => {
  try {
    const r = await loadTable('riwayatWa');
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' });
    await saveTable('riwayatWa', r.filter(x => x.id !== id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/riwayat-wa', async (req, res) => {
  try {
    await saveTable('riwayatWa', []);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ===== FORCE SYNC =====
app.post('/api/sync', async (req, res) => {
  try { res.json({ ok: true }); } catch (e) { res.status(500).json({ error: 'Sync error' }); }
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('API running on http://localhost:' + PORT));
}

module.exports = app;

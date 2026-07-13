# DEPLOY KE INTERNET (GRATIS, URL TETAP)

## Cara Deploy ke Render.com

Aplikasi akan online 24/7 dengan URL tetap: `https://sdp-selpuro.onrender.com`
Siapapun bisa akses dari HP/PC manapun di seluruh dunia.

---

## LANGKAH 1: Buat Akun GitHub (GRATIS)

1. Buka **https://github.com**
2. Klik **Sign up**
3. Isi: username, email, password
4. Verifikasi email

---

## LANGKAH 2: Upload Kode ke GitHub

1. Login ke **https://github.com**
2. Klik tombol **+** → **New repository**
3. Isi:
   - Repository name: `sdp-selpuro`
   - Description: `Sistem Pembayaran SDN 1 Selopuro`
   - Pilih **Public**
4. Klik **Create repository**
5. Klik **"uploading an existing file"**
6. **Drag & drop** seluruh isi folder `SD-Selpuro-Payment` (kecuali `node_modules` dan `node-portable`)
7. Klik **Commit changes**

---

## LANGKAH 3: Deploy ke Render.com (GRATIS)

1. Buka **https://render.com**
2. Klik **Get Started for Free**
3. **Sign up with GitHub** (gunakan akun GitHub yang sama)
4. Setelah login, klik **New +** → **Web Service**
5. Klik **Connect GitHub** → pilih repository `sdp-selpuro`
6. Isi pengaturan:
   - **Name**: `sdp-selpuro`
   - **Runtime**: `Node`
   - **Build Command**: `npm install --production`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
7. Klik **Create Web Service**
8. Tunggu 2-3 menit sampai deploy selesai

---

## LANGKAH 4: Selesai!

Setelah deploy selesai, aplikasi bisa diakses di:

```
https://sdp-selpuro.onrender.com
```

Login: **admin** / **esloji**

**Siapapun** di seluruh dunia bisa akses link ini!
- Di HP: buka Chrome, ketik link di atas
- Di PC: buka browser, ketik link di atas
- Install sebagai PWA: klik menu Chrome → "Tambahkan ke Layar Utama"

---

## CATATAN PENTING

### Update Aplikasi
Kalau ada perubahan kode, upload ulang ke GitHub:
1. Buka repository GitHub
2. Klik file yang mau diubah
3. Klik ikon pensil (edit)
4. Klik **Commit changes**
5. Render otomatis deploy ulang (~2 menit)

### Login Default
- **admin** / esloji (Administrator)
- **operator** / operator123 (Operator)

### Data Tersimpan
Data pembayaran tersimpan di server Render.com.
Data tetap ada selama service tidak dihapus.

### Batasan Render.com Free
- Service sleep setelah 15 menit tidak ada akses
- Saat diakses lagi, butuh ~30 detik untuk "bangun"
- Setelah bangun, normal lagi
- **Cocok untuk:** pembayaran sekolah, bukan real-time trading

# Sistem Pembayaran SD Negeri 1 Selopuro

## Cara Install

### Windows (PC)
1. Double-click **`setup.bat`** (otomatis download Node.js & install)
2. Buka browser ke `http://localhost:3000`
3. Login: `admin` / `esloji`

### Android (HP)
1. Pastikan HP & PC **1 jaringan WiFi** yang sama
2. Buka browser, ketik: `http://[IP-PC]:3000` (IP akan muncul di layar saat server jalan)
3. Tekan **⋮** > **Tambahkan ke Layar Utama** untuk install sebagai aplikasi

## Fitur
- **Login** dengan autentikasi user
- **Data Siswa** - CRUD lengkap dengan export CSV
- **Jenis Pembayaran** - LKS, Aktivitas, Iuran
- **Transaksi** - Catat bayar, detail, kirim struk WhatsApp
- **Stor ke Bendahara** - Catat setoran + cetak surat
- **Laporan** - Harian, Bulanan, Per Kelas, Ringkasan, Piutang
- **WhatsApp** - Kirim tagihan, reminder, konfirmasi lunas
- **Pengaturan** - Kelola akun user, profil sekolah
- **Real-time sync** - Data tersinkron antar device via server
- **PWA** - Bisa di-install di PC maupun Android

## Struktur
```
SD-Selpuro-Payment/
  server.js          <- Backend server (Node.js + SQLite)
  setup.bat          <- Setup otomatis untuk Windows
  package.json       <- Dependencies
  database.sqlite    <- Database (otomatis dibuat)
  public/
    index.html       <- Frontend HTML
    style.css        <- Tampilan
    app.js           <- Logika aplikasi
    manifest.json    <- PWA manifest
    sw.js            <- Service Worker
    icons/           <- Ikon aplikasi
```

## Akses dari Multi Device
- Buka `http://[IP-COMPUTER]:3000` dari device lain
- Semua perubahan otomatis sinkron ke semua device
- Data tersimpan di SQLite (server-side)

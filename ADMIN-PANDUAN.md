# Admin portofolio tanpa database

Editor ini menyimpan konten di `portfolio-content.json` dan gambar di `assets/` pada repositori GitHub Pages. Tidak ada database, Firebase, Supabase, atau layanan penyimpanan gambar eksternal.

Sebelum pertama kali digunakan, publikasikan file baru dari project ini ke branch `main`, termasuk `portfolio-content.json`, `admin.html`, `admin.css`, dan `admin.js`. Sesudah versi ini terbit, buka halaman `/admin.html` di website.

## Akses admin

1. Di GitHub, buka **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Buat token dengan resource owner `fadhlanqital` dan pilih hanya repositori `fadhlanqital.github.io`.
3. Beri izin **Repository permissions → Contents → Read and write**. Izin lainnya tidak dibutuhkan.
4. Buka `/admin.html` pada website, lalu masukkan token. Jangan masukkan token ke dalam source code, file JSON, chat, atau repositori.

Token hanya berada di memori tab admin selama halaman terbuka. Setelah tab ditutup atau koneksi diputus, token harus dimasukkan lagi. Halaman admin tidak ditautkan dari navigasi publik. GitHub Pages tidak menyediakan autentikasi untuk menyembunyikan URL halaman itu sendiri, jadi orang yang mengetahui `/admin.html` dapat melihat halaman masuk; mereka tidak dapat menerbitkan perubahan tanpa token GitHub yang memiliki hak tulis.

## Mengubah konten

- **Website**: identitas, teks beranda, gambar hero, About, keahlian, kontak, navigasi, footer, label antarmuka, metadata, serta bagian **Tampilan teks dan warna**. Label antarmuka mencakup petunjuk aksesibilitas yang sebelumnya tertulis di kode.
- **Tampilan teks dan warna**: atur skala judul, ukuran teks isi, tautan/tombol, label/metadata, dan caption gambar. Pilih warna untuk judul, teks isi, tautan/tombol, label, serta teks dan latar caption. Contoh di bawah pengaturan berubah sebagai pratinjau.
- Klik **Pratinjau website** untuk melihat seluruh tampilan draft di dalam dashboard. Anda dapat memeriksa mode desktop atau ponsel dan menjelajahi halaman website. Perubahan teks, warna, ukuran, kategori, proyek, serta gambar yang baru diunggah akan dipakai di pratinjau tanpa menerbitkannya.
- **Kategori**: tambah, ubah nama, alamat halaman, teks carousel, judul halaman, deskripsi, serta tata letak galeri atau daftar proyek.
- **Proyek & galeri**: tambah, edit, hapus, pilih kategori, atur urutan, tampilkan sebagai draft/publik, unggah gambar, ubah caption, dan susun seksi cerita.
- Pada halaman kategori personal artwork dan 2D game art, klik gambar untuk membukanya dalam tampilan layar penuh. Di kategori game development, klik gambar cover untuk melihat ukuran penuh; tautan di kartu proyek membuka halaman detail.
- Gambar yang diunggah diubah menjadi WebP dengan dimensi terpanjang maksimal 2400 piksel. Perubahan dan penghapusan gambar yang tidak lagi dipakai diterbitkan dalam commit yang sama dengan JSON.

Tekan **Terbitkan perubahan** untuk menyimpan satu commit ke branch `main`. Workflow GitHub Pages yang sudah ada akan menerbitkan ulang website. Perubahan biasanya muncul setelah deployment selesai.

## Batasan penting

Semua pengunjung dapat membaca berkas website dan gambar yang dipublikasikan. Editor hanya membatasi siapa yang dapat menulis ke repositori; gambar publik tetap dapat disimpan oleh pengunjung. Simpan file resolusi penuh secara terpisah dan publikasikan versi yang ukurannya sesuai untuk web bila ingin membatasi kualitas salinannya.

Karena situs ini statis, update yang diterbitkan menjadi commit GitHub. Ini bukan penyimpanan database dan perubahan tetap dapat dilihat atau dikembalikan lewat riwayat commit.

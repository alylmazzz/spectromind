# Docker Desktop Kurulum ve Başlatma Kılavuzu

## 🐳 Docker Desktop Kurulumu

### Windows için

1. **Docker Desktop İndir**
   - https://www.docker.com/products/docker-desktop adresinden indir
   - `Docker Desktop Installer.exe` dosyasını çalıştır

2. **Kurulum**
   - Kurulum sırasında "Use WSL 2 instead of Hyper-V" seçeneğini işaretle (önerilir)
   - Kurulum tamamlandıktan sonra bilgisayarı yeniden başlat

3. **Docker Desktop'ı Başlat**
   - Başlat menüsünden "Docker Desktop" uygulamasını çalıştır
   - Sistem tepsisinde (tray) Docker ikonu görünene kadar bekle (1-2 dakika)

4. **Doğrulama**
   ```bash
   docker --version
   docker ps
   ```

## ✅ Docker Desktop Çalışıyor mu Kontrol Et

### Yöntem 1: Komut Satırı
```bash
docker ps
```
Eğer hata alıyorsanız Docker Desktop çalışmıyor demektir.

### Yöntem 2: Sistem Tepsi İkonu
- Windows sistem tepsisinde (sağ alt köşe) Docker ikonunu kontrol et
- İkon görünüyorsa Docker çalışıyor demektir

### Yöntem 3: Docker Desktop Uygulaması
- Docker Desktop uygulamasını aç
- Sol üstte "Running" yazıyorsa çalışıyor demektir

## 🚀 Servisleri Başlatma

### Otomatik (Önerilen)
```bash
npm run dev
```

### Manuel
```bash
# Docker Desktop'ın çalıştığından emin ol
docker ps

# Servisleri başlat
docker-compose up -d

# Durumu kontrol et
docker-compose ps
```

## 🔧 Sorun Giderme

### Hata: "unable to get image" veya "Sistem belirtilen dosyayı bulamıyor"

**Sebep:** Docker Desktop çalışmıyor

**Çözüm:**
1. Docker Desktop uygulamasını başlat
2. Sistem tepsisinde Docker ikonunun göründüğünden emin ol
3. Birkaç saniye bekleyin (Docker başlatılıyor)
4. Tekrar deneyin: `docker ps`

### Hata: "version is obsolete"

**Çözüm:** ✅ Düzeltildi - `docker-compose.yml` dosyasından `version` satırı kaldırıldı

### Hata: Port zaten kullanılıyor

**Çözüm:**
```bash
# Kullanan process'i bul (Windows)
netstat -ano | findstr :8000

# docker-compose.yml'de portları değiştir veya
# Kullanan uygulamayı kapat
```

### Docker Desktop Başlamıyor

**Çözüm:**
1. Bilgisayarı yeniden başlat
2. Windows özelliklerinde "WSL 2" ve "Virtual Machine Platform" etkin mi kontrol et
3. Docker Desktop'ı yönetici olarak çalıştır

## 📋 Servis Portları

- **PostgreSQL**: 5432
- **Redis**: 6379
- **NMR Engine**: 8000
- **OPSIN Service**: 8001
- **Next.js**: 3000

Bu portların boş olduğundan emin olun.

## 🛑 Servisleri Durdurma

```bash
# Tüm servisleri durdur
npm run stop:services

# Veya manuel
docker-compose down

# Tüm verileri sil (dikkatli!)
docker-compose down -v
```

## 💡 İpuçları

1. **İlk Başlatma:** İlk kez `docker-compose up` çalıştırdığınızda image'lar indirileceği için 5-10 dakika sürebilir

2. **Bellek:** Docker Desktop en az 4GB RAM kullanır. Sisteminizde yeterli RAM olduğundan emin olun

3. **Disk Alanı:** Docker image'ları ve container'ları disk alanı kullanır. Düzenli olarak temizleyin:
   ```bash
   docker system prune -a
   ```

4. **Hızlandırma:** WSL 2 kullanımı Docker'ı daha hızlı çalıştırır


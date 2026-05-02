# SpectroMind v2.0 - Otomatik Servis Başlatma

## 🚀 Hızlı Başlangıç

### Tek Komutla Tüm Servisleri Başlatma

```bash
npm run dev
```

Bu komut otomatik olarak:
1. ✅ Docker servislerini başlatır (PostgreSQL, Redis, NMR Engine, Celery, OPSIN)
2. ✅ Servislerin hazır olmasını bekler
3. ✅ Next.js development server'ı başlatır

### Gereksinimler

- **Docker Desktop** yüklü ve çalışıyor olmalı
- **Node.js** ve **npm** yüklü olmalı

### Komutlar

```bash
# Tüm servisleri başlat ve Next.js'i çalıştır
npm run dev

# Sadece Docker servislerini başlat
npm run dev:services

# Sadece Next.js'i çalıştır (servisler zaten çalışıyorsa)
npm run dev:next

# Tüm servisleri durdur
npm run stop:services
```

## 📋 Servisler

Başlatılan servisler:

1. **PostgreSQL** (port 5432)
   - Veritabanı: `spectromind`
   - Kullanıcı: `spectromind`
   - pgvector extension ile

2. **Redis** (port 6379)
   - Cache ve session yönetimi
   - Celery broker

3. **NMR Engine** (port 8000)
   - FastAPI microservice
   - Health check: `http://localhost:8000/health`

4. **Celery Worker**
   - Async task processing
   - Redis broker kullanır

5. **OPSIN Service** (port 8001)
   - Local IUPAC parser

## 🔍 Servis Durumunu Kontrol Etme

### Docker Compose ile

```bash
docker-compose ps
```

### Manuel Kontrol

```bash
# PostgreSQL
docker exec spectromind_postgres pg_isready -U spectromind

# Redis
docker exec spectromind_redis redis-cli ping

# NMR Engine
curl http://localhost:8000/health
```

## ⚠️ Sorun Giderme

### Docker Desktop Çalışmıyor

```
❌ Docker is not installed or not in PATH
```

**Çözüm:** Docker Desktop'ı başlatın ve tekrar deneyin.

### Servisler Başlamıyor

```bash
# Manuel olarak başlat
docker-compose up -d

# Logları kontrol et
docker-compose logs

# Servisleri sıfırla
docker-compose down
docker-compose up -d
```

### Port Çakışması

Eğer portlar kullanılıyorsa:

```bash
# Kullanan process'i bul
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# docker-compose.yml'de portları değiştir
```

## 📝 Notlar

- İlk başlatmada Docker image'ları indirileceği için biraz zaman alabilir
- Servisler hazır olmadan Next.js başlatılırsa bazı özellikler çalışmayabilir
- Health check 30 saniye içinde tamamlanmazsa Next.js yine de başlatılır (servisler arka planda hazır olur)

## 🛑 Servisleri Durdurma

```bash
# Tüm servisleri durdur
npm run stop:services

# Veya manuel
docker-compose down
```


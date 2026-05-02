# RDKit Kurulum Talimatları (Windows)

RDKit bir Python paketidir ve npm ile kurulamaz. Windows'ta RDKit kurulumu için **Conda kullanmak en kolay yöntemdir**.

## ⚠️ ÖNEMLİ: Windows'ta RDKit Kurulumu

Windows'ta RDKit kurulumu zor olabilir çünkü:
- `rdkit-pypi` paketi Windows için mevcut değil
- Standart `pip install rdkit` genellikle çalışmaz
- **En kolay yöntem Conda kullanmaktır**

## Yöntem 1: Conda ile Kurulum (ÖNERİLEN)

### Adım 1: Miniconda Kurun (Eğer yoksa)

1. Miniconda'yı indirin: https://docs.conda.io/en/latest/miniconda.html
2. Kurulumu tamamlayın

### Adım 2: Conda Environment Oluştur ve RDKit Kur

```powershell
# Yeni bir conda environment oluştur
conda create -n spectromind python=3.11

# Environment'ı aktifleştir
conda activate spectromind

# RDKit'i kur
conda install -c conda-forge rdkit

# Doğrula
python -c "from rdkit import Chem; print('RDKit başarıyla kuruldu!')"
```

## Yöntem 2: Pre-built Wheel Dosyası ile (Alternatif)

Eğer Conda kullanmak istemiyorsanız:

```powershell
# Virtual environment oluştur
python -m venv venv_rdkit
venv_rdkit\Scripts\activate

# Pip'i güncelle
python.exe -m pip install --upgrade pip

# Python versiyonunuzu kontrol edin
python --version

# GitHub'dan Python versiyonunuza uygun wheel dosyasını indirin ve kurun
# https://github.com/rdkit/rdkit/releases adresinden
# Örnek (Python 3.11 için):
pip install https://github.com/rdkit/rdkit/releases/download/Release_2024_03_1/rdkit_pypi-2024.3.1-cp311-cp311-win_amd64.whl
```

## Yöntem 3: Docker Kullan (Gelişmiş)

Eğer Docker kullanıyorsanız:

```powershell
docker pull rdkit/rdkit
```

## Detaylı Talimatlar

Daha fazla bilgi için `RDKIT_WINDOWS_KURULUM.md` dosyasına bakın.

## Adım 3: Kurulumu Doğrula

```powershell
python -c "from rdkit import Chem; print('RDKit başarıyla kuruldu!')"
```

Eğer hata alırsanız, virtual environment'ın aktif olduğundan emin olun.

## Sorun Giderme

### Virtual Environment Bulunamıyor Hatası

Eğer sistem Python'da RDKit bulunamıyorsa:
1. Virtual environment'ın doğru yerde olduğundan emin olun: `venv_rdkit\Scripts\python.exe`
2. Virtual environment'ı aktifleştirin: `venv_rdkit\Scripts\activate`
3. RDKit'i tekrar kurun: `pip install rdkit-pypi`

### Python Bulunamıyor Hatası

Eğer `python` komutu çalışmıyorsa:
- Python 3.11 veya üzeri kurulu olmalı
- PATH'e Python eklenmiş olmalı
- Alternatif olarak: `python3` veya `py` komutunu deneyin

## Notlar

- RDKit sadece Python'da çalışır, npm paketi değildir
- Virtual environment kullanmak önerilir (sistem Python'u kirletmemek için)
- RDKit kurulumu birkaç dakika sürebilir (büyük bir paket)


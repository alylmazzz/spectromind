# RDKit Windows Kurulum Rehberi

RDKit Windows'ta kurulumu zor olabilir. Aşağıdaki yöntemlerden birini deneyin.

## Yöntem 1: Conda ile Kurulum (ÖNERİLEN)

Conda, RDKit kurulumu için en kolay yöntemdir:

```powershell
# 1. Miniconda veya Anaconda kurun (eğer yoksa)
# https://docs.conda.io/en/latest/miniconda.html

# 2. Yeni bir conda environment oluştur
conda create -n spectromind python=3.11

# 3. Environment'ı aktifleştir
conda activate spectromind

# 4. RDKit'i kur
conda install -c conda-forge rdkit

# 5. Doğrula
python -c "from rdkit import Chem; print('RDKit başarıyla kuruldu!')"
```

## Yöntem 2: Pip ile Kurulum (Deneysel)

```powershell
# Virtual environment oluştur
python -m venv venv_rdkit
venv_rdkit\Scripts\activate

# Pip'i güncelle
python.exe -m pip install --upgrade pip

# RDKit'i kur (eğer wheel dosyası mevcutsa)
pip install rdkit

# VEYA özel wheel dosyası kullan
# pip install https://github.com/rdkit/rdkit/releases/download/Release_XXXX_XX_XX/rdkit-pypi-XXXX.XX.X-cp311-cp311-win_amd64.whl
```

## Yöntem 3: Pre-built Wheel Dosyası (En Kolay)

```powershell
# Virtual environment oluştur
python -m venv venv_rdkit
venv_rdkit\Scripts\activate

# RDKit'in en son wheel dosyasını indir ve kur
# https://github.com/rdkit/rdkit/releases adresinden
# Python versiyonunuza uygun wheel dosyasını indirin

# Örnek (Python 3.11 için):
pip install https://github.com/rdkit/rdkit/releases/download/Release_2024_03_1/rdkit_pypi-2024.3.1-cp311-cp311-win_amd64.whl
```

## Yöntem 4: Docker Kullan (Alternatif)

Eğer yukarıdaki yöntemler çalışmazsa, Docker kullanabilirsiniz:

```powershell
# RDKit içeren bir Docker image kullan
docker pull rdkit/rdkit
```

## Sorun Giderme

### "No matching distribution found" Hatası

Bu hata, RDKit'in Windows için pip wheel dosyasının olmadığını gösterir. Çözüm:
1. Conda kullanın (Yöntem 1)
2. Pre-built wheel dosyası kullanın (Yöntem 3)

### Python Versiyonu Uyumsuzluğu

RDKit belirli Python versiyonlarını destekler:
- Python 3.8, 3.9, 3.10, 3.11, 3.12

Python versiyonunuzu kontrol edin:
```powershell
python --version
```

### Virtual Environment Bulunamıyor

Eğer sistem Python'da RDKit bulunamıyorsa:
1. Virtual environment'ın aktif olduğundan emin olun: `(venv_rdkit)` prompt'u görünmeli
2. Python path'ini kontrol edin: `where python` (Windows)
3. Virtual environment'ı yeniden oluşturun

## Önerilen Yöntem

**Windows için en kolay yöntem Conda'dır.** Eğer Conda kurulu değilse:
1. Miniconda'yı kurun: https://docs.conda.io/en/latest/miniconda.html
2. Yöntem 1'i takip edin

## Notlar

- RDKit büyük bir pakettir (~500MB), kurulum birkaç dakika sürebilir
- Windows'ta RDKit kurulumu Linux/Mac'e göre daha zordur
- Conda kullanmak en güvenilir yöntemdir


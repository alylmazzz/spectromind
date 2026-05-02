# SpectroMind Kurulum Özeti

## 1. RDKit Kurulumu (Python)

**ÖNEMLİ:** RDKit bir npm paketi değildir! Python paketidir.

### En Kolay Yöntem: Conda

```powershell
# 1. Miniconda kurun (eğer yoksa): https://docs.conda.io/en/latest/miniconda.html

# 2. Conda environment oluştur
conda create -n spectromind python=3.11

# 3. Aktifleştir
conda activate spectromind

# 4. RDKit kur
conda install -c conda-forge rdkit

# 5. Doğrula
python -c "from rdkit import Chem; print('Başarılı!')"
```

### Alternatif: Pre-built Wheel

```powershell
python -m venv venv_rdkit
venv_rdkit\Scripts\activate
pip install --upgrade pip
# Python versiyonunuza uygun wheel dosyasını GitHub'dan indirin:
# https://github.com/rdkit/rdkit/releases
```

## 2. React Dependency Conflict Çözümü

React 19 ile `@react-three/fiber` arasında conflict var. Çözüm:

```powershell
npm install --legacy-peer-deps
```

VEYA `package.json`'a ekleyin:

```json
{
  "overrides": {
    "react": "19.2.1",
    "react-dom": "19.2.1"
  }
}
```

## 3. Tüm Bağımlılıkları Kur

```powershell
# Node.js bağımlılıkları
npm install --legacy-peer-deps

# Python bağımlılıkları (Conda kullanıyorsanız)
conda activate spectromind
conda install -c conda-forge rdkit numpy
```

## Sorun Giderme

- **RDKit bulunamıyor:** Conda kullanın veya wheel dosyası indirin
- **React conflict:** `--legacy-peer-deps` kullanın
- **Python bulunamıyor:** PATH'e Python ekleyin veya `py` komutunu kullanın


# Peak Parser Guardrails Implementation

## 🔴 Tespit Edilen Sorunlar

### 1. FTIR cm⁻¹ değerlerinin ¹H NMR ppm olarak parse edilmesi
- **Sorun:** `δ 3300.00 (o, 1H)` ve `δ 3500.00 (o, 1H)` gibi FTIR bandları ¹H NMR peak'i olarak parse ediliyor
- **Sebep:** Tek bir regex ile "δ <number>" gördüğü her şeyi NMR peak sanıyor
- **Etki:** Toplam proton sayısı yanlış şişiyor, formül türetme heuristiği yanlış H sayısı tahmin ediyor

### 2. ¹H + ¹³C + FTIR aynı prompt'a karışması
- **Sorun:** Farklı spektrum tipleri aynı dataset'te birleşiyor
- **Sebep:** `spectrumType` ayrımı yok veya parsing aşamasında kayboluyor
- **Etki:** LLM/heuristic en basit aromatik ester gibi bir şeye sapıyor, C27H24 gibi yanlış formüller üretiyor

### 3. Formülün spektrumdan türetilmeye çalışılması
- **Sorun:** Formül, peak'lerden türetiliyor (özellikle sadece ¹H ile)
- **Sebep:** "peak sayısı ↔ C sayısı" gibi hatalı eşlemeler
- **Etki:** C27H24 gibi yanlış formüller üretiliyor

### 4. ¹³C multiplicity bilgisinin kullanılmaması
- **Sorun:** CH3/CH2/CH/Cq etiketleri parse ediliyor ama kullanılmıyor
- **Sebep:** CHn sayıları "atomCounts" gibi kullanılmıyor
- **Etki:** Formül doğrulama yapılamıyor

### 5. DBE hesaplama bug'ı
- **Sorun:** DBE hesaplama LLM'e bırakılmış, kod tarafında yapılmıyor
- **Sebep:** `renderDBEBlock` var ama AI hala kendi DBE'sini yazıyor
- **Etki:** C10H10O için DBE=7 yazılıyor (doğrusu 6)

## ✅ Yapılan Düzeltmeler

### 1. Yeni Parse Fonksiyonları (`lib/utils/peakParser.ts`)

**Özellikler:**
- ✅ `parseH1Peaks()` - ¹H NMR için strict parsing (ppm range: -2 to 15)
- ✅ `parseC13Peaks()` - ¹³C NMR için strict parsing (ppm range: 0 to 250)
- ✅ `parseFTIRBands()` - FTIR için strict parsing (cm⁻¹ range: 400 to 4000)
- ✅ Guardrail'ler: Out-of-range değerler `UNIT_MISMATCH` warning ile reject ediliyor
- ✅ `countCHnTypes()` - ¹³C multiplicity sayımı için utility

**Guardrail Örnekleri:**
```typescript
// ¹H için: δ 3300.00 → UNIT_MISMATCH (FTIR bandı)
if (shift < -2 || shift > 15) {
  pushWarn(warnings, "UNIT_MISMATCH", rawLine, 
    `¹H ppm out of range (${shift}). This likely belongs to FTIR (cm^-1).`);
  continue;
}

// ¹³C için: δ 300.00 → OUT_OF_RANGE
if (shift < 0 || shift > 250) {
  pushWarn(warnings, "OUT_OF_RANGE", rawLine, 
    `¹³C ppm out of range (${shift}). Line ignored.`);
  continue;
}

// FTIR için: 5000 cm⁻¹ → OUT_OF_RANGE
if (wn < 400 || wn > 4000) {
  pushWarn(warnings, "OUT_OF_RANGE", rawLine, 
    `FTIR cm^-1 out of range (${wn}). Line ignored.`);
  continue;
}
```

### 2. Formula.ts Güncellemeleri (`lib/chem/formula.ts`)

**Yeni Fonksiyonlar:**
- ✅ `parseFormula()` - Full formula parsing with normalization (unicode subscripts, charges, etc.)
- ✅ `computeDBEDetailed()` - DBE hesaplama detaylı versiyon (terms ile)
- ✅ `formulaEquals()` - İki formülü karşılaştırma (normalize edilmiş)
- ✅ `normalizeToHill()` - Formülü Hill sistemine normalize etme

**Unicode Subscript Desteği:**
```typescript
// C₄₇H₅₁NO₁₄ → C47H51NO14
const SUBSCRIPT_DIGITS = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9"
};
```

**DBE Hesaplama:**
```typescript
// DBE = C - H/2 - X/2 + N/2 + 1
export function computeDBEDetailed(atomCounts: AtomCounts): DBEResult {
  const C = atomCounts['C'] ?? 0;
  const H = atomCounts['H'] ?? 0;
  const N = atomCounts['N'] ?? 0;
  const X = (atomCounts['F'] ?? 0) + (atomCounts['Cl'] ?? 0) + 
            (atomCounts['Br'] ?? 0) + (atomCounts['I'] ?? 0);
  const dbe = C - H / 2 - X / 2 + N / 2 + 1;
  return { dbe, terms: { C, H, N, X } };
}
```

### 3. Kullanım Örnekleri

**Parse Hatalı Input:**
```typescript
const rawText = `
δ 8.13 (d, 2H)
δ 3300.00 (o, 1H)  ← FTIR bandı, reject edilecek
δ 3500.00 (o, 1H)  ← FTIR bandı, reject edilecek
δ 203.60 ppm (Cq)
3300 cm⁻¹ (50)
`;

const h1 = parseH1Peaks(rawText);
// h1.peaks: [{ shiftPpm: 8.13, multiplicity: 'd', integrationH: 2 }]
// h1.warnings: [
//   { code: 'UNIT_MISMATCH', line: 'δ 3300.00 (o, 1H)', message: '...' },
//   { code: 'UNIT_MISMATCH', line: 'δ 3500.00 (o, 1H)', message: '...' }
// ]

const c13 = parseC13Peaks(rawText);
// c13.peaks: [{ shiftPpm: 203.60, carbonType: 'Cq' }]

const ftir = parseFTIRBands(rawText);
// ftir.bands: [{ wavenumberCm1: 3300, intensity: 50 }]
```

**Formül Normalizasyon:**
```typescript
const formula1 = "C₄₇H₅₁NO₁₄";
const formula2 = "C47H51NO14";
const formula3 = "C47H51NO14+";

formulaEquals(formula1, formula2); // true
normalizeToHill(formula3); // "C47H51NO14"
```

## 📋 Değiştirilen Dosyalar

1. ✅ `lib/utils/peakParser.ts` - Yeni strict parse fonksiyonları
2. ✅ `lib/chem/formula.ts` - Gelişmiş formula parsing ve DBE hesaplama

## 🎯 Sonraki Adımlar

1. **BulkInput.tsx güncellemesi:** Mevcut parsing kodunu yeni `parseH1Peaks`, `parseC13Peaks`, `parseFTIRBands` fonksiyonlarıyla değiştir
2. **useSpectralAnalysis.ts güncellemesi:** Peak parsing'de guardrail'leri kullan
3. **CHn validation:** ¹³C multiplicity sayımlarını formül doğrulama için kullan

## 🧪 Test Senaryoları

**Test 1: FTIR Band Rejection**
```
Input: "δ 3300.00 (o, 1H)"
Expected: UNIT_MISMATCH warning, peak rejected
```

**Test 2: ¹H Range Validation**
```
Input: "δ 20.00 (s, 1H)"
Expected: OUT_OF_RANGE warning, peak rejected
```

**Test 3: Formula Normalization**
```
Input: "C₄₇H₅₁NO₁₄"
Expected: "C47H51NO14" (Hill format)
```

**Test 4: DBE Calculation**
```
Input: "C10H10O"
Expected: DBE = 10 - 10/2 + 1 = 6 (not 7!)
```

# Peak Analizi - Seçili Molekül Düzeltmesi

## 🔴 Tespit Edilen Sorun

**Sorun:** Seçili molekül (Paclitaxel) varsa AI çağrısı atlanıyor, bu yüzden peak analizi yapılmıyor.

**Kullanıcı İsteği:**
> "peak analizini yaptırıp yazdırın"

**Mevcut Durum:**
```
Seçili molekül: Paclitaxel (C₄₇H₅₁NO₁₄). Peak analizi yapılıyor...
```
→ Sadece bu mesaj gösteriliyor, gerçek peak analizi yapılmıyor.

## ✅ Yapılan Düzeltme

### Mantık Değişikliği

**Önce (Hatalı):**
```
1. Seçili molekül var → AI çağrısı ATLANIYOR
2. Sadece temel bilgiler gösteriliyor
3. Peak analizi YAPILMIYOR
```

**Sonra (Düzeltildi):**
```
1. Seçili molekül var → Peak analizi için AI çağrısı YAPILIYOR
2. Formül zorunlu kılınıyor (identity lock)
3. Peak analizi YAPILIYOR ve gösteriliyor
4. Formül türetme YAPILMIYOR (zorunlu formül kullanılıyor)
```

### Kod Değişikliği

**Dosya:** `lib/hooks/useSpectralAnalysis.ts` (satır ~1293-1380)

**Önce:**
```typescript
if (activeKnownMolecule) {
  // AI çağrısı ATLANIYOR
  result = {
    reasoning: `Seçili molekül: ${activeKnownMolecule.name}...`,
    // Peak analizi YOK
  };
}
```

**Sonra:**
```typescript
if (activeKnownMolecule) {
  // Enhanced Library varsa onu kullan
  if (hasEnhancedLibraryData) {
    result = enhancedData.aiResult; // Peak analizi dahil
  } else {
    // Peak analizi için AI çağrısı YAP
    result = await fetchChatGPTAnalysis(...);
    
    // Formülü zorunlu override et
    result.formula = activeKnownMolecule.formula;
    result.moleculeName = activeKnownMolecule.name;
  }
}
```

### Özellikler

1. ✅ **Peak Analizi Yapılıyor:** Seçili molekül varsa bile AI peak analizi yapıyor
2. ✅ **Formül Zorunlu:** Identity lock ile formül zorunlu kılınıyor (C47H51NO14)
3. ✅ **Formül Türetme Yok:** AI formül türetmiyor, sadece peak analizi yapıyor
4. ✅ **Enhanced Library Öncelikli:** Enhanced Library verisi varsa onu kullanıyor

## 📋 Sonuç

Artık:
- ✅ Seçili molekül (Paclitaxel) varsa peak analizi yapılıyor
- ✅ Reasoning'de detaylı peak analizi gösteriliyor
- ✅ Formül zorunlu olarak C47H51NO14 kullanılıyor
- ✅ Yanlış formül (C27H24) türetilmiyor
- ✅ DBE analizi doğru formülle yapılıyor

**Test:** Paclitaxel seçildiğinde, peak analizi yapılmalı ve reasoning'de detaylı analiz gösterilmeli.

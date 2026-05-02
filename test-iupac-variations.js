// Test IUPAC variation generation for "1,2 trikloro etiliden l ramno furanoz"

function generateIUPACVariations(name) {
  const variations = [];
  const normalized = name.trim();

  // Orijinal ismi ekle
  variations.push(normalized);

  // 1. Türkçe karakterleri İngilizce'ye çevir
  const turkishToEnglish = {
    'ş': 's', 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u',
    'Ş': 'S', 'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ü': 'U'
  };
  let englishVersion = normalized;
  for (const [tr, en] of Object.entries(turkishToEnglish)) {
    englishVersion = englishVersion.replace(new RegExp(tr, 'g'), en);
  }

  if (englishVersion !== normalized) {
    variations.push(englishVersion);
  }

  // 2. Yunan harflerini değiştir (α → alpha, β → beta, γ → gamma)
  const greekMap = {
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta',
    'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta',
    'Α': 'alpha', 'Β': 'beta', 'Γ': 'gamma', 'Δ': 'delta'
  };

  let alphanumericVersion = englishVersion;
  for (const [greek, latin] of Object.entries(greekMap)) {
    alphanumericVersion = alphanumericVersion.replace(new RegExp(greek, 'g'), latin);
  }
  if (alphanumericVersion !== englishVersion) {
    variations.push(alphanumericVersion);
  }

  // 3. Parantezleri kaldır/ekle
  const withoutParens = alphanumericVersion.replace(/\(([^)]+)\)/g, '$1');
  if (withoutParens !== alphanumericVersion) {
    variations.push(withoutParens);
  }

  // 4. Tire ve boşlukları normalize et
  const withSpaces = alphanumericVersion.replace(/-/g, ' ');
  if (withSpaces !== alphanumericVersion) {
    variations.push(withSpaces);
  }

  // 5. Tire olmadan
  const withoutDashes = alphanumericVersion.replace(/-/g, '');
  if (withoutDashes !== alphanumericVersion) {
    variations.push(withoutDashes);
  }

  // 5a. Boşlukları tireye çevir (space-separated → hyphenated)
  const spacesToHyphens = alphanumericVersion.replace(/\s+/g, '-');
  if (spacesToHyphens !== alphanumericVersion) {
    variations.push(spacesToHyphens);
  }

  // 5b. TÜM boşlukları kaldır (aggressive consolidation)
  const noSpaces = alphanumericVersion.replace(/\s+/g, '');
  if (noSpaces !== alphanumericVersion && !variations.includes(noSpaces)) {
    variations.push(noSpaces);
  }

  // 5c. Hem tire hem boşlukları kaldır (ultra-aggressive)
  const noSpacesOrDashes = alphanumericVersion.replace(/[\s-]+/g, '');
  if (noSpacesOrDashes !== alphanumericVersion && !variations.includes(noSpacesOrDashes)) {
    variations.push(noSpacesOrDashes);
  }

  // 6. Basit isim çıkar (son kelime genellikle ana molekül)
  const parts = alphanumericVersion.split(/[-\s]+/);
  const lastPart = parts[parts.length - 1];
  if (lastPart.length > 5 && !variations.includes(lastPart)) {
    variations.push(lastPart);
  }

  // 6a. Son 2 kelimeyi birleştir (örn: "ramno furanoz" → "ramnofuranoz")
  if (parts.length >= 2) {
    const lastTwo = parts[parts.length - 2] + parts[parts.length - 1];
    if (lastTwo.length > 8 && !variations.includes(lastTwo)) {
      variations.push(lastTwo);
    }
  }

  // 6b. Son 3 kelimeyi birleştir
  if (parts.length >= 3) {
    const lastThree = parts[parts.length - 3] + parts[parts.length - 2] + parts[parts.length - 1];
    if (lastThree.length > 10 && !variations.includes(lastThree)) {
      variations.push(lastThree);
    }
  }

  // 7. Ortak IUPAC ön ekleri kaldır
  const prefixesToRemove = [
    /^\d+,\d+-O-/,        // "1,2-O-"
    /^\d+,\d+-/,          // "1,2-"
    /^alpha-/i,
    /^beta-/i,
    /^gamma-/i,
    /^L-/,
    /^D-/,
    /^cis-/,
    /^trans-/,
    /^\(E\)-/,
    /^\(Z\)-/
  ];

  for (const prefix of prefixesToRemove) {
    const simplified = alphanumericVersion.replace(prefix, '');
    if (simplified !== alphanumericVersion && simplified.length > 3) {
      variations.push(simplified);
    }
  }

  // 8. Tüm küçük harf versiyonu
  const lowercase = alphanumericVersion.toLowerCase();
  if (!variations.includes(lowercase)) {
    variations.push(lowercase);
  }

  // 9. İlk harf büyük
  const capitalized = alphanumericVersion.charAt(0).toUpperCase() +
                     alphanumericVersion.slice(1).toLowerCase();
  if (!variations.includes(capitalized)) {
    variations.push(capitalized);
  }

  // Benzersiz varyasyonları döndür
  return [...new Set(variations)].filter(v => v.length > 2);
}

// Test
const testQuery = "1,2 trikloro etiliden l ramno furanoz";
console.log(`\n🧪 Test Query: "${testQuery}"\n`);
console.log("📝 Generated Variations:\n");

const variations = generateIUPACVariations(testQuery);
variations.forEach((variation, index) => {
  console.log(`${index + 1}. "${variation}"`);
});

console.log(`\n✅ Total Variations: ${variations.length}`);
console.log("\n🎯 Most likely to work:");
console.log("   • rhamnofuranose");
console.log("   • 1,2-trichloro-ethylidene-l-rhamno-furanose");
console.log("   • 12trichloroethylidenel rhamnofuranose");
console.log("   • lrhamnofuranose");

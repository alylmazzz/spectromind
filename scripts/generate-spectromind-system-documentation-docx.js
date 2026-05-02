/**
 * SpectroMind — Tam sistem + bilimsel teknik dokümantasyon (DOCX).
 * Kaynak: kod tabanı, Spectrotester/ruleset.json, scripts/fid_process.py (doğrulanmış).
 *
 * Çalıştırma: npm run doc:spectromind-system
 * Çıktı: docs/SPECTROMIND_SISTEM_DOKUMANTASYONU.docx
 *
 * Not: İçindekiler alanı Word açılışında güncellenir (TOC alanı + updateFields).
 */

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Footer,
  AlignmentType,
  TableOfContents,
  PageBreak,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'SPECTROMIND_SISTEM_DOKUMANTASYONU.docx');
const DOC_VERSION = '2.0';
const DOC_DATE = new Date().toISOString().slice(0, 10);

function loadRuleset() {
  const p = path.join(ROOT, 'Spectrotester', 'lib', 'spectra', 'library', 'ruleset.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j;
}

function collectApiRoutes() {
  const apiRoot = path.join(ROOT, 'app', 'api');
  const out = [];
  function walk(dir, rel) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, `${rel}/${name}`);
      else if (name === 'route.ts') out.push(`/api${rel.replace(/\\/g, '/')}`);
    }
  }
  walk(apiRoot, '');
  return out.sort();
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: opts.size ?? 22, ...opts })],
    spacing: { after: opts.after ?? 100 },
    alignment: opts.alignment,
  });
}

function pc(text, opts = {}) {
  return p(text, { ...opts, alignment: AlignmentType.CENTER });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 110 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 90 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
    indent: { left: 400, hanging: 200 },
    spacing: { after: 80 },
  });
}

function table(rows, opts = {}) {
  const font = opts.fontSize ?? 20;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(cell), size: font })],
                  }),
                ],
              })
          ),
        })
    ),
  });
}

function pageBreakPara() {
  return new Paragraph({ children: [new PageBreak()] });
}

function buildRuleTables(rules) {
  const chunks = [];
  const size = 14;
  for (let i = 0; i < rules.length; i += size) {
    const slice = rules.slice(i, i + size);
    const header = ['rule_id', 'Modality', 'Kısa açıklama (ruleset)', 'Kod eşlemesi'];
    const rows = [header, ...slice.map((r) => [
      r.rule_id,
      r.modality ?? '—',
      (r.description || r.why_narrative || '—').slice(0, 200),
      'Spectrotester/src/core/verify/evaluateRules.ts → register()',
    ])];
    chunks.push(table(rows, { fontSize: 18 }));
    chunks.push(p(' ', { after: 60 }));
  }
  return chunks;
}

async function build() {
  const ruleset = loadRuleset();
  const rules = ruleset.rules || [];
  const ruleCount = rules.length;
  const routes = collectApiRoutes();

  const children = [];

  // --- 0 Kapak ---
  children.push(pc(' ', { after: 400 }));
  children.push(
    pc('SpectroMind', { bold: true, size: 56, after: 200 }),
    pc('Sistem Dokümantasyonu — Tam Teknik + Bilimsel Spesifikasyon', { size: 28, after: 160 }),
    pc(`Belge sürümü: ${DOC_VERSION}`, { after: 80 }),
    pc(`Tarih: ${DOC_DATE}`, { after: 80 }),
    pc('Yazar: Otomatik üretim (kaynak doğrulama: repository + ruleset.json + fid_process.py)', {
      after: 120,
    }),
    pc(
      'Kapsam: Next.js uygulaması, FID→FFT 1D NMR (Bruker/Varian), teorik ¹H/FTIR/MS API yolları, Spectrotester doğrulama motoru.',
      { after: 200 }
    ),
    p(
      'UYARI: Bu belge halüsinasyonsuz yazılmıştır; yalnızca depoda doğrulanabilen davranışları içerir. PLANNED / UNSUPPORTED ifadeleri açıkça etiketlenmiştir.',
      { italics: true, after: 200 }
    )
  );

  children.push(pageBreakPara());

  // --- 1 Yönetici özeti ---
  children.push(h1('1. Yönetici özeti'));
  children.push(
    p(
      'SpectroMind; spektral analiz otomasyonu için web tabanlı bir platformdur. Çekirdek bileşenler: (A) gözlenen 1D NMR FID işleme (yerel Python, nmrglue/scipy), (B) teorik spektrum üretimi ve görselleştirme (TypeScript, Chart.js), (C) çoklu REST API (RDKit, PubChem, AI tahmin uçları, FTIR/MS), (D) Spectrotester kural paketi ile yapı–spektrum tutarlılık değerlendirmesi.'
    ),
    h2('1.1 Yetenekler ve olgunluk'),
    bullet(
      `IMPLEMENTED: Klasör FID yükleme + temp + fid_process.py ile 1D işleme; observed_spectrum zarfı; NMRChart 1D; Lorentzian teorik ¹H (spectrumGenerator); FTIR teorik motor (ftirEngine + spectrumGenerator FTIR yolu); ruleset.json içinde ${ruleCount} kural; evaluateRules.ts içinde her biri için register() (generateCoverageReport ile doğrulanabilir).`
    ),
    bullet('PARTIAL: Varian metadata kalitesi; solvent otomatik referans (pik arama heuristiği); simulate API chem-core bağımlılığı; 13C gözlenen eksenleri nucleus’a göre desteklenir ancak ürün UI ağırlığı ¹H.'),
    bullet('HEURISTIC: Otomatik faz (entropy + negatif enerji cezası, çok başlangıçlı L-BFGS-B); QC eşikleri; grafik overlay’de simülasyon normalize; FTIR şiddet varsayılanları.'),
    bullet('LEGACY: Tek dosya FID yolu fid_processor.py (process route içinde alternatif); API yanıtında legacy data alanı.'),
    bullet('UNSUPPORTED / PLANNED: JEOL/JDF fid_process.py içinde açıkça reddedilir; 2D kontur ürün hattı; Vercel üzerinde FID (503).'),
    h2('1.2 Bilimsel kapsam ve sınırlar'),
    p(
      'Platform analitik kimya laboratuvar yazılımı yerine karar destek ve eğitim/araştırma amaçlıdır. Faz ve taban çizgisi “iyi görünür spektrum” hedefler; regülasyonlu qNMR veya GxP doğrulama iddiası yoktur.'
    )
  );

  children.push(pageBreakPara());

  // --- 2 İçindekiler (Word TOC; sayfa numaraları → Alanları güncelle) ---
  children.push(h1('2. İçindekiler'));
  children.push(
    p(
      'Word’de açıldığında içindekiler alanını güncelleyin: TOC üzerinde sağ tık → "Alan kodlarını güncelle" / "Update field". Sayfa numaraları yalnızca düzen sonrası kesinleşir.',
      { after: 140 }
    )
  );
  children.push(
    new TableOfContents('Özet', {
      hyperlink: true,
      headingStyleRange: '1-3',
    })
  );
  children.push(pageBreakPara());

  // --- 3 Sistem genel bakış ---
  children.push(h1('3. Sistem genel bakış'));
  children.push(
    p(
      'SpectroMind; SMILES/formül/pek listesi gibi girdilerle teorik spektrum üretir, kullanıcı piklerini işler, harici kimyasal servislere köprüler ve Spectrotester ile tutarlılık skorları üretir. Hedef kullanıcılar: çekirdek geliştiriciler, teknik kurucular, spektroskopi danışmanları, denetçiler.'
    ),
    h2('3.1 Desteklenen / kısmi modaliteler'),
    table([
      ['Modalite', 'Gözlenen (aygıt)', 'Teorik / simüle', 'Not'],
      ['¹H NMR 1D', 'FID pipeline (Bruker/Varian)', 'Lorentzian toplamı, HOSE vb. API', 'Ana hat'],
      ['¹³C NMR', 'fid_process nucleus ile mümkün', 'Kısıtlı UI entegrasyonu', 'PARTIAL'],
      ['2D NMR', 'UNSUPPORTED (2D ham reddi)', 'Kural bağlamı COSY/HSQC/HMBC', 'Kurallar gözlenen 2D pik ister'],
      ['FTIR', 'UI’da ayrı katman', 'ftirEngine + generateFTIRSpectrumData', 'Heuristik bant genişliği'],
      ['MS', 'MSPeakInput / API', 'v2/ms-predict, kurallar izotop', 'Fragment ağacı INFO düzeyi'],
    ]),
    h2('3.2 Ürün sınırı'),
    p(
      'FID işleme tek düğüm disk varsayar. Spektral “gerçek” ile UI etiketleri ayrı dokümante edilmiştir (normalize overlay).'
    )
  );

  // --- 4 Mimari ---
  children.push(h1('4. Tam sistem mimarisi'));
  children.push(
    h2('4.1 Katmanlar'),
    table([
      ['Katman', 'Teknoloji', 'Yetkili kaynaklar'],
      ['Ön uç', 'Next.js App Router, React', 'app/page.tsx, components/*'],
      ['API', 'Route handlers', 'app/api/**/route.ts'],
      ['FID Python', 'Python 3, nmrglue, scipy', 'scripts/fid_process.py'],
      ['Kimya çekirdeği', 'TS + opsiyonel chem-core FastAPI', 'lib/chem/, services/chem-core/, packages/chem-kernel'],
      ['NMR simülasyon (derin)', 'Modüler TS motorları', 'lib/nmr/* (shift, coupling, lineshape, renderer)'],
      ['FTIR teorik', 'Graf + normal mod yaklaşımı', 'lib/spectromind/ir_engine/ftirEngine.ts'],
      ['Kural motoru', 'Spectrotester paketi', 'evaluateRules.ts, ruleset.json, scoring.ts'],
      ['Görselleştirme', 'Chart.js', 'components/charts/NMRChart.tsx, lib/nmr/nmrChartScaling.ts'],
    ]),
    h2('4.2 Veri akışı: FID → İşleme → Spektrum → QC → Arayüz'),
    p('Adım adım (yetkili klasör yolu):'),
    bullet('1) İstemci FormData → POST /api/fid/upload → temp/<datasetId>/ altına ham dosyalar.'),
    bullet('2) POST /api/fid/process + datasetId → route.ts Python spawn → --baseDir temp/...'),
    bullet('3) fid_process.py: yükle → 1D guard → Bruker dijital filtre → DC çıkarma → exp apodization (lb_hz varsayılan 0.3 Hz) → zero-fill (zf varsayılan 2×, sonraki 2^k) → proc.fft_positive → auto_phase veya manuel ph0/ph1 → baseline_asls (hata durumunda min_envelope) → ppm (uc_from_udic veya fallback) → solvent_auto_ref → robust p99 ölçek → azalan ppm sıralı çıktı.'),
    bullet('4) normalizeFidPythonPayload + finalizeFidSuccess → observed_spectrum + processing provenance.'),
    bullet('5) useFIDUpload / Zustand → NMRChart observedOverlay; QC overall_status kullanıcıya yansır.'),
    h2('4.3 Çakışan / çift yollar'),
    p(
      'fid_process.py (klasör, üretim odaklı) ile fid_processor.py (legacy tek dosya) aynı API’den tetiklenebilir; bilimsel parametreler özdeş tutulmaya çalışılmalıdır — garanti kodda yoktur.'
    ),
    p(
      'Teorik spektrum: spectrumGenerator.generateNMRSpectrumData (UI Lorentzian ızgarası) ile lib/nmr/* deterministik motorları ve /api/hose-predict ve /api/simulate paralel ekosistemler; hepsi aynı tek fizik modeli değildir — HEURISTIC / ENGINE farkı.'
    )
  );

  // --- 5 Spektroskopik motor ---
  children.push(h1('5. Spektroskopik işleme motoru (FID + sinyal modeli + pik + kurallar + simülasyon)'));

  children.push(
    h2('5.1 FID işleme — adım adım (fid_process.py)'),
    h3('5.1.1 Dijital filtre / grup gecikmesi (Bruker)'),
    p(
      'Uygulama: nmrglue.bruker.remove_digital_filter(dic, fid). Başarısızlıkta provenance dijital_filter: skipped. Matematik: vendor DSP faz kayması FFT sonrası spektrumu bozabilir; nmrglue düzeltmesi veri setine bağlıdır. Sınırlama: tüm pulse program revizyonları doğrulanmamıştır.'
    ),
    h3('5.1.2 DC düzeltme'),
    p('fid = fid - mean(fid). Karmaşık zaman domain ortalamasını sıfırlar.'),
    h3('5.1.3 Apodizasyon'),
    p(
      'Üstel çarpan: w(t)=exp(-π·lb_hz·t), lb varsayılan 0.3 Hz. Daraltılmış sinc kanatları; çözünürlük–SNR takası. lb_hz≤0 ise atlanır.'
    ),
    h3('5.1.4 Zero filling'),
    p(
      'zf_factor ile uzunluk çarpılır; bir sonraki 2^k uzunluğa yuvarlanır. Frekans çözünürlüğünü artırır; entegral genişliği değişmez, görünür çözünürlük artar.'
    ),
    h3('5.1.5 FFT (pozitif)'),
    p('proc.fft_positive(fid) — vendor uyumlu tek boyutlu pozitif frekans düzeni.'),
    h3('5.1.6 Faz düzeltmesi'),
    p(
      'Linear model: S\' = S · exp(i·(φ0 + φ1·x)), x∈[-0.5,0.5] piksel normalize. Manuel: API --ph0/--ph1. Otomatik: iki amaç fonksiyonu (spektral entropi + negatif gerçek kısım L2 cezası), çok başlangıç, L-BFGS-B sınırları ph0∈[-360,360], ph1∈[-1080,1080]. Kalite: phase_neg_energy_ratio = ||min(Re,0)||²/||max(Re,0)||². QC: overall_qc_status içinde phase_q>0.55 → PHASE_FAILED; json qc.phase_failed_heuristic ise phase_q>0.65 — eşikler tutarsız (TEKNİK BORÇ).'
    ),
    h3('5.1.7 Taban çizgisi'),
    p(
      'Birincil: AsLS (baseline_asls, λ=1e7, p=0.001, 10 iterasyon, seyrek matris). Yedek: minimum_filter1d + uniform_filter1d zarfı (baseline_min_envelope). AsLS başarısızlığında uyarı ile düşülür.'
    ),
    h3('5.1.8 Referans (ppm)'),
    p(
      'Önce ng.fileiobase.uc_from_udic ile ppm ölçeği. solvent_auto_ref: çözücü ipucu (acqus SOLVENT / procpar solvent) çözülür; beklenen çözücü pik ppm’inde (SOLVENT_REF_PPM tablosu) ±0.7 ppm pencerede maksimum aranır; kaydırma |shift|≤0.8 ise uygulanır. İpucu yoksa AUTO_REF_CANDIDATES üzerinden en küçük |shift| seçilir. Yanlış pik seçimi bilimsel risk (heuristik).'
    ),
    h3('5.1.9 Ölçekleme ve çıktı'),
    p(
      'y_display = y_corr / robust_scale(y_corr, 99) — p99 mutlak değer. Pik seçimi: rel_floor=0.006×max, yerel maksimum, min_dist_points=4 komşuluk baskısı, max 256 tepe. integral_regions / multiplet_regions şu an boş dizi (PLACEHOLDER).'
    )
  );

  children.push(
    h2('5.2 NMR sinyal modeli (teorik)'),
    p(
      'generateNMRSpectrumData: normalize Lorentzian L(Δ)=1/(1+(Δ/γ)²). Grid: H1_SIMULATION_PPM_DOMAIN (lib/utils/fidPeakToSimulation), adım ~0.005 ppm. Genişlik: lorentzianGammaPpm veya broad için 0.08 yoksa 0.018 ppm. Genlik: fidPickIntensity veya integ×100. Bu model çoklu yapı çözümü değil; çizgis şekil toplamıdır (IMPLEMENTED, görsel-öncelikli).'
    ),
    h2('5.3 Pik seçimi (gözlenen, Python)'),
    p(
      'Yerel maksimum + göreli eşik + “daha yüksek tepe yarıçapı” filtresi; prominence scipy değil özel mesafe mantığı. Zayıf pikleri kaçırma ve gürültü tepe üretme riski vardır (HEURISTIC).'
    ),
    h2('5.4 Kimyasal kural motoru — Spectrotester (tam liste)'),
    p(
      `ruleset.json sürümü: ${ruleset.version ?? '—'}, kural sayısı: ${ruleCount}. Her kural için evaluateRules.ts içinde register() beklenir; eksikleri generateCoverageReport(rules) ile tespit edin. Aşağıdaki tablolar ruleset’ten otomatik üretilir.`
    ),
    p(
      'Deterministik: graf özellikleri (graphFeatures) ve sayımsal eşiklerle PASS/WARN/FAIL. Heuristik: NMR/MS bölge aralıkları, izotop oran yaklaştırmaları (ör. M+1 ≈ 0.011×nC). Eksik veri: SKIP veya NOT_EVALUATED (evaluator yoksa — bu depoda 56/56 eşleşme hedefi).'
    ),
    ...buildRuleTables(rules),
    h3('5.4.1 Kural önkoşulları ve çatışmalar'),
    p(
      'evaluateRules.ts RULE_PREREQUISITES: örn. FORMULA kuralları GLOBAL_PARSE sonrası; çapraz kurallar GLOBAL_GRAPH_FIRST_REQUIRED. RULE_CONFLICTS: C13_CLASS_EXPECTED_VS_OBSERVED ile C13_SYMMETRY_EXPECTATION_UNIQUE_SIGNAL_COUNT — ikisi başarısızsa raporda güçlü hatayı öne çıkar.'
    )
  );

  children.push(
    h2('5.5 Spektral simülasyon motorları (SMILES → spektrum)'),
    bullet('HOSE hattı: /api/hose-predict → tahmini proton kaymaları; /api/simulate spectromind motorunda bunu Peak1D listesine map eder (chem-core isteğe bağlı).'),
    bullet('lib/nmr/deterministicPredictor, shift-engine, coupling-engine, spin-system, lineshape-engine, spectrum-renderer: derin modüler ¹H üretimi (INTEGRATED — tam UI zinciri her sayfada kullanılmayabilir).'),
    bullet('FTIR: predictFTIR → parseSMILES, hybridization, symmetry, calculateNormalModes; aromatik 1450–1600 cm⁻¹ için v33SpectrumRules tamamlayıcı bantlar (HEURISTIC tamamlayıcı).'),
    bullet('MS: MS servisleri ve v2/ms-predict — kurallar izotop ve neutral loss için gözlenen pik listesi bekler; MS_NEUTRAL_LOSS_RULES INFO: “fragmentation tree” gereksinimi (PLACEHOLDER açıklaması).')
  );

  // --- 6 Gözlenen vs simüle ---
  children.push(h1('6. Gözlenen ve simüle spektrum sistemi'));
  children.push(
    p(
      'Gözlenen: ObservedSpectrumEnvelope (kind observed_nmr_1d), x=ppm, y=robust ölçeklenmiş yoğunluk, provenance FID. Simüle: kullanıcı NMRPeak listesi → generateNMRSpectrumData; ayrı Chart.js dataset.'
    ),
    p(
      'Overlay: normalizeSimulatedToUnitMax (görünür pencere) — gözlenen ile yan yana “şekil” karşılaştırması; kuantitatif uyum iddiası yoktur (HEURISTIC GÖRSEL). Uyumsuzluk nedenleri: referans ofseti, farklı linewidth, eksik multiplet yapısı, faz hatası gözlenende.'
    )
  );

  // --- 7 Görselleştirme ---
  children.push(h1('7. Görselleştirme motoru'));
  children.push(
    p(
      'NMRChart: linear x, reverse:true, tipik 14→0 ppm. Y: ROBUST_P99, ROBUST_P995, çözücü maskeli modlar (nmrChartScaling.ts). Presetler: H1_FULL, aromatik, alifatik, fitSignalXDomain. Plugin: yerel baseline zero line eklentisi (annotation plugin yerine — React yaşam döngüsü uyumu).'
    )
  );

  // --- 8 API ---
  children.push(h1('8. API katmanı'));
  children.push(
    p(`Toplam route.ts: ${routes.length}. Önemli sözleşmeler:`),
    h2('8.1 POST /api/fid/process'),
    p(
      'FormData: datasetId veya dosya; processingSpec ile manuel faz. Vercel: 503 VERCEL_BLOCKED. Yanıt: finalizeFidSuccess → observed_spectrum, legacy data, qc, processing JSON.'
    ),
    h2('8.2 POST /api/fid/upload'),
    p('FormData files+paths → temp; ham fid/ser tespiti.'),
    h2('8.3 POST /api/simulate'),
    p('JSON: smiles, engine, solvent, frequency_MHz → UnifiedSpectrum (şema packages/schemas).'),
    p('Tam route listesi (otomatik tarama):'),
    ...routes.map((r) => bullet(r)),
    p('Hata kodları: lib/fid/fidErrorCodes.ts, docs/FID_ERROR_CODES.md.')
  );

  // --- 9 Şemalar ---
  children.push(h1('9. Veri şemaları'));
  children.push(
    table([
      ['Yapı', 'Konum'],
      ['ObservedSpectrumEnvelope, FidLegacyChartData', 'lib/fid/buildFidProcessResponse.ts'],
      ['NMRPeak, FTIRPeak', 'lib/types/index.ts'],
      ['UnifiedSpectrum, Peak1D', 'packages/schemas'],
      ['EvalContext, RuleEvalResult', 'Spectrotester/.../evaluateRules.ts'],
      ['GraphFeatures', 'Spectrotester/.../graph/features.ts'],
    ])
  );

  // --- 10 Kural & skor ---
  children.push(h1('10. Kural motoru ve doğrulama'));
  children.push(
    p(
      'evaluateRules: engineId filtreleri applies_to_engines; önkoşul sırası; eksik evaluator → NOT_EVALUATED. aggregateScoring: FATAL/ERROR veto, ceza ağırlıkları ruleset scoring_policy ile hizalı (scoring.ts).'
    ),
    p(`Kural sayısı (ruleset): ${ruleCount}.`)
  );

  // --- 11 Vendor ---
  children.push(h1('11. Satıcı destek matrisi'));
  children.push(
    table([
      ['Satıcı', 'fid_process.py', 'Not'],
      ['Bruker', 'IMPLEMENTED', 'remove_digital_filter denemesi'],
      ['Varian', 'IMPLEMENTED', 'procpar tabanlı'],
      ['JEOL', 'UNSUPPORTED (kodda reddedilir)', 'JDF parse bu dosyada yok'],
    ])
  );

  // --- 12 Kod haritası ---
  children.push(h1('12. Kod tabanı derin harita'));
  children.push(
    table([
      ['Dosya / klasör', 'Görev'],
      ['scripts/fid_process.py', '1D FID ana işleme'],
      ['app/api/fid/process/route.ts', 'Python köprü + payload normalizasyonu'],
      ['lib/fid/buildFidProcessResponse.ts', 'observed_spectrum üretimi'],
      ['components/charts/NMRChart.tsx', 'Ana grafik'],
      ['lib/utils/spectrumGenerator.ts', 'Lorentzian ¹H + FTIR transmittance'],
      ['lib/spectromind/ir_engine/', 'FTIR teorik'],
      ['Spectrotester/src/core/verify/', 'Kural değerlendirme + skor'],
      ['lib/hooks/useSpectralAnalysis.ts', 'İstemci analiz akışı'],
      ['lib/elucidation/', 'Tersine çözümleme boru hattı'],
    ])
  );

  // --- 13 Bilimsel sınırlar ---
  children.push(h1('13. Bilimsel sınırlamalar (dürüst)'));
  children.push(
    bullet('Faz: tekinci derece faz hataları veya dispersiyon tam modellenmez.'),
    bullet('Baseline: AsLS parametreleri sabit; yoğun dispersiyon veya “rolling” baseline zorlanır.'),
    bullet('2D: Ham 2D reddedilir; kurallar 2D gözlem isterse veri yoksa SKIP.'),
    bullet('HOSE / AI tahminleri model ve veri tabanı bağlıdır — fizik yasası değildir.'),
    bullet('FTIR normal modları: gerçek quantum chemistry değil; yaklaşık atama.')
  );

  // --- 14 Borç ---
  children.push(h1('14. Teknik borç'));
  children.push(
    bullet('İki FID Python script; iki faz QC eşiği (0.55 vs 0.65).'),
    bullet('data vs observed_spectrum çift contract.'),
    bullet('Çok sayıda API + Sidebar — regresyon riski.'),
    bullet('MS fragmentation tree kurallarda belirtilmiş, tam implementasyon yok (INFO).')
  );

  // --- 15 Yol haritası ---
  children.push(h1('15. Geliştirme yol haritası (etiketli)'));
  children.push(
    p('Kısa vade (PLANNED): Tek FID Python girişi konsolidasyonu; QC eşiklerinin tekilleştirilmesi.'),
    p('Orta vade (PLANNED): JEOL okuyucu; integral/multiplet workstation.'),
    p('Uzun vade (PLANNED): 2D işleme + kontur UI; bulut iş kuyruğu FID.')
  );

  // --- 16 Debug ---
  children.push(h1('16. Hata ayıklama rehberi'));
  children.push(
    bullet('Boş grafik: ppm/intensity uzunluk eşleşmesi; overlay kapalı mı; FID ok başarısız mı.'),
    bullet('Yanlış ppm: ppm_source fallback_linear; AXIS_UNCERTAIN qc.'),
    bullet('Pik yok: pick_peaks eşiği yüksek; düşük SNR.'),
    bullet('Yükleme: temp yolu, datasetId race, Vercel 503.')
  );

  // --- 17 Uzantı ---
  children.push(h1('17. Uzantı rehberi'));
  children.push(
    bullet('Yeni kural: ruleset.json + evaluateRules register + smoke test.'),
    bullet('Yeni spektrum tipi: şema (packages/schemas) + graf bileşeni + API.'),
    bullet('FID: fid_process.py adımı + processing JSON + buildFidProcessResponse.'),
    bullet('Vendor: ng okuyucu + detect_vendor + hata kodları.')
  );

  // --- Ek A–C: Modalite özel kural haritası (evaluateRules.ts) ---
  children.push(h1('Ek A — FT-IR doğrulama bölgeleri (kod sabitleri)'));
  children.push(
    p(
      'Aşağıdaki aralıklar Spectrotester FT-IR değerlendiricilerinde bandsInRange() ile kullanılır; gerçek spektrumda çözünürlük ve Fermi rezonansı bu aralıkları genişletebilir (HEURISTIC uyarı).'
    ),
    table([
      ['Fonksiyonel grup / kontrol', 'cm⁻¹ aralığı', 'İlgili rule_id (örnek)'],
      ['Karbonil C=O', '1630–1800', 'IR_FUNCTIONAL_GROUP_BAND_REQUIRED, IR_CARBONYL_TYPE_DISCRIMINATION, CROSS_CARBONYL_CONSENSUS'],
      ['Nitril C≡N', '2210–2260', 'IR_NITRILE_REQUIRED_IF_CYANO_PRESENT'],
      ['OH / NH geniş', '3200–3600 veya 3200–3550', 'IR_FUNCTIONAL_GROUP_BAND_REQUIRED, IR_OH_BROAD_REQUIRED_IF_OH_PRESENT, CROSS_OH_CONSENSUS'],
      ['Alifatik C–H', '2850–2960', 'IR_ALIPHATIC_CH_ONLY_IF_SP3_CH_PRESENT'],
      ['Aromatik C–H', '3000–3100', 'IR_AROMATIC_CH_STRETCH_REQUIRED_IF_AROMATIC'],
      ['Aromatik halka C=C iskelet', '1450–1600', 'IR_AROMATIC_RING_CC_REQUIRED_IF_AROMATIC, CROSS_AROMATICITY_CONSENSUS_RULE'],
      ['Ester / amit / asit ayrımı (INFO)', '1735–1750 / 1630–1690 / 1700–1725', 'IR_CARBONYL_TYPE_DISCRIMINATION'],
    ])
  );

  children.push(h1('Ek B — MS kural motoru: izotop ve kayıp (kod özeti)'));
  children.push(
    p(
      'm/z toleransı tipik ±0.5 (msInRange). MS_ISOTOPE_CLUSTER_MATCH_REQUIRED: M+1 yoğunluk oranı yaklaşık beklenen ≈ 0.011 × nC. MS_ISOTOPE_ENVELOPE_M_PLUS1_M_PLUS2_FIT: M+1’e S katkısı nS×0.008; M+2’de C, S, Cl, Br katkıları kodda ayrı terimlerle toplanır (basit doğal bolluk modeli — HEURISTIC). MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED: Cl/Br için M+2 / taban oranı sabit tablo beklentisi. MS_NEUTRAL_LOSS_H2O_REQUIRES_OH_OR_COOH: Δm ≈ 18.0106.'
    ),
    p(
      'MS_NEUTRAL_LOSS_RULES ve MS_ADDUCT_SET_COVERAGE şu an INFO düzeyi; tam parçalanma ağacı (fragmentation tree) implementasyonu belirtilmemiştir (PLACEHOLDER / PLANNED).'
    )
  );

  children.push(h1('Ek C — ¹H / ¹³C / 2D kuralların bilimsel rolleri'));
  children.push(
    table([
      ['Modalite', 'Örnek rule_id', 'Bilimsel mantık', 'Deterministik / HEURISTIC'],
      ['¹H', 'H1_ETHYL_MOTIF', 'Triplet–quartet, J 6–8 Hz, COSY çapraz', 'HEURISTIC (ppm aralığı + mult)'],
      ['¹H', 'H1_REQUIRE_AROMATIC_REGION_IF_AROMATIC_CH', 'Aromatik CH için 6.3–8.8 ppm sinyal', 'HEURISTIC bölge'],
      ['¹³C', 'C13_REQUIRE_CARBONYL_REGION_IF_CARBONYL_PRESENT', '160–220 ppm karbonil karbon', 'HEURISTIC'],
      ['HSQC', 'HSQC_CH_COUNT_MATCH_MIN_RATIO', 'CH/CH2/CH3 sayımı vs graf', 'Deterministik sayım + eşik'],
      ['COSY', 'COSY_EXPECTED_VICINAL_PAIRS_MIN_RATIO', 'Beklenen vicinal çiftlerin ≥ oranı', 'HEURISTIC (2D eksikse SKIP)'],
      ['HMBC', 'HMBC_CARBONYL_REQUIRED_IF_PATH_EXISTS', 'Karbonil + α-H varsa uzun menzil korelasyon', 'HARD/ERROR politikası'],
      ['NOESY', 'NOESY_DISTANCE_PRIOR_CHECK', '3D konformer olmadan INFO only', 'PLACEHOLDER bilim'],
    ])
  );

  // --- 18 Audit ---
  children.push(h1('18. Son uygulama denetimi (özet tablo)'));
  children.push(
    table([
      ['Modül', 'Durum', 'Not'],
      ['fid_process 1D', 'IMPLEMENTED', 'Bruker/Varian; JEOL hayır'],
      ['fid_processor legacy', 'LEGACY', ''],
      ['Teorik ¹H Lorentzian UI', 'IMPLEMENTED', 'spectrumGenerator'],
      ['Derin NMR motorları', 'PARTIAL', 'Tüm UI tek yol kullanmaz'],
      ['FTIR teorik', 'IMPLEMENTED', 'Yaklaşık'],
      ['MS kuralları', 'HEURISTIC', 'İzotop oranları basit'],
      ['Spectrotester kuralları', 'IMPLEMENTED', `${ruleCount} kural`],
      ['2D ürün', 'UNSUPPORTED', ''],
      ['Vercel FID', 'UNSUPPORTED', '503'],
    ])
  );

  children.push(
    p(
      '— Belge sonu. Tam metin referansları: docs/SYSTEM_OVERVIEW.md, ARCHITECTURE_OVERVIEW.md, FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md, SCHEMA_REFERENCE.md, API_REFERENCE.md, RULE_ENGINE_AND_QC.md, FINAL_IMPLEMENTATION_AUDIT.md.',
      { italics: true, after: 240 }
    )
  );

  const doc = new Document({
    creator: 'SpectroMind',
    title: 'SpectroMind Tam Sistem Dokümantasyonu',
    description: 'Kod tabanı doğrulamalı teknik spesifikasyon',
    features: {
      updateFields: true,
    },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              p(`SpectroMind v${DOC_VERSION} · ${DOC_DATE} · Otomatik DOCX`, { size: 18 }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  try {
    fs.writeFileSync(OUT, buf);
    console.log('Yazıldı:', OUT);
  } catch (e) {
    if (e && e.code === 'EBUSY') {
      const alt = path.join(ROOT, 'docs', 'SPECTROMIND_SISTEM_DOKUMANTASYONU_DRAFT.docx');
      fs.writeFileSync(alt, buf);
      console.warn('Hedef dosya kilitli; taslak yazıldı:', alt);
    } else throw e;
  }
  console.log('Kurallar:', ruleCount, '| API route:', routes.length);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

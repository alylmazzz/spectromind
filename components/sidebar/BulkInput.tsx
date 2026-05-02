'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { NMRPeak, Carbon13Peak, FTIRPeak } from '@/lib/types';

interface BulkInputProps {
  onPeaksImport: (peaks: NMRPeak[]) => void;
  onCarbon13PeaksImport?: (peaks: Carbon13Peak[]) => void;
  onFtirPeaksImport?: (peaks: FTIRPeak[]) => void;
  onAnalyze: () => void;
  spectrumType?: 'nmr' | 'ftir' | 'c13';
  onKnownMoleculeChange?: (molecule: any) => void;
}

interface PubChemMolecule {
  cid: number;
  name: string;
  formula: string;
  peaks?: Array<{ ppm: number; intensity: number }>;
  source?: string; // 'PubChem' veya 'Enhanced Library (AI Cache)' veya 'AI Prediction'
  usageCount?: number; // Enhanced Library için kullanım sayısı
  nmrData?: any; // AI prediction için NMR spektrum verisi
  aiMetadata?: { // AI prediction metadata
    confidence: number;
    method: string;
    literature?: any[];
  };
}

export default function BulkInput({ onPeaksImport, onCarbon13PeaksImport, onFtirPeaksImport, onAnalyze, spectrumType = 'nmr', onKnownMoleculeChange }: BulkInputProps) {
  const [bulkText, setBulkText] = useState('');
  const [showPubChemSearch, setShowPubChemSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState('');
  const [pubchemResults, setPubchemResults] = useState<PubChemMolecule[]>([]);
  const [aiPredictionData, setAiPredictionData] = useState<any>(null);
  const [isAiPredicting, setIsAiPredicting] = useState(false);
  const [synonymSuggestions, setSynonymSuggestions] = useState<any[]>([]); // {name, type, reason}
  const [parsedPeaksPreview, setParsedPeaksPreview] = useState<(NMRPeak | Carbon13Peak | FTIRPeak)[]>([]); // Preview of parsed peaks
  const [loadingMoleculeId, setLoadingMoleculeId] = useState<number | null>(null); // Loading state for molecule selection
  const [showLiterature, setShowLiterature] = useState(false); // Toggle literature links visibility

  // Klavye kısayolları: Cmd+E (Mac) veya Ctrl+E (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+E (Mac) veya Ctrl+E (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowPubChemSearch(true);
      }
      // ESC tuşu ile kapat
      if (e.key === 'Escape' && showPubChemSearch) {
        setShowPubChemSearch(false);
        setSearchQuery('');
        setPubchemResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPubChemSearch]);

  // Auto-parse peaks for preview whenever bulkText changes
  useEffect(() => {
    if (!bulkText.trim()) {
      setParsedPeaksPreview([]);
      return;
    }

    const lines = bulkText.trim().split('\n');
    const previewPeaks: (NMRPeak | Carbon13Peak | FTIRPeak)[] = [];

    if (spectrumType === 'c13') {
      // 13C NMR için parse - sadece ppm değerleri
      for (const line of lines) {
        const pattern = /(?:δ\s*)?(\d+\.?\d*)\s*(?:ppm)?/i;
        const match = line.match(pattern);

        if (match) {
          const ppm = parseFloat(match[1]);
          if (!isNaN(ppm)) {
            previewPeaks.push({
              ppm,
              intensity: 100
            } as Carbon13Peak);
          }
        }
      }
    } else if (spectrumType === 'ftir') {
      // FTIR için parse - "1754 cm-1" veya "1754: strong" gibi
      for (const line of lines) {
        const pattern = /(\d+\.?\d*)\s*(?:cm[-⁻]?¹?|:)?\s*(strong|medium|weak|s|m|w)?/i;
        const match = line.match(pattern);

        if (match) {
          const wavenumber = parseFloat(match[1]);
          const intensity = match[2]?.toLowerCase() || 'medium';

          if (!isNaN(wavenumber) && wavenumber > 400 && wavenumber < 4000) {
            const intensityType = intensity === 's' ? 'strong' : intensity === 'w' ? 'weak' : 'medium';
            const intensityValue = intensityType === 'strong' ? 80 : intensityType === 'weak' ? 30 : 50;

            previewPeaks.push({
              wavenumber,
              intensity: intensityValue,
              type: intensityType as 'strong' | 'medium' | 'weak',
              assignment: ''
            } as FTIRPeak);
          }
        }
      }
    } else {
      // 1H NMR için parse
      for (const line of lines) {
        const pattern = /(?:δ\s*)?(\d+\.?\d*)\s*(?:ppm)?[:\s]+([sdtqmSDTO]+|dd|dt|td|ddd|sep|br\s*[sdt]?)\s*(?:\(|,)?\s*(\d+\.?\d*)?\s*H?\)?/i;
        const match = line.match(pattern);

        if (match) {
          const shift = parseFloat(match[1]);
          const mult = match[2].toLowerCase().trim();
          const integ = match[3] ? parseFloat(match[3]) : 1;

          if (!isNaN(shift) && !isNaN(integ)) {
            previewPeaks.push({
              shift,
              integ,
              mult: mult || 's'
            } as NMRPeak);
          }
        }
      }
    }

    setParsedPeaksPreview(previewPeaks);
  }, [bulkText, spectrumType]);

  const parseBulkInput = () => {
    const lines = bulkText.trim().split('\n');

    if (spectrumType === 'c13') {
      // 13C NMR için parse - sadece ppm değerleri
      const carbon13Peaks: Carbon13Peak[] = [];

      for (const line of lines) {
        // Match patterns like: "198.1 ppm" or "198.1" or "δ 198.1"
        const pattern = /(?:δ\s*)?(\d+\.?\d*)\s*(?:ppm)?/i;
        const match = line.match(pattern);

        if (match) {
          const ppm = parseFloat(match[1]);

          if (!isNaN(ppm)) {
            carbon13Peaks.push({
              ppm,
              intensity: 100
            });
          }
        }
      }

      if (carbon13Peaks.length > 0 && onCarbon13PeaksImport) {
        onCarbon13PeaksImport(carbon13Peaks);
        setBulkText('');
        setParsedPeaksPreview([]);
        console.log(`✅ ${carbon13Peaks.length} adet 13C NMR peak eklendi (bulk input)`);
      }
    } else {
      // 1H NMR için parse
      const peaks: NMRPeak[] = [];

      for (const line of lines) {
        // Match patterns like: "7.26 ppm: s (1H)" or "7.26: s, 1H" or "δ 7.26 (s, 1H)"
        const pattern = /(?:δ\s*)?(\d+\.?\d*)\s*(?:ppm)?[:\s]+([sdtqmSDTO]+|dd|dt|td|ddd|sep|br\s*[sdt]?)\s*(?:\(|,)?\s*(\d+\.?\d*)?\s*H?\)?/i;
        const match = line.match(pattern);

        if (match) {
          const shift = parseFloat(match[1]);
          const mult = match[2].toLowerCase().trim();
          const integ = match[3] ? parseFloat(match[3]) : 1;

          if (!isNaN(shift) && !isNaN(integ)) {
            peaks.push({
              shift,
              integ,
              mult: mult || 's'
            });
          }
        }
      }

      if (peaks.length > 0) {
        onPeaksImport(peaks);
        setBulkText('');
        setParsedPeaksPreview([]);
      }
    }
  };

  const loadExample = () => {
    if (spectrumType === 'c13') {
      // 13C NMR örnek - Acetophenone
      setBulkText(`198.1 ppm
137.0 ppm
133.0 ppm
128.5 ppm
128.2 ppm
26.5 ppm`);
    } else {
      // 1H NMR örnek
      setBulkText(`10.50 ppm: S (1H)
8.50 ppm: S (1H)
7.12 ppm: D (1H)
6.95 ppm: S (1H)
3.70 ppm: S (2H)
2.85 ppm: T (2H)`);
    }
  };

  // Backend API üzerinden PubChem'de molekül ara (veya 13C için kütüphane araması)
  const searchPubChem = async () => {
    if (!searchQuery.trim()) return;

    console.log('🔍 Arama başlatılıyor:', searchQuery, `Spektrum Tipi: ${spectrumType}`);
    setIsSearching(true);
    setSearchStage(spectrumType === 'c13' ? '13C NMR Kütüphanesinde aranıyor...' : 'Kütüphanede aranıyor...');
    setPubchemResults([]);

    try {
      // 13C NMR için doğrudan kütüphanede ara
      if (spectrumType === 'c13') {
        setSearchStage('13C NMR Kütüphanesinde aranıyor...');

        // Import carbon13 library
        const { searchCarbon13MoleculeByName, getAllCarbon13Molecules } = await import('@/lib/data/carbon13Library');

        // Search by name
        const results = searchCarbon13MoleculeByName(searchQuery);

        console.log(`✅ 13C NMR Kütüphanesinde ${results.length} molekül bulundu`);

        if (results.length > 0) {
          // Convert to PubChemMolecule format
          const molecules: PubChemMolecule[] = results.map(mol => ({
            cid: mol.cid || 0,
            name: mol.name,
            formula: mol.formula,
            peaks: mol.peaks.map(p => ({ ppm: p.ppm, intensity: p.intensity || 100 })),
            source: '13C NMR Library'
          }));

          setPubchemResults(molecules);
          setSearchStage(`${results.length} molekül bulundu!`);
        } else {
          setSearchStage('13C NMR kütüphanesinde molekül bulunamadı');
        }

        setIsSearching(false);
        return;
      }

      // 1H NMR için PubChem araması
      // Backend otomatik olarak type'ı algılayacak, type parametresi vermeyelim
      const url = `/api/pubchem?query=${encodeURIComponent(searchQuery)}`;
      console.log(`🌐 API URL: ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30 saniye timeout
      });
      console.log(`📡 Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Arama başarısız oldu: HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API Response:', data);

      // Arama aşamalarını sırayla göster (animasyon için)
      if (data.searchStages && Array.isArray(data.searchStages)) {
        console.log('🔍 Arama Aşamaları:');
        for (let i = 0; i < data.searchStages.length; i++) {
          const stage = data.searchStages[i];
          console.log(`  ${i + 1}. ${stage}`);
          setSearchStage(stage);
          // Her aşamayı göstermek için kısa bir delay
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (data.success && data.molecules && data.molecules.length > 0) {
        console.log(`✅ ${data.molecules.length} molekül bulundu`);

        // Eğer birden fazla CID varsa bilgilendirme yap
        if (data.total > 1) {
          console.log(`ℹ️ "${searchQuery}" için ${data.total} farklı CID bulundu (stereoisomerler, tautomerler vs.)`);
        }

        // ✅ Recursive search sonucunda bulunan molekül varsa (smiles property'si varsa), aiPredictionData'yı oluştur
        const recursiveSearchMolecule = data.molecules.find((mol: any) => mol.smiles && mol.source?.includes('Recursive search'));
        if (recursiveSearchMolecule && data.aiPredictionData) {
          console.log('✅ Recursive search sonucunda bulunan molekül tespit edildi, aiPredictionData güncelleniyor...');
          setAiPredictionData({
            ...data.aiPredictionData,
            smiles: recursiveSearchMolecule.smiles, // ✅ SMILES eklendi
            cid: recursiveSearchMolecule.cid,
            formula: recursiveSearchMolecule.formula
          });
        } else if (data.aiPredictionData && data.aiPredictionData.smiles) {
          // ✅ aiPredictionData'da SMILES varsa, koru
          console.log('✅ aiPredictionData\'da SMILES mevcut, korunuyor...');
          setAiPredictionData(data.aiPredictionData);
        } else {
          setAiPredictionData(null); // AI data'yı temizle
        }

        setPubchemResults(data.molecules);
        setSynonymSuggestions([]); // Synonym'leri temizle
      } else if (data.aiPredictionData) {
        // Molekül bulunamadı ama AI prediction mevcut
        console.log('⚠️ Molekül bulunamadı ama AI tahmini yapılabilir');
        console.log('📤 knownMolecule set ediliyor:', data.aiPredictionData);
        setAiPredictionData(data.aiPredictionData);
        onKnownMoleculeChange?.(data.aiPredictionData); // Ana sayfaya molekül bilgisini gönder
        console.log('✅ onKnownMoleculeChange çağrıldı');
        setPubchemResults([]);
        setSynonymSuggestions(data.synonymSuggestions || []);
      } else {
        console.log('❌ Molekül bulunamadı');
        setPubchemResults([]);
        setAiPredictionData(null);
        setSynonymSuggestions(data.synonymSuggestions || []);
      }

    } catch (error) {
      console.error('❌ PubChem arama hatası:', error);
      alert('Arama başarısız oldu. Lütfen tekrar deneyin.');
      setPubchemResults([]);
    } finally {
      setIsSearching(false);
      setSearchStage('');
    }
  };

  // HOSE ile NMR tahmini yap (hızlı, offline)
  const runHOSEPrediction = async () => {
    if (!aiPredictionData?.smiles) {
      alert('HOSE prediction için SMILES gerekli!');
      return;
    }

    setIsAiPredicting(true);
    setSearchStage('HOSE algoritması ile NMR tahmini yapılıyor...');

    try {
      const hoseResponse = await fetch('/api/hose-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: aiPredictionData.smiles }),
        signal: AbortSignal.timeout(30000) // 30 saniye timeout
      });

      if (hoseResponse.ok) {
        const hoseData = await hoseResponse.json();

        if (hoseData.success && hoseData.predictions && hoseData.predictions.length > 0) {
          console.log(`✅ HOSE tahmini: ${hoseData.predictions.length} peak`);

          // HOSE peak'lerini NMRPeak formatına dönüştür
          const parsedPeaks: NMRPeak[] = hoseData.predictions.map((pred: any) => ({
            shift: pred.shift || 0,
            mult: 's', // HOSE multiplicity vermez
            integ: 1,
            source: {
              hosePrediction: true,
              atom: pred.atom
            }
          }));

          onPeaksImport(parsedPeaks);

          alert(`✅ HOSE Prediction Tamamlandı\n\n` +
            `"${aiPredictionData.moleculeName}" için ${parsedPeaks.length} peak tahmin edildi.\n\n` +
            `Metod: HOSE Code (Hierarchically Ordered Spherical Environment)\n\n` +
            `NOT: HOSE sadece chemical shift tahmin eder, multiplicity bilgisi yoktur.`
          );

          setShowPubChemSearch(false);
          setSearchQuery('');
          setPubchemResults([]);
          setAiPredictionData(null);
        } else {
          alert('HOSE tahmini yapılamadı.');
        }
      } else {
        alert('HOSE API hatası.');
      }
    } catch (error) {
      console.error('❌ HOSE prediction hatası:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        alert('⏱️ HOSE tahmini zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        alert('🌐 Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.');
      } else {
        alert(`❌ HOSE tahmini sırasında hata oluştu: ${errorMessage}`);
      }
    } finally {
      setIsAiPredicting(false);
      setSearchStage('');
    }
  };

  // AI ile NMR tahmini yap
  const runAIPrediction = async () => {
    if (!aiPredictionData) return;

    // ✅ ENHANCED LIBRARY KONTROLÜ: Eğer Enhanced Library'den gelen molekül varsa, direkt analiz başlat
    const storedMolecule = typeof window !== 'undefined' 
      ? localStorage.getItem('spectromind_known_molecule') 
      : null;
    
    if (storedMolecule) {
      try {
        const parsed = JSON.parse(storedMolecule);
        if (parsed.enhancedLibrary === true && parsed.enhancedLibraryData) {
          console.log('📚 Enhanced Library molekülü tespit edildi - "AI ile Analiz Et" butonu otomatik çalıştırılıyor...');
          
          // Modal'ı kapat
          setShowPubChemSearch(false);
          setSearchQuery('');
          setPubchemResults([]);
          setAiPredictionData(null);
          setIsAiPredicting(false);
          
          // Kısa bir gecikme ile "AI ile Analiz Et" butonunu tetikle
          setTimeout(() => {
            if (onAnalyze) {
              console.log('✅ "AI ile Analiz Et" butonu otomatik olarak tetiklendi (Enhanced Library)');
              onAnalyze();
            }
          }, 300);
          
          return; // Enhanced Library'den geldi, AI tahmini yapma
        }
      } catch (error) {
        console.warn('Enhanced Library kontrolü başarısız:', error);
        // Devam et, normal AI tahmini yap
      }
    }

    setIsAiPredicting(true);
    setSearchStage('AI ile NMR tahmini yapılıyor...');

    try {
      // Önce HOSE tahminini al (eğer SMILES varsa)
      let hosePredictions: any[] = [];
      if (aiPredictionData.smiles) {
        setSearchStage('RDKit/HOSE ile ön tahmin yapılıyor...');
        try {
          const hoseResponse = await fetch('/api/hose-predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ smiles: aiPredictionData.smiles }),
            signal: AbortSignal.timeout(30000) // 30 saniye timeout
          });

          if (hoseResponse.ok) {
            const hoseData = await hoseResponse.json();
            if (hoseData.success && hoseData.predictions) {
              hosePredictions = hoseData.predictions;
              console.log(`✅ HOSE ön tahmini: ${hosePredictions.length} peak`);
            }
          }
        } catch (error) {
          console.warn('HOSE tahmini yapılamadı, AI tahminine devam ediliyor:', error);
          // HOSE hatası kritik değil, devam et
        }
      }

      setSearchStage('AI + Literatür ile detaylı tahmin yapılıyor...');

      // AI tahminini yap (HOSE sonuçlarıyla birlikte)
      const aiResponse = await fetch('/api/ai-nmr-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...aiPredictionData,
          hosePredictions: hosePredictions.length > 0 ? hosePredictions : undefined
        }),
        signal: AbortSignal.timeout(120000) // 120 saniye timeout (AI tahmini uzun sürebilir)
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();

        if (aiData.success && aiData.prediction?.spectra) {
          console.log(`✅ AI tahmini oluşturuldu (güven: ${aiData.prediction.confidence})`);

          // AI'nin döndürdüğü peak'leri parse et
          const spectrum = aiData.prediction.spectra[0]; // İlk spektrum (1H NMR)
          if (spectrum && spectrum.peaks && spectrum.peaks.length > 0) {
            console.log(`📊 ${spectrum.peaks.length} AI tahmini peak bulundu`);

            // Peak'leri NMRPeak formatına dönüştür
            // ⚠️ AI TAHMİNİ: Molekül ismini EKLEME (tekrar analiz edildiğinde yanlış sonuç verir)
            const parsedPeaks: NMRPeak[] = spectrum.peaks.map((peak: any) => ({
              shift: peak.shift || 0,
              mult: peak.multiplicity || 's',
              integ: parseFloat(peak.integration) || 1,
              source: {
                // moleculeName: KASITLI OLARAK YOK (AI tahmini, kesin değil)
                aiPrediction: true,
                confidence: aiData.prediction.confidence
              }
            }));

            // Peak'leri input alanına ekle
            onPeaksImport(parsedPeaks);

            // ⚠️ AI TAHMİNİ: localStorage'e molekül ismini KAYDETME
            // Tekrar analiz edildiğinde yanlış molekül ismi kullanılmaması için
            // AI tahmini olduğunu belirten flag ile kaydet, ama "known molecule" olarak değil
            if (typeof window !== 'undefined') {
              // AI tahmini "bilinen molekül" değildir, localStorage'e KAYDETME
              console.log(`⚠️ AI tahmini localStorage'e kaydedilmedi (kesin değil): ${aiPredictionData.moleculeName} (${parsedPeaks.length} peak)`);
              console.log(`   Confidence: ${aiData.prediction.confidence}`);
            }

            // ⚠️ KULLANICIYA UYARI GÖSTER
            alert(`⚠️ AI Peak Tahmini Yüklendi\n\n` +
              `Bu peak'ler "${aiPredictionData.moleculeName}" molekülü için AI tarafından literatür taraması sonucu tahmin edilmiştir.\n\n` +
              `Güven Skoru: ${(aiData.prediction.confidence * 100).toFixed(0)}%\n\n` +
              `NOT: Bu veriler deneysel değil, tahmindir. Gerçek NMR spektrumları ile farklılık gösterebilir.`
            );

            // Modal'ı kapat
            setShowPubChemSearch(false);
            setSearchQuery('');
            setPubchemResults([]);
            setAiPredictionData(null);
            
            // ✅ AI tahmini yüklendikten sonra "AI ile Analiz Et" butonunu otomatik tetikle
            setTimeout(() => {
              if (onAnalyze) {
                console.log('✅ "AI ile Analiz Et" butonu otomatik olarak tetiklendi (AI tahmini yüklendi)');
                onAnalyze();
              }
            }, 500);
          } else {
            alert('AI tahmini peak verisi içermiyor.');
          }
        } else {
          alert('AI tahmini oluşturulamadı. Lütfen tekrar deneyin.');
        }
      } else {
        const errorText = await aiResponse.text().catch(() => '');
        alert(`AI tahmini sırasında hata oluştu: HTTP ${aiResponse.status}\n${errorText.substring(0, 200)}`);
      }
    } catch (aiError) {
      console.error('❌ AI prediction hatası:', aiError);
      const errorMessage = aiError instanceof Error ? aiError.message : 'Bilinmeyen hata';
      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        alert('⏱️ AI tahmini zaman aşımına uğradı (2 dakika). Lütfen tekrar deneyin.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        alert('🌐 Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.');
      } else {
        alert(`❌ AI tahmini sırasında hata oluştu: ${errorMessage}`);
      }
    } finally {
      setIsAiPredicting(false);
      setSearchStage('');
    }
  };

  // Backend API üzerinden PubChem'den NMR verilerini yükle (veya 13C için kütüphaneden)
  const loadFromPubChem = async (molecule: PubChemMolecule) => {
    // ✅ Tıklama engellemesini kontrol et
    if (loadingMoleculeId !== null) {
      console.warn(`⚠️ Başka bir molekül yükleniyor (CID: ${loadingMoleculeId}), ${molecule.name} yüklenemiyor`);
      return;
    }

    try {
      setLoadingMoleculeId(molecule.cid);
      console.log('📥 Molekül verisi yükleniyor:', molecule.name, `(CID: ${molecule.cid})`, `Spektrum: ${spectrumType}`);

      // ✅ ENHANCED LIBRARY KONTROLÜ: Enhanced Library'den gelen molekül için tüm spektrumları yükle
    if ((molecule as any).enhancedLibraryData) {
      const enhancedData = (molecule as any).enhancedLibraryData;
      console.log('✨ Enhanced Library verisi bulundu, tüm spektrumlar yükleniyor...');
      console.log(`   📊 1H NMR: ${enhancedData.nmrPeaks?.length || 0} peak`);
      console.log(`   📊 13C NMR: ${enhancedData.c13Analysis?.peaks?.length || 0} peak`);
      console.log(`   📊 FTIR: ${enhancedData.ftirAnalysis?.peaks?.length || 0} peak`);

      // ✅ TOPLU VERİ GİRİŞİ TEXTAREA'YA YAZ: Tüm spektral verileri textarea'ya formatla
      let bulkTextContent = '';
      
      // 1H NMR peaks formatla ve textarea'ya yaz
      if (enhancedData.nmrPeaks && enhancedData.nmrPeaks.length > 0) {
        const nmrLines = enhancedData.nmrPeaks.map((peak: any) => {
          // ✅ Safety check: shift might be undefined
          const shift = (peak.shift ?? 0).toFixed(2);
          const mult = peak.mult || 's';
          const integ = peak.integ || 1;
          let couplingStr = '';
          
          if (peak.coupling) {
            if (Array.isArray(peak.coupling)) {
              couplingStr = `, J=${peak.coupling.map((j: number) => j.toFixed(1)).join(', ')} Hz`;
            } else {
              couplingStr = `, J=${peak.coupling.toFixed(1)} Hz`;
            }
          }
          
          return `${shift}: ${mult} (${integ}H${couplingStr})`;
        });
        bulkTextContent += `# 1H NMR Peaks (${enhancedData.nmrPeaks.length} peak)\n${nmrLines.join('\n')}\n\n`;
        console.log(`✅ ${enhancedData.nmrPeaks.length} adet 1H NMR peak textarea'ya yazıldı`);
      }

      // 13C NMR peaks formatla ve textarea'ya yaz
      const c13Analysis = enhancedData.c13Analysis;
      if (c13Analysis && c13Analysis.peaks && c13Analysis.peaks.length > 0) {
        const c13Lines = c13Analysis.peaks.map((peak: any) => {
          // ✅ Safety check: ppm might be undefined
          const ppmValue = peak.ppm ?? peak.shift ?? 0;
          if (ppmValue === 0 || isNaN(ppmValue)) {
            return ''; // Skip invalid peaks
          }
          const ppm = ppmValue.toFixed(2);
          const carbonType = peak.carbonType ? ` (${peak.carbonType})` : '';
          return `${ppm}${carbonType}`;
        }).filter((line: string) => line !== ''); // Remove empty lines
        bulkTextContent += `# 13C NMR Peaks (${c13Analysis.peaks.length} peak)\n${c13Lines.join('\n')}\n\n`;
        console.log(`✅ ${c13Analysis.peaks.length} adet 13C NMR peak textarea'ya yazıldı`);
      }

      // FTIR peaks formatla ve textarea'ya yaz
      const ftirAnalysis = enhancedData.ftirAnalysis;
      if (ftirAnalysis && ftirAnalysis.peaks && ftirAnalysis.peaks.length > 0) {
        const ftirLines = ftirAnalysis.peaks.map((peak: any) => {
          const wavenumber = peak.wavenumber;
          const wavenumberEnd = peak.wavenumberEnd;
          const assignment = peak.assignment || '';
          
          if (wavenumberEnd && wavenumberEnd !== wavenumber) {
            return `${wavenumber} - ${wavenumberEnd}: ${assignment}`;
          }
          return `${wavenumber}: ${assignment}`;
        });
        bulkTextContent += `# FTIR Peaks (${ftirAnalysis.peaks.length} peak)\n${ftirLines.join('\n')}\n`;
        console.log(`✅ ${ftirAnalysis.peaks.length} adet FTIR peak textarea'ya yazıldı`);
      }

      // Textarea'ya yaz
      if (bulkTextContent.trim()) {
        setBulkText(bulkTextContent.trim());
        console.log(`📝 Toplu veri girişi textarea'sına ${bulkTextContent.split('\n').length} satır yazıldı`);
        
        // ✅ OTOMATİK PARSE: Textarea'ya yazılan peak'leri otomatik olarak parse et ve ekle
        // Böylece "AI ile Analiz Et" butonu aktif olur
        setTimeout(() => {
          // 1H NMR peaks parse et ve ekle
          if (enhancedData.nmrPeaks && enhancedData.nmrPeaks.length > 0 && onPeaksImport) {
            const nmrPeaks: NMRPeak[] = enhancedData.nmrPeaks.map((peak: any) => ({
              shift: peak.shift,
              mult: peak.mult || 's',
              integ: peak.integ || 1,
              coupling: peak.coupling,
              source: {
                moleculeName: molecule.name,
                cid: molecule.cid,
                source: 'Enhanced Library'
              }
            }));
            onPeaksImport(nmrPeaks);
            console.log(`✅ ${nmrPeaks.length} adet 1H NMR peak otomatik olarak eklendi`);
          }

          // 13C NMR peaks parse et ve ekle
          if (c13Analysis && c13Analysis.peaks && c13Analysis.peaks.length > 0 && onCarbon13PeaksImport) {
            const c13Peaks: Carbon13Peak[] = c13Analysis.peaks
              .map((peak: any) => {
                // ✅ Safety check: ppm must be valid
                const ppm = peak.ppm ?? peak.shift ?? 0;
                if (ppm === 0 || isNaN(ppm)) {
                  return null; // Skip invalid peaks
                }
                return {
                  ppm,
                  intensity: peak.intensity || 100,
                  carbonType: peak.carbonType,
                  assignment: peak.assignment
                } as Carbon13Peak;
              })
              .filter((peak: Carbon13Peak | null): peak is Carbon13Peak => peak !== null);
            onCarbon13PeaksImport(c13Peaks);
            console.log(`✅ ${c13Peaks.length} adet 13C NMR peak otomatik olarak eklendi`);
          }

          // FTIR peaks parse et ve ekle
          if (ftirAnalysis && ftirAnalysis.peaks && ftirAnalysis.peaks.length > 0 && onFtirPeaksImport) {
            const ftirPeaks = ftirAnalysis.peaks.map((peak: any) => ({
              wavenumber: peak.wavenumber,
              intensity: peak.intensity || (peak.type === 'strong' ? 85 : peak.type === 'weak' ? 40 : 60),
              type: peak.type || 'medium',
              width: peak.width || 50,
              assignment: peak.assignment,
              label: peak.label
            }));
            onFtirPeaksImport(ftirPeaks);
            console.log(`✅ ${ftirPeaks.length} adet FTIR peak otomatik olarak eklendi`);
          }
          
          console.log(`✅ Tüm spektral veriler otomatik olarak eklendi. "AI ile Analiz Et" butonuna tıklayabilirsiniz.`);
        }, 100); // 100ms gecikme (textarea güncellemesi için)
      }

      // Molekül bilgisini localStorage'e kaydet (Enhanced Library flag'i ile)
      if (typeof window !== 'undefined' && enhancedData.aiResult) {
        localStorage.setItem('spectromind_known_molecule', JSON.stringify({
          name: molecule.name,
          cid: molecule.cid,
          formula: enhancedData.aiResult.formula || molecule.formula,
          iupacName: enhancedData.aiResult.iupacName,
          smiles: enhancedData.aiResult.smiles,
          peaks: enhancedData.nmrPeaks || [],
          timestamp: Date.now(),
          // ✅ Enhanced Library flag'i - analiz sırasında kütüphanedeki verileri kullan
          enhancedLibrary: true,
          enhancedLibraryData: {
            nmrAnalysis: enhancedData.nmrAnalysis,
            c13Analysis: enhancedData.c13Analysis,
            ftirAnalysis: enhancedData.ftirAnalysis,
            aiResult: enhancedData.aiResult
          }
        }));
        console.log(`💾 Enhanced Library verisi kaydedildi: ${molecule.name} (Enhanced Library flag: true)`);
      }

      // Known molecule callback'i çağır
      if (onKnownMoleculeChange && enhancedData.aiResult) {
        onKnownMoleculeChange({
          name: molecule.name,
          cid: molecule.cid,
          formula: enhancedData.aiResult.formula || molecule.formula,
          iupacName: enhancedData.aiResult.iupacName,
          smiles: enhancedData.aiResult.smiles
        });
      }

      // ✅ aiPredictionData'yı set et (mesajın doğru gösterilmesi için)
      if (enhancedData.aiResult) {
        setAiPredictionData({
          moleculeName: molecule.name,
          cid: molecule.cid,
          formula: enhancedData.aiResult.formula || molecule.formula,
          iupacName: enhancedData.aiResult.iupacName,
          smiles: enhancedData.aiResult.smiles,
          image2D: enhancedData.aiResult.image2D,
          literature: enhancedData.aiResult.literature || [],
          source: 'Enhanced Library',
          enhancedLibrary: true,
          enhancedLibraryData: enhancedData
        });
      }

      // Modal'ı kapat
      setShowPubChemSearch(false);
      setSearchQuery('');
      setPubchemResults([]);
      
      // ✅ Loading state'i temizle (Enhanced Library'den geldi, başarılı)
      setLoadingMoleculeId(null);
      
      // Başarı mesajı göster
      const nmrCount = enhancedData.nmrPeaks?.length || 0;
      const c13Count = enhancedData.c13Analysis?.peaks?.length || 0;
      const ftirCount = enhancedData.ftirAnalysis?.peaks?.length || 0;
      
      console.log(`✅ ${molecule.name} molekülü Enhanced Library'den yüklendi!`);
      console.log(`📊 1H NMR: ${nmrCount} peak, 13C NMR: ${c13Count} peak, FTIR: ${ftirCount} peak`);
      console.log(`📝 Tüm spektral veriler toplu veri girişi textarea'sına yazıldı.`);
      console.log(`💡 "Peak'leri Ekle" butonuna tıklayarak peak'leri ekleyebilir, sonra "AI ile Analiz Et" butonuna tıklayabilirsiniz.`);
      
      // ✅ Enhanced Library'den geldi, fonksiyondan çık (try bloğu içinde return yapılıyor)
      return;
    }

      // Yeni molekül yüklenirken eski FTIR metadata'yı temizle
      if (spectrumType === 'ftir') {
        const oldMetadata = localStorage.getItem('ftir_molecule_metadata');
        if (oldMetadata) {
          console.log('🗑️ Eski FTIR metadata temizleniyor:', oldMetadata);
          localStorage.removeItem('ftir_molecule_metadata');
        }
      }
      // ✅ FTIR için Multi-Source kullan (NIST → SDBS → Theoretical → AI)
      if (spectrumType === 'ftir') {
        console.log('🔬 FTIR Multi-Source başlatılıyor...');

        try {
          // 1. Aggregator'dan SMILES ve formül topla
          console.log('📊 FTIR Data Aggregator çağrılıyor...');
          const aggregatorResponse = await fetch('/api/ftir-data-aggregator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              moleculeName: molecule.name,
              cid: molecule.cid
            }),
            signal: AbortSignal.timeout(30000) // 30 saniye timeout
          });

          if (!aggregatorResponse.ok) {
            throw new Error(`Aggregator failed: HTTP ${aggregatorResponse.status}`);
          }

          const { aggregation } = await aggregatorResponse.json();
          console.log('✅ Aggregation tamamlandı:', aggregation);

          // 2. Multi-Source API'yi çağır (tüm kaynakları dener)
          console.log('🌐 FTIR Multi-Source API çağrılıyor...');
          const multiSourceResponse = await fetch('/api/ftir-multi-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cid: aggregation.cid,
              smiles: aggregation.smiles,
              molecularFormula: aggregation.formula,
              moleculeName: molecule.name
            }),
            signal: AbortSignal.timeout(60000) // 60 saniye timeout (multi-source uzun sürebilir)
          });

          if (!multiSourceResponse.ok) {
            const errorData = await multiSourceResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Multi-source search failed: HTTP ${multiSourceResponse.status}`);
          }

          const multiSourceResult = await multiSourceResponse.json();
          console.log('✅ Multi-Source sonuçları:', multiSourceResult);

          // 3. En iyi kaynaktan peak'leri al
          if (multiSourceResult.success && multiSourceResult.bestSource) {
            const bestSource = multiSourceResult.sources.find((s: any) => s.name === multiSourceResult.bestSource);

            if (bestSource) {
              let ftirPeaks: any[] = [];

              // Theoretical engine'den geldiyse
              if (bestSource.type === 'theoretical' && bestSource.peaks) {
                ftirPeaks = bestSource.peaks;
              }
              // AI'dan geldiyse
              else if (bestSource.type === 'ai-generated' && bestSource.analysis?.predicted_ftir) {
                ftirPeaks = bestSource.analysis.predicted_ftir;
              }
              // Experimental (NIST) ise metadata göster
              else if (bestSource.type === 'experimental') {
                alert(`✅ ${bestSource.name} kaynağında spektrum bulundu!\n\n` +
                      `Kaynak: ${bestSource.name}\n` +
                      `Format: ${bestSource.format}\n` +
                      `URL: ${bestSource.url}\n\n` +
                      `Not: Bu kaynak görsel/JCAMP formatında. API erişimi yok.\n` +
                      `Teorik tahmin yapılacak...`);

                // NIST varsa bile theoretical engine çalıştır
                ftirPeaks = multiSourceResult.sources.find((s: any) => s.type === 'theoretical')?.peaks || [];
              }

              if (ftirPeaks.length > 0 && onFtirPeaksImport) {
                onFtirPeaksImport(ftirPeaks);
                console.log(`✅ ${ftirPeaks.length} adet FTIR peak eklendi (${multiSourceResult.bestSource})`);

                // FTIR molecule metadata'sını sakla (AI analyze yaparken kullanılacak)
                const ftirMetadata = {
                  moleculeName: molecule.name,
                  cid: aggregation.cid,
                  formula: aggregation.formula,
                  smiles: aggregation.smiles,
                  source: multiSourceResult.bestSource,
                  sourceType: bestSource.type
                };
                localStorage.setItem('ftir_molecule_metadata', JSON.stringify(ftirMetadata));
                console.log('💾 FTIR metadata kaydedildi:', ftirMetadata);

                // Kaynak tipine göre uyarı
                const warningMessage = bestSource.type === 'theoretical'
                  ? `✅ FTIR peaks teorik motor tarafından hesaplandı.\n\n` +
                    `Kaynak: ${bestSource.name}\n` +
                    `Metod: ${bestSource.method || 'Hooke\'s Law + Normal Mode Analysis'}\n` +
                    `Referans: ${bestSource.reference || 'Pavia - Introduction to Spectroscopy'}\n\n` +
                    `${bestSource.warnings?.length > 0 ? 'Uyarılar:\n' + bestSource.warnings.join('\n') : ''}`
                  : `⚠️ UYARI: FTIR peaks AI tarafından tahmin edildi.\n\n` +
                    `Denenen kaynaklar: ${multiSourceResult.totalAttempts}\n` +
                    `Başarılı kaynaklar: ${multiSourceResult.successfulSources}\n\n` +
                    `Doğrulama için lütfen deneysel FTIR ölçümü yapın.`;

                alert(warningMessage);
              } else {
                alert(`⚠️ ${bestSource.name} kaynağı bulundu ancak peak verisi çekilemedi.\n\n` +
                      `Kaynak: ${bestSource.name}\n` +
                      `Not: ${bestSource.note}`);
              }
            }
          } else {
            alert(`❌ FTIR verisi bulunamadı.\n\n` +
                  `Denenen kaynaklar: ${multiSourceResult.totalAttempts}\n` +
                  `Başarılı kaynaklar: ${multiSourceResult.successfulSources}\n\n` +
                  `Molekül: ${molecule.name}\nFormül: ${aggregation.formula}`);
          }

          // Modal'ı kapat
          setShowPubChemSearch(false);
          setSearchQuery('');
          setPubchemResults([]);

        } catch (error) {
          console.error('❌ FTIR multi-source hatası:', error);
          const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
          if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
            alert('⏱️ FTIR verisi çekilirken zaman aşımına uğradı. Lütfen tekrar deneyin.');
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
            alert('🌐 Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.');
          } else {
            alert(`❌ FTIR multi-source başarısız: ${errorMessage}`);
          }
        }

        return;
      }

      // 13C NMR için direkt peak'leri kullan (kütüphaneden gelen veri)
      if (spectrumType === 'c13' && molecule.peaks && molecule.peaks.length > 0) {
        console.log('✅ 13C NMR kütüphanesinden veri yükleniyor...');
        console.log(`📊 ${molecule.peaks.length} peak bulundu`);

        // 13C peak'lerini Carbon13Peak formatına çevir
        const carbon13Peaks: Carbon13Peak[] = molecule.peaks
          .map((peak: any) => {
            // ✅ Safety check: ppm must be valid
            const ppm = peak.ppm ?? peak.shift ?? 0;
            if (ppm === 0 || isNaN(ppm)) {
              return null; // Skip invalid peaks
            }
            return {
              ppm,
              intensity: peak.intensity || 100,
              carbonType: peak.carbonType,
              assignment: peak.assignment
            } as Carbon13Peak;
          })
          .filter((peak: Carbon13Peak | null): peak is Carbon13Peak => peak !== null);

        // Peak'leri ekle
        if (onCarbon13PeaksImport) {
          onCarbon13PeaksImport(carbon13Peaks);
          console.log(`✅ ${carbon13Peaks.length} adet 13C NMR peak eklendi`);
        }

        // Modal'ı kapat
        setShowPubChemSearch(false);
        setSearchQuery('');
        setPubchemResults([]);
        return;
      }

      // ✅ 1H NMR: Önce molecule.nmrData'yı kontrol et (NMRShiftDB2'den gelmişse)
      if (molecule.nmrData && Array.isArray(molecule.nmrData) && molecule.nmrData.length > 0) {
        console.log('✅ NMRShiftDB2\'den gelen nmrData bulundu, direkt yükleniyor...');
        console.log(`📊 ${molecule.nmrData.length} spektrum var`);

        // İlk spektrumu al (genelde 1H NMR)
        const firstSpectrum = molecule.nmrData[0];

        if (firstSpectrum.peaks && firstSpectrum.peaks.length > 0) {
          console.log(`📊 ${firstSpectrum.peaks.length} peak bulundu`);

          // NMRShiftDB2 peak formatını NMRPeak formatına çevir
          const parsedPeaks: NMRPeak[] = firstSpectrum.peaks.map((peak: any) => ({
            shift: peak.shift,
            mult: peak.multiplicity || 's',
            integ: 1, // NMRShiftDB2'de integration genelde yok
            source: {
              moleculeName: molecule.name,
              cid: molecule.cid,
              source: 'NMRShiftDB2'
            }
          }));

          // Peak'leri ekle
          onPeaksImport(parsedPeaks);

          // Molekül bilgisini localStorage'e kaydet
          if (typeof window !== 'undefined') {
            localStorage.setItem('spectromind_known_molecule', JSON.stringify({
              name: molecule.name,
              cid: molecule.cid,
              formula: molecule.formula,
              peaks: parsedPeaks,
              timestamp: Date.now()
            }));
            console.log(`✅ NMRShiftDB2 verisi yüklendi: ${molecule.name} (${parsedPeaks.length} peak)`);
          }

          // ✅ Known molecule callback'i çağır (NMRShiftDB2'den gelen molekül için)
          if (onKnownMoleculeChange) {
            // SMILES'i PubChem'den al
            let smiles = '';
            try {
              const smilesResponse = await fetch(`/api/pubchem/smiles?cid=${molecule.cid}`);
              if (smilesResponse.ok) {
                const smilesData = await smilesResponse.json();
                smiles = smilesData.smiles || '';
              }
            } catch (err) {
              console.warn('⚠️ SMILES alınamadı:', err);
            }

            const knownMoleculeData = {
              name: molecule.name,
              cid: molecule.cid,
              formula: molecule.formula,
              smiles: smiles,
              source: 'NMRShiftDB2'
            };

            onKnownMoleculeChange(knownMoleculeData);
            console.log(`✅ onKnownMoleculeChange çağrıldı: ${molecule.name} (CID: ${molecule.cid})`);

            // ✅ aiPredictionData'yı set et (UI'da doğru molekül bilgisinin gösterilmesi için)
            setAiPredictionData({
              moleculeName: molecule.name,
              cid: molecule.cid,
              formula: molecule.formula,
              smiles: smiles,
              source: 'NMRShiftDB2'
            });
          }

          setShowPubChemSearch(false);
          setSearchQuery('');
          setPubchemResults([]);
          setLoadingMoleculeId(null); // ✅ Loading state'i temizle
          return; // ✅ Başarıyla yüklendi, fonksiyondan çık
        }
      }

      // Backend API'den NMR verilerini al (nmrData yoksa veya boşsa)
      const url = `/api/pubchem?type=nmr&query=${molecule.cid}`;
      console.log(`🌐 NMR API URL: ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30 saniye timeout
      });
      console.log(`📡 NMR Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`NMR verisi alınamadı: HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 NMR API Response:', data);

      if (data.success && data.peakText && data.peakText.trim() !== '') {
        console.log(`✅ NMR peak'leri yüklendi: ${data.peaks.length} peak`);
        console.log('📊 Peak verileri:', data.peakText);

        // Peak'leri parse et VE source bilgisi ekle
        const peakLines = data.peakText.trim().split('\n');
        const parsedPeaks: NMRPeak[] = peakLines.map((line: string) => {
          // "1.17: t (3H)" formatını parse et
          const pattern = /(\d+\.?\d*)[:\s]+([sdtqmSDTO]+|dd|dt|td|ddd|sep|br\s*[sdt]?)\s*\((\d+\.?\d*)H?\)/i;
          const match = line.match(pattern);
          if (match) {
            return {
              shift: parseFloat(match[1]),
              mult: match[2].toLowerCase().trim(),
              integ: parseFloat(match[3]),
              source: {
                moleculeName: molecule.name,
                cid: molecule.cid
              }
            };
          }
          return null;
        }).filter((p: any) => p !== null) as NMRPeak[];

        // Peak'leri ekle (source bilgisiyle birlikte)
        onPeaksImport(parsedPeaks);

        // ✨ Molekül ismini VE peak'leri localStorage'e kaydet (AI analizinde kullanılacak)
        if (typeof window !== 'undefined') {
          localStorage.setItem('spectromind_known_molecule', JSON.stringify({
            name: molecule.name,
            cid: molecule.cid,
            formula: molecule.formula,
            peaks: parsedPeaks, // Peak'leri source ile kaydet
            timestamp: Date.now()
          }));
          console.log(`✅ Molekül ismi ve ${parsedPeaks.length} peak (source ile) kaydedildi: ${molecule.name}`);
        }

        // ✅ Known molecule callback'i çağır (PubChem'den gelen molekül için)
        if (onKnownMoleculeChange) {
          // SMILES'i PubChem'den al
          let smiles = '';
          try {
            const smilesResponse = await fetch(`/api/pubchem/smiles?cid=${molecule.cid}`);
            if (smilesResponse.ok) {
              const smilesData = await smilesResponse.json();
              smiles = smilesData.smiles || '';
            }
          } catch (err) {
            console.warn('⚠️ SMILES alınamadı:', err);
          }

          const knownMoleculeData = {
            name: molecule.name,
            cid: molecule.cid,
            formula: molecule.formula,
            smiles: smiles,
            source: 'PubChem'
          };

          onKnownMoleculeChange(knownMoleculeData);
          console.log(`✅ onKnownMoleculeChange çağrıldı: ${molecule.name} (CID: ${molecule.cid})`);

          // ✅ aiPredictionData'yı set et (UI'da doğru molekül bilgisinin gösterilmesi için)
          setAiPredictionData({
            moleculeName: molecule.name,
            cid: molecule.cid,
            formula: molecule.formula,
            smiles: smiles,
            source: 'PubChem'
          });
        }

        setShowPubChemSearch(false);
        setSearchQuery('');
        setPubchemResults([]);
        setLoadingMoleculeId(null); // ✅ Loading state'i temizle
      } else {
        console.log('❌ PubChem\'de NMR peak verisi bulunamadı, yerel kütüphaneden deneniyor...');

        // Aynı isimdeki diğer CID'lerde dene
        console.log(`🔄 "${molecule.name}" için diğer CID'ler deneniyor...`);

        try {
          // Aynı isimle tekrar ara, tüm CID'leri al
          const searchResponse = await fetch(
            `/api/pubchem?type=name&query=${encodeURIComponent(molecule.name)}`,
            {
              signal: AbortSignal.timeout(30000) // 30 saniye timeout
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.success && searchData.molecules && searchData.molecules.length > 1) {
              console.log(`📋 "${molecule.name}" için ${searchData.molecules.length} alternatif CID bulundu`);

              // Diğer CID'lerde NMR ara
              for (const altMolecule of searchData.molecules) {
                if (altMolecule.cid === molecule.cid) continue; // Zaten denendi

                console.log(`  🔍 CID ${altMolecule.cid} deneniyor...`);

                const altResponse = await fetch(`/api/pubchem?type=nmr&query=${altMolecule.cid}`, {
                  signal: AbortSignal.timeout(30000) // 30 saniye timeout
                });
                if (altResponse.ok) {
                  const altData = await altResponse.json();
                  if (altData.success && altData.peakText) {
                    console.log(`  ✅ CID ${altMolecule.cid}'de NMR bulundu!`);

                    // Peak'leri parse et VE source bilgisi ekle
                    const peakLines = altData.peakText.trim().split('\n');
                    const parsedPeaks: NMRPeak[] = peakLines.map((line: string) => {
                      const pattern = /(\d+\.?\d*)[:\s]+([sdtqmSDTO]+|dd|dt|td|ddd|sep|br\s*[sdt]?)\s*\((\d+\.?\d*)H?\)/i;
                      const match = line.match(pattern);
                      if (match) {
                        return {
                          shift: parseFloat(match[1]),
                          mult: match[2].toLowerCase().trim(),
                          integ: parseFloat(match[3]),
                          source: {
                            moleculeName: molecule.name,
                            cid: altMolecule.cid
                          }
                        };
                      }
                      return null;
                    }).filter((p: any) => p !== null) as NMRPeak[];

                    // Peak'leri ekle (source bilgisiyle birlikte)
                    onPeaksImport(parsedPeaks);

                    // ✨ Molekül ismini VE peak'leri localStorage'e kaydet
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('spectromind_known_molecule', JSON.stringify({
                        name: molecule.name, // Orijinal molekül ismi
                        cid: altMolecule.cid,
                        formula: altMolecule.formula,
                        peaks: parsedPeaks, // Peak'leri source ile kaydet
                        timestamp: Date.now()
                      }));
                      console.log(`✅ Molekül ismi ve ${parsedPeaks.length} peak (source ile) kaydedildi: ${molecule.name} (alternatif CID: ${altMolecule.cid})`);
                    }

                    // ✅ Known molecule callback'i çağır (Alternatif CID'den gelen molekül için)
                    if (onKnownMoleculeChange) {
                      // SMILES'i PubChem'den al
                      let smiles = '';
                      try {
                        const smilesResponse = await fetch(`/api/pubchem/smiles?cid=${altMolecule.cid}`);
                        if (smilesResponse.ok) {
                          const smilesData = await smilesResponse.json();
                          smiles = smilesData.smiles || '';
                        }
                      } catch (err) {
                        console.warn('⚠️ SMILES alınamadı:', err);
                      }

                      const knownMoleculeData = {
                        name: molecule.name, // Orijinal molekül ismi
                        cid: altMolecule.cid,
                        formula: altMolecule.formula,
                        smiles: smiles,
                        source: 'PubChem'
                      };

                      onKnownMoleculeChange(knownMoleculeData);
                      console.log(`✅ onKnownMoleculeChange çağrıldı: ${molecule.name} (Alternatif CID: ${altMolecule.cid})`);

                      // ✅ aiPredictionData'yı set et (UI'da doğru molekül bilgisinin gösterilmesi için)
                      setAiPredictionData({
                        moleculeName: molecule.name,
                        cid: altMolecule.cid,
                        formula: altMolecule.formula,
                        smiles: smiles,
                        source: 'PubChem'
                      });
                    }

                    setShowPubChemSearch(false);
                    setSearchQuery('');
                    setPubchemResults([]);
                    setLoadingMoleculeId(null); // ✅ Loading state'i temizle
                    return;
                  }
                }
              }

              console.log('❌ Hiçbir alternatif CID\'de NMR bulunamadı');
            }
          }
        } catch (err) {
          console.error('Alternatif CID araması hatası:', err);
        }

        // Yerel kütüphaneden dene
        try {
          console.log(`📚 Yerel kütüphanede "${molecule.name}" aranıyor...`);

          const localResponse = await fetch('/api/molecule-library/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: molecule.name }),
            signal: AbortSignal.timeout(10000) // 10 saniye timeout
          });

          console.log(`📡 Yerel kütüphane response status: ${localResponse.status}`);

          if (localResponse.ok) {
            const localData = await localResponse.json();
            console.log('📦 Yerel kütüphane response:', localData);

            if (localData.success && localData.molecule?.peaks) {
              console.log(`✅ Yerel kütüphanede bulundu: ${localData.molecule.peaks.length} peak`);

              // Peak'leri formatla
              const peakText = localData.molecule.peaks
                .map((p: any) => `${p.shift}: ${p.mult} (${p.integ}H)`)
                .join('\n');

              console.log('📊 Formatlanmış peak\'ler:', peakText);

              setBulkText(peakText);
              setShowPubChemSearch(false);
              setSearchQuery('');
              setPubchemResults([]);
              console.log('✅ Yerel kütüphane peak\'leri yüklendi');
              return;
            } else {
              console.log('⚠️ Yerel kütüphanede bulundu ama peak yok:', localData);
            }
          } else {
            console.log('❌ Yerel kütüphane API hatası');
          }
        } catch (err) {
          console.error('❌ Yerel kütüphane exception:', err);
        }

        // Hem PubChem'de hem yerel kütüphanede yok - AI'ya sor
        console.log('❌ Hiçbir yerde bulunamadı, AI\'ya soruluyor...');

        try {
          const aiResponse = await fetch('/api/ai-generate-nmr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              moleculeName: molecule.name,
              formula: molecule.formula,
              cid: molecule.cid
            }),
            signal: AbortSignal.timeout(60000) // 60 saniye timeout
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.peakText) {
              console.log('🤖 AI tarafından NMR peak\'leri oluşturuldu');
              console.log('📊 AI Peak verileri:', aiData.peakText);

              setBulkText(aiData.peakText);
              setShowPubChemSearch(false);
              setSearchQuery('');
              setPubchemResults([]);

              // Kullanıcıya bilgi ver
              alert(`🤖 AI tarafından oluşturuldu!\n\n${molecule.name} için NMR peak verileri yapay zeka tarafından tahmin edildi.\n\nNot: Bu veriler AI tahminidir, doğrulama yapmanız önerilir.`);
              return;
            }
          }
        } catch (aiErr) {
          console.error('AI NMR oluşturma hatası:', aiErr);
        }

        // AI de başarısız oldu
        console.log('❌ AI ile de başarısız olundu');
        const errorMessage = data.message || `${molecule.name} için NMR peak verisi bulunamadı`;
        alert(`⚠️ ${errorMessage}\n\nFormül: ${molecule.formula}\nCID: ${molecule.cid}\n\nNe PubChem'de, ne yerel kütüphanede, ne de AI ile NMR peak verisi oluşturulamadı.`);
      }

    } catch (error) {
      console.error('❌ NMR verisi yükleme hatası:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        alert(`⏱️ ${molecule.name} için NMR verisi çekilirken zaman aşımına uğradı. Lütfen tekrar deneyin.`);
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
        alert(`🌐 Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.\n\nMolekül: ${molecule.name}`);
      } else {
        alert(`❌ NMR verileri yüklenemedi: ${errorMessage}\n\nMolekül: ${molecule.name}\nCID: ${molecule.cid}`);
      }
    } finally {
      // Clear loading state
      setLoadingMoleculeId(null);
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs @sm:text-sm @lg:text-base font-bold text-purple-400 flex items-center gap-1">
          Toplu Veri Girişi
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPubChemSearch(!showPubChemSearch)}
            className="text-xs @sm:text-sm @lg:text-base text-emerald-400 hover:text-emerald-300 transition font-bold flex items-center gap-1.5"
          >
            {showPubChemSearch ? (
              '✕ Kapat'
            ) : (
              <>
                <Image
                  src="/book.png"
                  alt="Arama"
                  width={16}
                  height={16}
                  className="w-3 h-3 @sm:w-3.5 @sm:h-3.5 @lg:w-4 @lg:h-4"
                />
                Ara
              </>
            )}
          </button>
          {spectrumType !== 'ftir' && (
            <button
              onClick={loadExample}
              className="text-xs @sm:text-sm @lg:text-base text-sky-400 hover:text-sky-300 transition"
            >
              Örnek
            </button>
          )}
        </div>
      </div>

      {/* PubChem Arama Modal - Fullscreen Overlay */}
      {showPubChemSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Image
                  src="/book.png"
                  alt="PubChem"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <h2 className="text-xl font-bold text-emerald-400">Molekül Arama</h2>
              </div>
              <button
                onClick={() => {
                  setShowPubChemSearch(false);
                  setSearchQuery('');
                  setPubchemResults([]);
                }}
                className="text-slate-400 hover:text-white text-2xl font-bold transition px-3 py-1 hover:bg-slate-800 rounded"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              {/* Arama Kutusu */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Molekül ismi veya formül girin (örn: Ethanol veya C2H6O)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        searchPubChem();
                      }
                    }}
                    autoFocus
                    className="flex-1 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={searchPubChem}
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition"
                  >
                    {isSearching ? '🔍 Aranıyor...' : '🔍 Ara'}
                  </button>
                </div>

                {/* Önerilen Aramalar - Başlıksız, sadece butonlar */}
                {synonymSuggestions.length > 0 && pubchemResults.length === 0 && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-300 mb-2 font-semibold">
                      Önerilen aramalar:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        // Önce synonym/correction, sonra similar
                        const alternativeNames = synonymSuggestions.filter((s: any) => s.type === 'synonym' || s.type === 'correction');
                        const similarMolecules = synonymSuggestions.filter((s: any) => s.type === 'similar');
                        const allSuggestions = [...alternativeNames, ...similarMolecules];

                        return allSuggestions.map((suggestion: any, index: number) => (
                          <button
                            key={index}
                            onClick={async () => {
                              console.log('🔍 Öneri tıklandı:', suggestion.name);
                              setSearchQuery(suggestion.name);
                              setIsSearching(true);
                              setSearchStage('Kütüphanede aranıyor...');
                              setPubchemResults([]);
                              setSynonymSuggestions([]);

                              try {
                                const url = `/api/pubchem?query=${encodeURIComponent(suggestion.name)}`;
                                console.log('🌐 API URL:', url);

                                const response = await fetch(url, {
                                  signal: AbortSignal.timeout(30000) // 30 saniye timeout
                                });
                                
                                if (!response.ok) {
                                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                }
                                
                                const data = await response.json();
                                console.log('📦 API Response:', data);

                                // Arama aşamalarını göster
                                if (data.searchStages && Array.isArray(data.searchStages)) {
                                  for (let i = 0; i < data.searchStages.length; i++) {
                                    setSearchStage(data.searchStages[i]);
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                  }
                                }

                                if (data.success && data.molecules && data.molecules.length > 0) {
                                  console.log('✅ Molekül bulundu! IUPAC ve formül bilgileri zorunlu olarak çekiliyor...');
                                  // İlk molekülü otomatik yükle
                                  const firstMolecule = data.molecules[0];
                                  
                                  // ✅ ZORUNLU: IUPAC adı ve moleküler formülü PubChem'den çek (firstMolecule'daki yanlış bilgileri override et!)
                                  setSearchStage('IUPAC adı ve formül bilgileri çekiliyor...');
                                  let iupacName = '';
                                  let molecularFormula = '';
                                  let allSynonyms: string[] = [];
                                  
                                  try {
                                    console.log(`🔍 CID ${firstMolecule.cid} için IUPAC ve formül bilgileri ZORUNLU olarak PubChem'den çekiliyor...`);
                                    console.log(`   Stored formula (override edilecek): "${firstMolecule.formula || 'N/A'}"`);
                                    
                                    // IUPAC adını ve moleküler formülü BİRLİKTE zorunlu olarak çek
                                    const storedFormulaFirst = firstMolecule.formula || '';
                                    const iupacResponse = await fetch(`/api/pubchem/iupac?cid=${firstMolecule.cid}&formula=${encodeURIComponent(storedFormulaFirst)}`, {
                                      signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                    });
                                    if (iupacResponse.ok) {
                                      const iupacData = await iupacResponse.json();
                                      
                                      // ⚠️ Formül uyuşmazlığı tespit edildiyse yanlış bilgileri kullanma!
                                      if (!iupacData.success && iupacData.error === 'Formula mismatch detected') {
                                        console.error(`🚨 CRITICAL: CID ${firstMolecule.cid} formül uyuşmazlığı tespit edildi!`);
                                        console.error(`   Stored formula: "${storedFormulaFirst}"`);
                                        console.error(`   PubChem formula: "${iupacData.formula || 'N/A'}"`);
                                        console.error(`   → Bu CID yanlış moleküle ait! Doğru CID'yi bulmak için yeni arama yapılıyor...`);
                                        
                                        // Doğru CID'yi bulmak için molekül ismini kullanarak yeni arama yap
                                        try {
                                          const moleculeName = firstMolecule.name || searchQuery || '';
                                          if (moleculeName) {
                                            console.log(`🔍 Doğru CID'yi bulmak için "${moleculeName}" aranıyor...`);
                                            const searchResponse = await fetch(`/api/pubchem?query=${encodeURIComponent(moleculeName)}`, {
                                              signal: AbortSignal.timeout(30000) // 30 saniye timeout
                                            });
                                            if (searchResponse.ok) {
                                              const searchData = await searchResponse.json();
                                              if (searchData.success && searchData.molecules && searchData.molecules.length > 0) {
                                                // İlk molekülü kontrol et
                                                const correctMolecule = searchData.molecules[0];
                                                if (correctMolecule.cid && correctMolecule.cid !== firstMolecule.cid) {
                                                  console.log(`✅ Doğru CID bulundu: ${correctMolecule.cid} (önceki: ${firstMolecule.cid})`);
                                                  // Doğru CID ile tekrar çek
                                                  firstMolecule.cid = correctMolecule.cid;
                                                  const correctIupacResponse = await fetch(`/api/pubchem/iupac?cid=${correctMolecule.cid}`, {
                                                    signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                                  });
                                                  if (correctIupacResponse.ok) {
                                                    const correctIupacData = await correctIupacResponse.json();
                                                    if (correctIupacData.success) {
                                                      iupacName = correctIupacData.iupacName || '';
                                                      molecularFormula = correctIupacData.formula || '';
                                                      firstMolecule.iupacName = iupacName;
                                                      firstMolecule.formula = molecularFormula;
                                                      console.log(`✅ Doğru bilgiler çekildi: IUPAC="${iupacName}", Formula="${molecularFormula}"`);
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        } catch (searchError) {
                                          console.error('❌ Doğru CID arama hatası:', searchError);
                                        }
                                      } else if (iupacData.success) {
                                        // Formül uyuşmazlığı yok, normal devam et
                                        if (iupacData.iupacName) {
                                          iupacName = iupacData.iupacName;
                                          console.log(`✅ IUPAC adı çekildi: "${iupacName}"`);
                                        }
                                        if (iupacData.formula) {
                                          molecularFormula = iupacData.formula;
                                          console.log(`✅ Moleküler formül çekildi (IUPAC API'den): "${molecularFormula}"`);
                                        }
                                      }
                                    }
                                    
                                    // Fallback: Moleküler formülü zorunlu olarak çek (eğer IUPAC API'den gelmediyse)
                                    if (!molecularFormula) {
                                      const formulaResponse = await fetch(
                                        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstMolecule.cid}/property/MolecularFormula/JSON`,
                                        { 
                                          headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                          signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                        }
                                      );
                                      if (formulaResponse.ok) {
                                        const formulaData = await formulaResponse.json();
                                        const props = formulaData.PropertyTable?.Properties?.[0];
                                        if (props && props.MolecularFormula) {
                                          molecularFormula = props.MolecularFormula;
                                          console.log(`✅ Moleküler formül çekildi (fallback): "${molecularFormula}"`);
                                        }
                                      }
                                    }
                                    
                                    // Fallback: Eğer IUPAC API başarısız olduysa direkt PubChem'den çek
                                    if (!iupacName) {
                                      const iupacDirectResponse = await fetch(
                                        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstMolecule.cid}/property/IUPACName/JSON`,
                                        { 
                                          headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                          signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                        }
                                      );
                                      if (iupacDirectResponse.ok) {
                                        const iupacDirectData = await iupacDirectResponse.json();
                                        const props = iupacDirectData.PropertyTable?.Properties?.[0];
                                        if (props && props.IUPACName) {
                                          iupacName = props.IUPACName;
                                          console.log(`✅ IUPAC adı çekildi (fallback): "${iupacName}"`);
                                        }
                                      }
                                    }
                                    
                                    // ⚠️ VALIDATION: firstMolecule'daki bilgilerle karşılaştır
                                    if (firstMolecule.formula && molecularFormula && firstMolecule.formula !== molecularFormula) {
                                      console.warn(`⚠️ FORMÜL UYUŞMAZLIĞI TESPİT EDİLDİ:`);
                                      console.warn(`   Stored: "${firstMolecule.formula}"`);
                                      console.warn(`   PubChem: "${molecularFormula}"`);
                                      console.warn(`   → PubChem'den çekilen formül kullanılıyor (doğru olan)`);
                                    }
                                    
                                    // Tüm synonyms'ları çek
                                    const synonymsResponse = await fetch(
                                      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstMolecule.cid}/synonyms/JSON`,
                                      { 
                                        headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                        signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                      }
                                    );
                                    if (synonymsResponse.ok) {
                                      const synonymsData = await synonymsResponse.json();
                                      allSynonyms = synonymsData.InformationList?.Information?.[0]?.Synonym || [];
                                      console.log(`✅ ${allSynonyms.length} eş anlamlı isim bulundu`);
                                    }
                                    
                                    // Zorunlu veriler kontrolü
                                    if (!iupacName) {
                                      console.error('❌ IUPAC adı zorunlu ama alınamadı!');
                                      alert('⚠️ IUPAC adı alınamadı. Lütfen tekrar deneyin.');
                                      setIsSearching(false);
                                      setSearchStage('');
                                      return;
                                    }
                                    
                                    if (!molecularFormula) {
                                      console.error('❌ Moleküler formül zorunlu ama alınamadı!');
                                      alert('⚠️ Moleküler formül alınamadı. Lütfen tekrar deneyin.');
                                      setIsSearching(false);
                                      setSearchStage('');
                                      return;
                                    }
                                    
                                    // Molekül bilgisini güncelle
                                    firstMolecule.iupacName = iupacName;
                                    firstMolecule.formula = molecularFormula;
                                    firstMolecule.synonyms = allSynonyms;
                                    
                                  } catch (error) {
                                    console.error('❌ PubChem veri çekme hatası:', error);
                                    alert('⚠️ Molekül bilgileri alınamadı. Lütfen tekrar deneyin.');
                                    setIsSearching(false);
                                    setSearchStage('');
                                    return;
                                  }

                                  // NMR verilerini yükle
                                  setSearchStage('NMR verileri yükleniyor...');
                                  const nmrUrl = `/api/pubchem?type=nmr&query=${firstMolecule.cid}`;
                                  const nmrResponse = await fetch(nmrUrl, {
                                    signal: AbortSignal.timeout(30000) // 30 saniye timeout
                                  });

                                  if (nmrResponse.ok) {
                                    const nmrData = await nmrResponse.json();

                                    if (nmrData.success && nmrData.peaks && nmrData.peaks.length > 0) {
                                      console.log(`✅ ${nmrData.peaks.length} NMR peak bulundu, input alanına yazılıyor...`);

                                      // Peak'leri parse et ve NMRPeak formatına çevir
                                      const parsedPeaks: NMRPeak[] = nmrData.peaks.map((peakStr: string) => {
                                        // "7.26: s (1H)" formatını parse et
                                        const match = peakStr.match(/(\d+\.?\d*)\s*:\s*([a-z]+)\s*\((\d+\.?\d*)H\)/i);
                                        if (match) {
                                          return {
                                            shift: parseFloat(match[1]),
                                            mult: match[2],
                                            integ: parseFloat(match[3]),
                                            source: {
                                              moleculeName: firstMolecule.name,
                                              cid: firstMolecule.cid,
                                              source: firstMolecule.source || 'PubChem'
                                            }
                                          };
                                        }
                                        return null;
                                      }).filter((p: any) => p !== null);

                                      if (parsedPeaks.length > 0) {
                                        // Peak'leri input alanına yaz
                                        onPeaksImport(parsedPeaks);

                                        // Molekül bilgisini localStorage'e kaydet (IUPAC ve formül ile birlikte)
                                        if (typeof window !== 'undefined') {
                                          localStorage.setItem('spectromind_known_molecule', JSON.stringify({
                                            name: firstMolecule.name,
                                            cid: firstMolecule.cid,
                                            formula: molecularFormula, // Zorunlu: PubChem'den çekildi
                                            iupacName: iupacName, // Zorunlu: PubChem'den çekildi
                                            synonyms: allSynonyms, // Tüm eş anlamlı isimler
                                            peaks: parsedPeaks,
                                            timestamp: Date.now()
                                          }));
                                          
                                          // onKnownMoleculeChange'e de gönder
                                          onKnownMoleculeChange?.({
                                            moleculeName: firstMolecule.name,
                                            cid: firstMolecule.cid,
                                            formula: molecularFormula,
                                            iupacName: iupacName,
                                            synonyms: allSynonyms,
                                            source: 'PubChem (Verified IUPAC & Formula)'
                                          });
                                        }

                                        // Modal'ı kapat
                                        setShowPubChemSearch(false);
                                        setSearchQuery('');
                                        setPubchemResults([]);
                                        setSynonymSuggestions([]);
                                        setAiPredictionData(null);
                                      }
                                    } else {
                                      console.log('⚠️ NMR peak verisi bulunamadı, molekül listesi gösteriliyor');
                                      setPubchemResults(data.molecules);
                                      setAiPredictionData(null);
                                      setSynonymSuggestions([]);
                                    }
                                  } else {
                                    console.log('⚠️ NMR API hatası, molekül listesi gösteriliyor');
                                    setPubchemResults(data.molecules);
                                    setAiPredictionData(null);
                                    setSynonymSuggestions([]);
                                  }
                                } else if (data.aiPredictionData) {
                                  console.log('✅ AI prediction data var, IUPAC ve formül bilgileri zorunlu olarak çekiliyor...');
                                  
                                  // ✅ ZORUNLU: IUPAC adı ve moleküler formülü PubChem'den çek (aiPredictionData'daki yanlış bilgileri override et!)
                                  let iupacName = '';
                                  let molecularFormula = '';
                                  let allSynonyms: string[] = [];
                                  
                                  if (data.aiPredictionData.cid) {
                                    setSearchStage('IUPAC adı ve formül bilgileri çekiliyor...');
                                    
                                    try {
                                      console.log(`🔍 CID ${data.aiPredictionData.cid} için IUPAC ve formül bilgileri ZORUNLU olarak PubChem'den çekiliyor...`);
                                      console.log(`   Stored IUPAC (override edilecek): "${data.aiPredictionData.iupacName || 'N/A'}"`);
                                      console.log(`   Stored formula (override edilecek): "${data.aiPredictionData.formula || 'N/A'}"`);
                                      
                                      // IUPAC adını ve moleküler formülü BİRLİKTE zorunlu olarak çek
                                      const storedFormulaAi = data.aiPredictionData.formula || '';
                                      const iupacResponse = await fetch(`/api/pubchem/iupac?cid=${data.aiPredictionData.cid}&formula=${encodeURIComponent(storedFormulaAi)}`, {
                                        signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                      });
                                      if (iupacResponse.ok) {
                                        const iupacData = await iupacResponse.json();
                                        
                                        // ⚠️ Formül uyuşmazlığı tespit edildiyse yanlış bilgileri kullanma!
                                        if (!iupacData.success && iupacData.error === 'Formula mismatch detected') {
                                          console.error(`🚨 CRITICAL: CID ${data.aiPredictionData.cid} formül uyuşmazlığı tespit edildi!`);
                                          console.error(`   Stored formula: "${storedFormulaAi}"`);
                                          console.error(`   PubChem formula: "${iupacData.formula || 'N/A'}"`);
                                          console.error(`   → Bu CID yanlış moleküle ait! Doğru CID'yi bulmak için yeni arama yapılıyor...`);
                                          
                                          // Doğru CID'yi bulmak için molekül ismini kullanarak yeni arama yap
                                          try {
                                            const moleculeName = data.aiPredictionData.moleculeName || searchQuery || '';
                                            if (moleculeName) {
                                              console.log(`🔍 Doğru CID'yi bulmak için "${moleculeName}" aranıyor...`);
                                              const searchResponse = await fetch(`/api/pubchem?query=${encodeURIComponent(moleculeName)}`, {
                                                signal: AbortSignal.timeout(30000) // 30 saniye timeout
                                              });
                                              if (searchResponse.ok) {
                                                const searchData = await searchResponse.json();
                                                if (searchData.success && searchData.molecules && searchData.molecules.length > 0) {
                                                  // İlk molekülü kontrol et
                                                  const correctMolecule = searchData.molecules[0];
                                                  if (correctMolecule.cid && correctMolecule.cid !== data.aiPredictionData.cid) {
                                                    console.log(`✅ Doğru CID bulundu: ${correctMolecule.cid} (önceki: ${data.aiPredictionData.cid})`);
                                                    // Doğru CID ile tekrar çek
                                                    data.aiPredictionData.cid = correctMolecule.cid;
                                                    const correctIupacResponse = await fetch(`/api/pubchem/iupac?cid=${correctMolecule.cid}`, {
                                                      signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                                    });
                                                    if (correctIupacResponse.ok) {
                                                      const correctIupacData = await correctIupacResponse.json();
                                                      if (correctIupacData.success) {
                                                        iupacName = correctIupacData.iupacName || '';
                                                        molecularFormula = correctIupacData.formula || '';
                                                        data.aiPredictionData.iupacName = iupacName;
                                                        data.aiPredictionData.formula = molecularFormula;
                                                        console.log(`✅ Doğru bilgiler çekildi: IUPAC="${iupacName}", Formula="${molecularFormula}"`);
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } catch (searchError) {
                                            console.error('❌ Doğru CID arama hatası:', searchError);
                                          }
                                        } else if (iupacData.success) {
                                          // Formül uyuşmazlığı yok, normal devam et
                                          if (iupacData.iupacName) {
                                            iupacName = iupacData.iupacName;
                                            console.log(`✅ IUPAC adı çekildi: "${iupacName}"`);
                                          }
                                          if (iupacData.formula) {
                                            molecularFormula = iupacData.formula;
                                            console.log(`✅ Moleküler formül çekildi (IUPAC API'den): "${molecularFormula}"`);
                                          }
                                        }
                                      }
                                      
                                      // Fallback: Eğer IUPAC API başarısız olduysa direkt PubChem'den çek
                                      if (!iupacName || !molecularFormula) {
                                        const pubchemPropsResponse = await fetch(
                                          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${data.aiPredictionData.cid}/property/IUPACName,MolecularFormula/JSON`,
                                          { 
                                            headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                            signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                          }
                                        );
                                        if (pubchemPropsResponse.ok) {
                                          const pubchemPropsData = await pubchemPropsResponse.json();
                                          const props = pubchemPropsData.PropertyTable?.Properties?.[0];
                                          if (props) {
                                            if (!iupacName && props.IUPACName) {
                                              iupacName = props.IUPACName;
                                              console.log(`✅ IUPAC adı çekildi (fallback): "${iupacName}"`);
                                            }
                                            if (!molecularFormula && props.MolecularFormula) {
                                              molecularFormula = props.MolecularFormula;
                                              console.log(`✅ Moleküler formül çekildi (fallback): "${molecularFormula}"`);
                                            }
                                          }
                                        }
                                      }
                                      
                                      // Fallback: Moleküler formülü zorunlu olarak çek (eğer hala yoksa)
                                      if (!molecularFormula) {
                                        const formulaResponse = await fetch(
                                          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${data.aiPredictionData.cid}/property/MolecularFormula/JSON`,
                                          { 
                                            headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                            signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                          }
                                        );
                                        if (formulaResponse.ok) {
                                          const formulaData = await formulaResponse.json();
                                          const props = formulaData.PropertyTable?.Properties?.[0];
                                          if (props && props.MolecularFormula) {
                                            molecularFormula = props.MolecularFormula;
                                            console.log(`✅ Moleküler formül çekildi (final fallback): "${molecularFormula}"`);
                                          }
                                        }
                                      }
                                      
                                      // ⚠️ VALIDATION: aiPredictionData'daki bilgilerle karşılaştır
                                      const storedIUPAC = data.aiPredictionData.iupacName;
                                      const storedFormulaVal = data.aiPredictionData.formula;
                                      
                                      if (storedIUPAC && iupacName && storedIUPAC !== iupacName) {
                                        console.warn(`⚠️ IUPAC UYUŞMAZLIĞI TESPİT EDİLDİ:`);
                                        console.warn(`   Stored: "${storedIUPAC}"`);
                                        console.warn(`   PubChem: "${iupacName}"`);
                                        console.warn(`   → PubChem'den çekilen IUPAC adı kullanılıyor (doğru olan)`);
                                      }
                                      
                                      if (storedFormulaVal && molecularFormula && storedFormulaVal !== molecularFormula) {
                                        console.warn(`⚠️ FORMÜL UYUŞMAZLIĞI TESPİT EDİLDİ:`);
                                        console.warn(`   Stored: "${storedFormulaVal}"`);
                                        console.warn(`   PubChem: "${molecularFormula}"`);
                                        console.warn(`   → PubChem'den çekilen formül kullanılıyor (doğru olan)`);
                                      }
                                      
                                      // Tüm synonyms'ları çek
                                      setSearchStage('Eş anlamlı isimler çekiliyor...');
                                      const synonymsResponse = await fetch(
                                        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${data.aiPredictionData.cid}/synonyms/JSON`,
                                        { 
                                          headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                                          signal: AbortSignal.timeout(10000) // 10 saniye timeout
                                        }
                                      );
                                      if (synonymsResponse.ok) {
                                        const synonymsData = await synonymsResponse.json();
                                        allSynonyms = synonymsData.InformationList?.Information?.[0]?.Synonym || [];
                                        console.log(`✅ ${allSynonyms.length} eş anlamlı isim bulundu`);
                                      }
                                      
                                      // Zorunlu veriler kontrolü
                                      if (!iupacName) {
                                        console.error('❌ IUPAC adı zorunlu ama alınamadı!');
                                        alert('⚠️ IUPAC adı alınamadı. Lütfen tekrar deneyin.');
                                        setIsSearching(false);
                                        setSearchStage('');
                                        return;
                                      }
                                      
                                      if (!molecularFormula) {
                                        console.error('❌ Moleküler formül zorunlu ama alınamadı!');
                                        alert('⚠️ Moleküler formül alınamadı. Lütfen tekrar deneyin.');
                                        setIsSearching(false);
                                        setSearchStage('');
                                        return;
                                      }
                                      
                                    } catch (error) {
                                      console.error('❌ PubChem veri çekme hatası:', error);
                                      alert('⚠️ Molekül bilgileri alınamadı. Lütfen tekrar deneyin.');
                                      setIsSearching(false);
                                      setSearchStage('');
                                      return;
                                    }
                                  }
                                  
                                  // Güncellenmiş aiPredictionData'yı oluştur
                                  const updatedAiPredictionData = {
                                    ...data.aiPredictionData,
                                    iupacName: iupacName, // Zorunlu: PubChem'den çekildi
                                    formula: molecularFormula, // Zorunlu: PubChem'den çekildi
                                    synonyms: allSynonyms, // Tüm eş anlamlı isimler
                                    source: 'PubChem (Verified IUPAC & Formula)'
                                  };
                                  
                                  console.log('✅ AI prediction data güncellendi (IUPAC ve formül eklendi):', updatedAiPredictionData);
                                  setAiPredictionData(updatedAiPredictionData);
                                  onKnownMoleculeChange?.(updatedAiPredictionData); // Ana sayfaya molekül bilgisini gönder
                                  setPubchemResults([]);
                                  setSynonymSuggestions(data.synonymSuggestions || []);
                                } else {
                                  console.log('✅ Sadece synonym\'ler var:', data.synonymSuggestions);
                                  setPubchemResults([]);
                                  setAiPredictionData(null);
                                  setSynonymSuggestions(data.synonymSuggestions || []);
                                }
                              } catch (error) {
                                console.error('❌ PubChem arama hatası:', error);
                                const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
                                if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
                                  alert('⏱️ İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
                                } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
                                  alert('🌐 Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.');
                                } else {
                                  alert(`❌ Arama başarısız oldu: ${errorMessage}`);
                                }
                              } finally {
                                setIsSearching(false);
                                setSearchStage('');
                              }
                            }}
                            className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 text-yellow-100 rounded-full text-sm font-medium transition"
                            title={suggestion.reason}
                          >
                            {suggestion.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* NMR Prediction Options - Kütüphanede olmayan moleküller için */}
                {aiPredictionData && (
                  <div className="mt-3 p-4 bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-700 rounded-lg">
                    <div className="flex items-start gap-3 mb-3">
                      {aiPredictionData.image2D && (
                        <img
                          src={aiPredictionData.image2D}
                          alt={aiPredictionData.moleculeName}
                          className="w-24 h-24 bg-white rounded border border-slate-600"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-white mb-1">{aiPredictionData.moleculeName}</h3>
                        {aiPredictionData.iupacName && aiPredictionData.iupacName !== aiPredictionData.moleculeName && (
                          <p className="text-xs text-blue-300 mb-1">IUPAC: {aiPredictionData.iupacName}</p>
                        )}
                        <p className="text-xs text-slate-300 mb-1">Formula: {aiPredictionData.formula || 'N/A'}</p>
                        {aiPredictionData.literature && aiPredictionData.literature.length > 0 && (
                          <button
                            onClick={() => setShowLiterature(!showLiterature)}
                            className="text-xs text-purple-300 hover:text-purple-200 underline cursor-pointer mt-1"
                          >
                            📚 {aiPredictionData.literature.length} bilimsel makale bulundu {showLiterature ? '▼' : '▶'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Literature Links Section */}
                    {showLiterature && aiPredictionData.literature && aiPredictionData.literature.length > 0 && (
                      <div className="mb-3 bg-slate-800/70 rounded p-3 border border-purple-600/30">
                        <h4 className="text-xs font-semibold text-purple-300 mb-2">📚 Bilimsel Makaleler</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {aiPredictionData.literature.map((article: { doi: string; title: string; url: string }, idx: number) => (
                            <div key={idx} className="bg-slate-900/50 rounded p-2 text-xs">
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:text-blue-200 font-medium line-clamp-2 mb-1 block"
                              >
                                {article.title}
                              </a>
                              <p className="text-slate-400 text-[10px] font-mono">DOI: {article.doi}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enhanced Library kontrolü */}
                    {(() => {
                      // Enhanced Library kontrolü: localStorage'den kontrol et
                      const storedMolecule = typeof window !== 'undefined' 
                        ? localStorage.getItem('spectromind_known_molecule') 
                        : null;
                      const hasEnhancedLibrary = storedMolecule 
                        ? (() => {
                            try {
                              const parsed = JSON.parse(storedMolecule);
                              return parsed.enhancedLibrary === true && parsed.enhancedLibraryData;
                            } catch {
                              return false;
                            }
                          })()
                        : false;
                      
                      if (hasEnhancedLibrary) {
                        const parsed = JSON.parse(storedMolecule!);
                        const enhancedData = parsed.enhancedLibraryData;
                        const nmrCount = enhancedData?.nmrAnalysis?.peaks?.length || enhancedData?.nmrPeaks?.length || 0;
                        const c13Count = enhancedData?.c13Analysis?.peaks?.length || 0;
                        const ftirCount = enhancedData?.ftirAnalysis?.peaks?.length || 0;
                        const totalCount = nmrCount + c13Count + ftirCount;
                        
                        return (
                          <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-600/50 rounded p-2 mb-3 text-xs text-slate-200">
                            <p className="font-semibold text-green-300 mb-1">✅ Kütüphanede spektral veri var</p>
                            <p className="mb-2">Bu molekül için Enhanced Library'de detaylı spektral veriler mevcut:</p>
                            <div className="space-y-1 text-[10px]">
                              {nmrCount > 0 && <p>• ¹H NMR: {nmrCount} peak</p>}
                              {c13Count > 0 && <p>• ¹³C NMR: {c13Count} peak</p>}
                              {ftirCount > 0 && <p>• FTIR: {ftirCount} peak</p>}
                            </div>
                            <p className="mt-2 text-green-400 font-semibold">Tüm veriler otomatik olarak yüklendi. "AI ile Analiz Et" butonuna tıklayabilirsiniz.</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-slate-800/50 rounded p-2 mb-3 text-xs text-slate-300">
                          <p className="font-semibold text-yellow-400 mb-1">⚠️ Kütüphanede NMR verisi yok</p>
                          <p>Bu molekül için deneysel NMR verisi bulunamadı. Aşağıdaki yöntemlerle tahmin yapabilirsiniz:</p>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      {/* HOSE Prediction */}
                      {aiPredictionData.predictionMethods?.hose && (
                        <button
                          onClick={runHOSEPrediction}
                          disabled={isAiPredicting}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2"
                        >
                          <span>⚡</span>
                          HOSE Predictor (Hızlı, Offline)
                        </button>
                      )}

                      {/* AI Prediction */}
                      {aiPredictionData.predictionMethods?.ai && (
                        <button
                          onClick={runAIPrediction}
                          disabled={isAiPredicting}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-bold transition flex items-center justify-center gap-2"
                        >
                          {isAiPredicting ? (
                            <>
                              <span className="animate-spin">⏳</span>
                              Tahmin yapılıyor...
                            </>
                          ) : (
                            <>
                              <span>🤖</span>
                              AI + Literatür (Daha Detaylı)
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-400 space-y-1">
                      <p>• <strong>HOSE:</strong> RDKit tabanlı, sadece chemical shift</p>
                      <p>• <strong>AI:</strong> GPT-4 + literatür, shift + multiplicity</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500">
                    💡 İpucu: Molekül ismini (örn: "Ethanol") veya formülü (örn: "C2H6O") girebilirsiniz
                  </p>
                  <p className="text-xs text-slate-500">
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">⌘E</kbd> veya <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl+E</kbd> ile aç | <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">ESC</kbd> ile kapat
                  </p>
                </div>
              </div>

              {/* Sonuçlar */}
              <div className="flex-1 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm text-slate-400 animate-pulse">{searchStage}</p>
                    </div>
                  </div>
                ) : pubchemResults.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    {searchQuery ? 'Sonuç bulunamadı. Farklı bir arama deneyin.' : 'Molekül aramak için yukarıdaki kutuyu kullanın'}
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-3 text-slate-400 text-sm font-semibold">
                      {pubchemResults.filter((mol) => {
                        // ✅ Sadece spektral verisi olan molekülleri say
                        const enhancedData = (mol as any).enhancedLibraryData;
                        const spectralDataCount = (mol as any).spectralDataCount || 0;
                        const hasNMR = enhancedData?.nmrAnalysis || enhancedData?.nmrPeaks || (mol as any).nmrData;
                        const hasC13 = enhancedData?.c13Analysis;
                        const hasFTIR = enhancedData?.ftirAnalysis;
                        const hasNMRShiftDB = (mol as any).nmrData && Array.isArray((mol as any).nmrData) && (mol as any).nmrData.length > 0;
                        const hasPubChemNMR = (mol as any).hasNMR === true;
                        const hasPubChemC13 = (mol as any).hasC13 === true;
                        const hasPubChemFTIR = (mol as any).hasFTIR === true;
                        return spectralDataCount > 0 || hasNMR || hasC13 || hasFTIR || hasNMRShiftDB || hasPubChemNMR || hasPubChemC13 || hasPubChemFTIR;
                      }).length} molekül bulundu
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pubchemResults
                        .filter((mol) => {
                          // ✅ SADECE SPEKTRAL VERİSİ OLAN MOLEKÜLLERİ GÖSTER
                          const enhancedData = (mol as any).enhancedLibraryData;
                          const spectralDataCount = (mol as any).spectralDataCount || 0;
                          const hasNMR = enhancedData?.nmrAnalysis || enhancedData?.nmrPeaks || (mol as any).nmrData;
                          const hasC13 = enhancedData?.c13Analysis;
                          const hasFTIR = enhancedData?.ftirAnalysis;
                          const hasNMRShiftDB = (mol as any).nmrData && Array.isArray((mol as any).nmrData) && (mol as any).nmrData.length > 0;
                          const hasPubChemNMR = (mol as any).hasNMR === true;
                          const hasPubChemC13 = (mol as any).hasC13 === true;
                          const hasPubChemFTIR = (mol as any).hasFTIR === true;
                          
                          // Spektral veri varsa göster (tüm kaynaklardan)
                          return spectralDataCount > 0 || hasNMR || hasC13 || hasFTIR || hasNMRShiftDB || hasPubChemNMR || hasPubChemC13 || hasPubChemFTIR;
                        })
                        .map((mol, index) => {
                          const isEnhancedLibrary = (mol as any).priority === true || (mol as any).enhancedLibraryData;
                          const enhancedData = (mol as any).enhancedLibraryData;
                          const spectralDataCount = (mol as any).spectralDataCount || 0;
                          
                          // ✅ SPEKTRAL VERİ TÜRLERİNİ BELİRLE
                          // Enhanced Library'den
                          const hasNMR = enhancedData?.nmrAnalysis || enhancedData?.nmrPeaks;
                          const hasC13 = enhancedData?.c13Analysis;
                          const hasFTIR = enhancedData?.ftirAnalysis;
                          
                          // NMRShiftDB2'den (PubChem route'undan gelen)
                          const hasNMRShiftDB = (mol as any).nmrData && Array.isArray((mol as any).nmrData) && (mol as any).nmrData.length > 0;
                          
                          // PubChem'den (route'dan gelen)
                          const hasPubChemNMR = (mol as any).hasNMR === true;
                          const hasPubChemC13 = (mol as any).hasC13 === true;
                          const hasPubChemFTIR = (mol as any).hasFTIR === true;
                          
                          // ✅ Toplam spektral veri sayısı (tüm kaynaklardan)
                          let totalSpectralCount = spectralDataCount;
                          if (!totalSpectralCount) {
                            totalSpectralCount = 
                              (hasNMR || hasNMRShiftDB || hasPubChemNMR ? 1 : 0) + 
                              (hasC13 || hasPubChemC13 ? 1 : 0) + 
                              (hasFTIR || hasPubChemFTIR ? 1 : 0);
                          }
                          
                          // ✅ Final spektral veri türleri (tüm kaynaklardan birleştir)
                          const finalHasNMR = hasNMR || hasNMRShiftDB || hasPubChemNMR;
                          const finalHasC13 = hasC13 || hasPubChemC13;
                          const finalHasFTIR = hasFTIR || hasPubChemFTIR;
                          
                          // ✅ Unique key: CID + name + index (duplicate key hatasını önlemek için)
                          const uniqueKey = `mol_${mol.cid}_${mol.name?.replace(/\s+/g, '_') || 'unknown'}_${index}`;
                          
                          return (
                          <button
                            key={uniqueKey}
                            onClick={() => loadFromPubChem(mol)}
                            disabled={loadingMoleculeId !== null}
                            className={`text-left p-4 border-2 rounded-lg transition group relative ${
                              isEnhancedLibrary
                                ? 'bg-gradient-to-br from-purple-900/40 to-purple-800/30 hover:from-purple-800/50 hover:to-purple-700/40 border-purple-500 hover:border-purple-400 shadow-lg shadow-purple-900/20'
                                : 'bg-slate-800 hover:bg-emerald-700 border-slate-700 hover:border-emerald-500'
                            } ${loadingMoleculeId === mol.cid ? 'opacity-75 cursor-wait' : ''} ${loadingMoleculeId !== null && loadingMoleculeId !== mol.cid ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {loadingMoleculeId === mol.cid && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-lg z-10">
                                <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                              </div>
                            )}
                            
                            {/* Enhanced Library Badge */}
                            {isEnhancedLibrary && (
                              <div className="absolute top-2 right-2 flex items-center gap-1">
                                <span className="text-xs px-2 py-1 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-full font-bold shadow-md flex items-center gap-1">
                                  <span className="text-yellow-300">✨</span>
                                  <span>Kütüphane</span>
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-bold text-base text-white group-hover:text-emerald-100 pr-16">
                                {mol.name}
                              </div>
                            </div>
                            
                            {/* ✅ MOLEKÜL FORMÜLÜ - Her zaman göster */}
                            {mol.formula && (
                              <div className="text-xs text-slate-300 group-hover:text-emerald-200 mb-2 font-medium">
                                {mol.formula}
                              </div>
                            )}
                            
                            {/* ✅ CID - Her zaman göster */}
                            <div className="text-xs text-slate-400 group-hover:text-slate-300 mb-3">
                              CID: {mol.cid}
                              {mol.usageCount && ` • ${mol.usageCount}x kullanıldı`}
                            </div>
                            
                            {/* ✅ SPEKTRAL VERİ TÜRLERİ - Tüm moleküller için göster */}
                            {(finalHasNMR || finalHasC13 || finalHasFTIR) && (
                              <div className="mt-2 pt-2 border-t border-purple-700/50">
                                {/* Spektral Veri Button'ları - Görseldeki gibi */}
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {finalHasNMR && (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className="text-xs px-2.5 py-1 bg-blue-600/40 hover:bg-blue-600/60 text-blue-200 rounded-md border border-blue-500/50 font-semibold transition cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // 1H NMR spektrumunu yükle
                                        loadFromPubChem(mol);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          loadFromPubChem(mol);
                                        }
                                      }}
                                    >
                                      ¹H NMR
                                    </div>
                                  )}
                                  {finalHasC13 && (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className="text-xs px-2.5 py-1 bg-green-600/40 hover:bg-green-600/60 text-green-200 rounded-md border border-green-500/50 font-semibold transition cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // 13C NMR spektrumunu yükle
                                        loadFromPubChem(mol);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          loadFromPubChem(mol);
                                        }
                                      }}
                                    >
                                      ¹³C NMR
                                    </div>
                                  )}
                                  {finalHasFTIR && (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className="text-xs px-2.5 py-1 bg-orange-600/40 hover:bg-orange-600/60 text-orange-200 rounded-md border border-orange-500/50 font-semibold transition cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // FTIR spektrumunu yükle
                                        loadFromPubChem(mol);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          loadFromPubChem(mol);
                                        }
                                      }}
                                    >
                                      FTIR
                                    </div>
                                  )}
                                </div>
                                {/* Spektrum sayısı - Görseldeki gibi */}
                                <div className="text-xs text-purple-300 font-semibold">
                                  {totalSpectralCount} spektrum mevcut
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toplu Veri Girişi Textarea ve Butonlar - Her zaman görünür */}
      <div className="mt-3">
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={spectrumType === 'c13'
            ? "198.1 ppm\n137.0 ppm\n133.0 ppm\n128.5 ppm"
            : spectrumType === 'ftir'
            ? "1754 cm⁻¹ (strong)\n1715 cm⁻¹ (medium)\n1600 cm⁻¹ (weak)"
            : "10.50: s (1H)\n8.50: s (1H)\n7.12: d (1H)"}
          className="w-full bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded text-xs @sm:text-sm @lg:text-base font-mono min-h-[80px] resize-none focus:border-purple-500 focus:outline-none"
          spellCheck={false}
        />

        {/* Parsed Peaks Preview */}
        {parsedPeaksPreview.length > 0 && (
        <div className="mt-2 bg-slate-800/50 border border-slate-600 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] @sm:text-xs text-slate-400 font-semibold">
              📋 Tespit Edilen Peak'ler ({parsedPeaksPreview.length})
            </span>
          </div>
          <div className="space-y-0.5">
            {parsedPeaksPreview.map((peak, idx) => {
              if (spectrumType === 'c13') {
                const c13Peak = peak as Carbon13Peak;
                // ✅ Safety check: ppm might be undefined
                const ppm = c13Peak?.ppm ?? (c13Peak as any)?.shift ?? 0;
                if (ppm === 0 || isNaN(ppm)) {
                  return null; // Skip invalid peaks
                }
                return (
                  <div
                    key={idx}
                    className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-700/50 px-2 py-0.5 rounded"
                  >
                    δ {ppm.toFixed(1)} ppm
                  </div>
                );
              } else if (spectrumType === 'ftir') {
                const ftirPeak = peak as any; // FTIRPeak or any format
                const wavenumber = ftirPeak?.wavenumber || ftirPeak?.frequency || ftirPeak?.position || 0;
                const intensity = ftirPeak?.intensity || ftirPeak?.int || 'medium';
                const assignment = ftirPeak?.assignment || ftirPeak?.label || '';

                // ✅ Safety check: wavenumber must be valid
                if (!wavenumber || wavenumber === 0 || isNaN(wavenumber)) {
                  return null; // Skip invalid peaks
                }

                return (
                  <div
                    key={idx}
                    className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-700/50 px-2 py-0.5 rounded"
                  >
                    {wavenumber.toFixed(0)} cm⁻¹ ({intensity})
                    {assignment && <span className="text-purple-400 ml-1">→ {assignment}</span>}
                  </div>
                );
              } else {
                const nmrPeak = peak as NMRPeak;
                // ✅ Safety check: shift might be undefined
                const shift = nmrPeak?.shift ?? 0;
                if (shift === 0 || isNaN(shift)) {
                  return null; // Skip invalid peaks
                }
                return (
                  <div
                    key={idx}
                    className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-700/50 px-2 py-0.5 rounded"
                  >
                    δ {shift.toFixed(2)} ({nmrPeak?.mult || 's'}, {nmrPeak?.integ || 1}H)
                  </div>
                );
              }
            })}
          </div>
        </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            onClick={parseBulkInput}
            disabled={!bulkText.trim()}
            className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs @sm:text-sm @lg:text-base font-bold transition"
          >
            📥 Peak'leri Ekle
          </button>
          <button
            onClick={() => setBulkText('')}
            disabled={!bulkText.trim()}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

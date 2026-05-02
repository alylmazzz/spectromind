'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AuthorityBadge from '@/components/common/AuthorityBadge';

interface Molecule3DViewerProps {
  cid?: number;
  smiles?: string;
  moleculeName: string;
}

// ✅ Cache key generator
const getCacheKey = (cid?: number, smiles?: string): string | null => {
  if (cid) return `sdf3d_cid_${cid}`;
  if (smiles) {
    // SMILES'tan güvenli cache key oluştur
    const safeKey = smiles.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    return `sdf3d_smiles_${safeKey}`;
  }
  return null;
};

export default function Molecule3DViewer({ cid, smiles, moleculeName }: Molecule3DViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sdfData, setSdfData] = useState<string | null>(null);
  const [has3DData, setHas3DData] = useState(false);
  const [authorityLabel, setAuthorityLabel] = useState('AUTHORITATIVE_RDKIT_3D');

  // ✅ 3D Viewer'ı yükle
  const load3DViewer = useCallback(async (sdfContent: string) => {
    if (!viewerRef.current) return;

    try {
      const module = await import('3dmol');
      const $3Dmol = module.default || module;
      
      // Eğer viewer zaten varsa temizle
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.clear();
      }
      
      const viewer = $3Dmol.createViewer(viewerRef.current as any, {
        backgroundColor: 'white',
      } as any);
      
      viewerInstanceRef.current = viewer;

      viewer.addModel(sdfContent, 'sdf');
      viewer.setStyle({}, {
        stick: {
          colorscheme: 'Jmol',
          radius: 0.15,
          multibond: true,
          bondScale: 0.3
        } as any,
        sphere: {
          colorscheme: 'Jmol',
          scale: 0.25
        }
      });
      (viewer as any).setBackgroundColor('white');
      (viewer as any).zoomTo();
      viewer.render();
      setHas3DData(true);
      setLoading(false);
    } catch (err) {
      console.error('3D viewer yükleme hatası:', err);
      setError(true);
      setLoading(false);
    }
  }, []);

  // ✅ PubChem'den 3D SDF yükle
  const load3DDataFromPubChem = useCallback(async (pubchemCid: number) => {
    try {
      setLoading(true);
      const sdfURL = `/api/pubchem/structure?cid=${pubchemCid}&type=3d-sdf`;
      
      const response = await fetch(sdfURL);
      if (response.ok) {
        const sdfContent = await response.text();
        // Cache'e kaydet
        const cacheKey = getCacheKey(pubchemCid);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              sdf: sdfContent,
              timestamp: Date.now(),
              source: 'pubchem',
              cid: pubchemCid
            }));
            console.log(`✅ 3D SDF cache'e kaydedildi: ${cacheKey}`);
          } catch (cacheErr) {
            console.warn('⚠️ Cache kaydetme hatası:', cacheErr);
          }
        }
        setSdfData(sdfContent);
        setAuthorityLabel('DISPLAY_ONLY_FALLBACK (PubChem)');
        await load3DViewer(sdfContent);
      } else {
        throw new Error('PubChem SDF not available');
      }
    } catch (err) {
      console.warn('⚠️ PubChem 3D SDF yüklenemedi, SMILES fallback deneniyor...', err);
      // ✅ FALLBACK: SMILES varsa RDKit ile 3D SDF oluştur
      if (smiles) {
        await load3DDataFromSMILES(smiles);
      } else {
        setError(true);
        setLoading(false);
      }
    }
  }, [smiles, load3DViewer]);

  // ✅ SMILES'tan 3D SDF oluştur
  const load3DDataFromSMILES = useCallback(async (smilesString: string) => {
    try {
      setLoading(true);
      
      // ✅ SMILES düzeltmesi: "0" (sıfır) yerine "O" (oksijen) olmalı
      let correctedSmiles = smilesString;
      if (smilesString.includes('0')) {
        correctedSmiles = smilesString.replace(/([A-Za-z\)])0([\)\s]|$)/g, '$1O$2');
        if (correctedSmiles.includes('0') && !correctedSmiles.match(/\d0\d/)) {
          correctedSmiles = correctedSmiles.replace(/0/g, 'O');
        }
        if (correctedSmiles !== smilesString) {
          console.warn(`⚠️ SMILES düzeltmesi (3D): "${smilesString}" → "${correctedSmiles}"`);
        }
      }
      
      const response = await fetch('/api/rdkit/generate-sdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: correctedSmiles })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorText = errorData.error || `RDKit SDF generation failed (HTTP ${response.status})`;
        
        // RDKit modül hatasını özel olarak yakala
        if (errorText.includes('RDKit modülü bulunamadı') || 
            errorText.includes('No module named') ||
            errorText.includes('rdkit')) {
          throw new Error('RDKit modülü bulunamadı. Lütfen virtual environment kurun.');
        }
        
        throw new Error(errorText);
      }
      
      const data = await response.json();
      if (data.success && data.sdf) {
        // Cache'e kaydet
        const cacheKey = getCacheKey(undefined, correctedSmiles);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              sdf: data.sdf,
              timestamp: Date.now(),
              source: 'rdkit',
              smiles: correctedSmiles
            }));
            console.log(`✅ 3D SDF cache'e kaydedildi: ${cacheKey}`);
          } catch (cacheErr) {
            console.warn('⚠️ Cache kaydetme hatası:', cacheErr);
          }
        }
        setSdfData(data.sdf);
        setAuthorityLabel('AUTHORITATIVE_RDKIT_3D');
        await load3DViewer(data.sdf);
      } else {
        throw new Error(data.error || 'No SDF returned');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // RDKit modül hatası için özel mesaj
      if (errorMessage.includes('RDKit modülü bulunamadı') || 
          errorMessage.includes('No module named') ||
          errorMessage.includes('rdkit')) {
        // Console'da sadece warning göster (error değil - daha az rahatsız edici)
        console.warn('⚠️ RDKit modülü bulunamadı. 3D yapı oluşturulamıyor.');
        console.warn('   💡 Kurulum için: python -m venv venv_rdkit && venv_rdkit\\Scripts\\activate && pip install rdkit-pypi');
        // Kullanıcıya daha friendly mesaj göster
        setError(true);
        setErrorMsg('RDKit modülü bulunamadı. Virtual environment kurulumu gerekli.');
      } else {
        // Diğer hatalar için sadece warning (console.error yerine - daha az rahatsız edici)
        console.warn('⚠️ 3D SDF oluşturma hatası:', errorMessage.substring(0, 100));
        setError(true);
        setErrorMsg('3D yapı oluşturulamadı. PubChem Viewer\'ı kullanabilirsiniz.');
      }
      setLoading(false);
    }
  }, [load3DViewer]);

  useEffect(() => {
    if (!viewerRef.current) return;
    if (!cid && !smiles) {
      setError(true);
      setLoading(false);
      return;
    }

    // ✅ ÖNCELİK 0: Cache'den kontrol et
    const cacheKey = getCacheKey(cid, smiles);
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          // Cache geçerliliğini kontrol et (7 gün)
          const cacheAge = Date.now() - cachedData.timestamp;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 gün
          
          if (cacheAge < maxAge && cachedData.sdf) {
            console.log(`✅ Cache'den 3D SDF yüklendi (${cacheKey})`);
            setSdfData(cachedData.sdf);
            setHas3DData(true);
            setLoading(false);
            // Viewer'ı başlat
            load3DViewer(cachedData.sdf);
            return;
          } else {
            // Eski cache'i temizle
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (err) {
        console.warn('⚠️ Cache okuma hatası:', err);
      }
    }

    // Authoritative path: always prefer server-side RDKit 3D generation.
    if (smiles) {
      load3DDataFromSMILES(smiles);
    } else if (cid) {
      load3DDataFromPubChem(cid);
    }

    // Cleanup
    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.clear();
        viewerInstanceRef.current = null;
      }
    };
  }, [cid, smiles, load3DViewer, load3DDataFromPubChem, load3DDataFromSMILES]);

  // ✅ SDF indirme fonksiyonu
  const downloadSDF = useCallback(() => {
    if (!sdfData) return;
    
    const blob = new Blob([sdfData], { type: 'chemical/x-mdl-sdfile' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moleculeName.replace(/\s+/g, '_')}_3D.sdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`✅ 3D SDF indirildi: ${a.download}`);
  }, [sdfData, moleculeName]);

  if (error) {
    return (
      <div className="bg-yellow-900/40 border border-yellow-500 rounded px-4 py-3 text-yellow-200 text-sm">
        <div className="font-semibold mb-2">⚠️ 3D yapı yüklenemedi</div>
        {errorMsg ? (
          <div className="text-xs mb-2">{errorMsg}</div>
        ) : (
          <div className="text-xs mb-2">Lütfen PubChem Viewer'ı kullanın.</div>
        )}
        {errorMsg && errorMsg.includes('RDKit') && (
          <div className="text-xs mt-2 p-2 bg-yellow-800/50 rounded">
            <strong>Kurulum:</strong>
            <pre className="mt-1 text-xs font-mono">
{`python -m venv venv_rdkit
venv_rdkit\\Scripts\\activate
pip install rdkit-pypi`}</pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
          <div className="text-purple-600 font-semibold">3D yapı yükleniyor...</div>
        </div>
      )}
      <div
        ref={viewerRef}
        className="w-full h-96 rounded-lg border-2 border-slate-700 bg-white"
        style={{ minHeight: '400px' }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <div className="text-center flex-1">
          🖱️ Fare ile döndürün • Tekerlek ile yakınlaştırın
        </div>
        {sdfData && (
          <button
            onClick={downloadSDF}
            className="ml-4 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors"
            title="3D SDF dosyasını indir"
          >
            📥 SDF İndir
          </button>
        )}
      </div>
      {has3DData && sdfData && (
        <div className="mt-2 text-xs text-green-400 text-center">
          ✅ 3D yapı yüklendi
          <div className="mt-1">
            <AuthorityBadge
              label={authorityLabel}
              tone={authorityLabel.startsWith('AUTHORITATIVE') ? 'authoritative' : 'fallback'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import AuthorityBadge from '@/components/common/AuthorityBadge';

interface Molecule2DViewerProps {
  smiles: string;
  moleculeName: string;
  width?: number;
  height?: number;
  showAtomNumbers?: boolean;
  /** PubChem CID — RDKit çizimi başarısız olursa otorite 2D için PubChem PNG kullanılır */
  cid?: number;
}

export default function Molecule2DViewer({
  smiles,
  moleculeName,
  width = 400,
  height = 300,
  showAtomNumbers = false,
  cid,
}: Molecule2DViewerProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorityLabel, setAuthorityLabel] = useState<string>('AUTHORITATIVE_RDKIT_2D');
  const [usePubChemImg, setUsePubChemImg] = useState(false);

  useEffect(() => {
    const run = async () => {
      setUsePubChemImg(false);
      setError(null);
      setSvgContent(null);

      if (!smiles?.trim() && cid && cid > 0) {
        setAuthorityLabel('AUTHORITATIVE_OBSERVED_PUBCHEM_2D');
        setUsePubChemImg(true);
        setLoading(false);
        return;
      }

      if (!smiles?.trim()) {
        setError('SMILES verilmedi');
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch('/api/rdkit/draw-2d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles, width, height, showAtomNumbers }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success || !data?.svg) {
          throw new Error(data?.error || 'Server-side RDKit çizimi başarısız');
        }
        setSvgContent(data.svg);
        setAuthorityLabel('AUTHORITATIVE_RDKIT_2D');
      } catch {
        try {
          const dynamicImport = new Function('m', 'return import(m)') as (moduleName: string) => Promise<{ default: () => Promise<any> }>;
          const rdkitModule = await dynamicImport('@rdkit/rdkit');
          const rdkit = await rdkitModule.default();
          const mol = rdkit.get_mol(smiles);
          const svg = mol.get_svg_with_highlights(JSON.stringify({ width, height }));
          mol.delete();
          setSvgContent(svg);
          setAuthorityLabel('DISPLAY_ONLY_FALLBACK (RDKit.js)');
        } catch {
          if (cid && cid > 0) {
            setSvgContent(null);
            setUsePubChemImg(true);
            setAuthorityLabel('AUTHORITATIVE_OBSERVED_PUBCHEM_2D');
          } else {
            setSvgContent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
              <rect width="100%" height="100%" fill="#fff" stroke="#64748b" />
              <text x="50%" y="45%" text-anchor="middle" fill="#334155" font-size="12">Display-only fallback graph</text>
              <text x="50%" y="60%" text-anchor="middle" fill="#475569" font-size="10">Authoritative RDKit depiction unavailable</text>
            </svg>`
            );
            setAuthorityLabel('DISPLAY_ONLY_FALLBACK');
          }
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [smiles, width, height, showAtomNumbers, cid]);

  if (error && !svgContent && !usePubChemImg) {
    return (
      <div className="bg-yellow-900/40 border border-yellow-500 rounded px-4 py-3 text-yellow-200 text-sm">
        ⚠️ 2D yapı yüklenemedi: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-white/10 rounded-lg border-2 border-slate-700" style={{ width, height }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-400 text-sm">2D yapı çiziliyor...</p>
        </div>
      </div>
    );
  }

  if (usePubChemImg && cid && cid > 0) {
    return (
      <div className="flex flex-col items-center">
        <div
          className="bg-white rounded-lg border-2 border-slate-700 p-2 flex items-center justify-center"
          style={{ width: width + 20, height: height + 20 }}
        >
          <img
            src={`/api/pubchem/structure?cid=${cid}&type=2d-png`}
            alt={`${moleculeName} — PubChem 2D`}
            className="max-w-full max-h-full object-contain"
            style={{ maxWidth: width, maxHeight: height }}
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              if (!el.dataset.fallbackAttempted) {
                el.dataset.fallbackAttempted = '1';
                el.src = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=${width}x${height}`;
              }
            }}
          />
        </div>
        <div className="mt-2 text-xs text-slate-400 text-center">
          2D Kimyasal Yapı: {moleculeName}
        </div>
        <div className="mt-1">
          <AuthorityBadge
            label={authorityLabel}
            tone="authoritative"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-white rounded-lg border-2 border-slate-700 p-2"
        style={{ width: width + 20, height: height + 20 }}
        dangerouslySetInnerHTML={{ __html: svgContent || '' }}
      />
      <div className="mt-2 text-xs text-slate-400 text-center">
        2D Kimyasal Yapı: {moleculeName}
      </div>
      <div className="mt-1">
        <AuthorityBadge
          label={authorityLabel}
          tone={authorityLabel.startsWith('AUTHORITATIVE') ? 'authoritative' : 'fallback'}
        />
      </div>
    </div>
  );
}

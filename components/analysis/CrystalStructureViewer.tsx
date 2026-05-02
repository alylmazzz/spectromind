'use client';

import { useEffect, useRef, useState } from 'react';

interface CrystalStructureViewerProps {
  cid: number;
  moleculeName: string;
}

/**
 * CrystalStructureViewer Component
 * Displays crystal structure from PubChem using 3Dmol.js
 */
export default function CrystalStructureViewer({ cid, moleculeName }: CrystalStructureViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!viewerRef.current) return;

    // Dynamically import 3dmol only on client side
    import('3dmol').then((module) => {
      const $3Dmol = module.default || module;
      const viewer = $3Dmol.createViewer(viewerRef.current as any, {
        backgroundColor: 'white',
      } as any);

      // Fetch crystal structure SDF from our API proxy
      const crystalURL = `/api/pubchem/structure?cid=${cid}&type=crystal`;

      fetch(crystalURL)
        .then(response => {
          if (!response.ok) {
            if (response.status === 404) {
              setAvailable(false);
              setLoading(false);
              return null;
            }
            throw new Error('Crystal structure not available');
          }
          return response.text();
        })
        .then(sdfData => {
          if (!sdfData) {
            setAvailable(false);
            setLoading(false);
            return;
          }

          // Add molecule from SDF
          viewer.addModel(sdfData, 'sdf');

          // Set style for crystal structure (ball-and-stick with unit cell)
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

          // Set background to white
          (viewer as any).setBackgroundColor('white');

          // Auto-zoom to fit molecule
          (viewer as any).zoomTo();

          // Render with antialiasing
          viewer.render();

          setLoading(false);
        })
        .catch(err => {
          console.error('Crystal structure viewer error:', err);
          setError(true);
          setLoading(false);
        });
    }).catch(err => {
      console.error('3dmol import error:', err);
      setError(true);
      setLoading(false);
    });
  }, [cid]);

  if (error) {
    return (
      <div className="bg-yellow-900/40 border border-yellow-500 rounded px-4 py-3 text-yellow-200 text-sm">
        ⚠️ Kristal yapı yüklenemedi.
      </div>
    );
  }

  if (!available) {
    return (
      <div className="bg-slate-800/50 border border-slate-600 rounded px-4 py-3 text-slate-400 text-sm text-center">
        ℹ️ Bu molekül için kristal yapı verisi mevcut değil.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-white/10 rounded-lg border-2 border-slate-700" style={{ height: '400px' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-400 text-sm">Kristal yapı yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={viewerRef}
        className="w-full rounded-lg border-2 border-blue-500 bg-white"
        style={{ height: '400px', minHeight: '400px' }}
      />
      <p className="text-xs text-slate-400 mt-2 text-center">
        💎 Kristal Yapı: {moleculeName} (CID: {cid})
      </p>
    </div>
  );
}


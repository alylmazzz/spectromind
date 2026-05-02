'use client';

import { useState } from 'react';
import { MULTIPLET_SKEWING_INFO } from '@/lib/data/spectralAnalysisBoxes';

export default function MultipletSkewingInfo() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500 rounded p-2 space-y-1.5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <span className="text-xs @sm:text-sm @lg:text-base font-bold text-indigo-300">
            Multiplet Skewing (Roof Effect)
          </span>
        </div>
        <span className="text-indigo-400 text-xs @sm:text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 text-[10px] @sm:text-xs text-slate-300">
          {/* Description */}
          <div className="bg-slate-900/50 p-2 rounded">
            <div className="font-semibold text-indigo-300 mb-1">What is it?</div>
            <div>{MULTIPLET_SKEWING_INFO.description}</div>
          </div>

          {/* Visual Example */}
          <div className="bg-slate-900/50 p-2 rounded">
            <div className="font-semibold text-indigo-300 mb-1">Visual Example:</div>
            <pre className="font-mono text-yellow-300 whitespace-pre-wrap">
{MULTIPLET_SKEWING_INFO.visualExample}
            </pre>
          </div>

          {/* Diagnostic Value */}
          <div className="bg-slate-900/50 p-2 rounded">
            <div className="font-semibold text-indigo-300 mb-1">How to use it:</div>
            <pre className="whitespace-pre-wrap">
{MULTIPLET_SKEWING_INFO.diagnosticValue}
            </pre>
          </div>

          {/* Real Example */}
          <div className="bg-green-900/30 border border-green-500 p-2 rounded">
            <div className="font-semibold text-green-300 mb-1">Real Example: Ethanol</div>
            <div className="space-y-1">
              <div>CH₃-CH₂-OH</div>
              <div className="text-slate-400">
                • δ 1.2 ppm: CH₃ triplet <span className="text-yellow-300">/|\</span> → leans toward 3.7 ppm
              </div>
              <div className="text-slate-400">
                • δ 3.7 ppm: CH₂ quartet <span className="text-yellow-300">/|\</span> ← leans toward 1.2 ppm
              </div>
              <div className="text-green-300 mt-1">
                → The triplet and quartet point at each other, confirming CH₃-CH₂ coupling!
              </div>
            </div>
          </div>

          {/* Note for users */}
          <div className="bg-blue-900/30 border border-blue-500 p-2 rounded text-blue-200">
            <span className="font-semibold">💡 Note:</span> While SpectroMind doesn't visualize
            multiplet skewing, the AI analysis considers this phenomenon when determining molecular
            structure and connectivity. Skewing helps identify which protons are neighbors in the structure.
          </div>
        </div>
      )}
    </div>
  );
}

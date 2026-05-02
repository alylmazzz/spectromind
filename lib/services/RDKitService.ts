/**
 * RDKitService
 * Extracted from page.tsx lines 470-525
 *
 * Handles RDKit structure elucidation API calls
 */

import type { NMRPeak } from '@/lib/types';

export interface RDKitElucidationOptions {
  peaks: NMRPeak[];
  formula: string;
}

export interface RDKitCandidate {
  name: string;
  smiles: string;
  iupac: string;
  formula: string;
  score: number;
}

export interface RDKitFragment {
  type: string;
  reasoning: string;
}

export interface RDKitResult {
  success: boolean;
  best?: RDKitCandidate;
  candidates?: RDKitCandidate[];
  fragments?: RDKitFragment[];
  error?: string;
  context?: string; // AI context string
}

export class RDKitService {

  /**
   * Run RDKit structure elucidation
   */
  async elucidate(options: RDKitElucidationOptions): Promise<RDKitResult> {
    const { peaks, formula } = options;

    try {
      const response = await fetch('/api/rdkit/elucidation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peaks: peaks.map(p => ({
            shift: p.shift,
            integ: p.integ || 1,
            mult: p.mult,
            coupling: p.coupling
          })),
          formula
        })
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'RDKit API request failed'
        };
      }

      const data = await response.json();

      if (!data.success || !data.best) {
        return {
          success: false,
          error: data.error || 'RDKit could not find candidate molecules'
        };
      }

      // Generate AI context from RDKit result
      const context = this.generateAIContext(data);

      return {
        success: true,
        best: data.best,
        candidates: data.candidates,
        fragments: data.fragments,
        context
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'RDKit API error - Python or RDKit may not be installed'
      };
    }
  }

  /**
   * Generate AI context string from RDKit result
   */
  private generateAIContext(rdkitResult: any): string {
    if (!rdkitResult.success || !rdkitResult.best) {
      return '';
    }

    const fragmentsList = rdkitResult.fragments
      ?.map((f: any, i: number) => `${i + 1}. ${f.type}: ${f.reasoning}`)
      .join('\n') || '';

    return `\n\n🧪 **RDKIT STRUCTURE ELUCIDATION SONUCU:**

📌 En Olası Molekül: "${rdkitResult.best.name}"
📐 SMILES: ${rdkitResult.best.smiles}
🔤 IUPAC Adı: ${rdkitResult.best.iupac}
🧪 Moleküler Formül: ${rdkitResult.best.formula}
📊 Güven Skoru: ${rdkitResult.best.score.toFixed(1)}/100

🧩 Tespit Edilen Moleküler Parçalar:
${fragmentsList}

⚠️ **SENİN GÖREVİN:**
1. RDKit'in önerdiği "${rdkitResult.best.name}" molekülünü değerlendir
2. SMILES kodunu ve formülü kontrol et
3. Peak'lerle uyumluluğunu analiz et
4. Eğer RDKit doğruysa, detaylı NMR analizini YAP
5. Eğer RDKit yanlışsa, kendi tahminini sun ve NEDEN yanlış olduğunu açıkla

🎯 RDKit kimyasal kurallarla çalışır, ama %100 doğru değildir. Sen son kararı ver!`;
  }

  /**
   * Log RDKit result to console (for debugging)
   */
  logResult(result: RDKitResult): void {
    if (!result.success || !result.best) {
      console.log('⚠️ RDKit aday molekül bulamadı');
      console.log(`Sebep: ${result.error || 'Bilinmiyor'}\n`);
      return;
    }

    console.log('✅ RDKIT ANALİZİ TAMAMLANDI!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🎯 En İyi Aday: ${result.best.name}`);
    console.log(`📐 SMILES: ${result.best.smiles}`);
    console.log(`🔤 IUPAC: ${result.best.iupac}`);
    console.log(`🧪 Formül: ${result.best.formula}`);
    console.log(`📊 Skor: ${result.best.score.toFixed(1)}/100`);

    if (result.fragments && result.fragments.length > 0) {
      console.log(`\n🧩 Tespit Edilen Parçalar (Fragments):`);
      result.fragments.slice(0, 3).forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.type} - ${f.reasoning}`);
      });
    }

    if (result.candidates && result.candidates.length > 1) {
      console.log(`\n📋 Diğer Adaylar:`);
      result.candidates.slice(1, 4).forEach((c, i) => {
        console.log(`   ${i + 2}. ${c.name} (${c.formula}) - Skor: ${c.score.toFixed(1)}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════\n');
  }
}

// Export singleton
export const rdkitService = new RDKitService();

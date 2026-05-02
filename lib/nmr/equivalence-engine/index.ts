/**
 * SpectroMind v2.0 - Equivalence Engine
 * 
 * Proton eşdeğerlik analizi:
 * - Topolojik eşdeğerlik (graf tabanlı)
 * - Stereo-kimyasal eşdeğerlik (diastereotopic CH2)
 * - Dinamik eşdeğerlik (ring flip, rotasyon, exchange)
 */

import {
  Proton,
  Conformer,
  EquivalenceGroup,
  DynamicEvent,
  ExchangeRegime,
  Solvent,
} from '@/lib/types/nmr-simulation';

// ============================================================================
// EQUIVALENCE ANALYSIS
// ============================================================================

export interface EquivalenceAnalysisInput {
  protons: Proton[];
  conformers?: Conformer[];
  dynamicEvents?: DynamicEvent[];
  fieldMHz: number;
  temperatureK: number;
  solvent: Solvent;
}

export interface EquivalenceAnalysisResult {
  groups: EquivalenceGroup[];
  mergeDecisions: MergeDecision[];
  warnings: string[];
}

export interface MergeDecision {
  proton1Id: string;
  proton2Id: string;
  merged: boolean;
  reason: string;
  regime?: ExchangeRegime;
}

// ============================================================================
// TOPOLOGICAL EQUIVALENCE
// ============================================================================

/**
 * 2D topolojik sınıf kontrolü
 * Aynı topoClass'a sahip protonlar aday
 */
export function areTopologicallyEquivalent(
  proton1: Proton,
  proton2: Proton
): boolean {
  return proton1.topoClass === proton2.topoClass;
}

// ============================================================================
// STEREO EQUIVALENCE
// ============================================================================

/**
 * Stereo-kimyasal eşdeğerlik kontrolü
 * proR ve proS birleştirilmez (diastereotopic)
 */
export function areStereoCompatible(
  proton1: Proton,
  proton2: Proton
): boolean {
  // Biri proR diğeri proS ise birleştirme
  if (proton1.stereoClass === 'proR' && proton2.stereoClass === 'proS') return false;
  if (proton1.stereoClass === 'proS' && proton2.stereoClass === 'proR') return false;
  
  return true;
}

// ============================================================================
// DYNAMIC EQUIVALENCE
// ============================================================================

/**
 * Eyring denklemiyle bariyer → hız dönüşümü
 */
export function exchangeRateFromBarrier(
  barrierKcal: number,
  temperatureK: number
): number {
  const kB = 1.380649e-23;  // J/K
  const h = 6.62607015e-34; // J·s
  const R = 1.987204258e-3; // kcal/(mol·K)
  
  const prefactor = (kB * temperatureK) / h;
  const expo = Math.exp(-barrierKcal / (R * temperatureK));
  
  return prefactor * expo;
}

/**
 * k/Δν rejim kararı
 */
export function determineExchangeRegime(
  rateK: number,
  deltaPPM: number,
  fieldMHz: number
): ExchangeRegime {
  const deltaHz = Math.abs(deltaPPM) * fieldMHz;
  
  if (deltaHz === 0) return 'fast';
  
  const ratio = rateK / deltaHz;
  
  if (ratio > 10) return 'fast';
  if (ratio < 0.1) return 'slow';
  return 'intermediate';
}

/**
 * Dinamik event'in iki protonu swap edip etmediğini kontrol et
 */
export function doesEventSwapProtons(
  event: DynamicEvent,
  proton1Id: string,
  proton2Id: string
): boolean {
  if (!event.swapMapping) return false;
  
  const to1 = event.swapMapping[proton1Id];
  const to2 = event.swapMapping[proton2Id];
  
  return to1 === proton2Id && to2 === proton1Id;
}

// ============================================================================
// MAIN EQUIVALENCE BUILDER
// ============================================================================

/**
 * Ana eşdeğerlik grupları oluştur
 */
export function buildEquivalenceGroups(
  input: EquivalenceAnalysisInput
): EquivalenceAnalysisResult {
  const { protons, conformers, dynamicEvents, fieldMHz, temperatureK } = input;
  
  const mergeDecisions: MergeDecision[] = [];
  const warnings: string[] = [];
  
  // Union-Find yapısı
  const parent = new Map<string, string>();
  for (const p of protons) {
    parent.set(p.id, p.id);
  }
  
  const find = (x: string): string => {
    let p = parent.get(x)!;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  
  // Topo bucket'lara ayır
  const topoBuckets = new Map<number, Proton[]>();
  for (const p of protons) {
    if (!topoBuckets.has(p.topoClass)) {
      topoBuckets.set(p.topoClass, []);
    }
    topoBuckets.get(p.topoClass)!.push(p);
  }
  
  // Her bucket içinde birleştirme kararları
  for (const [, bucket] of topoBuckets) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const p1 = bucket[i];
        const p2 = bucket[j];
        
        // Stereo kontrolü
        if (!areStereoCompatible(p1, p2)) {
          mergeDecisions.push({
            proton1Id: p1.id,
            proton2Id: p2.id,
            merged: false,
            reason: 'Diastereotopic (proR/proS)',
          });
          continue;
        }
        
        // Dinamik event kontrolü
        let shouldMerge = false;
        let mergeReason = '';
        let regime: ExchangeRegime | undefined;
        
        if (dynamicEvents) {
          for (const event of dynamicEvents) {
            if (doesEventSwapProtons(event, p1.id, p2.id)) {
              // δ farkı hesapla
              const deltaPPM = Math.abs(p1.deltaFinal - p2.deltaFinal);
              const rateK = event.estimatedRateK ?? exchangeRateFromBarrier(event.barrierKcal, temperatureK);
              
              regime = determineExchangeRegime(rateK, deltaPPM, fieldMHz);
              
              if (regime === 'fast') {
                shouldMerge = true;
                mergeReason = `Fast exchange via ${event.type}`;
              } else if (regime === 'intermediate') {
                shouldMerge = true;
                mergeReason = `Intermediate exchange via ${event.type} (broadened)`;
              } else {
                mergeReason = `Slow exchange via ${event.type} (separate peaks)`;
              }
              break;
            }
          }
        }
        
        // Event yoksa δ yakınlığına bak
        if (!mergeReason) {
          const deltaPPM = Math.abs(p1.deltaFinal - p2.deltaFinal);
          const threshold = 0.03;  // ppm
          
          if (deltaPPM < threshold) {
            shouldMerge = true;
            mergeReason = `Very close shifts (Δδ = ${deltaPPM.toFixed(3)} ppm)`;
          }
        }
        
        if (shouldMerge) {
          union(p1.id, p2.id);
        }
        
        mergeDecisions.push({
          proton1Id: p1.id,
          proton2Id: p2.id,
          merged: shouldMerge,
          reason: mergeReason || 'No merge condition met',
          regime,
        });
      }
    }
  }
  
  // Grupları oluştur
  const groupMap = new Map<string, Proton[]>();
  for (const p of protons) {
    const root = find(p.id);
    if (!groupMap.has(root)) {
      groupMap.set(root, []);
    }
    groupMap.get(root)!.push(p);
  }
  
  // EquivalenceGroup formatına dönüştür
  const groups: EquivalenceGroup[] = [];
  let groupId = 1;
  
  for (const [, members] of groupMap) {
    const deltaMean = members.reduce((sum, p) => sum + p.deltaFinal, 0) / members.length;
    const deltaStd = Math.sqrt(
      members.reduce((sum, p) => sum + Math.pow(p.deltaFinal - deltaMean, 2), 0) / members.length
    );
    
    groups.push({
      id: `EQ${groupId++}`,
      protonIds: members.map(p => p.id),
      integral: members.length,
      deltaMean,
      deltaStd,
      confidence: deltaStd < 0.1 ? 0.9 : 0.7,
      mergeReason: members.length > 1 ? 'Equivalent protons' : undefined,
    });
  }
  
  return {
    groups,
    mergeDecisions,
    warnings,
  };
}

// ============================================================================
// DYNAMIC EVENT DETECTION
// ============================================================================

/**
 * Ring flip tespiti (cyclohexane gibi)
 */
export function detectRingFlips(
  ringAtomIndices: number[],
  ringSize: number
): DynamicEvent | null {
  if (ringSize !== 6) return null;  // Sadece 6-üyeli halkalar
  
  // Sikloheksan için tipik bariyer
  const barrierKcal = 10.5;  // kcal/mol
  
  return {
    id: `ring_flip_${ringAtomIndices.join('_')}`,
    type: 'ring_flip',
    affectedAtomIndices: ringAtomIndices,
    barrierKcal,
    estimatedRateK: exchangeRateFromBarrier(barrierKcal, 298.15),
  };
}

/**
 * Amid rotamer tespiti
 */
export function detectAmideRotamer(
  amideNIdx: number,
  amideCIdx: number,
  substituents: number[]
): DynamicEvent {
  // Tipik amid rotasyon bariyeri
  const barrierKcal = 18;  // kcal/mol (yüksek, çoğu zaman slow)
  
  return {
    id: `amide_rotamer_${amideNIdx}_${amideCIdx}`,
    type: 'amide_rotamer',
    affectedAtomIndices: [amideNIdx, amideCIdx, ...substituents],
    barrierKcal,
    estimatedRateK: exchangeRateFromBarrier(barrierKcal, 298.15),
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Boltzmann ağırlıklı ortalama δ
 */
export function weightedMeanDelta(
  values: number[],
  weights: number[]
): number {
  if (values.length === 0) return 0;
  
  let num = 0, den = 0;
  for (let i = 0; i < values.length; i++) {
    num += weights[i] * values[i];
    den += weights[i];
  }
  
  return den === 0 ? 0 : num / den;
}

/**
 * Ağırlıklı standart sapma
 */
export function weightedStdDelta(
  values: number[],
  weights: number[]
): number {
  if (values.length <= 1) return 0;
  
  const mean = weightedMeanDelta(values, weights);
  let num = 0, den = 0;
  
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mean;
    num += weights[i] * diff * diff;
    den += weights[i];
  }
  
  return den === 0 ? 0 : Math.sqrt(num / den);
}

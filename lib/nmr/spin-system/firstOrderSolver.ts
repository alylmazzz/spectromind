/**
 * First-Order Spin System Solver
 * 
 * n+1 kuralı ve splitting tree ile pattern üretimi
 * R ≥ 10 olan sistemler için kullanılır
 */

import { SpinLine, JEdge } from '@/lib/types/nmr-simulation';
import { SpinInput, getPascalCoefficients, getMultipletName } from './spinSystemTypes';

// ============================================================================
// FIRST-ORDER PATTERN GENERATION
// ============================================================================

export interface FirstOrderResult {
  lines: SpinLine[];
  multiplicity: string;
  couplings: number[];      // J değerleri
  centerPPM: number;
  totalIntegral: number;
}

/**
 * First-order multiplet pattern üret
 * 
 * Tek coupling için: n+1 kuralı
 * Çoklu coupling için: iteratif splitting
 */
export function generateFirstOrderPattern(
  spin: SpinInput,
  couplings: Array<{ jHz: number; equivalentNeighbors: number }>,
  fieldMHz: number,
  baseLinewidthHz: number = 1.0
): FirstOrderResult {
  const centerHz = spin.shiftHz;
  const centerPPM = spin.shiftPPM;
  
  if (couplings.length === 0) {
    // Singlet
    return {
      lines: [{
        frequencyHz: centerHz,
        frequencyPPM: centerPPM,
        intensity: 1.0,
        linewidthHz: baseLinewidthHz,
        sourceProtonIds: [spin.protonId],
        label: 's',
      }],
      multiplicity: 's',
      couplings: [],
      centerPPM,
      totalIntegral: spin.integral,
    };
  }
  
  // Splitting tree oluştur
  let lines: Array<{ position: number; intensity: number }> = [
    { position: centerHz, intensity: 1.0 }
  ];
  
  const allJValues: number[] = [];
  
  for (const coupling of couplings) {
    const { jHz, equivalentNeighbors } = coupling;
    allJValues.push(jHz);
    
    // Her coupling için split et
    const newLines: Array<{ position: number; intensity: number }> = [];
    const pascalCoeffs = getPascalCoefficients(equivalentNeighbors);
    
    for (const line of lines) {
      for (let i = 0; i <= equivalentNeighbors; i++) {
        const offset = (i - equivalentNeighbors / 2) * jHz;
        newLines.push({
          position: line.position + offset,
          intensity: line.intensity * pascalCoeffs[i] / Math.pow(2, equivalentNeighbors),
        });
      }
    }
    
    lines = newLines;
  }
  
  // Normalize intensities
  const maxIntensity = Math.max(...lines.map(l => l.intensity));
  
  // SpinLine formatına dönüştür
  const spinLines: SpinLine[] = lines.map(l => ({
    frequencyHz: l.position,
    frequencyPPM: l.position / fieldMHz,
    intensity: l.intensity / maxIntensity,
    linewidthHz: baseLinewidthHz,
    sourceProtonIds: [spin.protonId],
  }));
  
  // Multiplicity adı
  const totalNeighbors = couplings.reduce((sum, c) => sum + c.equivalentNeighbors, 0);
  const multiplicity = determineMultiplicityName(couplings);
  
  return {
    lines: spinLines,
    multiplicity,
    couplings: allJValues,
    centerPPM,
    totalIntegral: spin.integral,
  };
}

/**
 * Multiplicity adını belirle (d, t, dd, dt, ddd, m, etc.)
 */
function determineMultiplicityName(
  couplings: Array<{ jHz: number; equivalentNeighbors: number }>
): string {
  if (couplings.length === 0) return 's';
  
  // Tek coupling
  if (couplings.length === 1) {
    const n = couplings[0].equivalentNeighbors;
    return getMultipletName(n + 1);
  }
  
  // Çoklu coupling - aynı J'ler gruplanabilir
  const jGroups = new Map<number, number>();  // J → toplam komşu
  
  for (const c of couplings) {
    const jRounded = Math.round(c.jHz * 10) / 10;  // 0.1 Hz hassasiyet
    const existing = jGroups.get(jRounded) ?? 0;
    jGroups.set(jRounded, existing + c.equivalentNeighbors);
  }
  
  // Farklı J sayısına göre
  const uniqueJs = Array.from(jGroups.entries()).sort((a, b) => b[0] - a[0]);  // Büyükten küçüğe
  
  if (uniqueJs.length === 1) {
    // Tek tip J, toplam n komşu
    const totalN = uniqueJs[0][1];
    return getMultipletName(totalN + 1);
  }
  
  if (uniqueJs.length === 2) {
    // İki farklı J
    const name1 = getMultipletName(uniqueJs[0][1] + 1);
    const name2 = getMultipletName(uniqueJs[1][1] + 1);
    
    // dd, dt, dq, td, tt, etc.
    return name1 + name2;
  }
  
  if (uniqueJs.length === 3) {
    // Üç farklı J
    const names = uniqueJs.map(([_, n]) => getMultipletName(n + 1));
    return names.join('');  // ddd, ddt, etc.
  }
  
  // Çok karmaşık
  return 'm';
}

// ============================================================================
// NEIGHBOR ANALYSIS
// ============================================================================

/**
 * Bir proton için coupling komşularını analiz et
 */
export function analyzeNeighborCouplings(
  spinId: string,
  protonId: string,
  allEdges: JEdge[],
  equivalenceGroups: Map<string, string[]>,  // groupId → protonIds
  jMinHz: number = 0.7
): Array<{ jHz: number; equivalentNeighbors: number }> {
  // Bu protonun coupling'lerini bul
  const relevantEdges = allEdges.filter(e => 
    (e.proton1Id === protonId || e.proton2Id === protonId) &&
    Math.abs(e.jHz) >= jMinHz
  );
  
  // Komşuları grupla
  const neighborGroups = new Map<string, { jHz: number; count: number }>();
  
  for (const edge of relevantEdges) {
    const neighborProtonId = edge.proton1Id === protonId ? edge.proton2Id : edge.proton1Id;
    
    // Bu komşunun eşdeğerlik grubunu bul
    let groupKey = neighborProtonId;  // Default: kendisi
    
    for (const [groupId, members] of equivalenceGroups) {
      if (members.includes(neighborProtonId)) {
        groupKey = groupId;
        break;
      }
    }
    
    // J değerini grupla
    const existing = neighborGroups.get(groupKey);
    if (existing) {
      // Aynı gruptaki komşu - J ortalaması al
      const avgJ = (existing.jHz * existing.count + edge.jHz) / (existing.count + 1);
      neighborGroups.set(groupKey, { jHz: avgJ, count: existing.count + 1 });
    } else {
      neighborGroups.set(groupKey, { jHz: edge.jHz, count: 1 });
    }
  }
  
  // Sonuç formatına dönüştür
  const result: Array<{ jHz: number; equivalentNeighbors: number }> = [];
  
  for (const [groupKey, data] of neighborGroups) {
    // Eşdeğer komşu sayısı
    const groupMembers = equivalenceGroups.get(groupKey);
    const equivalentNeighbors = groupMembers ? groupMembers.length : 1;
    
    result.push({
      jHz: Math.abs(data.jHz),
      equivalentNeighbors,
    });
  }
  
  // J büyüklüğüne göre sırala
  result.sort((a, b) => b.jHz - a.jHz);
  
  return result;
}

// ============================================================================
// SIMPLE MULTIPLET GENERATOR
// ============================================================================

/**
 * Basit multiplet üretici (tek J için)
 */
export function generateSimpleMultiplet(
  centerHz: number,
  jHz: number,
  nNeighbors: number,
  fieldMHz: number,
  linewidthHz: number = 1.0,
  sourceProtonIds: string[] = []
): SpinLine[] {
  const pascalCoeffs = getPascalCoefficients(nNeighbors);
  const maxCoeff = Math.max(...pascalCoeffs);
  
  const lines: SpinLine[] = [];
  
  for (let i = 0; i <= nNeighbors; i++) {
    const offset = (i - nNeighbors / 2) * jHz;
    
    lines.push({
      frequencyHz: centerHz + offset,
      frequencyPPM: (centerHz + offset) / fieldMHz,
      intensity: pascalCoeffs[i] / maxCoeff,
      linewidthHz,
      sourceProtonIds,
    });
  }
  
  return lines;
}

/**
 * Çoklu J için iteratif splitting
 */
export function generateComplexMultiplet(
  centerHz: number,
  couplings: Array<{ jHz: number; nNeighbors: number }>,
  fieldMHz: number,
  linewidthHz: number = 1.0,
  sourceProtonIds: string[] = []
): SpinLine[] {
  if (couplings.length === 0) {
    return [{
      frequencyHz: centerHz,
      frequencyPPM: centerHz / fieldMHz,
      intensity: 1.0,
      linewidthHz,
      sourceProtonIds,
    }];
  }
  
  // İlk coupling
  let lines = generateSimpleMultiplet(
    centerHz,
    couplings[0].jHz,
    couplings[0].nNeighbors,
    fieldMHz,
    linewidthHz,
    sourceProtonIds
  );
  
  // Sonraki coupling'ler
  for (let i = 1; i < couplings.length; i++) {
    const newLines: SpinLine[] = [];
    
    for (const line of lines) {
      const splitLines = generateSimpleMultiplet(
        line.frequencyHz,
        couplings[i].jHz,
        couplings[i].nNeighbors,
        fieldMHz,
        linewidthHz,
        sourceProtonIds
      );
      
      for (const splitLine of splitLines) {
        newLines.push({
          ...splitLine,
          intensity: line.intensity * splitLine.intensity,
        });
      }
    }
    
    lines = newLines;
  }
  
  // Çok yakın çizgileri birleştir (overlap)
  lines = mergeCloseLines(lines, 0.5);  // 0.5 Hz tolerans
  
  // Normalize
  const maxInt = Math.max(...lines.map(l => l.intensity));
  for (const line of lines) {
    line.intensity /= maxInt;
  }
  
  return lines;
}

/**
 * Yakın çizgileri birleştir
 */
function mergeCloseLines(lines: SpinLine[], toleranceHz: number): SpinLine[] {
  if (lines.length <= 1) return lines;
  
  // Frekansa göre sırala
  const sorted = [...lines].sort((a, b) => a.frequencyHz - b.frequencyHz);
  
  const merged: SpinLine[] = [];
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].frequencyHz - current.frequencyHz < toleranceHz) {
      // Birleştir (ağırlıklı ortalama)
      const totalInt = current.intensity + sorted[i].intensity;
      const newFreq = (current.frequencyHz * current.intensity + 
                       sorted[i].frequencyHz * sorted[i].intensity) / totalInt;
      
      current = {
        ...current,
        frequencyHz: newFreq,
        frequencyPPM: newFreq / (current.frequencyPPM > 0 ? 
          current.frequencyHz / current.frequencyPPM : 400),
        intensity: totalInt,
      };
    } else {
      merged.push(current);
      current = sorted[i];
    }
  }
  merged.push(current);
  
  return merged;
}

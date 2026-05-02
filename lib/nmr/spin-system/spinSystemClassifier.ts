/**
 * Spin System Classifier
 * 
 * Proton gruplarını spin sistem tiplerine sınıflandırır
 */

import { SpinSystemType, JEdge } from '@/lib/types/nmr-simulation';
import {
  SpinInput,
  SpinSystemInput,
  SpinSystemClassification,
  RValueResult,
  calculateRValue,
} from './spinSystemTypes';

// ============================================================================
// MAIN CLASSIFIER
// ============================================================================

/**
 * Spin sistemini sınıflandır
 */
export function classifySpinSystem(
  input: SpinSystemInput
): SpinSystemClassification {
  const { spins, jEdges, fieldMHz } = input;
  const warnings: string[] = [];
  
  if (spins.length === 0) {
    return {
      type: 'FIRST_ORDER',
      spinIds: [],
      rValues: [],
      solver: 'quick',
      description: 'Empty spin system',
      warnings: ['No spins in system'],
    };
  }
  
  if (spins.length === 1) {
    return {
      type: 'FIRST_ORDER',
      spinIds: [spins[0].id],
      rValues: [],
      solver: 'quick',
      description: 'Singlet (isolated spin)',
      warnings: [],
    };
  }
  
  // R değerlerini hesapla
  const rValues = calculateAllRValues(spins, jEdges);
  
  // En düşük R değeri
  const minR = Math.min(...rValues.map(r => r.R));
  const hasStrongCoupling = rValues.some(r => r.regime === 'strong_coupling');
  const hasSecondOrder = rValues.some(r => r.regime === 'second_order');
  
  // Spin sayısına ve R değerlerine göre sınıflandır
  const systemType = determineSystemType(spins, rValues, jEdges);
  
  // Solver seç
  let solver: 'quick' | 'hamiltonian' | 'hybrid' = 'quick';
  
  if (systemType === 'AB' || systemType === 'A2B2') {
    solver = 'hamiltonian';
  } else if (hasStrongCoupling) {
    solver = 'hamiltonian';
    warnings.push('Strong coupling detected; using Hamiltonian solver');
  } else if (hasSecondOrder && spins.length <= 4) {
    solver = 'hamiltonian';
  } else if (hasSecondOrder && spins.length > 4) {
    solver = 'hybrid';
    warnings.push('Large spin system with second-order effects; using hybrid solver');
  }
  
  // Boyut uyarısı
  if (spins.length > 8) {
    warnings.push(`Large spin system (${spins.length} spins); computation may be slow`);
  }
  
  return {
    type: systemType,
    spinIds: spins.map(s => s.id),
    rValues,
    solver,
    description: getSystemDescription(systemType, spins.length),
    warnings,
  };
}

// ============================================================================
// R VALUE CALCULATION
// ============================================================================

function calculateAllRValues(
  spins: SpinInput[],
  jEdges: JEdge[]
): RValueResult[] {
  const results: RValueResult[] = [];
  
  for (const edge of jEdges) {
    const spin1 = spins.find(s => s.protonId === edge.proton1Id);
    const spin2 = spins.find(s => s.protonId === edge.proton2Id);
    
    if (!spin1 || !spin2) continue;
    
    const deltaHz = Math.abs(spin1.shiftHz - spin2.shiftHz);
    const jHz = Math.abs(edge.jHz);
    const R = jHz > 0 ? deltaHz / jHz : Infinity;
    const regime = calculateRValue(spin1.shiftHz, spin2.shiftHz, edge.jHz);
    
    results.push({
      spin1Id: spin1.id,
      spin2Id: spin2.id,
      deltaHz,
      jHz,
      R,
      regime,
    });
  }
  
  return results;
}

// ============================================================================
// SYSTEM TYPE DETERMINATION
// ============================================================================

function determineSystemType(
  spins: SpinInput[],
  rValues: RValueResult[],
  jEdges: JEdge[]
): SpinSystemType {
  const n = spins.length;
  
  // Tek spin
  if (n === 1) return 'FIRST_ORDER';
  
  // İki spin
  if (n === 2) {
    const r = rValues[0];
    if (!r) return 'FIRST_ORDER';
    
    if (r.regime === 'first_order') return 'FIRST_ORDER';
    return 'AB';
  }
  
  // Üç spin
  if (n === 3) {
    // ABX mi AMX mi?
    const hasSecondOrder = rValues.some(r => 
      r.regime === 'second_order' || r.regime === 'strong_coupling'
    );
    
    if (!hasSecondOrder) return 'FIRST_ORDER';
    
    // A ve B yakın, X uzak mı?
    const stronglyCoupleds = rValues.filter(r => r.R < 3);
    if (stronglyCoupleds.length === 1) {
      return 'ABX';
    }
    
    return 'AMX';
  }
  
  // Dört spin
  if (n === 4) {
    // A2B2 (AA'BB') kontrolü
    // İki çift eşdeğer spin + ortho/meta coupling
    const isA2B2 = checkForA2B2Pattern(spins, jEdges);
    if (isA2B2) return 'A2B2';
    
    // ABCD kontrolü
    const hasSecondOrder = rValues.some(r => 
      r.regime === 'second_order' || r.regime === 'strong_coupling'
    );
    
    if (hasSecondOrder) return 'ABCD';
    return 'FIRST_ORDER';
  }
  
  // Büyük sistemler
  const hasSecondOrder = rValues.some(r => 
    r.regime === 'second_order' || r.regime === 'strong_coupling'
  );
  
  if (hasSecondOrder) return 'GENERAL';
  return 'FIRST_ORDER';
}

/**
 * A2B2 (AA'BB') pattern kontrolü
 * Para-disubstituted benzene gibi sistemler
 */
function checkForA2B2Pattern(
  spins: SpinInput[],
  jEdges: JEdge[]
): boolean {
  if (spins.length !== 4) return false;
  
  // İki eşdeğer çift olmalı
  // δ_A ≈ δ_A' ve δ_B ≈ δ_B'
  
  const shifts = spins.map(s => s.shiftPPM).sort((a, b) => a - b);
  
  // İki çift yakın kayma
  const pairTolerance = 0.05;  // ppm
  const pair1Match = Math.abs(shifts[0] - shifts[1]) < pairTolerance;
  const pair2Match = Math.abs(shifts[2] - shifts[3]) < pairTolerance;
  
  if (!pair1Match || !pair2Match) return false;
  
  // Ortho ve meta coupling'ler var mı?
  const hasOrthoJ = jEdges.some(e => e.bondClass === 'aromatic_ortho');
  const hasMetaJ = jEdges.some(e => e.bondClass === 'aromatic_meta');
  
  return hasOrthoJ && hasMetaJ;
}

// ============================================================================
// DESCRIPTION
// ============================================================================

function getSystemDescription(type: SpinSystemType, spinCount: number): string {
  switch (type) {
    case 'FIRST_ORDER':
      return `First-order system with ${spinCount} spin(s)`;
    case 'AB':
      return 'AB system (two coupled spins with similar shifts)';
    case 'ABX':
      return 'ABX system (two strongly coupled + one weakly coupled)';
    case 'AMX':
      return 'AMX system (three spins with distinct shifts)';
    case 'A2B2':
      return "AA'BB' system (e.g., para-disubstituted benzene)";
    case 'ABC':
      return 'ABC system (three non-equivalent coupled spins)';
    case 'ABCD':
      return 'ABCD system (four non-equivalent coupled spins)';
    case 'GENERAL':
      return `General ${spinCount}-spin system requiring full Hamiltonian`;
    default:
      return `Unknown system type with ${spinCount} spins`;
  }
}

// ============================================================================
// CONNECTED COMPONENTS
// ============================================================================

/**
 * Coupling grafiğini bağlı bileşenlere ayır
 * Her bileşen ayrı simüle edilebilir
 */
export function findSpinSystemComponents(
  allSpins: SpinInput[],
  allEdges: JEdge[],
  jMinHz: number = 0.7
): SpinSystemInput[] {
  // Graf oluştur
  const adjacency = new Map<string, Set<string>>();
  
  for (const spin of allSpins) {
    adjacency.set(spin.id, new Set());
  }
  
  for (const edge of allEdges) {
    if (Math.abs(edge.jHz) < jMinHz) continue;  // Zayıf coupling'leri atla
    
    const spin1 = allSpins.find(s => s.protonId === edge.proton1Id);
    const spin2 = allSpins.find(s => s.protonId === edge.proton2Id);
    
    if (spin1 && spin2) {
      adjacency.get(spin1.id)?.add(spin2.id);
      adjacency.get(spin2.id)?.add(spin1.id);
    }
  }
  
  // BFS ile bağlı bileşenler
  const visited = new Set<string>();
  const components: SpinSystemInput[] = [];
  
  for (const spin of allSpins) {
    if (visited.has(spin.id)) continue;
    
    const component: string[] = [];
    const queue = [spin.id];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      component.push(current);
      
      const neighbors = adjacency.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    // Bileşeni oluştur
    const componentSpins = allSpins.filter(s => component.includes(s.id));
    const componentEdges = allEdges.filter(e => {
      const spin1 = allSpins.find(s => s.protonId === e.proton1Id);
      const spin2 = allSpins.find(s => s.protonId === e.proton2Id);
      return spin1 && spin2 && component.includes(spin1.id) && component.includes(spin2.id);
    });
    
    if (componentSpins.length > 0) {
      components.push({
        spins: componentSpins,
        jEdges: componentEdges,
        fieldMHz: 400,  // Bu dışarıdan alınmalı
      });
    }
  }
  
  return components;
}

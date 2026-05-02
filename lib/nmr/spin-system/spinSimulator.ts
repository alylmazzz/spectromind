/**
 * Spin Simulator - Ana Simülasyon Modülü
 * 
 * Tüm spin sistem çözücüleri birleştiren ana modül
 */

import { SpinLine, SpinSystem, SpinSystemType, JEdge } from '@/lib/types/nmr-simulation';
import { SpinInput, SpinSystemInput, SpinSystemClassification } from './spinSystemTypes';
import { classifySpinSystem, findSpinSystemComponents } from './spinSystemClassifier';
import { generateFirstOrderPattern, analyzeNeighborCouplings, generateComplexMultiplet } from './firstOrderSolver';
import { solveABSystem, solveABXSystem, solveAABBSystem, solveGeneralSpinSystem } from './hamiltonianSolver';

// ============================================================================
// MAIN SIMULATOR
// ============================================================================

export interface SimulationConfig {
  fieldMHz: number;
  linewidthHz: number;
  jMinHz: number;
  secondOrderThreshold: number;  // R < bu değer ise second-order
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  fieldMHz: 400,
  linewidthHz: 1.0,
  jMinHz: 0.7,
  secondOrderThreshold: 3,
};

export interface SpinSimulationResult {
  lines: SpinLine[];
  classification: SpinSystemClassification;
  spinSystems: SpinSystem[];
  warnings: string[];
}

/**
 * Ana simülasyon fonksiyonu
 */
export function simulateSpinSystem(
  spins: SpinInput[],
  jEdges: JEdge[],
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG
): SpinSimulationResult {
  const allLines: SpinLine[] = [];
  const allWarnings: string[] = [];
  const spinSystems: SpinSystem[] = [];
  
  // Bağlı bileşenlere ayır
  const components = findSpinSystemComponents(spins, jEdges, config.jMinHz);
  
  let classificationSummary: SpinSystemClassification | null = null;
  
  for (const component of components) {
    // Her bileşeni sınıflandır
    const input: SpinSystemInput = {
      ...component,
      fieldMHz: config.fieldMHz,
    };
    
    const classification = classifySpinSystem(input);
    allWarnings.push(...classification.warnings);
    
    if (!classificationSummary) {
      classificationSummary = classification;
    }
    
    // Spin sistem kaydı
    const spinSystem: SpinSystem = {
      id: `sys_${spinSystems.length}`,
      type: classification.type,
      protonIds: classification.spinIds,
      shifts: component.spins.map(s => s.shiftHz),
      jMatrix: buildJMatrix(component.spins, component.jEdges),
      solver: classification.solver,
      rValues: classification.rValues.map(r => r.R),
    };
    spinSystems.push(spinSystem);
    
    // Simüle et
    const componentLines = simulateComponent(
      component,
      classification,
      config
    );
    
    allLines.push(...componentLines);
  }
  
  // Sınıflandırma yoksa default
  if (!classificationSummary) {
    classificationSummary = {
      type: 'FIRST_ORDER',
      spinIds: [],
      rValues: [],
      solver: 'quick',
      description: 'No spins',
      warnings: [],
    };
  }
  
  return {
    lines: allLines,
    classification: classificationSummary,
    spinSystems,
    warnings: allWarnings,
  };
}

/**
 * Tek bir bileşeni simüle et
 */
function simulateComponent(
  component: SpinSystemInput,
  classification: SpinSystemClassification,
  config: SimulationConfig
): SpinLine[] {
  const { spins, jEdges } = component;
  const { fieldMHz, linewidthHz } = config;
  
  switch (classification.type) {
    case 'FIRST_ORDER':
      return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
    
    case 'AB':
      if (spins.length !== 2) {
        return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
      }
      const jAB = jEdges.find(e => 
        (e.proton1Id === spins[0].protonId && e.proton2Id === spins[1].protonId) ||
        (e.proton2Id === spins[0].protonId && e.proton1Id === spins[1].protonId)
      )?.jHz ?? 0;
      return solveABSystem(spins[0], spins[1], jAB, fieldMHz, linewidthHz).lines;
    
    case 'ABX':
      return simulateABX(spins, jEdges, fieldMHz, linewidthHz);
    
    case 'A2B2':
      return simulateAABB(spins, jEdges, fieldMHz, linewidthHz);
    
    case 'GENERAL':
    case 'ABC':
    case 'ABCD':
      return simulateGeneral(spins, jEdges, fieldMHz, linewidthHz);
    
    default:
      return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
  }
}

// ============================================================================
// SPECIFIC SIMULATORS
// ============================================================================

/**
 * First-order simülasyonu
 */
function simulateFirstOrder(
  spins: SpinInput[],
  jEdges: JEdge[],
  fieldMHz: number,
  linewidthHz: number
): SpinLine[] {
  const allLines: SpinLine[] = [];
  
  // Eşdeğerlik grupları (basitleştirilmiş)
  const equivalenceGroups = new Map<string, string[]>();
  
  for (const spin of spins) {
    // Her proton için coupling'leri analiz et
    const couplings = analyzeNeighborCouplings(
      spin.id,
      spin.protonId,
      jEdges,
      equivalenceGroups,
      0.7
    );
    
    // Pattern üret
    const result = generateFirstOrderPattern(spin, couplings, fieldMHz, linewidthHz);
    allLines.push(...result.lines);
  }
  
  return allLines;
}

/**
 * ABX simülasyonu
 */
function simulateABX(
  spins: SpinInput[],
  jEdges: JEdge[],
  fieldMHz: number,
  linewidthHz: number
): SpinLine[] {
  if (spins.length !== 3) {
    return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
  }
  
  // A, B, X'i belirle (A ve B yakın kaymalar, X uzak)
  const sorted = [...spins].sort((a, b) => a.shiftPPM - b.shiftPPM);
  
  // İkili shift farklarını hesapla
  const diff01 = Math.abs(sorted[0].shiftHz - sorted[1].shiftHz);
  const diff12 = Math.abs(sorted[1].shiftHz - sorted[2].shiftHz);
  
  let spinA: SpinInput, spinB: SpinInput, spinX: SpinInput;
  
  if (diff01 < diff12) {
    // 0 ve 1 yakın (A, B), 2 uzak (X)
    spinA = sorted[0];
    spinB = sorted[1];
    spinX = sorted[2];
  } else {
    // 1 ve 2 yakın (A, B), 0 uzak (X)
    spinX = sorted[0];
    spinA = sorted[1];
    spinB = sorted[2];
  }
  
  // J değerlerini bul
  const findJ = (id1: string, id2: string) => {
    return jEdges.find(e =>
      (e.proton1Id === id1 && e.proton2Id === id2) ||
      (e.proton2Id === id1 && e.proton1Id === id2)
    )?.jHz ?? 0;
  };
  
  const jAB = findJ(spinA.protonId, spinB.protonId);
  const jAX = findJ(spinA.protonId, spinX.protonId);
  const jBX = findJ(spinB.protonId, spinX.protonId);
  
  const result = solveABXSystem(spinA, spinB, spinX, jAB, jAX, jBX, fieldMHz, linewidthHz);
  return result.lines;
}

/**
 * AA'BB' simülasyonu
 */
function simulateAABB(
  spins: SpinInput[],
  jEdges: JEdge[],
  fieldMHz: number,
  linewidthHz: number
): SpinLine[] {
  if (spins.length !== 4) {
    return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
  }
  
  // Shift'e göre sırala
  const sorted = [...spins].sort((a, b) => a.shiftPPM - b.shiftPPM);
  
  // İlk iki A grubu, son iki B grubu varsay
  const spinA = sorted[0];
  const spinAp = sorted[1];
  const spinB = sorted[2];
  const spinBp = sorted[3];
  
  // J değerlerini bul
  const findJ = (id1: string, id2: string) => {
    return jEdges.find(e =>
      (e.proton1Id === id1 && e.proton2Id === id2) ||
      (e.proton2Id === id1 && e.proton1Id === id2)
    )?.jHz ?? 0;
  };
  
  // Ortho ve meta coupling'leri
  const jAB = findJ(spinA.protonId, spinB.protonId) || 8.0;  // ortho default
  const jABp = findJ(spinA.protonId, spinBp.protonId) || 2.2;  // meta default
  const jAA = findJ(spinA.protonId, spinAp.protonId) || 0.5;
  const jBB = findJ(spinB.protonId, spinBp.protonId) || 0.5;
  
  const result = solveAABBSystem(
    spinA, spinAp, spinB, spinBp,
    jAB, jABp, jAA, jBB,
    fieldMHz, linewidthHz
  );
  
  return result.lines;
}

/**
 * Genel spin sistem simülasyonu
 */
function simulateGeneral(
  spins: SpinInput[],
  jEdges: JEdge[],
  fieldMHz: number,
  linewidthHz: number
): SpinLine[] {
  // J matrisi oluştur
  const jMatrix = buildJMatrix(spins, jEdges);
  
  // Hamiltonian çözümü
  const lines = solveGeneralSpinSystem(spins, jMatrix, fieldMHz, linewidthHz);
  
  // Boşsa first-order'a düş
  if (lines.length === 0) {
    return simulateFirstOrder(spins, jEdges, fieldMHz, linewidthHz);
  }
  
  return lines;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * J coupling matrisi oluştur
 */
function buildJMatrix(spins: SpinInput[], jEdges: JEdge[]): number[][] {
  const n = spins.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (const edge of jEdges) {
    const i = spins.findIndex(s => s.protonId === edge.proton1Id);
    const j = spins.findIndex(s => s.protonId === edge.proton2Id);
    
    if (i >= 0 && j >= 0 && i !== j) {
      matrix[i][j] = edge.jHz;
      matrix[j][i] = edge.jHz;
    }
  }
  
  return matrix;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Tek bir multiplet için basit simülasyon
 */
export function simulateSingleMultiplet(
  centerPPM: number,
  couplings: Array<{ jHz: number; nNeighbors: number }>,
  fieldMHz: number = 400,
  linewidthHz: number = 1.0,
  protonId: string = 'H'
): SpinLine[] {
  const centerHz = centerPPM * fieldMHz;
  
  return generateComplexMultiplet(
    centerHz,
    couplings,
    fieldMHz,
    linewidthHz,
    [protonId]
  );
}

/**
 * AB quartet simülasyonu
 */
export function simulateABQuartet(
  ppmA: number,
  ppmB: number,
  jAB: number,
  fieldMHz: number = 400,
  linewidthHz: number = 1.0
): SpinLine[] {
  const spinA: SpinInput = {
    id: 'A',
    protonId: 'H_A',
    shiftHz: ppmA * fieldMHz,
    shiftPPM: ppmA,
    integral: 1,
  };
  
  const spinB: SpinInput = {
    id: 'B',
    protonId: 'H_B',
    shiftHz: ppmB * fieldMHz,
    shiftPPM: ppmB,
    integral: 1,
  };
  
  return solveABSystem(spinA, spinB, jAB, fieldMHz, linewidthHz).lines;
}

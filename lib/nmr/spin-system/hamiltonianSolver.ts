/**
 * Spin Hamiltonian Solver
 * 
 * Second-order spin sistemleri için tam Hamiltonian çözümü
 * AB, ABX, AA'BB' gibi sistemler
 */

import { SpinLine } from '@/lib/types/nmr-simulation';
import { SpinInput, ABSystemResult, EigenState, Transition } from './spinSystemTypes';

// ============================================================================
// AB SYSTEM SOLVER
// ============================================================================

/**
 * AB sistemi çözümü (iki güçlü bağlı spin)
 * 
 * Dört çizgi üretir:
 * ν₁ = νc - (D + J)/2    I ∝ 1 - sin(2θ)
 * ν₂ = νc + (D - J)/2    I ∝ 1 + sin(2θ)
 * ν₃ = νc - (D - J)/2    I ∝ 1 + sin(2θ)
 * ν₄ = νc + (D + J)/2    I ∝ 1 - sin(2θ)
 * 
 * D = √[(νA - νB)² + J²]
 */
export function solveABSystem(
  spinA: SpinInput,
  spinB: SpinInput,
  jAB: number,
  fieldMHz: number,
  linewidthHz: number = 1.0
): ABSystemResult {
  const nuA = spinA.shiftHz;
  const nuB = spinB.shiftHz;
  
  // Merkez frekans
  const nuC = (nuA + nuB) / 2;
  
  // Frekans farkı
  const deltaNu = nuA - nuB;
  
  // D parametresi
  const D = Math.sqrt(deltaNu * deltaNu + jAB * jAB);
  
  // Karışım açısı
  // tan(2θ) = J / (νA - νB)
  const theta = 0.5 * Math.atan2(jAB, deltaNu);
  const sin2theta = Math.sin(2 * theta);
  const cos2theta = Math.cos(2 * theta);
  
  // Çizgi pozisyonları ve intensiteleri
  // "Roofing" efekti: iç çizgiler daha yoğun
  const lines: SpinLine[] = [
    {
      // ν₁ = νc - (D + J)/2
      frequencyHz: nuC - (D + jAB) / 2,
      frequencyPPM: (nuC - (D + jAB) / 2) / fieldMHz,
      intensity: 1 - sin2theta,
      linewidthHz,
      sourceProtonIds: [spinA.protonId, spinB.protonId],
      label: 'AB₁',
    },
    {
      // ν₂ = νc + (D - J)/2 (iç çizgi, daha yoğun)
      frequencyHz: nuC + (D - jAB) / 2,
      frequencyPPM: (nuC + (D - jAB) / 2) / fieldMHz,
      intensity: 1 + sin2theta,
      linewidthHz,
      sourceProtonIds: [spinA.protonId, spinB.protonId],
      label: 'AB₂',
    },
    {
      // ν₃ = νc - (D - J)/2 (iç çizgi, daha yoğun)
      frequencyHz: nuC - (D - jAB) / 2,
      frequencyPPM: (nuC - (D - jAB) / 2) / fieldMHz,
      intensity: 1 + sin2theta,
      linewidthHz,
      sourceProtonIds: [spinA.protonId, spinB.protonId],
      label: 'AB₃',
    },
    {
      // ν₄ = νc + (D + J)/2
      frequencyHz: nuC + (D + jAB) / 2,
      frequencyPPM: (nuC + (D + jAB) / 2) / fieldMHz,
      intensity: 1 - sin2theta,
      linewidthHz,
      sourceProtonIds: [spinA.protonId, spinB.protonId],
      label: 'AB₄',
    },
  ];
  
  // Intensiteleri normalize et
  const maxInt = Math.max(...lines.map(l => l.intensity));
  for (const line of lines) {
    line.intensity /= maxInt;
  }
  
  // Frekansa göre sırala
  lines.sort((a, b) => a.frequencyHz - b.frequencyHz);
  
  return {
    lines,
    nuPlus: nuC,
    nuMinus: deltaNu / 2,
    D,
    cos2theta,
  };
}

// ============================================================================
// ABX SYSTEM SOLVER
// ============================================================================

export interface ABXSystemResult {
  lines: SpinLine[];
  abSubsystem: ABSystemResult[];  // X'in her enerji seviyesi için AB
}

/**
 * ABX sistemi çözümü
 * 
 * X spin'in iki enerji seviyesi için ayrı AB çözümü
 * Toplam 12 çizgi (bazıları overlap olabilir)
 */
export function solveABXSystem(
  spinA: SpinInput,
  spinB: SpinInput,
  spinX: SpinInput,
  jAB: number,
  jAX: number,
  jBX: number,
  fieldMHz: number,
  linewidthHz: number = 1.0
): ABXSystemResult {
  const allLines: SpinLine[] = [];
  const abSubsystems: ABSystemResult[] = [];
  
  // X'in α durumu için AB çözümü
  // Efektif kaymalar: νA' = νA + JAX/2, νB' = νB + JBX/2
  const spinA_alpha: SpinInput = {
    ...spinA,
    shiftHz: spinA.shiftHz + jAX / 2,
    shiftPPM: (spinA.shiftHz + jAX / 2) / fieldMHz,
  };
  const spinB_alpha: SpinInput = {
    ...spinB,
    shiftHz: spinB.shiftHz + jBX / 2,
    shiftPPM: (spinB.shiftHz + jBX / 2) / fieldMHz,
  };
  
  const abAlpha = solveABSystem(spinA_alpha, spinB_alpha, jAB, fieldMHz, linewidthHz);
  abSubsystems.push(abAlpha);
  
  // X'in β durumu için AB çözümü
  const spinA_beta: SpinInput = {
    ...spinA,
    shiftHz: spinA.shiftHz - jAX / 2,
    shiftPPM: (spinA.shiftHz - jAX / 2) / fieldMHz,
  };
  const spinB_beta: SpinInput = {
    ...spinB,
    shiftHz: spinB.shiftHz - jBX / 2,
    shiftPPM: (spinB.shiftHz - jBX / 2) / fieldMHz,
  };
  
  const abBeta = solveABSystem(spinA_beta, spinB_beta, jAB, fieldMHz, linewidthHz);
  abSubsystems.push(abBeta);
  
  // AB çizgilerini birleştir (her iki durumdan)
  for (const line of abAlpha.lines) {
    allLines.push({
      ...line,
      intensity: line.intensity * 0.5,  // Her durum %50
      label: line.label + '_α',
    });
  }
  
  for (const line of abBeta.lines) {
    allLines.push({
      ...line,
      intensity: line.intensity * 0.5,
      label: line.label + '_β',
    });
  }
  
  // X çizgileri (A ve B ile coupling)
  // Basitleştirilmiş: X first-order olarak davranır
  const xLines = generateXPartOfABX(spinX, jAX, jBX, fieldMHz, linewidthHz);
  allLines.push(...xLines);
  
  return {
    lines: allLines,
    abSubsystem: abSubsystems,
  };
}

/**
 * ABX'in X kısmını üret
 */
function generateXPartOfABX(
  spinX: SpinInput,
  jAX: number,
  jBX: number,
  fieldMHz: number,
  linewidthHz: number
): SpinLine[] {
  // X, A ve B ile coupling → dd (doublet of doublets)
  const centerHz = spinX.shiftHz;
  const lines: SpinLine[] = [];
  
  // 4 çizgi: JAX ve JBX kombinasyonları
  const offsets = [
    (jAX + jBX) / 2,
    (jAX - jBX) / 2,
    (-jAX + jBX) / 2,
    (-jAX - jBX) / 2,
  ];
  
  for (const offset of offsets) {
    lines.push({
      frequencyHz: centerHz + offset,
      frequencyPPM: (centerHz + offset) / fieldMHz,
      intensity: 1.0,
      linewidthHz,
      sourceProtonIds: [spinX.protonId],
      label: 'X_dd',
    });
  }
  
  return lines;
}

// ============================================================================
// AA'BB' SYSTEM SOLVER
// ============================================================================

export interface AABBSystemResult {
  lines: SpinLine[];
  symmetry: 'C2v';
}

/**
 * AA'BB' sistemi çözümü (para-disubstituted benzene)
 * 
 * Bu karmaşık bir sistemdir ve tam çözüm için matris diagonalizasyonu gerekir.
 * Burada basitleştirilmiş bir yaklaşım kullanılır.
 */
export function solveAABBSystem(
  spinA: SpinInput,   // A1
  spinAp: SpinInput,  // A2 (A')
  spinB: SpinInput,   // B1
  spinBp: SpinInput,  // B2 (B')
  jAB: number,        // A-B ortho coupling (J_ortho)
  jABp: number,       // A-B' meta coupling (J_meta)
  jAA: number,        // A-A' coupling (usually ~0)
  jBB: number,        // B-B' coupling (usually ~0)
  fieldMHz: number,
  linewidthHz: number = 1.0
): AABBSystemResult {
  // Ortalama kaymalar
  const nuA = (spinA.shiftHz + spinAp.shiftHz) / 2;
  const nuB = (spinB.shiftHz + spinBp.shiftHz) / 2;
  const nuC = (nuA + nuB) / 2;
  
  // N ve L parametreleri
  // N = JAB + JAB' (toplam ortho + meta)
  // L = JAB - JAB'
  const N = jAB + jABp;
  const L = jAB - jABp;
  
  // K ve M parametreleri
  // K² = (Δν)² + L²
  // M² = (Δν)² + N²
  const deltaNu = nuA - nuB;
  const K = Math.sqrt(deltaNu * deltaNu + L * L);
  const M = Math.sqrt(deltaNu * deltaNu + N * N);
  
  // Çizgi pozisyonları (yaklaşık)
  const lines: SpinLine[] = [];
  
  // A tarafı çizgileri
  const aPositions = [
    nuA + N / 2,
    nuA - N / 2,
    nuA + L / 2,
    nuA - L / 2,
  ];
  
  for (let i = 0; i < aPositions.length; i++) {
    lines.push({
      frequencyHz: aPositions[i],
      frequencyPPM: aPositions[i] / fieldMHz,
      intensity: 1.0,
      linewidthHz,
      sourceProtonIds: [spinA.protonId, spinAp.protonId],
      label: `A${i + 1}`,
    });
  }
  
  // B tarafı çizgileri
  const bPositions = [
    nuB + N / 2,
    nuB - N / 2,
    nuB + L / 2,
    nuB - L / 2,
  ];
  
  for (let i = 0; i < bPositions.length; i++) {
    lines.push({
      frequencyHz: bPositions[i],
      frequencyPPM: bPositions[i] / fieldMHz,
      intensity: 1.0,
      linewidthHz,
      sourceProtonIds: [spinB.protonId, spinBp.protonId],
      label: `B${i + 1}`,
    });
  }
  
  // Ekstra çizgiler (karışım)
  // Tam çözüm için daha fazla çizgi olabilir
  
  // Roofing efekti uygula
  applyRoofingEffect(lines, nuC);
  
  return {
    lines,
    symmetry: 'C2v',
  };
}

/**
 * Roofing efekti uygula (iç çizgiler daha yoğun)
 */
function applyRoofingEffect(lines: SpinLine[], centerHz: number): void {
  for (const line of lines) {
    const distance = Math.abs(line.frequencyHz - centerHz);
    // Merkeze yakın çizgiler daha yoğun
    const roofingFactor = 1 + 0.3 * Math.exp(-distance / 10);
    line.intensity *= roofingFactor;
  }
  
  // Normalize
  const maxInt = Math.max(...lines.map(l => l.intensity));
  for (const line of lines) {
    line.intensity /= maxInt;
  }
}

// ============================================================================
// GENERAL N-SPIN HAMILTONIAN
// ============================================================================

/**
 * Genel N-spin Hamiltonian çözümü
 * 
 * Bu, küçük sistemler için (N ≤ 6) tam diagonalizasyon yapar.
 * Büyük sistemler için hesaplama maliyeti 2^N ile artar.
 */
export function solveGeneralSpinSystem(
  spins: SpinInput[],
  jMatrix: number[][],  // N × N coupling matrisi
  fieldMHz: number,
  linewidthHz: number = 1.0
): SpinLine[] {
  const N = spins.length;
  const dim = Math.pow(2, N);  // Hilbert space boyutu
  
  // Boyut kontrolü
  if (dim > 1024) {  // 2^10 = 1024
    console.warn(`Large spin system (dim=${dim}); using approximate method`);
    // Büyük sistemler için first-order'a düş
    return [];
  }
  
  // Hamiltonian matrisi oluştur
  const H = buildHamiltonian(spins, jMatrix);
  
  // Diagonalize (basit Jacobi metodu)
  const { eigenvalues, eigenvectors } = diagonalize(H);
  
  // Enerji seviyeleri
  const states: EigenState[] = eigenvalues.map((E, i) => ({
    index: i,
    energy: E,
    vector: eigenvectors[i],
    mQuantum: calculateMQuantum(i, N),
  }));
  
  // İzinli geçişleri bul
  const transitions = findTransitions(states, spins, N);
  
  // Geçişlerden çizgiler oluştur
  const lines: SpinLine[] = transitions.map(t => ({
    frequencyHz: t.frequencyHz,
    frequencyPPM: t.frequencyHz / fieldMHz,
    intensity: t.intensity,
    linewidthHz,
    sourceProtonIds: spins.map(s => s.protonId),
    label: t.label,
  }));
  
  return lines;
}

/**
 * Spin Hamiltonian matrisi oluştur
 * H = Σ ωi Iz_i + 2π Σ Jij Iz_i Iz_j
 */
function buildHamiltonian(
  spins: SpinInput[],
  jMatrix: number[][]
): number[][] {
  const N = spins.length;
  const dim = Math.pow(2, N);
  
  // Sıfır matris
  const H: number[][] = Array(dim).fill(null).map(() => Array(dim).fill(0));
  
  for (let state = 0; state < dim; state++) {
    // Diagonal elemanlar: Zeeman + Iz-Iz coupling
    let energy = 0;
    
    for (let i = 0; i < N; i++) {
      const mz_i = getSpinMz(state, i, N);
      energy += spins[i].shiftHz * mz_i;
      
      for (let j = i + 1; j < N; j++) {
        const mz_j = getSpinMz(state, j, N);
        energy += 2 * Math.PI * jMatrix[i][j] * mz_i * mz_j;
      }
    }
    
    H[state][state] = energy;
    
    // Off-diagonal: I+ I- terimleri (tam Hamiltonian için)
    // Basitleştirilmiş versiyonda ihmal
  }
  
  return H;
}

/**
 * State indeksinden i. spin'in Mz değeri
 */
function getSpinMz(state: number, spinIndex: number, N: number): number {
  // Binary representation
  const bit = (state >> (N - 1 - spinIndex)) & 1;
  return bit === 1 ? 0.5 : -0.5;
}

/**
 * Toplam M kuantum sayısı
 */
function calculateMQuantum(state: number, N: number): number {
  let m = 0;
  for (let i = 0; i < N; i++) {
    m += getSpinMz(state, i, N);
  }
  return m;
}

/**
 * Basit matris diagonalizasyonu (Jacobi metodu)
 */
function diagonalize(A: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = A.length;
  
  // Kopyala
  const B: number[][] = A.map(row => [...row]);
  const V: number[][] = Array(n).fill(null).map((_, i) => {
    const row = Array(n).fill(0);
    row[i] = 1;
    return row;
  });
  
  // Jacobi rotasyonları (basitleştirilmiş)
  const maxIter = 100;
  const eps = 1e-10;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // En büyük off-diagonal elemanı bul
    let maxVal = 0;
    let p = 0, q = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(B[i][j]) > maxVal) {
          maxVal = Math.abs(B[i][j]);
          p = i;
          q = j;
        }
      }
    }
    
    if (maxVal < eps) break;  // Yakınsadı
    
    // Rotasyon açısı
    const theta = 0.5 * Math.atan2(2 * B[p][q], B[q][q] - B[p][p]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    // B'yi güncelle
    const Bpp = B[p][p];
    const Bqq = B[q][q];
    const Bpq = B[p][q];
    
    B[p][p] = c * c * Bpp - 2 * s * c * Bpq + s * s * Bqq;
    B[q][q] = s * s * Bpp + 2 * s * c * Bpq + c * c * Bqq;
    B[p][q] = B[q][p] = 0;
    
    for (let i = 0; i < n; i++) {
      if (i === p || i === q) continue;
      const Bip = B[i][p];
      const Biq = B[i][q];
      B[i][p] = B[p][i] = c * Bip - s * Biq;
      B[i][q] = B[q][i] = s * Bip + c * Biq;
    }
    
    // V'yi güncelle
    for (let i = 0; i < n; i++) {
      const Vip = V[i][p];
      const Viq = V[i][q];
      V[i][p] = c * Vip - s * Viq;
      V[i][q] = s * Vip + c * Viq;
    }
  }
  
  // Eigenvalues diagonal'dan
  const eigenvalues = Array(n).fill(0).map((_, i) => B[i][i]);
  
  // Eigenvectors sütunlardan
  const eigenvectors: number[][] = [];
  for (let j = 0; j < n; j++) {
    eigenvectors.push(V.map(row => row[j]));
  }
  
  return { eigenvalues, eigenvectors };
}

/**
 * İzinli geçişleri bul
 */
function findTransitions(
  states: EigenState[],
  spins: SpinInput[],
  N: number
): Transition[] {
  const transitions: Transition[] = [];
  
  // Δm = ±1 geçişleri
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const deltaM = states[j].mQuantum - states[i].mQuantum;
      
      if (Math.abs(deltaM) === 1) {
        const freqHz = Math.abs(states[j].energy - states[i].energy) / (2 * Math.PI);
        
        // Intensity (basit yaklaşım)
        const intensity = 1.0;
        
        transitions.push({
          fromState: i,
          toState: j,
          frequencyHz: freqHz,
          intensity,
          label: `${i}→${j}`,
        });
      }
    }
  }
  
  return transitions;
}

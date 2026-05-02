/**
 * SpectroMind v2.0 - Special Packs
 * 
 * Özel durumlar için ek paketler:
 * - Aldehyde coupling
 * - Benzylic/Allylic
 * - Exchangeable protons
 * - Amide rotamer
 * - Tautomer/Mesomer
 */

import {
  SpecialPacksConfig,
  Proton,
  JEdge,
  ExchangeSite,
  DynamicEvent,
  Solvent,
  SOLVENT_PRESETS,
} from '@/lib/types/nmr-simulation';

// ============================================================================
// ALDEHYDE COUPLING PACK
// ============================================================================

export interface AldehydeAnalysisResult {
  isAldehyde: boolean;
  alphaProtons: string[];       // α pozisyondaki proton ID'leri
  expectedJRange: [number, number];
  shiftWindow: [number, number];
}

/**
 * Aldehit coupling analizi
 * CHO genelde 9-10.5 ppm, α-proton ile küçük J (1-3 Hz)
 */
export function analyzeAldehydeCoupling(
  protons: Proton[],
  moleculeHasAldehyde: boolean,
  config: SpecialPacksConfig['aldehyde']
): AldehydeAnalysisResult {
  if (!config.enabled || !moleculeHasAldehyde) {
    return {
      isAldehyde: false,
      alphaProtons: [],
      expectedJRange: [0, 0],
      shiftWindow: [0, 0],
    };
  }
  
  // Aldehit protonunu bul (δ 9-10.5)
  const aldehydeProtons = protons.filter(p => 
    p.type === 'aldehyde' || 
    (p.deltaFinal >= config.choWindowPPM[0] && p.deltaFinal <= config.choWindowPPM[1])
  );
  
  if (aldehydeProtons.length === 0) {
    return {
      isAldehyde: false,
      alphaProtons: [],
      expectedJRange: [0, 0],
      shiftWindow: config.choWindowPPM,
    };
  }
  
  // α protonlarını bul (aldehit karbonuna komşu)
  // Bu, molekül yapısı analizi gerektirir - basitleştirilmiş versiyon
  const alphaProtons: string[] = [];
  
  return {
    isAldehyde: true,
    alphaProtons,
    expectedJRange: config.alphaJRange,
    shiftWindow: config.choWindowPPM,
  };
}

/**
 * Aldehit için J edge'lerini düzelt
 */
export function applyAldehydeJCorrections(
  edges: JEdge[],
  aldehydeProtonIds: string[],
  config: SpecialPacksConfig['aldehyde']
): JEdge[] {
  if (!config.enabled) return edges;
  
  return edges.map(edge => {
    const involvesAldehyde = 
      aldehydeProtonIds.includes(edge.proton1Id) || 
      aldehydeProtonIds.includes(edge.proton2Id);
    
    if (involvesAldehyde && edge.couplingType === '3J') {
      // Aldehit α-coupling genelde küçük
      if (edge.jHz > 3) {
        return {
          ...edge,
          jHz: Math.min(edge.jHz, 3),
          source: 'motif' as const,
        };
      }
    }
    
    return edge;
  });
}

// ============================================================================
// BENZYLIC/ALLYLIC PACK
// ============================================================================

export interface BenzylicAllylicResult {
  benzylicProtons: string[];
  allylicProtons: string[];
  longRangeEdges: JEdge[];
}

/**
 * Benzylic ve allylic proton tespiti
 */
export function analyzeBenzylicAllylic(
  protons: Proton[],
  edges: JEdge[],
  config: SpecialPacksConfig['benzylicAllylic']
): BenzylicAllylicResult {
  if (!config.enabled) {
    return { benzylicProtons: [], allylicProtons: [], longRangeEdges: [] };
  }
  
  const benzylicProtons = protons
    .filter(p => p.type === 'benzylic' || 
      (p.deltaFinal >= config.benzylicShiftRange[0] && 
       p.deltaFinal <= config.benzylicShiftRange[1]))
    .map(p => p.id);
  
  const allylicProtons = protons
    .filter(p => p.type === 'allylic' ||
      (p.deltaFinal >= config.allylicShiftRange[0] &&
       p.deltaFinal <= config.allylicShiftRange[1]))
    .map(p => p.id);
  
  // Long-range coupling edge'leri
  const longRangeEdges = edges.filter(e => 
    e.couplingType === '4J' &&
    e.jHz >= config.longRange4JRange[0] &&
    e.jHz <= config.longRange4JRange[1]
  );
  
  return {
    benzylicProtons,
    allylicProtons,
    longRangeEdges,
  };
}

// ============================================================================
// EXCHANGEABLE PROTONS PACK
// ============================================================================

export interface ExchangeableResult {
  protonIds: string[];
  visible: boolean;
  linewidthHz: number;
  exchangeSites: ExchangeSite[];
}

/**
 * Exchangeable proton analizi (OH, NH, COOH)
 */
export function analyzeExchangeableProtons(
  protons: Proton[],
  solvent: Solvent,
  config: SpecialPacksConfig['exchangeable']
): ExchangeableResult {
  if (!config.enabled) {
    return {
      protonIds: [],
      visible: true,
      linewidthHz: 1.0,
      exchangeSites: [],
    };
  }
  
  const exchangeableProtons = protons.filter(p => p.isExchangeable);
  const protonIds = exchangeableProtons.map(p => p.id);
  
  // D2O'da görünmezlik
  const solventPreset = SOLVENT_PRESETS[solvent];
  const visible = config.d2oRemoval ? !solventPreset.exchangeableRemoved : true;
  
  // Linewidth
  const linewidthHz = visible ? config.broadLinewidthHz : 0;
  
  // Exchange sites oluştur
  const exchangeSites: ExchangeSite[] = [];
  
  if (visible) {
    for (const p of exchangeableProtons) {
      exchangeSites.push({
        siteId: `ex_${p.id}`,
        protonIds: [p.id],
        states: [
          { name: 'free', deltaPPM: p.deltaFinal, population: 0.5 },
          { name: 'h-bonded', deltaPPM: p.deltaFinal + 2, population: 0.5 },
        ],
        rateK: 1000,  // Fast exchange default
        regime: 'fast',
        linewidthExtraHz: linewidthHz,
      });
    }
  }
  
  return {
    protonIds,
    visible,
    linewidthHz,
    exchangeSites,
  };
}

// ============================================================================
// AMIDE ROTAMER PACK
// ============================================================================

export interface AmideRotamerResult {
  hasAmide: boolean;
  rotamerEvents: DynamicEvent[];
  expectedDuplication: boolean;
  affectedProtons: string[];
}

/**
 * Amid rotamer analizi
 */
export function analyzeAmideRotamer(
  protons: Proton[],
  moleculeHasAmide: boolean,
  solvent: Solvent,
  config: SpecialPacksConfig['amideRotamer']
): AmideRotamerResult {
  if (!config.enabled || !moleculeHasAmide) {
    return {
      hasAmide: false,
      rotamerEvents: [],
      expectedDuplication: false,
      affectedProtons: [],
    };
  }
  
  // Amid bariyeri yüksek → slow exchange → iki set sinyal olabilir
  const barrierKcal = config.barrierKcal;
  
  // DMSO'da rotamer ayrımı daha belirgin
  const dmsoEnhanced = config.dmsoEnhancement && solvent === 'DMSO-d6';
  
  // N-attached protonları bul
  const affectedProtons = protons
    .filter(p => p.type === 'n_ch' || p.type === 'n_ch2' || p.type === 'n_ch3' || p.type === 'nh')
    .map(p => p.id);
  
  // Rotamer eventi oluştur
  const rotamerEvents: DynamicEvent[] = [{
    id: 'amide_rotamer',
    type: 'amide_rotamer',
    affectedAtomIndices: [],  // Molekül analizinden doldurulmalı
    barrierKcal,
    estimatedRateK: dmsoEnhanced ? 50 : 100,  // Slow
  }];
  
  // k/Δν oranına göre duplication beklentisi
  // DMSO'da ve yüksek bariyerde iki set beklenir
  const expectedDuplication = barrierKcal > 15 || dmsoEnhanced;
  
  return {
    hasAmide: true,
    rotamerEvents,
    expectedDuplication,
    affectedProtons,
  };
}

// ============================================================================
// TAUTOMER/MESOMER PACK
// ============================================================================

export interface TautomerResult {
  hasTautomer: boolean;
  tautomerType: 'keto-enol' | 'lactam-lactim' | 'other' | 'none';
  enolOHShift?: number;       // Çok downfield olabilir
  exchangeRate: 'fast' | 'slow' | 'intermediate';
  states: Array<{
    name: string;
    population: number;
    deltaShifts: Record<string, number>;
  }>;
}

/**
 * Tautomer/mesomer analizi
 */
export function analyzeTautomer(
  protons: Proton[],
  moleculeHasKetoEnol: boolean,
  config: SpecialPacksConfig['tautomer']
): TautomerResult {
  if (!config.enabled) {
    return {
      hasTautomer: false,
      tautomerType: 'none',
      exchangeRate: 'fast',
      states: [],
    };
  }
  
  if (!moleculeHasKetoEnol) {
    return {
      hasTautomer: false,
      tautomerType: 'none',
      exchangeRate: 'fast',
      states: [],
    };
  }
  
  // Keto-enol tautomerizmi
  // Enol OH çok downfield olabilir (12-18 ppm, intramoleküler H-bond)
  
  return {
    hasTautomer: true,
    tautomerType: 'keto-enol',
    enolOHShift: config.downfieldOHThreshold,
    exchangeRate: 'intermediate',  // Genelde orta hızda
    states: [
      {
        name: 'keto',
        population: 0.3,
        deltaShifts: {},
      },
      {
        name: 'enol',
        population: 0.7,
        deltaShifts: {},
      },
    ],
  };
}

// ============================================================================
// COMBINED SPECIAL PACKS ANALYSIS
// ============================================================================

export interface SpecialPacksAnalysisResult {
  aldehyde: AldehydeAnalysisResult;
  benzylicAllylic: BenzylicAllylicResult;
  exchangeable: ExchangeableResult;
  amideRotamer: AmideRotamerResult;
  tautomer: TautomerResult;
  modifiedEdges: JEdge[];
  modifiedProtons: Proton[];
  additionalExchangeSites: ExchangeSite[];
  warnings: string[];
}

/**
 * Tüm özel paketleri çalıştır
 */
export function runSpecialPacksAnalysis(
  protons: Proton[],
  edges: JEdge[],
  structure: {
    hasAldehyde: boolean;
    hasAmide: boolean;
    hasKetoEnol: boolean;
  },
  solvent: Solvent,
  config: SpecialPacksConfig
): SpecialPacksAnalysisResult {
  const warnings: string[] = [];
  
  // Aldehyde
  const aldehyde = analyzeAldehydeCoupling(protons, structure.hasAldehyde, config.aldehyde);
  
  // Benzylic/Allylic
  const benzylicAllylic = analyzeBenzylicAllylic(protons, edges, config.benzylicAllylic);
  
  // Exchangeable
  const exchangeable = analyzeExchangeableProtons(protons, solvent, config.exchangeable);
  
  // Amide rotamer
  const amideRotamer = analyzeAmideRotamer(protons, structure.hasAmide, solvent, config.amideRotamer);
  
  // Tautomer
  const tautomer = analyzeTautomer(protons, structure.hasKetoEnol, config.tautomer);
  
  // Edge düzeltmeleri
  let modifiedEdges = [...edges];
  if (aldehyde.isAldehyde) {
    // Aldehit proton ID'lerini bul
    const aldehydeProtonIds = protons
      .filter(p => p.type === 'aldehyde')
      .map(p => p.id);
    modifiedEdges = applyAldehydeJCorrections(modifiedEdges, aldehydeProtonIds, config.aldehyde);
  }
  
  // Proton düzeltmeleri (linewidth vs)
  const modifiedProtons = protons.map(p => {
    if (exchangeable.protonIds.includes(p.id)) {
      // Exchangeable proton görünürlüğü
      if (!exchangeable.visible) {
        return { ...p, deltaFinal: 0 };  // Görünmez yap
      }
    }
    return p;
  });
  
  // Ek exchange sites
  const additionalExchangeSites: ExchangeSite[] = [
    ...exchangeable.exchangeSites,
  ];
  
  // Warnings
  if (amideRotamer.expectedDuplication) {
    warnings.push('Amide rotamer duplication expected; check for doubled signals');
  }
  
  if (tautomer.hasTautomer) {
    warnings.push(`Tautomerism detected (${tautomer.tautomerType}); signals may be averaged or broadened`);
  }
  
  if (!exchangeable.visible && exchangeable.protonIds.length > 0) {
    warnings.push(`Exchangeable protons (${exchangeable.protonIds.length}) not visible in ${solvent}`);
  }
  
  return {
    aldehyde,
    benzylicAllylic,
    exchangeable,
    amideRotamer,
    tautomer,
    modifiedEdges,
    modifiedProtons,
    additionalExchangeSites,
    warnings,
  };
}

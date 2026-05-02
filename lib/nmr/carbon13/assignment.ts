import type { Carbon13Peak } from '@/lib/types';

export interface AssignCarbon13Options {
  /** UI / FID metadata çözücü (örn. DMSO-d6, Pyridine-d5). Boşsa pyridine residual pencereleri uygulanmaz. */
  solvent?: string;
}

function solventSuggestsPyridineLike(s?: string): boolean {
  const u = (s || '').toLowerCase();
  return u.includes('pyridin') || u.includes('c5d5n') || u.includes('py-d5') || u.includes('pyridine');
}

function solventSuggestsDmso(s?: string): boolean {
  const u = (s || '').toLowerCase();
  return u.includes('dmso') || u.includes('dimethyl sulfoxide');
}

export interface Carbon13Assignment {
  assignment_label: string;
  assignment_class: string;
  confidence: number;
  evidence_type: string;
  residual_flag: boolean;
  analyte_flag: boolean;
  explanation_short: string;
  /** Birincil sahiplik: residual küme ile analyte/anchor çakışmasını tekilleştirir. */
  cluster_owner: 'residual' | 'oleanolic_anchor' | 'analyte' | 'broad_fallback';
}

const inRange = (ppm: number, min: number, max: number): boolean => ppm >= min && ppm <= max;

/**
 * DMSO çözücüsünde pyridine-d5 residual pencereleri uygulanmaz (FID’de ~123 ppm oleanolic C=C ile karışmaz).
 * Pyridine-d5’te: önce dar oleanolic C-12, sonra pyridine beta (geniş) — böylece 122.33 analyte, 123.3 residual kalır.
 */
export function assignCarbon13Peak(ppm: number, options?: AssignCarbon13Options): Carbon13Assignment {
  const sol = options?.solvent;
  const pySolv = solventSuggestsPyridineLike(sol);
  const dmsoSolv = solventSuggestsDmso(sol);

  // --- DMSO-d6 residual (yalnızca DMSO çözücüsünde) ---
  if (dmsoSolv && inRange(ppm, 39.20, 39.90)) {
    return {
      assignment_label: 'DMSO-d6 residual carbon',
      assignment_class: 'solvent_residual',
      confidence: 0.95,
      evidence_type: 'solvent_signature',
      residual_flag: true,
      analyte_flag: false,
      explanation_short: '~39.5 ppm DMSO-d6 residual karbon bölgesi.',
      cluster_owner: 'residual',
    };
  }

  // --- Oleanolic anchors (pyridine ile çakışan C-12: çözücüye göre dar veya geniş pencere) ---
  if (inRange(ppm, 179.74, 179.93)) {
    return {
      assignment_label: 'C-28 carboxylic acid carbonyl',
      assignment_class: 'oleanolic_anchor',
      confidence: 0.98,
      evidence_type: 'cross_modal_anchor',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Oleanolic acid için karboksilik asit karbonil anchor’ı.',
      cluster_owner: 'oleanolic_anchor',
    };
  }
  if (inRange(ppm, 144.40, 144.59)) {
    return {
      assignment_label: 'C-13 quaternary olefinic carbon',
      assignment_class: 'oleanolic_anchor',
      confidence: 0.96,
      evidence_type: 'cross_modal_anchor',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Oleanolic acid için olefinik kuaterner karbon anchor’ı.',
      cluster_owner: 'oleanolic_anchor',
    };
  }
  const c12OlefinicMin = pySolv ? 122.14 : 121.9;
  const c12OlefinicMax = pySolv ? 122.68 : 123.95;
  if (inRange(ppm, c12OlefinicMin, c12OlefinicMax)) {
    return {
      assignment_label: 'C-12 olefinic CH carbon',
      assignment_class: 'oleanolic_anchor',
      confidence: pySolv ? 0.95 : 0.9,
      evidence_type: 'cross_modal_anchor',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: pySolv
        ? 'Oleanolic acid için olefinik CH anchor’ı (dar pencere; pyridine-d5 beta kümesi ile ayrıştırıldı).'
        : 'Oleanolic acid / pentasiklik triterpenoid için olefinik CH (C=C) bölgesi; DMSO’da pyridine residual olarak etiketlenmez.',
      cluster_owner: 'oleanolic_anchor',
    };
  }

  // --- Pyridine-d5 residual kümeleri (yalnızca pyridine benzeri çözücü seçiliyse) ---
  if (pySolv && inRange(ppm, 148.95, 150.10)) {
    return {
      assignment_label: 'Pyridine-d5 alpha-carbon residual',
      assignment_class: 'solvent_residual',
      confidence: 0.97,
      evidence_type: 'cluster_match',
      residual_flag: true,
      analyte_flag: false,
      explanation_short: '149.13–149.90 ppm pyridine-d5 alpha residual kümesi.',
      cluster_owner: 'residual',
    };
  }
  if (pySolv && inRange(ppm, 134.50, 135.95)) {
    return {
      assignment_label: 'Pyridine-d5 gamma-carbon residual',
      assignment_class: 'solvent_residual',
      confidence: 0.97,
      evidence_type: 'cluster_match',
      residual_flag: true,
      analyte_flag: false,
      explanation_short: '134.5–135.9 ppm pyridine-d5 gamma residual kümesi.',
      cluster_owner: 'residual',
    };
  }
  if (pySolv && inRange(ppm, 122.70, 123.70)) {
    return {
      assignment_label: 'Pyridine-d5 beta-carbon residual',
      assignment_class: 'solvent_residual',
      confidence: 0.97,
      evidence_type: 'cluster_match',
      residual_flag: true,
      analyte_flag: false,
      explanation_short: '122.7–123.7 ppm pyridine-d5 beta residual kümesi.',
      cluster_owner: 'residual',
    };
  }
  if (inRange(ppm, 77.68, 77.87)) {
    return {
      assignment_label: 'C-3 oxygenated carbon',
      assignment_class: 'oleanolic_anchor',
      confidence: 0.95,
      evidence_type: 'cross_modal_anchor',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Oleanolic acid için C-3 oksijenli karbon anchor’ı.',
      cluster_owner: 'oleanolic_anchor',
    };
  }

  if (inRange(ppm, 10.0, 17.99)) {
    return {
      assignment_label: 'methyl carbon',
      assignment_class: 'structural_class_assignment',
      confidence: 0.88,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Alifatik metil karbon bölgesi; triterpenoid iskeletle uyumlu.',
      cluster_owner: 'analyte',
    };
  }
  if (inRange(ppm, 18.0, 37.99)) {
    return {
      assignment_label: 'methylene-rich aliphatic carbon',
      assignment_class: 'structural_class_assignment',
      confidence: 0.86,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Methylene/methine ağırlıklı alifatik karbon bölgesi.',
      cluster_owner: 'analyte',
    };
  }
  if (inRange(ppm, 38.0, 56.0)) {
    return {
      assignment_label: 'aliphatic sp3 carbon',
      assignment_class: 'structural_class_assignment',
      confidence: 0.84,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Deshielded alifatik sp3 karbon; pentasiklik iskelet ile uyumlu.',
      cluster_owner: 'analyte',
    };
  }
  if (inRange(ppm, 56.01, 90.0)) {
    return {
      assignment_label: 'oxygenated sp3 carbon',
      assignment_class: 'structural_class_assignment',
      confidence: 0.72,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Oksijen komşuluğunda sp3 karbon bölgesi.',
      cluster_owner: 'analyte',
    };
  }
  if (inRange(ppm, 120.0, 149.0)) {
    return {
      assignment_label: 'olefinic CH/quaternary carbon',
      assignment_class: 'structural_class_assignment',
      confidence: 0.66,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Olefinik bölge; residual/anchor dışı analyte değerlendirmesi.',
      cluster_owner: 'analyte',
    };
  }
  if (inRange(ppm, 170.0, 183.0)) {
    return {
      assignment_label: 'carboxylic acid carbonyl',
      assignment_class: 'structural_class_assignment',
      confidence: 0.82,
      evidence_type: 'range_classification',
      residual_flag: false,
      analyte_flag: true,
      explanation_short: 'Karboksilik asit karbonil bölgesi.',
      cluster_owner: 'analyte',
    };
  }

  return {
    assignment_label: 'trace impurity carbon candidate',
    assignment_class: 'broad_region_assignment',
    confidence: 0.45,
    evidence_type: 'broad_region_fallback',
    residual_flag: false,
    analyte_flag: false,
    explanation_short: 'Keskin anchor/residual eşleşmesi yok; geniş bölge fallback etiketi atandı.',
    cluster_owner: 'broad_fallback',
  };
}

export function applyCarbon13Assignment(peak: Carbon13Peak, solvent?: string): Carbon13Peak {
  const assignment = assignCarbon13Peak(peak.ppm, solvent ? { solvent } : undefined);
  return {
    ...peak,
    assignment: assignment.assignment_label,
    carbonType: peak.carbonType || (
      assignment.assignment_class === 'solvent_residual'
        ? 'Cq'
        : assignment.assignment_label.includes('methyl')
          ? 'CH3'
          : assignment.assignment_label.includes('methylene')
            ? 'CH2'
            : assignment.assignment_label.includes('olefinic CH')
              ? 'CH'
              : 'Cq'
    ),
    assignment_label: assignment.assignment_label,
    assignment_class: assignment.assignment_class,
    confidence: assignment.confidence,
    evidence_type: assignment.evidence_type,
    residual_flag: assignment.residual_flag,
    analyte_flag: assignment.analyte_flag,
    explanation_short: assignment.explanation_short,
  } as Carbon13Peak;
}

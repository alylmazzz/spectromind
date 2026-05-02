/**
 * Comprehensive Functional Group Spectroscopy Library
 * Based on Silverstein NMR Spectroscopy textbook
 * Contains 80+ functional groups with ¹H NMR, ¹³C NMR, and FT-IR characteristic peaks
 */

export interface FunctionalGroupSpectrum {
  id: number;
  name: string;
  nameEn: string;
  structure: string;
  h1nmr: {
    range: string;
    ppm: [number, number];
    description: string;
    multiplicity?: string;
  }[];
  c13nmr: {
    range: string;
    ppm: [number, number];
    description: string;
  };
  ftir: {
    range: string;
    wavenumber: [number, number];
    intensity: 'weak' | 'medium' | 'strong' | 'variable';
    assignment: string;
  }[];
  diagnosticFeatures: string[];
  warnings?: string[];
}

export const FUNCTIONAL_GROUP_LIBRARY: FunctionalGroupSpectrum[] = [
  // 1-20: Basic functional groups
  {
    id: 1,
    name: 'Alkan (sp³ C–H)',
    nameEn: 'Alkane',
    structure: 'R-H',
    h1nmr: [{
      range: '0.8 – 1.5 ppm',
      ppm: [0.8, 1.5],
      description: 'CH₃, CH₂, CH protonları'
    }],
    c13nmr: {
      range: '10 – 50 ppm',
      ppm: [10, 50],
      description: 'Alifatik karbonlar'
    },
    ftir: [
      {
        range: '2850–2960 cm⁻¹',
        wavenumber: [2850, 2960],
        intensity: 'strong',
        assignment: 'C–H stretch'
      },
      {
        range: '1465, 1375 cm⁻¹',
        wavenumber: [1375, 1465],
        intensity: 'medium',
        assignment: 'C–H bending'
      }
    ],
    diagnosticFeatures: [
      'En basit fonksiyonel grup',
      'Baseline bölge',
      'Multiplisite n+1 kuralına uyar'
    ]
  },

  {
    id: 2,
    name: 'Alken (C=C)',
    nameEn: 'Alkene',
    structure: 'R-CH=CH-R',
    h1nmr: [{
      range: '4.5 – 6.5 ppm',
      ppm: [4.5, 6.5],
      description: 'Vinilik H (=CH)',
      multiplicity: 'dd, ddd'
    }],
    c13nmr: {
      range: '100 – 150 ppm',
      ppm: [100, 150],
      description: 'sp² karbonlar'
    },
    ftir: [
      {
        range: '1640–1680 cm⁻¹',
        wavenumber: [1640, 1680],
        intensity: 'medium',
        assignment: 'C=C stretch'
      },
      {
        range: '3020–3100 cm⁻¹',
        wavenumber: [3020, 3100],
        intensity: 'medium',
        assignment: '=C–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Konjugasyon ile kayma gösterir',
      'Trans/cis J değerleri farklı (trans: 11-18 Hz, cis: 6-15 Hz)',
      'Multiplet skewing gösterir'
    ]
  },

  {
    id: 3,
    name: 'Alkin (C≡C)',
    nameEn: 'Alkyne',
    structure: 'R-C≡C-H',
    h1nmr: [{
      range: '1.8 – 3.0 ppm',
      ppm: [1.8, 3.0],
      description: 'Terminal ≡CH',
      multiplicity: 's'
    }],
    c13nmr: {
      range: '65 – 90 ppm',
      ppm: [65, 90],
      description: 'sp karbonlar'
    },
    ftir: [
      {
        range: '2100–2260 cm⁻¹',
        wavenumber: [2100, 2260],
        intensity: 'medium',
        assignment: 'C≡C stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'strong',
        assignment: '≡C–H stretch (keskin)'
      }
    ],
    diagnosticFeatures: [
      '3300 cm⁻¹ keskin pik çok karakteristik',
      'Long-range coupling (⁴J = 2-3 Hz)',
      'Simetrik alkinlerde C≡C IR\'da görünmez'
    ]
  },

  {
    id: 4,
    name: 'Aromatik (Aren)',
    nameEn: 'Aromatic',
    structure: 'Ar-H',
    h1nmr: [{
      range: '6.5 – 8.5 ppm',
      ppm: [6.5, 8.5],
      description: 'Aromatik protonlar',
      multiplicity: 's, d, t, dd'
    }],
    c13nmr: {
      range: '120 – 150 ppm',
      ppm: [120, 150],
      description: 'Aromatik karbonlar'
    },
    ftir: [
      {
        range: '1450–1600 cm⁻¹',
        wavenumber: [1450, 1600],
        intensity: 'strong',
        assignment: 'Aromatik C=C'
      },
      {
        range: '3030 cm⁻¹',
        wavenumber: [3030, 3030],
        intensity: 'medium',
        assignment: 'Ar–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Ortho: J = 7-10 Hz',
      'Meta: J = 2-3 Hz',
      'Para: J = 0-1 Hz',
      'Elektron çekici grup → downfield',
      'Elektron verici grup → upfield'
    ]
  },

  {
    id: 5,
    name: 'Alkil Halojenür (R–X)',
    nameEn: 'Alkyl Halide',
    structure: 'R-X (X=Cl,Br,I)',
    h1nmr: [{
      range: '2.5 – 4.5 ppm',
      ppm: [2.5, 4.5],
      description: 'C–X yanındaki H (halojen tipine göre değişir)'
    }],
    c13nmr: {
      range: '30 – 70 ppm',
      ppm: [30, 70],
      description: 'C–X karbonu'
    },
    ftir: [
      {
        range: '600–800 cm⁻¹',
        wavenumber: [600, 800],
        intensity: 'strong',
        assignment: 'C–Cl'
      },
      {
        range: '500–600 cm⁻¹',
        wavenumber: [500, 600],
        intensity: 'strong',
        assignment: 'C–Br'
      }
    ],
    diagnosticFeatures: [
      'Cl: δ 3.0-4.0 ppm',
      'Br: δ 3.4-4.0 ppm',
      'I: δ 3.1-3.3 ppm',
      'Halojen ne kadar ağırsa o kadar upfield'
    ]
  },

  {
    id: 6,
    name: 'Alkol (R–OH)',
    nameEn: 'Alcohol',
    structure: 'R-OH',
    h1nmr: [
      {
        range: '0.5 – 5.5 ppm',
        ppm: [0.5, 5.5],
        description: 'OH (geniş, değişken, H-bağına bağlı)',
        multiplicity: 'br s'
      },
      {
        range: '3.3 – 4.0 ppm',
        ppm: [3.3, 4.0],
        description: 'C–OH yanındaki H'
      }
    ],
    c13nmr: {
      range: '50 – 80 ppm',
      ppm: [50, 80],
      description: 'C–OH karbonu'
    },
    ftir: [
      {
        range: '3200–3600 cm⁻¹',
        wavenumber: [3200, 3600],
        intensity: 'strong',
        assignment: 'O–H stretch (geniş)'
      },
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'D₂O ile exchange → OH peak kaybolur',
      'Konsantrasyona bağlı kayma',
      'Primer: δ 0.5-3 ppm',
      'Sekonder: δ 1-4 ppm',
      'Tersiyer: δ 2-5 ppm'
    ],
    warnings: [
      'OH peak pozisyonu çok değişkendir!',
      'H-bağı ne kadar güçlüyse o kadar downfield'
    ]
  },

  {
    id: 7,
    name: 'Fenol',
    nameEn: 'Phenol',
    structure: 'Ar-OH',
    h1nmr: [
      {
        range: '4 – 10 ppm',
        ppm: [4, 10],
        description: 'Ar–OH (geniş, alkol\'den daha downfield)',
        multiplicity: 'br s'
      }
    ],
    c13nmr: {
      range: '150 – 160 ppm',
      ppm: [150, 160],
      description: 'Ar–C–OH karbonu'
    },
    ftir: [
      {
        range: '3200–3600 cm⁻¹',
        wavenumber: [3200, 3600],
        intensity: 'strong',
        assignment: 'O–H stretch'
      },
      {
        range: '1200–1260 cm⁻¹',
        wavenumber: [1200, 1260],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Aromatik + OH kombinasyonu',
      'Intramoleküler H-bağı → daha downfield',
      'D₂O exchange testi yapılabilir'
    ]
  },

  {
    id: 8,
    name: 'Eter (R–O–R)',
    nameEn: 'Ether',
    structure: 'R-O-R',
    h1nmr: [{
      range: '3.3 – 4.0 ppm',
      ppm: [3.3, 4.0],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '50 – 80 ppm',
      ppm: [50, 80],
      description: 'C–O karbonları'
    },
    ftir: [
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O–C asymmetric stretch'
      }
    ],
    diagnosticFeatures: [
      'OH peak YOK (alkol ile fark)',
      'Simetrik eter: tek tip C–O peak',
      'Asimetrik eter: iki farklı C–O peak'
    ]
  },

  {
    id: 9,
    name: 'Aldehit (–CHO)',
    nameEn: 'Aldehyde',
    structure: 'R-CHO',
    h1nmr: [{
      range: '9.0 – 10.5 ppm',
      ppm: [9.0, 10.5],
      description: 'Aldehit H (ÇOK karakteristik)',
      multiplicity: 's, d, t'
    }],
    c13nmr: {
      range: '190 – 205 ppm',
      ppm: [190, 205],
      description: 'Aldehit C=O'
    },
    ftir: [
      {
        range: '1720–1740 cm⁻¹',
        wavenumber: [1720, 1740],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '2720–2820 cm⁻¹',
        wavenumber: [2720, 2820],
        intensity: 'medium',
        assignment: 'Aldehit C–H stretch (ÇOK ayırt edici)'
      }
    ],
    diagnosticFeatures: [
      '9-10 ppm peak TEK BAŞINA aldehit tanısı!',
      '2720-2820 cm⁻¹ IR piki de çok karakteristik',
      'Aromatik aldehit: δ ~10 ppm',
      'Alifatik aldehit: δ ~9.7 ppm'
    ]
  },

  {
    id: 10,
    name: 'Keton (–CO–)',
    nameEn: 'Ketone',
    structure: 'R-CO-R',
    h1nmr: [{
      range: '2.1 – 2.7 ppm',
      ppm: [2.1, 2.7],
      description: 'α-H (karbonile komşu)'
    }],
    c13nmr: {
      range: '205 – 220 ppm',
      ppm: [205, 220],
      description: 'Keton C=O'
    },
    ftir: [
      {
        range: '1705–1725 cm⁻¹',
        wavenumber: [1705, 1725],
        intensity: 'strong',
        assignment: 'C=O stretch'
      }
    ],
    diagnosticFeatures: [
      'Aldehit H YOK (aldehit ile fark)',
      'Konjuge keton: 1680-1700 cm⁻¹',
      'Halkalı keton: ring strain → daha yüksek frekans'
    ]
  },

  {
    id: 11,
    name: 'Karboksilik Asit (–COOH)',
    nameEn: 'Carboxylic Acid',
    structure: 'R-COOH',
    h1nmr: [{
      range: '10 – 13 ppm',
      ppm: [10, 13],
      description: 'COOH (ÇOK geniş, ÇOK karakteristik)',
      multiplicity: 'br s (VERY BROAD!)'
    }],
    c13nmr: {
      range: '170 – 185 ppm',
      ppm: [170, 185],
      description: 'COOH karbonu'
    },
    ftir: [
      {
        range: '2500–3300 cm⁻¹',
        wavenumber: [2500, 3300],
        intensity: 'strong',
        assignment: 'O–H stretch (ÇOK geniş, baseline\'a yayılır)'
      },
      {
        range: '1700–1725 cm⁻¹',
        wavenumber: [1700, 1725],
        intensity: 'strong',
        assignment: 'C=O stretch'
      }
    ],
    diagnosticFeatures: [
      '10-13 ppm ÇOK TANİSAL!',
      'Peak çok geniş, bazen baseline\'a gömülür',
      'D₂O ile exchange → peak kaybolur',
      'Dimer oluşumu → IR\'da 2500-3300 çok geniş'
    ],
    warnings: [
      '⚠️ CRITICAL: Peak SO BROAD it can disappear into baseline!',
      '⚠️ D₂O solvent: COOH → COOD (peak invisible)',
      '⚠️ H-bonding → pozisyon değişkendir'
    ]
  },

  {
    id: 12,
    name: 'Ester (–COOR)',
    nameEn: 'Ester',
    structure: 'R-COOR',
    h1nmr: [{
      range: '3.7 – 4.3 ppm',
      ppm: [3.7, 4.3],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'Ester C=O'
    },
    ftir: [
      {
        range: '1735–1750 cm⁻¹',
        wavenumber: [1735, 1750],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '1050–1300 cm⁻¹',
        wavenumber: [1050, 1300],
        intensity: 'strong',
        assignment: 'C–O stretch (2 bant)'
      }
    ],
    diagnosticFeatures: [
      'Amid ve asitten daha yüksek C=O frekansı',
      'İki C–O bant (1050-1300)',
      'OH peak YOK (asit ile fark)'
    ]
  },

  {
    id: 13,
    name: 'Amid (–CONH–)',
    nameEn: 'Amide',
    structure: 'R-CONH₂',
    h1nmr: [{
      range: '5 – 9 ppm',
      ppm: [5, 9],
      description: 'NH (geniş), Primer amid: 2 ayrı peak (restricted rotation!)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '165 – 180 ppm',
      ppm: [165, 180],
      description: 'Amid C=O'
    },
    ftir: [
      {
        range: '1640–1690 cm⁻¹',
        wavenumber: [1640, 1690],
        intensity: 'strong',
        assignment: 'C=O stretch (amid I)'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Primer amid (–NH₂): İKİ ayrı NH peak (restricted rotation)',
      'Sekonder amid (–NH–): BİR peak',
      'Tersiyer amid (–N<): NH peak YOK',
      'Amid rotation barrier ~20 kcal/mol'
    ],
    warnings: [
      '⚠️ NH₂ → TWO separate peaks (not one broad peak like amines!)',
      '⚠️ Reason: Resonance causes restricted rotation'
    ]
  },

  {
    id: 14,
    name: 'Amin',
    nameEn: 'Amine',
    structure: 'R-NH₂',
    h1nmr: [{
      range: '1 – 5 ppm',
      ppm: [1, 5],
      description: 'NH (geniş, exchange nedeniyle)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '30 – 65 ppm',
      ppm: [30, 65],
      description: 'C–N karbonu'
    },
    ftir: [
      {
        range: '3300–3500 cm⁻¹',
        wavenumber: [3300, 3500],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Primer amin: 2 bant (~3300, ~3400)',
      'Sekonder amin: 1 bant (~3300)',
      'Tersiyer amin: N–H yok',
      'Fast exchange → broad peak'
    ]
  },

  {
    id: 15,
    name: 'Nitril (–C≡N)',
    nameEn: 'Nitrile',
    structure: 'R-C≡N',
    h1nmr: [{
      range: '2 – 3 ppm',
      ppm: [2, 3],
      description: 'α-H (N çekici grup etkisi)'
    }],
    c13nmr: {
      range: '110 – 130 ppm',
      ppm: [110, 130],
      description: 'C≡N karbonu'
    },
    ftir: [
      {
        range: '2210–2260 cm⁻¹',
        wavenumber: [2210, 2260],
        intensity: 'medium',
        assignment: 'C≡N stretch (keskin, ayırt edici)'
      }
    ],
    diagnosticFeatures: [
      '2210-2260 cm⁻¹ ÇOK karakteristik',
      'Alkin C≡C\'den farklı (alkin: 2100-2200)',
      'Konjugasyon → daha düşük frekans'
    ]
  },

  {
    id: 16,
    name: 'İmin (C=NR)',
    nameEn: 'Imine',
    structure: 'R₂C=NR',
    h1nmr: [{
      range: '7 – 9 ppm',
      ppm: [7, 9],
      description: 'CH=N (karakteristik)'
    }],
    c13nmr: {
      range: '150 – 170 ppm',
      ppm: [150, 170],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1640–1690 cm⁻¹',
        wavenumber: [1640, 1690],
        intensity: 'medium',
        assignment: 'C=N stretch'
      }
    ],
    diagnosticFeatures: [
      'Schiff base olarak da bilinir',
      'Moisture sensitive',
      'Amid C=O\'dan farklı pozisyon'
    ]
  },

  {
    id: 17,
    name: 'Tiyol (–SH)',
    nameEn: 'Thiol',
    structure: 'R-SH',
    h1nmr: [{
      range: '1 – 4 ppm',
      ppm: [1, 4],
      description: 'SH (zayıf, bazen görünmez)',
      multiplicity: 's'
    }],
    c13nmr: {
      range: '20 – 40 ppm',
      ppm: [20, 40],
      description: 'C–SH karbonu'
    },
    ftir: [
      {
        range: '2550–2600 cm⁻¹',
        wavenumber: [2550, 2600],
        intensity: 'weak',
        assignment: 'S–H stretch (zayıf ama ayırt edici)'
      }
    ],
    diagnosticFeatures: [
      '2550-2600 cm⁻¹ zayıf ama çok karakteristik',
      'OH\'dan çok farklı pozisyon',
      'Karakteristik koku (garlic-like)'
    ]
  },

  {
    id: 18,
    name: 'Sülfid (R–S–R)',
    nameEn: 'Sulfide',
    structure: 'R-S-R',
    h1nmr: [{
      range: '2 – 3 ppm',
      ppm: [2, 3],
      description: 'S–CH protonları'
    }],
    c13nmr: {
      range: '25 – 45 ppm',
      ppm: [25, 45],
      description: 'C–S karbonları'
    },
    ftir: [
      {
        range: '600–700 cm⁻¹',
        wavenumber: [600, 700],
        intensity: 'weak',
        assignment: 'C–S stretch'
      }
    ],
    diagnosticFeatures: [
      'Eter\'e benzer ama daha upfield',
      'S oksijen\'den daha az elektronegatif'
    ]
  },

  {
    id: 19,
    name: 'Sülfonik Asit',
    nameEn: 'Sulfonic Acid',
    structure: 'R-SO₃H',
    h1nmr: [{
      range: '9 – 13 ppm',
      ppm: [9, 13],
      description: 'SO₃H (çok geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '130 – 160 ppm',
      ppm: [130, 160],
      description: 'C–SO₃H karbonu'
    },
    ftir: [
      {
        range: '1140–1350 cm⁻¹',
        wavenumber: [1140, 1350],
        intensity: 'strong',
        assignment: 'S=O stretch (çok güçlü, çift bant)'
      }
    ],
    diagnosticFeatures: [
      'Çok güçlü asit',
      'S=O çift bant çok karakteristik',
      '1350 ve 1140 cm⁻¹ civarı'
    ]
  },

  {
    id: 20,
    name: 'Asetal / Ketal',
    nameEn: 'Acetal/Ketal',
    structure: 'R-CH(OR)₂',
    h1nmr: [{
      range: '4.5 – 6.0 ppm',
      ppm: [4.5, 6.0],
      description: 'O–CH–O (çok karakteristik pozisyon)'
    }],
    c13nmr: {
      range: '95 – 105 ppm',
      ppm: [95, 105],
      description: 'Asetal karbonu (ÇOK ayırt edici bölge)'
    },
    ftir: [
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      '95-105 ppm ¹³C ÇOK TANİSAL!',
      'C=O peak YOK (aldehit/keton ile fark)',
      'Asit ile hidroliz → aldehit/keton verir'
    ]
  },

  // 21-40: Additional groups
  {
    id: 21,
    name: 'Epoksit',
    nameEn: 'Epoxide',
    structure: 'R₂C–O–CR₂ (3-membered ring)',
    h1nmr: [{
      range: '2.5 – 3.5 ppm',
      ppm: [2.5, 3.5],
      description: 'O\'ya bağlı CH (ring strain etkisi)'
    }],
    c13nmr: {
      range: '45 – 65 ppm',
      ppm: [45, 65],
      description: 'Epoksit karbonları'
    },
    ftir: [
      {
        range: '950–1250 cm⁻¹',
        wavenumber: [950, 1250],
        intensity: 'medium',
        assignment: 'C–O–C asymmetric stretch'
      }
    ],
    diagnosticFeatures: [
      'Ring strain → reaktif',
      'Normal eter\'den farklı ¹H pozisyonu',
      'Asit/baz ile açılır'
    ]
  },

  {
    id: 22,
    name: 'Asit Halojenürü (–COX)',
    nameEn: 'Acid Halide',
    structure: 'R-COCl',
    h1nmr: [{
      range: '2.5 – 3.0 ppm',
      ppm: [2.5, 3.0],
      description: 'α-H'
    }],
    c13nmr: {
      range: '170 – 180 ppm',
      ppm: [170, 180],
      description: 'C=O karbonu'
    },
    ftir: [
      {
        range: '1770–1815 cm⁻¹',
        wavenumber: [1770, 1815],
        intensity: 'strong',
        assignment: 'C=O stretch (ÇOK keskin, en yüksek frekans)'
      },
      {
        range: '600–800 cm⁻¹',
        wavenumber: [600, 800],
        intensity: 'strong',
        assignment: 'C–X'
      }
    ],
    diagnosticFeatures: [
      'TÜM karbonil türevlerinin EN YÜKSEK frekansta C=O',
      'Çok reaktif',
      'Moisture sensitive'
    ]
  },

  {
    id: 23,
    name: 'Asit Anhidridi',
    nameEn: 'Acid Anhydride',
    structure: '(RCO)₂O',
    h1nmr: [{
      range: '2.2 – 2.8 ppm',
      ppm: [2.2, 2.8],
      description: 'α-H'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'İki C=O karbonu'
    },
    ftir: [
      {
        range: '1820 cm⁻¹',
        wavenumber: [1820, 1820],
        intensity: 'strong',
        assignment: 'C=O asymmetric'
      },
      {
        range: '1760 cm⁻¹',
        wavenumber: [1760, 1760],
        intensity: 'strong',
        assignment: 'C=O symmetric'
      }
    ],
    diagnosticFeatures: [
      'ÇİFT C=O peak (1820 + 1760) ÇOK TANİSAL!',
      'Tek başına tanı için yeterli',
      'Reaktif, moisture sensitive'
    ]
  },

  {
    id: 24,
    name: 'Enamin',
    nameEn: 'Enamine',
    structure: 'R₂N–CH=CH₂',
    h1nmr: [
      {
        range: '4.5 – 6.5 ppm',
        ppm: [4.5, 6.5],
        description: 'Vinilik H'
      },
      {
        range: '2.5 – 3.5 ppm',
        ppm: [2.5, 3.5],
        description: 'N–CH'
      }
    ],
    c13nmr: {
      range: '100 – 150 ppm',
      ppm: [100, 150],
      description: 'C=C karbonları'
    },
    ftir: [
      {
        range: '1610–1650 cm⁻¹',
        wavenumber: [1610, 1650],
        intensity: 'medium',
        assignment: 'C=C stretch'
      }
    ],
    diagnosticFeatures: [
      'Nucleophilic alkene',
      'N\'nin lone pair ile konjugasyon',
      'Michael akseptörler için reaktif'
    ]
  },

  {
    id: 25,
    name: 'Oksim (C=NOH)',
    nameEn: 'Oxime',
    structure: 'R₂C=NOH',
    h1nmr: [{
      range: '8 – 11 ppm',
      ppm: [8, 11],
      description: '=N–OH (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1650 cm⁻¹',
        wavenumber: [1650, 1650],
        intensity: 'medium',
        assignment: 'C=N stretch'
      },
      {
        range: '3200–3500 cm⁻¹',
        wavenumber: [3200, 3500],
        intensity: 'medium',
        assignment: 'O–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Aldehit/keton türevi',
      'E/Z izomerizm mümkün',
      'Beckmann rearrangement verir'
    ]
  },

  {
    id: 26,
    name: 'Hidrazon (C=NNH₂)',
    nameEn: 'Hydrazone',
    structure: 'R₂C=NNH₂',
    h1nmr: [{
      range: '4 – 8 ppm',
      ppm: [4, 8],
      description: 'NH₂ (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1600–1650 cm⁻¹',
        wavenumber: [1600, 1650],
        intensity: 'medium',
        assignment: 'C=N stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Aldehit/keton türevi',
      'Wolff-Kishner indirgeme için kullanılır',
      'E/Z izomerizm'
    ]
  },

  {
    id: 27,
    name: 'Disülfid (–S–S–)',
    nameEn: 'Disulfide',
    structure: 'R-S-S-R',
    h1nmr: [{
      range: '2.5 – 3.0 ppm',
      ppm: [2.5, 3.0],
      description: 'S–CH protonları'
    }],
    c13nmr: {
      range: '30 – 45 ppm',
      ppm: [30, 45],
      description: 'C–SS–C karbonları'
    },
    ftir: [
      {
        range: '500–550 cm⁻¹',
        wavenumber: [500, 550],
        intensity: 'weak',
        assignment: 'S–S stretch (zayıf ama ayırt edici)'
      }
    ],
    diagnosticFeatures: [
      '500-550 cm⁻¹ ÇOK AYIRT EDİCİ!',
      'Redox aktif (S–S ⇄ 2 SH)',
      'Protein yapısında önemli'
    ]
  },

  {
    id: 28,
    name: 'Sülfon (–SO₂–)',
    nameEn: 'Sulfone',
    structure: 'R-SO₂-R',
    h1nmr: [{
      range: '2.8 – 3.5 ppm',
      ppm: [2.8, 3.5],
      description: 'α-H (S=O çekici etkisi)'
    }],
    c13nmr: {
      range: '40 – 60 ppm',
      ppm: [40, 60],
      description: 'C–SO₂ karbonları'
    },
    ftir: [
      {
        range: '1310–1350 cm⁻¹',
        wavenumber: [1310, 1350],
        intensity: 'strong',
        assignment: 'SO₂ asymmetric stretch'
      },
      {
        range: '1120–1160 cm⁻¹',
        wavenumber: [1120, 1160],
        intensity: 'strong',
        assignment: 'SO₂ symmetric stretch'
      }
    ],
    diagnosticFeatures: [
      'İKİ güçlü S=O bant (1350 + 1140) ÇOK TANİSAL',
      'Sülfonik asitten farklı (OH yok)',
      'Çok polar'
    ]
  },

  {
    id: 29,
    name: 'Sülfit Esteri (–SO–OR)',
    nameEn: 'Sulfite Ester',
    structure: 'R-SO-OR',
    h1nmr: [{
      range: '3.5 – 4.5 ppm',
      ppm: [3.5, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '55 – 75 ppm',
      ppm: [55, 75],
      description: 'C–O karbonları'
    },
    ftir: [
      {
        range: '1000–1150 cm⁻¹',
        wavenumber: [1000, 1150],
        intensity: 'strong',
        assignment: 'S–O stretch'
      },
      {
        range: '900–1000 cm⁻¹',
        wavenumber: [900, 1000],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Sülfattan farklı (bir O daha az)',
      'Hidrolizilebilir'
    ]
  },

  {
    id: 30,
    name: 'Fosfat Esteri',
    nameEn: 'Phosphate Ester',
    structure: 'RO-PO(OR)₂',
    h1nmr: [{
      range: '3.8 – 4.5 ppm',
      ppm: [3.8, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'C–O karbonları'
    },
    ftir: [
      {
        range: '1000–1100 cm⁻¹',
        wavenumber: [1000, 1100],
        intensity: 'strong',
        assignment: 'P–O stretch'
      },
      {
        range: '1200–1250 cm⁻¹',
        wavenumber: [1200, 1250],
        intensity: 'strong',
        assignment: 'P=O stretch'
      }
    ],
    diagnosticFeatures: [
      'DNA/RNA yapı taşı',
      'P=O çok karakteristik',
      '¹³C\'de quartet (P-C coupling)'
    ]
  },

  {
    id: 31,
    name: 'Fosfonat',
    nameEn: 'Phosphonate',
    structure: 'R-PO(OR)₂',
    h1nmr: [{
      range: '2.0 – 3.5 ppm',
      ppm: [2.0, 3.5],
      description: 'P–CH protonları (P-H coupling görülebilir)'
    }],
    c13nmr: {
      range: '30 – 50 ppm',
      ppm: [30, 50],
      description: 'C–P karbonu (doublet, ¹J(P-C))'
    },
    ftir: [
      {
        range: '1150–1250 cm⁻¹',
        wavenumber: [1150, 1250],
        intensity: 'strong',
        assignment: 'P=O stretch'
      },
      {
        range: '900–1050 cm⁻¹',
        wavenumber: [900, 1050],
        intensity: 'strong',
        assignment: 'P–O stretch'
      }
    ],
    diagnosticFeatures: [
      '¹H\'de doublet (²J(P-H) ~20 Hz)',
      '¹³C\'de doublet (¹J(P-C) ~100-150 Hz)',
      'Horner-Wadsworth-Emmons reaksiyonu'
    ]
  },

  {
    id: 32,
    name: 'Hemi-asetal',
    nameEn: 'Hemiacetal',
    structure: 'R-CH(OH)OR',
    h1nmr: [
      {
        range: '4.0 – 5.5 ppm',
        ppm: [4.0, 5.5],
        description: 'O–CH–OH'
      },
      {
        range: '2 – 6 ppm',
        ppm: [2, 6],
        description: 'OH (geniş)',
        multiplicity: 'br s'
      }
    ],
    c13nmr: {
      range: '90 – 100 ppm',
      ppm: [90, 100],
      description: 'Hemi-asetal karbonu'
    },
    ftir: [
      {
        range: '3200–3500 cm⁻¹',
        wavenumber: [3200, 3500],
        intensity: 'medium',
        assignment: 'O–H stretch'
      },
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Asetal ile asit → hemi-asetal (kısmi hidroliz)',
      'OH var (asetal ile fark)',
      'Denge halinde aldehit/keton verebilir',
      'Şeker kimyasında önemli'
    ]
  },

  {
    id: 33,
    name: 'Lakton (halkalı ester)',
    nameEn: 'Lactone',
    structure: 'Cyclic -COO-',
    h1nmr: [{
      range: '4.0 – 5.0 ppm',
      ppm: [4.0, 5.0],
      description: 'O–CH (halka üzerinde)'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'Lakton C=O'
    },
    ftir: [
      {
        range: '1740–1770 cm⁻¹',
        wavenumber: [1740, 1770],
        intensity: 'strong',
        assignment: 'C=O stretch (halka boyutuna bağlı)'
      }
    ],
    diagnosticFeatures: [
      '5-üyeli (γ-lakton): ~1770 cm⁻¹',
      '6-üyeli (δ-lakton): ~1740 cm⁻¹',
      '4-üyeli (β-lakton): ~1820 cm⁻¹ (ring strain)',
      'Açık zincir ester\'den farklı frekans'
    ]
  },

  {
    id: 34,
    name: 'Laktam (halkalı amid)',
    nameEn: 'Lactam',
    structure: 'Cyclic -CONH-',
    h1nmr: [{
      range: '6 – 9 ppm',
      ppm: [6, 9],
      description: 'NH (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'Laktam C=O'
    },
    ftir: [
      {
        range: '1630–1680 cm⁻¹',
        wavenumber: [1630, 1680],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      '4-üyeli (β-laktam): ~1750 cm⁻¹ (antibiyotikler)',
      '5-6-üyeli: ~1650 cm⁻¹',
      'Penicillin, cephalosporin yapısı'
    ]
  },

  {
    id: 35,
    name: 'Kinon',
    nameEn: 'Quinone',
    structure: 'Cyclic diketone',
    h1nmr: [{
      range: '6.5 – 7.5 ppm',
      ppm: [6.5, 7.5],
      description: 'Vinilik H (C=C–C=O)'
    }],
    c13nmr: {
      range: '180 – 190 ppm',
      ppm: [180, 190],
      description: 'İki C=O karbonu (ÇOK ayırt edici)'
    },
    ftir: [
      {
        range: '1650–1680 cm⁻¹',
        wavenumber: [1650, 1680],
        intensity: 'strong',
        assignment: 'Konjuge C=O stretch'
      }
    ],
    diagnosticFeatures: [
      '180-190 ppm ¹³C ÇOK TANİSAL!',
      'Normal keton\'dan daha düşük (konjugasyon)',
      'Renklid (sarı-kırmızı)',
      'Redox aktif'
    ]
  },

  {
    id: 36,
    name: 'Amonyum Tuzu (R₄N⁺)',
    nameEn: 'Quaternary Ammonium',
    structure: 'R₄N⁺X⁻',
    h1nmr: [{
      range: '3.0 – 4.0 ppm',
      ppm: [3.0, 4.0],
      description: 'N⁺–CH (pozitif yük etkisi → downfield)'
    }],
    c13nmr: {
      range: '50 – 70 ppm',
      ppm: [50, 70],
      description: 'C–N⁺ karbonları'
    },
    ftir: [
      {
        range: '950–1250 cm⁻¹',
        wavenumber: [950, 1250],
        intensity: 'medium',
        assignment: 'C–N stretch'
      }
    ],
    diagnosticFeatures: [
      'N–H peak YOK (tersiyer amin ile fark)',
      'Pozitif yük → daha downfield',
      'Su\'da çok çözünür',
      'Counter ion değişkenliği'
    ]
  },

  {
    id: 37,
    name: 'Nitro (–NO₂)',
    nameEn: 'Nitro',
    structure: 'R-NO₂',
    h1nmr: [{
      range: '2.5 – 4.5 ppm',
      ppm: [2.5, 4.5],
      description: 'α-H (güçlü elektron çekici etki)'
    }],
    c13nmr: {
      range: '50 – 80 ppm',
      ppm: [50, 80],
      description: 'C–NO₂ karbonu'
    },
    ftir: [
      {
        range: '1520–1550 cm⁻¹',
        wavenumber: [1520, 1550],
        intensity: 'strong',
        assignment: 'NO₂ asymmetric stretch'
      },
      {
        range: '1340–1380 cm⁻¹',
        wavenumber: [1340, 1380],
        intensity: 'strong',
        assignment: 'NO₂ symmetric stretch'
      }
    ],
    diagnosticFeatures: [
      'ÇİFT bant (1550 + 1350) ÇOK TANİSAL!',
      'Tek başına tanı için yeterli',
      'Nitroalkan: δ 4.1-4.4 ppm (eter\'den bile daha downfield!)',
      'N formal yük: +1'
    ],
    warnings: [
      '⚠️ R-CH₂-NO₂: δ 4.1-4.4 ppm (VERY deshielded!)',
      '⚠️ Stronger than O-CH₂ deshielding'
    ]
  },

  {
    id: 38,
    name: 'İzotiyosiyanat (–N=C=S)',
    nameEn: 'Isothiocyanate',
    structure: 'R-N=C=S',
    h1nmr: [{
      range: '3 – 4 ppm',
      ppm: [3, 4],
      description: 'α-H'
    }],
    c13nmr: {
      range: '125 – 140 ppm',
      ppm: [125, 140],
      description: 'N=C=S karbonu'
    },
    ftir: [
      {
        range: '2050–2100 cm⁻¹',
        wavenumber: [2050, 2100],
        intensity: 'strong',
        assignment: 'N=C=S stretch (ÇOK keskin)'
      }
    ],
    diagnosticFeatures: [
      '2050-2100 cm⁻¹ ÇOK AYIRT EDİCİ!',
      'İzosiyanat\'tan farklı (O yerine S)',
      'Reaktif elektrofil'
    ]
  },

  {
    id: 39,
    name: 'Karbamat (–O–CO–NH–)',
    nameEn: 'Carbamate',
    structure: 'R-O-CONH-R',
    h1nmr: [
      {
        range: '5 – 8 ppm',
        ppm: [5, 8],
        description: 'NH (geniş)',
        multiplicity: 'br s'
      },
      {
        range: '3.5 – 4.5 ppm',
        ppm: [3.5, 4.5],
        description: 'O–CH'
      }
    ],
    c13nmr: {
      range: '155 – 165 ppm',
      ppm: [155, 165],
      description: 'Karbamat C=O'
    },
    ftir: [
      {
        range: '1700–1720 cm⁻¹',
        wavenumber: [1700, 1720],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Amino asit koruma grubu (Boc, Fmoc, Cbz)',
      'Ester + Amid karışımı özellik',
      'Polyurethane yapısı'
    ]
  },

  {
    id: 40,
    name: 'Üre (–NH–CO–NH–)',
    nameEn: 'Urea',
    structure: 'R-NH-CO-NH-R',
    h1nmr: [{
      range: '5 – 9 ppm',
      ppm: [5, 9],
      description: 'NH (geniş, exchange)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '155 – 165 ppm',
      ppm: [155, 165],
      description: 'Üre C=O'
    },
    ftir: [
      {
        range: '1680–1700 cm⁻¹',
        wavenumber: [1680, 1700],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '3300–3400 cm⁻¹',
        wavenumber: [3300, 3400],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'İki NH grubu',
      'Amid\'den farklı (iki N var)',
      'H-bağı oluşturur (güçlü)'
    ]
  },

  // 41-60: Additional specialized groups
  {
    id: 41,
    name: 'İzosiyanat (–N=C=O)',
    nameEn: 'Isocyanate',
    structure: 'R-N=C=O',
    h1nmr: [{
      range: '3.0 – 4.5 ppm',
      ppm: [3.0, 4.5],
      description: 'α-H'
    }],
    c13nmr: {
      range: '120 – 130 ppm',
      ppm: [120, 130],
      description: 'N=C=O karbonu'
    },
    ftir: [
      {
        range: '2260–2280 cm⁻¹',
        wavenumber: [2260, 2280],
        intensity: 'strong',
        assignment: 'N=C=O stretch (ÇOK keskin, ayırt edici)'
      }
    ],
    diagnosticFeatures: [
      '2260-2280 cm⁻¹ TEK BAŞINA TANıSAL!',
      'Polyurethane sentezi için kullanılır',
      'Moisture sensitive, reaktif'
    ]
  },

  {
    id: 42,
    name: 'İzosiyanür (–N≡C)',
    nameEn: 'Isocyanide',
    structure: 'R-N≡C',
    h1nmr: [{
      range: '2.5 – 4.0 ppm',
      ppm: [2.5, 4.0],
      description: 'α-H (N≡C çekici etkisi)'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'N≡C karbonu'
    },
    ftir: [
      {
        range: '2100–2150 cm⁻¹',
        wavenumber: [2100, 2150],
        intensity: 'strong',
        assignment: 'N≡C stretch (keskin)'
      }
    ],
    diagnosticFeatures: [
      'Karakteristik kötü koku',
      'Nitril\'den farklı (C≡N vs N≡C)',
      'Passerini, Ugi reaksiyonlarında kullanılır'
    ]
  },

  {
    id: 43,
    name: 'Azid (–N₃)',
    nameEn: 'Azide',
    structure: 'R-N₃',
    h1nmr: [{
      range: '3.0 – 4.5 ppm',
      ppm: [3.0, 4.5],
      description: 'α-H (N₃ çekici etkisi)'
    }],
    c13nmr: {
      range: '40 – 70 ppm',
      ppm: [40, 70],
      description: 'C–N₃ karbonu'
    },
    ftir: [
      {
        range: '2090–2120 cm⁻¹',
        wavenumber: [2090, 2120],
        intensity: 'strong',
        assignment: 'N₃ asymmetric stretch (ÇOK karakteristik)'
      }
    ],
    diagnosticFeatures: [
      '2090-2120 cm⁻¹ ÇOK TANıSAL!',
      'Click chemistry için kullanılır',
      'Patlayıcı özellik gösterebilir (dikkat!)'
    ],
    warnings: [
      '⚠️ Organik azidler potansiyel patlayıcıdır',
      '⚠️ Yüksek molekül ağırlıklı azidler tehlikeli'
    ]
  },

  {
    id: 44,
    name: 'Diazo (–CHN₂)',
    nameEn: 'Diazo',
    structure: 'R₂C=N₂',
    h1nmr: [{
      range: '4.5 – 6.0 ppm',
      ppm: [4.5, 6.0],
      description: 'Diazo-CH (downfield, çift bağ etkisi)'
    }],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'Diazo karbonu'
    },
    ftir: [
      {
        range: '2040–2100 cm⁻¹',
        wavenumber: [2040, 2100],
        intensity: 'strong',
        assignment: 'N=N stretch'
      }
    ],
    diagnosticFeatures: [
      'Karbene precursor',
      'Sarı renkli',
      'Çok reaktif'
    ]
  },

  {
    id: 45,
    name: 'N-Oksit (Amin oksit)',
    nameEn: 'N-Oxide',
    structure: 'R₃N⁺–O⁻',
    h1nmr: [{
      range: '3.2 – 4.2 ppm',
      ppm: [3.2, 4.2],
      description: 'N⁺–CH (pozitif yük → downfield kayma)'
    }],
    c13nmr: {
      range: '55 – 75 ppm',
      ppm: [55, 75],
      description: 'C–N⁺–O⁻ karbonları'
    },
    ftir: [
      {
        range: '1250–1300 cm⁻¹',
        wavenumber: [1250, 1300],
        intensity: 'strong',
        assignment: 'N→O stretch'
      }
    ],
    diagnosticFeatures: [
      'Amin\'den daha downfield',
      'Polar, suda çözünür',
      'Cope elimination verir'
    ]
  },

  {
    id: 46,
    name: 'O-Alkil Hidroksilamin (–ONH–)',
    nameEn: 'O-Alkyl Hydroxylamine',
    structure: 'R-O-NH₂',
    h1nmr: [
      {
        range: '4 – 7 ppm',
        ppm: [4, 7],
        description: 'NH₂ (geniş)',
        multiplicity: 'br s'
      },
      {
        range: '3.5 – 4.5 ppm',
        ppm: [3.5, 4.5],
        description: 'O–CH'
      }
    ],
    c13nmr: {
      range: '55 – 75 ppm',
      ppm: [55, 75],
      description: 'C–O–NH₂ karbonu'
    },
    ftir: [
      {
        range: '3300–3500 cm⁻¹',
        wavenumber: [3300, 3500],
        intensity: 'medium',
        assignment: 'N–H stretch'
      },
      {
        range: '1000–1100 cm⁻¹',
        wavenumber: [1000, 1100],
        intensity: 'medium',
        assignment: 'N–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Oksim sentezi için kullanılır',
      'Zayıf baz'
    ]
  },

  {
    id: 47,
    name: 'Tiyokarbonil (C=S)',
    nameEn: 'Thiocarbonyl',
    structure: 'R₂C=S',
    h1nmr: [{
      range: '2.5 – 3.5 ppm',
      ppm: [2.5, 3.5],
      description: 'α-H (C=S yanında)'
    }],
    c13nmr: {
      range: '180 – 220 ppm',
      ppm: [180, 220],
      description: 'C=S karbonu (ÇOK downfield)'
    },
    ftir: [
      {
        range: '1050–1200 cm⁻¹',
        wavenumber: [1050, 1200],
        intensity: 'medium',
        assignment: 'C=S stretch'
      }
    ],
    diagnosticFeatures: [
      '180-220 ppm ¹³C çok karakteristik',
      'C=O\'ya benzer ama daha düşük frekans',
      'Sarı-turuncu renk'
    ]
  },

  {
    id: 48,
    name: 'Tiyoester (–COSR)',
    nameEn: 'Thioester',
    structure: 'R-CO-S-R',
    h1nmr: [{
      range: '2.7 – 3.5 ppm',
      ppm: [2.7, 3.5],
      description: 'S–CH protonları'
    }],
    c13nmr: {
      range: '185 – 200 ppm',
      ppm: [185, 200],
      description: 'C=O karbonu (ester\'den farklı)'
    },
    ftir: [
      {
        range: '1680–1710 cm⁻¹',
        wavenumber: [1680, 1710],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '700–800 cm⁻¹',
        wavenumber: [700, 800],
        intensity: 'medium',
        assignment: 'C–S stretch'
      }
    ],
    diagnosticFeatures: [
      'Normal ester\'den daha düşük C=O frekansı',
      'Biyokimyada önemli (Coenzyme A)',
      'Amid\'den daha reaktif'
    ]
  },

  {
    id: 49,
    name: 'Tiyoamid (–CSNH–)',
    nameEn: 'Thioamide',
    structure: 'R-CS-NH₂',
    h1nmr: [{
      range: '6 – 10 ppm',
      ppm: [6, 10],
      description: 'NH (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '180 – 200 ppm',
      ppm: [180, 200],
      description: 'C=S karbonu'
    },
    ftir: [
      {
        range: '3200–3400 cm⁻¹',
        wavenumber: [3200, 3400],
        intensity: 'medium',
        assignment: 'N–H stretch'
      },
      {
        range: '1100–1200 cm⁻¹',
        wavenumber: [1100, 1200],
        intensity: 'strong',
        assignment: 'C=S stretch'
      }
    ],
    diagnosticFeatures: [
      'Amid\'in kükürt analoğu',
      'Peptit mimetiği',
      'Metal kompleksleri oluşturur'
    ]
  },

  {
    id: 50,
    name: 'Silil Eter (R–O–SiR₃)',
    nameEn: 'Silyl Ether',
    structure: 'R-O-Si(CH₃)₃',
    h1nmr: [{
      range: '0.0 – 0.3 ppm',
      ppm: [0.0, 0.3],
      description: 'Si–CH₃ (ÇOK AYIRT EDİCİ, neredeyse 0 ppm!)'
    }],
    c13nmr: {
      range: '-5 – +5 ppm',
      ppm: [-5, 5],
      description: 'Si–CH₃ karbonları (NEGATİF değerler mümkün!)'
    },
    ftir: [
      {
        range: '1000–1100 cm⁻¹',
        wavenumber: [1000, 1100],
        intensity: 'strong',
        assignment: 'Si–O stretch'
      },
      {
        range: '800–850 cm⁻¹',
        wavenumber: [800, 850],
        intensity: 'strong',
        assignment: 'Si–C stretch'
      }
    ],
    diagnosticFeatures: [
      '0.0-0.3 ppm ÇOK TANıSAL! (TMS referansına çok yakın)',
      'Alkol koruma grubu (TBS, TIPS, TMS)',
      'Asit ile kolayca hidroliz olur'
    ]
  },

  {
    id: 51,
    name: 'Silan (Si–H)',
    nameEn: 'Silane',
    structure: 'R₃Si-H',
    h1nmr: [{
      range: '3.5 – 5.0 ppm',
      ppm: [3.5, 5.0],
      description: 'Si–H (karakteristik)'
    }],
    c13nmr: {
      range: '-5 – 20 ppm',
      ppm: [-5, 20],
      description: 'Alkil-Si karbonları'
    },
    ftir: [
      {
        range: '2100–2300 cm⁻¹',
        wavenumber: [2100, 2300],
        intensity: 'strong',
        assignment: 'Si–H stretch'
      }
    ],
    diagnosticFeatures: [
      '2100-2300 cm⁻¹ Si–H karakteristik',
      'Hidrosilylation reaksiyonları',
      'H₂ kaynağı olarak kullanılabilir'
    ]
  },

  {
    id: 52,
    name: 'Boronik Asit (–B(OH)₂)',
    nameEn: 'Boronic Acid',
    structure: 'R-B(OH)₂',
    h1nmr: [{
      range: '4 – 9 ppm',
      ppm: [4, 9],
      description: 'B–OH (geniş, exchange)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '120 – 160 ppm',
      ppm: [120, 160],
      description: 'Ar–B karbonu (genelde aromatik)'
    },
    ftir: [
      {
        range: '3200–3500 cm⁻¹',
        wavenumber: [3200, 3500],
        intensity: 'strong',
        assignment: 'O–H stretch'
      },
      {
        range: '1330–1400 cm⁻¹',
        wavenumber: [1330, 1400],
        intensity: 'strong',
        assignment: 'B–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Suzuki coupling için kritik',
      'Lewis asit',
      'Şeker sensörü olarak kullanılır'
    ]
  },

  {
    id: 53,
    name: 'Boronat Esteri',
    nameEn: 'Boronate Ester',
    structure: 'R-B(OR)₂',
    h1nmr: [{
      range: '3.5 – 4.5 ppm',
      ppm: [3.5, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'C–O karbonları'
    },
    ftir: [
      {
        range: '1300–1400 cm⁻¹',
        wavenumber: [1300, 1400],
        intensity: 'strong',
        assignment: 'B–O stretch'
      },
      {
        range: '1000–1100 cm⁻¹',
        wavenumber: [1000, 1100],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Boronik asit koruma formu',
      'Moisture sensitive değil',
      'Suzuki reaksiyonunda kullanılır'
    ]
  },

  {
    id: 54,
    name: 'Peroksit (–O–O–)',
    nameEn: 'Peroxide',
    structure: 'R-O-O-R',
    h1nmr: [{
      range: '3.8 – 4.5 ppm',
      ppm: [3.8, 4.5],
      description: 'O–O–CH protonları'
    }],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'C–O–O karbonları'
    },
    ftir: [
      {
        range: '800–900 cm⁻¹',
        wavenumber: [800, 900],
        intensity: 'weak',
        assignment: 'O–O stretch (zayıf ama AYIRT EDİCİ!)'
      }
    ],
    diagnosticFeatures: [
      '800-900 cm⁻¹ ÇOK AYIRT EDİCİ (zayıf olsa da)',
      'Patlayıcı özellik gösterebilir',
      'Radikal başlatıcı (AIBN, benzoil peroksit)'
    ],
    warnings: [
      '⚠️ Potansiyel patlayıcı!',
      '⚠️ Isı ve sürtünmeye hassas'
    ]
  },

  {
    id: 55,
    name: 'Hidroperoksit (–OOH)',
    nameEn: 'Hydroperoxide',
    structure: 'R-O-O-H',
    h1nmr: [
      {
        range: '7 – 11 ppm',
        ppm: [7, 11],
        description: 'O–O–H (geniş)',
        multiplicity: 'br s'
      }
    ],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'C–O–OH karbonu'
    },
    ftir: [
      {
        range: '3200–3500 cm⁻¹',
        wavenumber: [3200, 3500],
        intensity: 'medium',
        assignment: 'O–H stretch'
      },
      {
        range: '800–900 cm⁻¹',
        wavenumber: [800, 900],
        intensity: 'weak',
        assignment: 'O–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Oksidant',
      'Epoksidasyon reaksiyonları',
      'Cumene hidro peroksit (fenol sentezi)'
    ],
    warnings: [
      '⚠️ Patlayıcı!',
      '⚠️ Çok dikkatli kullanılmalı'
    ]
  },

  {
    id: 56,
    name: 'Ortoester (RC(OR)₃)',
    nameEn: 'Orthoester',
    structure: 'R-C(OR)₃',
    h1nmr: [{
      range: '3.5 – 4.5 ppm',
      ppm: [3.5, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '100 – 110 ppm',
      ppm: [100, 110],
      description: 'Merkez C (ÇOK karakteristik)'
    },
    ftir: [
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      '100-110 ppm ¹³C ÇOK TANıSAL!',
      'C=O peak YOK (ester ile fark)',
      'Asit ile kolayca hidroliz → ester'
    ]
  },

  {
    id: 57,
    name: 'Amidinat',
    nameEn: 'Amidinate',
    structure: 'R-C(=NR)NR₂',
    h1nmr: [{
      range: '5 – 9 ppm',
      ppm: [5, 9],
      description: 'NH (varsa, geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1620–1680 cm⁻¹',
        wavenumber: [1620, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch (varsa)'
      }
    ],
    diagnosticFeatures: [
      'Metal ligand',
      'Rezonans stabilizasyonu',
      'Amid ile benzer yapı'
    ]
  },

  {
    id: 58,
    name: 'Guanidin (–C(=NH)NH₂)',
    nameEn: 'Guanidine',
    structure: 'HN=C(NH₂)₂',
    h1nmr: [{
      range: '4 – 8 ppm',
      ppm: [4, 8],
      description: 'NH/NH₂ (geniş, exchange)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '155 – 165 ppm',
      ppm: [155, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1650–1680 cm⁻¹',
        wavenumber: [1650, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '3300–3400 cm⁻¹',
        wavenumber: [3300, 3400],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Çok güçlü baz (pKa ~13)',
      'Arginine yan zinciri',
      'Rezonans stabilizasyonu'
    ]
  },

  {
    id: 59,
    name: 'Biguanid',
    nameEn: 'Biguanide',
    structure: 'HN=C(NH)-NH-C(=NH)NH₂',
    h1nmr: [{
      range: '4 – 9 ppm',
      ppm: [4, 9],
      description: 'Çoklu NH (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '155 – 165 ppm',
      ppm: [155, 165],
      description: 'İki C=N karbonu'
    },
    ftir: [
      {
        range: '1650–1680 cm⁻¹',
        wavenumber: [1650, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '3300–3400 cm⁻¹',
        wavenumber: [3300, 3400],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'İki guanidin ünitesi',
      'Antidiyabetik ilaçlar (metformin)',
      'Güçlü baz'
    ]
  },

  {
    id: 60,
    name: 'Amidinat (–C(=NR)NR₂)',
    nameEn: 'Amidinate',
    structure: 'R-C(=NR)NR₂',
    h1nmr: [{
      range: '5 – 8 ppm',
      ppm: [5, 8],
      description: 'NH (varsa)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1620–1680 cm⁻¹',
        wavenumber: [1620, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'weak',
        assignment: 'N–H stretch (varsa)'
      }
    ],
    diagnosticFeatures: [
      'Metal ligand',
      'Kataliz uygulamaları',
      'Rezonans stabilize'
    ]
  },

  // 61-80: More specialized groups
  {
    id: 61,
    name: 'Alil Grubu (–CH₂–CH=CH₂)',
    nameEn: 'Allyl Group',
    structure: 'R-CH₂-CH=CH₂',
    h1nmr: [
      {
        range: '3.2 – 3.6 ppm',
        ppm: [3.2, 3.6],
        description: 'CH₂– (allylic position)'
      },
      {
        range: '4.9 – 6.0 ppm',
        ppm: [4.9, 6.0],
        description: 'Vinilik H (=CH₂, =CH)'
      }
    ],
    c13nmr: {
      range: '115 – 140 ppm',
      ppm: [115, 140],
      description: 'C=C karbonları'
    },
    ftir: [
      {
        range: '1640–1680 cm⁻¹',
        wavenumber: [1640, 1680],
        intensity: 'medium',
        assignment: 'C=C stretch'
      },
      {
        range: '3080 cm⁻¹',
        wavenumber: [3080, 3080],
        intensity: 'medium',
        assignment: '=C–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Allylic CH₂ karakteristik δ 3.2-3.6',
      'Reaktif pozisyon (SN2\')',
      'Metathesis reaksiyonları'
    ]
  },

  {
    id: 62,
    name: 'Benzil Grubu (Ph–CH₂–)',
    nameEn: 'Benzyl Group',
    structure: 'Ph-CH₂-X',
    h1nmr: [{
      range: '4.2 – 4.6 ppm',
      ppm: [4.2, 4.6],
      description: 'Ar–CH₂– (ÇOK karakteristik)'
    }],
    c13nmr: {
      range: '40 – 50 ppm',
      ppm: [40, 50],
      description: 'Benzilik CH₂'
    },
    ftir: [
      {
        range: '3030 cm⁻¹',
        wavenumber: [3030, 3030],
        intensity: 'medium',
        assignment: 'Ar–H stretch'
      },
      {
        range: '1450–1600 cm⁻¹',
        wavenumber: [1450, 1600],
        intensity: 'strong',
        assignment: 'Ar C=C'
      }
    ],
    diagnosticFeatures: [
      'δ 4.2-4.6 ppm ÇOK TANıSAL!',
      'Alkol koruma grubu (Bn)',
      'Hidrojenoliz ile kolay ayrılır'
    ]
  },

  {
    id: 63,
    name: 'Vinil Halojenür (–CH=CH–X)',
    nameEn: 'Vinyl Halide',
    structure: 'R-CH=CH-X',
    h1nmr: [{
      range: '5.5 – 6.5 ppm',
      ppm: [5.5, 6.5],
      description: 'Vinilik H (halojen etkisiyle downfield)'
    }],
    c13nmr: {
      range: '115 – 140 ppm',
      ppm: [115, 140],
      description: 'C=C karbonları'
    },
    ftir: [
      {
        range: '1600–1680 cm⁻¹',
        wavenumber: [1600, 1680],
        intensity: 'medium',
        assignment: 'C=C stretch'
      },
      {
        range: '600–800 cm⁻¹',
        wavenumber: [600, 800],
        intensity: 'strong',
        assignment: 'C–X stretch'
      }
    ],
    diagnosticFeatures: [
      'SN2\'ye dirençli (sp² karbon)',
      'Cross-coupling reaksiyonları',
      'Heck reaksiyonu'
    ]
  },

  {
    id: 64,
    name: 'Propargil Grubu (–CH₂–C≡CH)',
    nameEn: 'Propargyl Group',
    structure: 'R-CH₂-C≡CH',
    h1nmr: [
      {
        range: '2.0 – 3.0 ppm',
        ppm: [2.0, 3.0],
        description: '≡CH (terminal alkin)'
      },
      {
        range: '3.0 – 3.5 ppm',
        ppm: [3.0, 3.5],
        description: 'CH₂ (propargilik pozisyon)'
      }
    ],
    c13nmr: {
      range: '70 – 85 ppm',
      ppm: [70, 85],
      description: 'C≡C karbonları'
    },
    ftir: [
      {
        range: '2100–2260 cm⁻¹',
        wavenumber: [2100, 2260],
        intensity: 'medium',
        assignment: 'C≡C stretch'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'strong',
        assignment: '≡C–H stretch'
      }
    ],
    diagnosticFeatures: [
      'Click chemistry',
      'Propargilik CH₂ δ 3.0-3.5',
      'Sonogashira coupling'
    ]
  },

  {
    id: 65,
    name: 'Allen (C=C=C)',
    nameEn: 'Allene',
    structure: 'R₂C=C=CR₂',
    h1nmr: [{
      range: '4.5 – 6.5 ppm',
      ppm: [4.5, 6.5],
      description: 'Vinilik H (kümülen sistem)'
    }],
    c13nmr: {
      range: '200 – 220 ppm',
      ppm: [200, 220],
      description: 'Merkez karbon (ÇOK AYIRT EDİCİ!)'
    },
    ftir: [
      {
        range: '1950–2000 cm⁻¹',
        wavenumber: [1950, 2000],
        intensity: 'strong',
        assignment: 'C=C=C kümülen stretch (ÇOK karakteristik)'
      }
    ],
    diagnosticFeatures: [
      '200-220 ppm ¹³C TEK BAŞINA TANıSAL!',
      '1950-2000 cm⁻¹ IR ÇOK AYIRT EDİCİ!',
      'Kümülen yapı',
      'Axial chirality'
    ]
  },

  {
    id: 66,
    name: 'İmino Ester (–C(=NH)OR)',
    nameEn: 'Imidate',
    structure: 'R-C(=NH)OR',
    h1nmr: [
      {
        range: '6 – 9 ppm',
        ppm: [6, 9],
        description: 'NH (geniş)',
        multiplicity: 'br s'
      },
      {
        range: '3.8 – 4.5 ppm',
        ppm: [3.8, 4.5],
        description: 'O–CH'
      }
    ],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1640–1680 cm⁻¹',
        wavenumber: [1640, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '1050–1250 cm⁻¹',
        wavenumber: [1050, 1250],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Amid analogu (C=N vs C=O)',
      'Pinner synthesis',
      'Moisture sensitive'
    ]
  },

  {
    id: 67,
    name: 'Amid Oksim (–C(=NOH)NH₂)',
    nameEn: 'Amide Oxime',
    structure: 'R-C(=NOH)NH₂',
    h1nmr: [
      {
        range: '8 – 11 ppm',
        ppm: [8, 11],
        description: 'N–OH (çok geniş)',
        multiplicity: 'br s'
      },
      {
        range: '4 – 7 ppm',
        ppm: [4, 7],
        description: 'NH₂ (geniş)',
        multiplicity: 'br s'
      }
    ],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '3200–3500 cm⁻¹',
        wavenumber: [3200, 3500],
        intensity: 'medium',
        assignment: 'N–H / O–H stretch (overlap)'
      },
      {
        range: '1650 cm⁻¹',
        wavenumber: [1650, 1650],
        intensity: 'strong',
        assignment: 'C=N stretch'
      }
    ],
    diagnosticFeatures: [
      'İki farklı NH grubu',
      'Metal chelator',
      'Hidroksam asit precursor'
    ]
  },

  {
    id: 68,
    name: 'Thioimidate (–C(=NR)SR)',
    nameEn: 'Thioimidate',
    structure: 'R-C(=NR)SR',
    h1nmr: [{
      range: '2.5 – 3.5 ppm',
      ppm: [2.5, 3.5],
      description: 'S–CH protonları'
    }],
    c13nmr: {
      range: '150 – 165 ppm',
      ppm: [150, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1600–1650 cm⁻¹',
        wavenumber: [1600, 1650],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '700–800 cm⁻¹',
        wavenumber: [700, 800],
        intensity: 'medium',
        assignment: 'C–S stretch'
      }
    ],
    diagnosticFeatures: [
      'İmidat\'ın S analoğu',
      'Heterocycle synthesis',
      'Tautomerism'
    ]
  },

  {
    id: 69,
    name: 'Ditiokarbamat (–CS₂NR₂)',
    nameEn: 'Dithiocarbamate',
    structure: 'R₂N-CS₂-M',
    h1nmr: [{
      range: '3.0 – 4.0 ppm',
      ppm: [3.0, 4.0],
      description: 'N–CH protonları'
    }],
    c13nmr: {
      range: '200 – 220 ppm',
      ppm: [200, 220],
      description: 'CS₂ karbonu (ÇOK downfield)'
    },
    ftir: [
      {
        range: '950–1050 cm⁻¹',
        wavenumber: [950, 1050],
        intensity: 'strong',
        assignment: 'C=S stretch'
      },
      {
        range: '1400–1500 cm⁻¹',
        wavenumber: [1400, 1500],
        intensity: 'strong',
        assignment: 'C–N stretch'
      }
    ],
    diagnosticFeatures: [
      '200-220 ppm ¹³C çok karakteristik',
      'Metal chelator',
      'Vulkanizasyon accelerator'
    ]
  },

  {
    id: 70,
    name: 'Ksantat (–OCS₂R)',
    nameEn: 'Xanthate',
    structure: 'R-O-CS₂-R',
    h1nmr: [{
      range: '3.8 – 4.5 ppm',
      ppm: [3.8, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '210 – 220 ppm',
      ppm: [210, 220],
      description: 'CS₂ karbonu'
    },
    ftir: [
      {
        range: '1050–1200 cm⁻¹',
        wavenumber: [1050, 1200],
        intensity: 'strong',
        assignment: 'C=S stretch'
      },
      {
        range: '800–900 cm⁻¹',
        wavenumber: [800, 900],
        intensity: 'medium',
        assignment: 'C–S stretch'
      }
    ],
    diagnosticFeatures: [
      'Barton-McCombie deoxygenation',
      'RAFT polymerization',
      'Sarı renk'
    ]
  },

  {
    id: 71,
    name: 'Karbonat Esteri (–O–CO–O–)',
    nameEn: 'Carbonate Ester',
    structure: 'R-O-CO-O-R',
    h1nmr: [{
      range: '4.0 – 4.5 ppm',
      ppm: [4.0, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '154 – 160 ppm',
      ppm: [154, 160],
      description: 'Karbonat C=O'
    },
    ftir: [
      {
        range: '1740–1760 cm⁻¹',
        wavenumber: [1740, 1760],
        intensity: 'strong',
        assignment: 'C=O stretch'
      },
      {
        range: '1200–1300 cm⁻¹',
        wavenumber: [1200, 1300],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'İki ester grubu arasında',
      'Polycarbonate plastikleri',
      'Çevre dostu çözücüler (DMC, DEC)'
    ]
  },

  {
    id: 72,
    name: 'Perasit (–COOOH)',
    nameEn: 'Peracid',
    structure: 'R-CO-O-OH',
    h1nmr: [{
      range: '9 – 12 ppm',
      ppm: [9, 12],
      description: 'O–O–H (çok geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'C=O karbonu'
    },
    ftir: [
      {
        range: '1760–1780 cm⁻¹',
        wavenumber: [1760, 1780],
        intensity: 'strong',
        assignment: 'C=O stretch (normal asitten yüksek)'
      },
      {
        range: '850–900 cm⁻¹',
        wavenumber: [850, 900],
        intensity: 'weak',
        assignment: 'O–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Güçlü oksidant',
      'Epoksidasyon (mCPBA)',
      'Baeyer-Villiger oksidasyonu'
    ],
    warnings: [
      '⚠️ Patlayıcı!',
      '⚠️ Dikkatli saklanmalı'
    ]
  },

  {
    id: 73,
    name: 'Haloformil (–COX, aromatik)',
    nameEn: 'Aroyl Halide',
    structure: 'Ar-COX',
    h1nmr: [{
      range: '3.0 – 3.5 ppm',
      ppm: [3.0, 3.5],
      description: 'α-H (aromatic karbonil α-konumu genelde yok)'
    }],
    c13nmr: {
      range: '175 – 185 ppm',
      ppm: [175, 185],
      description: 'Ar–C=O karbonu'
    },
    ftir: [
      {
        range: '1780–1810 cm⁻¹',
        wavenumber: [1780, 1810],
        intensity: 'strong',
        assignment: 'C=O stretch (ÇOK yüksek frekans)'
      },
      {
        range: '600–800 cm⁻¹',
        wavenumber: [600, 800],
        intensity: 'strong',
        assignment: 'C–X stretch'
      }
    ],
    diagnosticFeatures: [
      'Benzoil klorür en bilinen örnek',
      'Schotten-Baumann reaksiyonu',
      'Çok reaktif acylating agent'
    ]
  },

  {
    id: 74,
    name: 'İmid (–CO–NH–CO–)',
    nameEn: 'Imide',
    structure: '(RCO)₂NH',
    h1nmr: [{
      range: '7 – 10 ppm',
      ppm: [7, 10],
      description: 'NH (geniş)',
      multiplicity: 'br s'
    }],
    c13nmr: {
      range: '165 – 175 ppm',
      ppm: [165, 175],
      description: 'İki C=O karbonu'
    },
    ftir: [
      {
        range: '1700–1770 cm⁻¹',
        wavenumber: [1700, 1770],
        intensity: 'strong',
        assignment: 'Çift C=O stretch (asymmetric + symmetric)'
      },
      {
        range: '3300 cm⁻¹',
        wavenumber: [3300, 3300],
        intensity: 'medium',
        assignment: 'N–H stretch'
      }
    ],
    diagnosticFeatures: [
      'İki karbonil grubu',
      'Phthalimide (Gabriel synthesis)',
      'Maleimide, succinimide'
    ]
  },

  {
    id: 75,
    name: 'Nitron (R₂C=N⁺O⁻–R)',
    nameEn: 'Nitrone',
    structure: 'R₂C=N⁺(O⁻)R',
    h1nmr: [{
      range: '6 – 8 ppm',
      ppm: [6, 8],
      description: 'CH=N (nitron karakteristik)'
    }],
    c13nmr: {
      range: '140 – 155 ppm',
      ppm: [140, 155],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1550–1600 cm⁻¹',
        wavenumber: [1550, 1600],
        intensity: 'strong',
        assignment: 'C=N⁺–O⁻ stretch'
      },
      {
        range: '1200–1300 cm⁻¹',
        wavenumber: [1200, 1300],
        intensity: 'strong',
        assignment: 'N–O stretch'
      }
    ],
    diagnosticFeatures: [
      '1,3-Dipolar cycloaddition',
      'Spin trap',
      'İmin N-oksit'
    ]
  },

  {
    id: 76,
    name: 'Oksazolin (5-üyeli N,O-heterosiklik)',
    nameEn: 'Oxazoline',
    structure: 'Cyclic O-C=N',
    h1nmr: [{
      range: '4.0 – 4.8 ppm',
      ppm: [4.0, 4.8],
      description: 'O–CH (halka üzerinde)'
    }],
    c13nmr: {
      range: '155 – 165 ppm',
      ppm: [155, 165],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1640–1680 cm⁻¹',
        wavenumber: [1640, 1680],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '1050–1150 cm⁻¹',
        wavenumber: [1050, 1150],
        intensity: 'strong',
        assignment: 'C–O stretch'
      }
    ],
    diagnosticFeatures: [
      'Ligand kimyasında kullanılır',
      'Asimetrik kataliz',
      'Amino alkol türevi'
    ]
  },

  {
    id: 77,
    name: 'Tiazolin (N,S-heterosiklik)',
    nameEn: 'Thiazoline',
    structure: 'Cyclic S-C=N',
    h1nmr: [{
      range: '3.0 – 4.0 ppm',
      ppm: [3.0, 4.0],
      description: 'S–CH (halka üzerinde)'
    }],
    c13nmr: {
      range: '150 – 170 ppm',
      ppm: [150, 170],
      description: 'C=N karbonu'
    },
    ftir: [
      {
        range: '1600–1650 cm⁻¹',
        wavenumber: [1600, 1650],
        intensity: 'strong',
        assignment: 'C=N stretch'
      },
      {
        range: '700–800 cm⁻¹',
        wavenumber: [700, 800],
        intensity: 'medium',
        assignment: 'C–S stretch'
      }
    ],
    diagnosticFeatures: [
      'Biyolojik aktivite',
      'Antibiyotik prekürsor',
      'Cystein türevi'
    ]
  },

  {
    id: 78,
    name: 'Sülfenil Halojenür (–S–X)',
    nameEn: 'Sulfenyl Halide',
    structure: 'R-S-X',
    h1nmr: [{
      range: '2.5 – 3.5 ppm',
      ppm: [2.5, 3.5],
      description: 'α-H (S–X komşusu)'
    }],
    c13nmr: {
      range: '30 – 45 ppm',
      ppm: [30, 45],
      description: 'C–S karbonu'
    },
    ftir: [
      {
        range: '500–600 cm⁻¹',
        wavenumber: [500, 600],
        intensity: 'medium',
        assignment: 'S–X stretch'
      }
    ],
    diagnosticFeatures: [
      'Çok reaktif',
      'Sülfenilasyon ajanı',
      'Kötü koku'
    ]
  },

  {
    id: 79,
    name: 'Fosforamidat (–P(=O)(NR₂)(OR))',
    nameEn: 'Phosphoramidate',
    structure: 'R₂N-P(=O)(OR)₂',
    h1nmr: [{
      range: '3.0 – 4.5 ppm',
      ppm: [3.0, 4.5],
      description: 'N–CH / O–CH protonları'
    }],
    c13nmr: {
      range: '50 – 80 ppm',
      ppm: [50, 80],
      description: 'C–O / C–N karbonları'
    },
    ftir: [
      {
        range: '1200–1250 cm⁻¹',
        wavenumber: [1200, 1250],
        intensity: 'strong',
        assignment: 'P=O stretch'
      },
      {
        range: '900–1050 cm⁻¹',
        wavenumber: [900, 1050],
        intensity: 'strong',
        assignment: 'P–O / P–N stretch'
      }
    ],
    diagnosticFeatures: [
      'Pestisitler (insecticides)',
      'Nerve agents (dikkatli!)',
      'Biyokimyada önemli'
    ]
  },

  {
    id: 80,
    name: 'Arsonat Esteri (–AsO(OR)₂)',
    nameEn: 'Arsonate Ester',
    structure: 'R-AsO(OR)₂',
    h1nmr: [{
      range: '3.5 – 4.5 ppm',
      ppm: [3.5, 4.5],
      description: 'O–CH protonları'
    }],
    c13nmr: {
      range: '60 – 80 ppm',
      ppm: [60, 80],
      description: 'C–O karbonları'
    },
    ftir: [
      {
        range: '830–880 cm⁻¹',
        wavenumber: [830, 880],
        intensity: 'strong',
        assignment: 'As–O stretch'
      },
      {
        range: '1200–1250 cm⁻¹',
        wavenumber: [1200, 1250],
        intensity: 'strong',
        assignment: 'As=O stretch'
      }
    ],
    diagnosticFeatures: [
      'Fosfat analoğu',
      'Biyolojik aktivite',
      'Toksik (dikkatli kullanım!)'
    ],
    warnings: [
      '⚠️ Arsenik bileşikleri toksiktir!',
      '⚠️ Uygun güvenlik önlemleri gereklidir'
    ]
  }
];

/**
 * Quick diagnostic features for rapid identification
 */
export const DIAGNOSTIC_PEAKS = {
  // Single peaks that are nearly diagnostic alone
  aldehyde_h: { range: [9.0, 10.5], description: 'Aldehit H - ÇOK TANİSAL!' },
  carboxylic_acid: { range: [10.0, 13.0], description: 'COOH - ÇOK geniş, ÇOK TANİSAL!' },
  aromatic: { range: [6.5, 8.5], description: 'Aromatik H' },
  acetal_c13: { range: [95, 105], description: 'Asetal C - ¹³C\'de ÇOK TANİSAL!' },
  quinone_c13: { range: [180, 190], description: 'Kinon C=O - ¹³C\'de ÇOK TANİSAL!' },
  allene_c13: { range: [200, 220], description: 'Allene merkez C - ÇOK AYIRT EDİCİ!' },
  silyl_h: { range: [-0.3, 0.3], description: 'Si-CH₃ - NEGATİF değerler mümkün!' },
};

/**
 * IR peaks that are diagnostic alone
 */
export const DIAGNOSTIC_IR = {
  nitrile: { range: [2210, 2260], description: 'C≡N - keskin, ayırt edici' },
  alkyne_h: { range: [3300, 3300], description: '≡C–H - keskin terminal alkin' },
  anhydride: { peaks: [1820, 1760], description: 'Çift C=O - anhidrit TANıSAL!' },
  nitro: { peaks: [1520, 1350], description: 'Çift NO₂ - ÇOK TANıSAL!' },
  azide: { range: [2090, 2120], description: 'N₃ - çok karakteristik' },
  isocyanate: { range: [2260, 2280], description: 'N=C=O - çok keskin' },
  isothiocyanate: { range: [2050, 2100], description: 'N=C=S - çok keskin' },
  allene: { range: [1950, 2000], description: 'C=C=C kümülen' },
  disulfide: { range: [500, 550], description: 'S–S - zayıf ama ÇOK AYIRT EDİCİ!' },
  thiol: { range: [2550, 2600], description: 'S–H - zayıf ama ayırt edici' },
  peroxide: { range: [800, 900], description: 'O–O - zayıf ama karakteristik' },
};

/**
 * Search functional group by name (Turkish or English)
 */
export function searchFunctionalGroup(query: string): FunctionalGroupSpectrum[] {
  const lowerQuery = query.toLowerCase();
  return FUNCTIONAL_GROUP_LIBRARY.filter(fg =>
    fg.name.toLowerCase().includes(lowerQuery) ||
    fg.nameEn.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Find functional groups by H1 NMR shift
 */
export function findByH1Shift(ppm: number, tolerance: number = 0.5): FunctionalGroupSpectrum[] {
  return FUNCTIONAL_GROUP_LIBRARY.filter(fg =>
    fg.h1nmr.some(h => ppm >= h.ppm[0] - tolerance && ppm <= h.ppm[1] + tolerance)
  );
}

/**
 * Find functional groups by C13 NMR shift
 */
export function findByC13Shift(ppm: number, tolerance: number = 5): FunctionalGroupSpectrum[] {
  return FUNCTIONAL_GROUP_LIBRARY.filter(fg =>
    ppm >= fg.c13nmr.ppm[0] - tolerance && ppm <= fg.c13nmr.ppm[1] + tolerance
  );
}

/**
 * Find functional groups by IR wavenumber
 */
export function findByIR(wavenumber: number, tolerance: number = 50): FunctionalGroupSpectrum[] {
  return FUNCTIONAL_GROUP_LIBRARY.filter(fg =>
    fg.ftir.some(ir =>
      wavenumber >= ir.wavenumber[0] - tolerance &&
      wavenumber <= ir.wavenumber[1] + tolerance
    )
  );
}

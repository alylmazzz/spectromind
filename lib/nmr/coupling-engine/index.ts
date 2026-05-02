/**
 * SpectroMind v2.0 - J Coupling Engine
 * 
 * J değerleri üretim hattı:
 * 1. Coupling sınıfı tespit (2J/3J/4J)
 * 2. Bağ/topoloji sınıfı belirleme
 * 3. 3D'den dihedral ve geometri çıkarma
 * 4. Parametre seti seçimi (bondClass'a göre)
 * 5. Substituent/gauche düzeltmeleri
 * 6. Motif tabanlı override
 */

export * from './couplingTypes';
export * from './karplusEngine';
export * from './jLibrary';
export * from './bondClassifier';
export * from './jCalculator';

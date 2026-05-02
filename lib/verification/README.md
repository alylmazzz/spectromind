# Verification Module – Deterministic Teyit Altyapısı

Bu modül, SpectroMaster “validated or nothing” ve GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED gereksinimleri için ortak tipler ve sabitler sağlar.

## Dosyalar

- **constants.ts** – `ROOT_CAUSE_CODES` (PARSER_FAIL:*, RULE_VIOLATION:*, NOT_PROVIDED, NOT_EXPECTED_FOR_CONTEXT) ve `ROOT_CAUSE_RECOMMENDED_ACTIONS`.
- **types.ts** – `MoleculeGraph` (tek sözleşme: atoms, bonds, canonicalSmiles, atomCounts, dbe, source, ringSize vb.) ve `ParseAndStandardizeResult`.
- **index.ts** – Re-export.

## API

- **POST /api/parse_and_standardize** – RDKit ile Parse → Sanitize → Canonicalize → MoleculeGraph. Başarısız parse: `{ success: false, rootCause, message }` (HTTP 200, INCONCLUSIVE için uygun).

## Kullanım

- Teyit motoru (Spectromasterv0.2tester): Kernel yoksa veya parse başarısızsa `runVerification` INCONCLUSIVE döner; `root_cause_code`, `recommended_action`, `config_snapshot`, `artifact_hashes` rapora eklenir.
- Next.js pipeline: `parse_and_standardize` çağrılıp `moleculeGraph` alınarak tüm spektrum/teyit akışı bu sözleşmeyle beslenebilir.

## Sonraki Adımlar (Phase 2+)

- 1H/13C shift motorları HOSE/increment ve MoleculeGraph ile tek modele indirilebilir.
- HSQC/COSY/HMBC jeneratörleri “yapıdan beklenen korelasyon grafı → kapsama oranı” ile doğrulanabilir.
- ruleset.json’a taşınacak mantık için bu modüldeki root_cause kodları referans alınır.

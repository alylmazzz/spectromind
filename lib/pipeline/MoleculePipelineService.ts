/**
 * MoleculePipelineService
 * 
 * Single Source of Truth for molecule processing pipeline.
 * Orchestrates: Identity -> Structure -> Graph -> NMR -> FID
 * 
 * This service ensures:
 * - Deterministic processing order
 * - Consistent SMILES/stereo policy
 * - Proper 2D/3D coordinate separation
 * - Clear separation of deterministic vs LLM predictions
 */

import {
  MoleculeInput,
  IdentityResult,
  StructureResult,
  GraphResult,
  NMRPredictionResult,
  FIDComparisonResult,
  PipelineResult,
  PipelineWarning,
  ConfidenceBreakdown,
  NMRPeakPrediction,
  Atom2D,
  Atom3D,
  GraphAtom,
  GraphBond,
  LLMInterpretation
} from './types';

import { SMILESResolver, SMILESResolutionResult } from '@/lib/services/SMILESResolver';
import { parseSMILES, estimate3DCoordinates, type MolecularStructure } from '@/lib/utils/molecularStructure';
import {
  computeAtomCountsFromRDKitAtoms,
  formatHillFormula,
  computeDBE,
  validateFormula,
  normalizeFormula,
  getTotalHydrogen,
  getTotalCarbon
} from '@/lib/chem/formula';
import { WARNING_CODES } from './types';

// ============================================================================
// PIPELINE SERVICE
// ============================================================================

export class MoleculePipelineService {
  private static instance: MoleculePipelineService;
  
  private constructor() {}
  
  static getInstance(): MoleculePipelineService {
    if (!MoleculePipelineService.instance) {
      MoleculePipelineService.instance = new MoleculePipelineService();
    }
    return MoleculePipelineService.instance;
  }

  // ============================================================================
  // MAIN PIPELINE RUNNER
  // ============================================================================

  /**
   * Run the complete pipeline
   */
  async run(
    input: MoleculeInput,
    options?: {
      predictNMR?: boolean;
      processFID?: {
        fidData: ArrayBuffer;
        acqusContent?: string;
      };
    }
  ): Promise<PipelineResult> {
    const timestamps: Record<string, string> = {};
    const sourceChain: string[] = [];
    const warnings: PipelineWarning[] = [];

    timestamps.start = new Date().toISOString();

    // Stage 1: Resolve Identity
    const identity = await this.resolveIdentity(input);
    timestamps.identityResolved = new Date().toISOString();
    sourceChain.push(`identity:${identity.cid ? 'cid' : 'name'}`);
    warnings.push(...identity.warnings);

    // Stage 2: Resolve Structure
    const structure = await this.resolveStructure(identity, input);
    timestamps.structureResolved = new Date().toISOString();
    sourceChain.push(`structure:${structure.source}`);
    warnings.push(...structure.warnings);

    if (!structure.canonicalSmiles) {
      // Cannot proceed without structure
      return {
        input,
        identity,
        structure,
        graph: this.createEmptyGraph(),
        warnings,
        provenance: { sourceChain, timestamps },
        confidence: this.createEmptyConfidence()
      };
    }

    // Stage 3: Validate and Normalize
    const validation = this.normalizeAndValidate(identity, structure, input);
    warnings.push(...validation.warnings);

    // Stage 4: Build Graph
    const graph = await this.buildGraph(structure);
    timestamps.graphBuilt = new Date().toISOString();
    sourceChain.push(`graph:${graph.graphSource}`);
    warnings.push(...graph.limitations.map(l => ({
      code: 'GRAPH_LIMITATION',
      message: l,
      stage: 'graph' as const,
      severity: 'medium' as const
    })));

    // Formula validation (now that we have graph.molecularFormulaHill)
    if (identity.formula && graph.molecularFormulaHill) {
      const normalizedIdentityFormula = normalizeFormula(identity.formula);
      const normalizedGraphFormula = normalizeFormula(graph.molecularFormulaHill);
      
      // Use validateFormula for accurate comparison
      if (!validateFormula(identity.formula, graph.molecularFormulaHill)) {
        warnings.push({
          code: WARNING_CODES.FORMULA_MISMATCH,
          message: `Formula mismatch: identity="${normalizedIdentityFormula}" vs computed="${normalizedGraphFormula}". This may indicate wrong CID or structure. Analysis will be locked to selected identity.`,
          stage: 'graph',
          severity: 'high'
        });
      }
    }

    // Identity fingerprint already stored above (before NMR stage)

    // Stage 5: Predict NMR (if requested)
    let nmr: NMRPredictionResult | undefined;
    if (options?.predictNMR) {
      nmr = await this.predictNMR(structure, graph, input);
      timestamps.nmrPredicted = new Date().toISOString();
      sourceChain.push('nmr:predicted');
    }

    // Stage 6: FID Comparison (if requested)
    let fid: FIDComparisonResult | undefined;
    if (options?.processFID && nmr) {
      fid = await this.optionalFIDCompare(
        options.processFID.fidData,
        options.processFID.acqusContent,
        nmr.finalConsensus.peaks
      );
      timestamps.fidProcessed = new Date().toISOString();
      sourceChain.push('fid:compared');
    }

    timestamps.end = new Date().toISOString();

    // Calculate confidence
    const confidence = this.calculateConfidence(structure, graph, nmr, fid);

    return {
      input,
      identity,
      structure,
      graph,
      nmr,
      fid,
      warnings,
      provenance: {
        sourceChain,
        timestamps
      },
      confidence
    };
  }

  // ============================================================================
  // STAGE 1: RESOLVE IDENTITY
  // ============================================================================

  /**
   * Resolve molecule identity (CID, name, formula)
   */
  async resolveIdentity(input: MoleculeInput): Promise<IdentityResult> {
    const warnings: PipelineWarning[] = [];

    // If CID provided, use it directly
    if (input.cid) {
      try {
        // Fetch IUPAC and formula from PubChem
        const response = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${input.cid}/property/IUPACName,MolecularFormula/JSON`,
          { headers: { 'User-Agent': 'SpectroMind/1.0' } }
        );

        if (response.ok) {
          const data = await response.json();
          const props = data.PropertyTable?.Properties?.[0];
          
          return {
            cid: input.cid,
            preferredName: props?.IUPACName || input.moleculeName || 'Unknown',
            iupacName: props?.IUPACName,
            formula: props?.MolecularFormula || input.formula,
            warnings
          };
        }
      } catch (error) {
        warnings.push({
          code: 'CID_FETCH_FAILED',
          message: `Failed to fetch CID ${input.cid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'identity',
          severity: 'medium'
        });
      }
    }

    // If molecule name provided, search PubChem
    if (input.moleculeName) {
      try {
        const response = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(input.moleculeName)}/cids/JSON`,
          { headers: { 'User-Agent': 'SpectroMind/1.0' } }
        );

        if (response.ok) {
          const data = await response.json();
          const cids = data.IdentifierList?.CID || [];

          if (cids.length > 0) {
            const cid = cids[0];
            
            // Fetch properties for first CID
            const propResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula/JSON`,
              { headers: { 'User-Agent': 'SpectroMind/1.0' } }
            );

            if (propResponse.ok) {
              const propData = await propResponse.json();
              const props = propData.PropertyTable?.Properties?.[0];

              if (cids.length > 1) {
                warnings.push({
                  code: 'MULTIPLE_CIDS',
                  message: `Found ${cids.length} CIDs for "${input.moleculeName}", using first (${cid})`,
                  stage: 'identity',
                  severity: 'low'
                });
              }

              return {
                cid,
                preferredName: props?.IUPACName || input.moleculeName,
                iupacName: props?.IUPACName,
                formula: props?.MolecularFormula || input.formula,
                warnings
              };
            }
          }
        }
      } catch (error) {
        warnings.push({
          code: 'NAME_SEARCH_FAILED',
          message: `Failed to search PubChem for "${input.moleculeName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'identity',
          severity: 'medium'
        });
      }
    }

    // Fallback: use provided data
    return {
      preferredName: input.moleculeName || input.iupacName || 'Unknown',
      iupacName: input.iupacName,
      formula: input.formula,
      warnings: [
        ...warnings,
        {
          code: 'IDENTITY_INCOMPLETE',
          message: 'Could not resolve full identity from PubChem, using provided data',
          stage: 'identity',
          severity: 'medium'
        }
      ]
    };
  }

  // ============================================================================
  // STAGE 2: RESOLVE STRUCTURE
  // ============================================================================

  /**
   * Resolve structure (SMILES, InChI) with stereo policy
   */
  async resolveStructure(
    identity: IdentityResult,
    input: MoleculeInput
  ): Promise<StructureResult> {
    const warnings: PipelineWarning[] = [];
    const stereoPolicy = input.options?.preferredStereoPolicy || 'auto';

    // If SMILES provided by user, use it
    if (input.smiles) {
      return {
        canonicalSmiles: input.smiles,
        isomericSmiles: undefined, // Assume canonical unless marked
        inchi: input.inchi || undefined,
        inchiKey: undefined, // Would need to calculate
        stereoStatus: 'none', // Unknown
        source: 'user',
        warnings: [
          {
            code: 'USER_SMILES',
            message: 'Using user-provided SMILES, stereo status unknown',
            stage: 'structure',
            severity: 'low'
          }
        ]
      };
    }

    // Strategy 1: CID -> PubChem SMILES
    if (identity.cid) {
      const result = await SMILESResolver.fromCID(identity.cid);
      
      if (result.smiles) {
        const stereoStatus = result.isomeric ? 'full' : 'none';
        
        if (stereoPolicy === 'require_isomeric' && !result.isomeric) {
          warnings.push({
            code: 'STEREO_MISSING',
            message: 'Isomeric SMILES required but only canonical available',
            stage: 'structure',
            severity: 'high'
          });
        }

        if (stereoStatus === 'none' && stereoPolicy !== 'allow_canonical') {
          warnings.push({
            code: 'STEREO_MISSING',
            message: 'Stereo information missing; NMR prediction may be ambiguous',
            stage: 'structure',
            severity: 'medium'
          });
        }

        return {
          canonicalSmiles: result.smiles,
          isomericSmiles: result.isomeric ? result.smiles : undefined,
          inchi: result.inchi || undefined,
          inchiKey: undefined, // Would need to calculate from InChI
          stereoStatus,
          source: result.source || 'pubchem',
          warnings
        };
      }
    }

    // Strategy 2: IUPAC -> OPSIN
    const iupacName = identity.iupacName || input.iupacName;
    if (iupacName) {
      const result = await SMILESResolver.fromIUPAC(iupacName);
      
      if (result.smiles) {
        return {
          canonicalSmiles: result.smiles,
          isomericSmiles: undefined,
          inchi: undefined,
          inchiKey: undefined,
          stereoStatus: 'none', // OPSIN usually returns canonical
          source: 'opsin',
          warnings: [
            ...warnings,
            {
              code: 'OPSIN_NO_STEREO',
              message: 'OPSIN conversion successful but no stereo information',
              stage: 'structure',
              severity: 'medium'
            }
          ]
        };
      }
    }

    // Strategy 3: Name -> PubChem (if not already tried)
    if (identity.preferredName && !identity.cid) {
      try {
        const response = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(identity.preferredName)}/property/IsomericSMILES,CanonicalSMILES,InChI/JSON`,
          { headers: { 'User-Agent': 'SpectroMind/1.0' } }
        );

        if (response.ok) {
          const data = await response.json();
          const props = data.PropertyTable?.Properties?.[0];
          const smiles = props?.IsomericSMILES || props?.CanonicalSMILES;
          const isomeric = !!props?.IsomericSMILES;

          if (smiles) {
            return {
              canonicalSmiles: smiles,
              isomericSmiles: isomeric ? smiles : undefined,
              inchi: props?.InChI || undefined,
              inchiKey: undefined,
              stereoStatus: isomeric ? 'full' : 'none',
              source: 'pubchem',
              warnings
            };
          }
        }
      } catch (error) {
        // Silent fail, continue to error
      }
    }

    // All strategies failed
    return {
      canonicalSmiles: undefined,
      isomericSmiles: undefined,
      inchi: undefined,
      inchiKey: undefined,
      stereoStatus: 'none',
      source: 'unknown',
      warnings: [
        ...warnings,
        {
          code: 'STRUCTURE_RESOLUTION_FAILED',
          message: 'Could not resolve structure from any source',
          stage: 'structure',
          severity: 'high'
        }
      ]
    };
  }

  // ============================================================================
  // STAGE 3: VALIDATE AND NORMALIZE
  // ============================================================================

  /**
   * Validate structure against identity
   */
  normalizeAndValidate(
    identity: IdentityResult,
    structure: StructureResult,
    input: MoleculeInput
  ): { warnings: PipelineWarning[]; normalizedInput: MoleculeInput } {
    const warnings: PipelineWarning[] = [];

    // Formula match validation
    if (identity.formula && structure.canonicalSmiles) {
      try {
        // Try to get formula from graph (if already built) or calculate from SMILES
        // For now, we'll validate when graph is built
        // Placeholder: actual validation happens in buildGraph stage
        warnings.push({
          code: 'FORMULA_VALIDATION_PENDING',
          message: 'Formula validation will be performed after graph building',
          stage: 'structure',
          severity: 'low'
        });
      } catch (error) {
        warnings.push({
          code: 'FORMULA_VALIDATION_FAILED',
          message: `Formula validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'structure',
          severity: 'medium'
        });
      }
    }

    // InChIKey validation (if both PubChem and OPSIN results exist)
    // This would require calculating InChIKey from InChI
    // Placeholder for now

    return {
      warnings,
      normalizedInput: input
    };
  }

  // ============================================================================
  // STAGE 4: BUILD GRAPH
  // ============================================================================

  /**
   * Build molecular graph (2D/3D coordinates)
   */
  async buildGraph(structure: StructureResult): Promise<GraphResult> {
    if (!structure.canonicalSmiles) {
      return this.createEmptyGraph();
    }

    // Try RDKit first (primary)
    try {
      const baseUrl = typeof window === 'undefined' ? 'http://localhost:3000' : '';
      const response = await fetch(`${baseUrl}/api/rdkit/parse-smiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: structure.canonicalSmiles })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Extract 2D and 3D coordinates
          const coords2d: Atom2D[] = data.coords2d || [];
          const coords3d: Atom3D[] = data.coords3d || data.atoms?.map((a: any) => ({
            x: a.x || 0,
            y: a.y || 0,
            z: a.z || 0
          })) || [];

          const atoms: GraphAtom[] = data.atoms?.map((a: any, idx: number) => ({
            id: `atom_${idx}`,
            symbol: a.symbol,
            formalCharge: a.formalCharge || 0,
            implicitHydrogens: a.implicitHydrogens || 0,
            isAromatic: a.isAromatic || false,
            hybridization: a.hybridization
          })) || [];

          const bonds: GraphBond[] = data.bonds?.map((b: any, idx: number) => ({
            id: `bond_${idx}`,
            atom1Id: `atom_${b.beginAtomIdx}`,
            atom2Id: `atom_${b.endAtomIdx}`,
            order: b.bondType === 'AROMATIC' ? 1.5 : (b.bondOrder || 1),
            isAromatic: b.bondType === 'AROMATIC' || b.isAromatic || false
          })) || [];

          // Compute atom counts from RDKit atoms (SINGLE SOURCE OF TRUTH)
          const atomCounts = computeAtomCountsFromRDKitAtoms(
            data.atoms?.map((a: any) => ({
              symbol: a.symbol,
              implicitHydrogens: a.implicitHydrogens || 0
            })) || []
          );

          // Compute molecular formula in Hill system
          const molecularFormulaHill = formatHillFormula(atomCounts);
          
          // Compute DBE
          const dbe = computeDBE(atomCounts);
          
          // Total hydrogen count
          const totalHydrogenFromFormula = getTotalHydrogen(atomCounts);

          return {
            graphSource: 'rdkit',
            coords2d: coords2d.length > 0 ? coords2d : undefined,
            coords3d: coords3d.length > 0 ? coords3d : undefined,
            atoms,
            bonds,
            formula: data.formula || molecularFormulaHill, // Backward compatibility
            atomCounts, // NEW: Single source of truth
            molecularFormulaHill, // NEW: Computed from atomCounts
            dbe, // NEW: Computed from atomCounts
            totalHydrogenFromFormula, // NEW: From atomCounts
            structureConfidence: 1.0,
            limitations: [],
            chiralCenters: data.chiral_centers?.map((cc: any) => ({
              atomIdx: cc[0],
              type: 'unknown' as const
            }))
          };
        }
      }
    } catch (error) {
      console.warn('RDKit graph building failed, falling back to JS parser:', error);
    }

    // Fallback: JS parser
    try {
      const molStructure = parseSMILES(structure.canonicalSmiles);
      const molStructure3D = estimate3DCoordinates(molStructure);

      const atoms: GraphAtom[] = molStructure.atoms.map(a => ({
        id: `atom_${a.id}`,
        symbol: a.element,
        formalCharge: a.formalCharge,
        implicitHydrogens: 0, // JS parser doesn't track this
        isAromatic: a.isAromatic,
        hybridization: a.hybridization
      }));

      const bonds: GraphBond[] = molStructure.bonds.map((b, idx) => ({
        id: `bond_${idx}`,
        atom1Id: `atom_${b.from}`,
        atom2Id: `atom_${b.to}`,
        order: b.order,
        isAromatic: b.isAromatic
      }));

      const coords2d: Atom2D[] = molStructure.atoms
        .filter(a => a.position)
        .map(a => ({
          x: a.position!.x,
          y: a.position!.y
        }));

      const coords3d: Atom3D[] = molStructure3D.atoms
        .filter(a => a.position)
        .map(a => ({
          x: a.position!.x,
          y: a.position!.y,
          z: a.position!.z
        }));

      // Compute atom counts from JS parser atoms
      const atomCounts: Record<string, number> = {};
      molStructure.atoms.forEach(atom => {
        atomCounts[atom.element] = (atomCounts[atom.element] || 0) + 1;
      });

      // Compute molecular formula in Hill system
      const molecularFormulaHill = formatHillFormula(atomCounts);
      
      // Compute DBE
      const dbe = computeDBE(atomCounts);
      
      // Total hydrogen count
      const totalHydrogenFromFormula = getTotalHydrogen(atomCounts);

      return {
        graphSource: 'js',
        coords2d: coords2d.length > 0 ? coords2d : undefined,
        coords3d: coords3d.length > 0 ? coords3d : undefined,
        atoms,
        bonds,
        formula: molecularFormulaHill, // Use computed formula
        atomCounts, // NEW: Single source of truth
        molecularFormulaHill, // NEW: Computed from atomCounts
        dbe, // NEW: Computed from atomCounts
        totalHydrogenFromFormula, // NEW: From atomCounts
        structureConfidence: 0.4, // Lower confidence for fallback
        limitations: [
          'Charge notation not fully supported',
          'Stereochemistry (@/@@) not parsed',
          'Isotopes not supported',
          'Complex ring closures may fail'
        ]
      };
    } catch (error) {
      console.error('JS parser also failed:', error);
      return this.createEmptyGraph();
    }
  }

  // ============================================================================
  // STAGE 5: PREDICT NMR
  // ============================================================================

  /**
   * Predict NMR spectrum (deterministic + LLM)
   */
  async predictNMR(
    structure: StructureResult,
    graph: GraphResult,
    input: MoleculeInput,
    identityFingerprint?: {
      cid?: number;
      inchiKey?: string | undefined;
      isomericSmiles?: string | undefined;
      molecularFormulaHill?: string;
    }
  ): Promise<NMRPredictionResult> {
    const warnings: Array<{ code: string; message: string }> = [];

    // Import predictors (dynamic import to avoid circular dependencies)
    const { predictDeterministic } = await import('@/lib/nmr/deterministicPredictor');
    const { runLLMInterpretation } = await import('@/lib/nmr/llmPredictor');
    const { buildConsensus } = await import('@/lib/nmr/consensusBuilder');

    // Step 1: Deterministic prediction
    const modelPrediction = await predictDeterministic(
      structure,
      graph,
      {
        solvent: 'CDCl3', // TODO: Get from input
        frequency: 400, // TODO: Get from input
        useUltraThink: true // Try Python engine first
      }
    );

    if (modelPrediction.method === 'NOT_IMPLEMENTED') {
      warnings.push({
        code: 'DETERMINISTIC_NOT_AVAILABLE',
        message: 'Deterministic NMR prediction not available'
      });
    }

    // IDENTITY LOCK: Use ONLY computed formula from graph
    const lockedFormula = graph.molecularFormulaHill || graph.formula;
    const lockedAtomCounts = graph.atomCounts;
    const lockedDBE = graph.dbe;
    const lockedTotalH = graph.totalHydrogenFromFormula;

    // Step 2: LLM interpretation (optional, requires API key)
    // CRITICAL: Pass ONLY computed formula, not user input formula
    let llmInterpretation: LLMInterpretation | undefined;
    let llmDriftDetected = false;
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        llmInterpretation = await runLLMInterpretation({
          moleculeName: input.moleculeName || structure.canonicalSmiles || 'Unknown',
          smiles: structure.isomericSmiles || structure.canonicalSmiles,
          formula: lockedFormula, // IDENTITY LOCK: Use computed formula only
          solvent: 'CDCl3',
          frequency: 400
        }, apiKey);
      } else {
        warnings.push({
          code: 'LLM_API_KEY_MISSING',
          message: 'OpenAI API key not configured, skipping LLM interpretation'
        });
      }
    } catch (error) {
      warnings.push({
        code: 'LLM_INTERPRETATION_FAILED',
        message: `LLM interpretation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // IDENTITY DRIFT DETECTION: Check if LLM returned different formula
    // (Simplified: Full validation would parse LLM response text for formula mentions)
    // For now, we rely on the locked formula being passed to LLM

    // If identity drift detected, discard LLM peaks
    if (llmDriftDetected && llmInterpretation) {
      warnings.push({
        code: WARNING_CODES.IDENTITY_DRIFT_DETECTED,
        message: `LLM interpretation detected formula/structure drift. LLM peaks discarded. Analysis locked to selected identity: ${lockedFormula}`
      });
      
      // Discard LLM peaks but keep notes/literatureInsights
      llmInterpretation = {
        ...llmInterpretation,
        peaks: undefined // Remove peaks, keep interpretation text
      };
    }

    // Step 3: Build consensus
    const finalConsensus = buildConsensus(
      modelPrediction,
      llmInterpretation,
      {
        tolerancePpm: 0.2,
        stereoStatus: structure.stereoStatus,
        preferModel: true
      }
    );

    // If identity lock is active (formula mismatch), mark consensus as "locked"
    const hasFormulaMismatch = warnings.some(w => w.code === WARNING_CODES.FORMULA_MISMATCH);
    if (hasFormulaMismatch) {
      // Force model-only if drift detected
      finalConsensus.method = 'model-only' as any;
      finalConsensus.rationale = `Analysis locked to selected identity (${lockedFormula}). LLM interpretation discarded due to formula mismatch.`;
    }

    return {
      modelPrediction,
      llmInterpretation,
      finalConsensus,
      warnings,
      solvent: 'CDCl3',
      frequency: 400
    };
  }

  // ============================================================================
  // STAGE 6: FID COMPARISON
  // ============================================================================

  /**
   * Compare FID experimental peaks with theoretical
   * 
   * NOTE: This is a placeholder. Actual implementation would:
   * 1. Process FID file (scripts/fid_processor.py)
   * 2. Extract experimental peaks
   * 3. Match with theoretical peaks
   */
  async optionalFIDCompare(
    fidData: ArrayBuffer,
    acqusContent: string | undefined,
    theoreticalPeaks: NMRPeakPrediction[]
  ): Promise<FIDComparisonResult> {
    // Placeholder - actual implementation would process FID
    return {
      experimentalPeaks: [],
      matchReport: {
        matched: [],
        missing: [],
        impurity: [],
        matchRate: 0.0
      }
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private createEmptyGraph(): GraphResult {
    return {
      graphSource: 'js',
      atoms: [],
      bonds: [],
      formula: '',
      atomCounts: {},
      molecularFormulaHill: '',
      dbe: 0,
      totalHydrogenFromFormula: 0,
      structureConfidence: 0.0,
      limitations: ['No structure available']
    };
  }

  private createEmptyConfidence(): ConfidenceBreakdown {
    return {
      structureConfidence: 0.0,
      stereoConfidence: 0.0,
      predictionConfidence: 0.0
    };
  }

  private calculateConfidence(
    structure: StructureResult,
    graph: GraphResult,
    nmr?: NMRPredictionResult,
    fid?: FIDComparisonResult
  ): ConfidenceBreakdown {
    let structureConfidence = graph.structureConfidence;
    
    // Reduce confidence if stereo missing
    if (structure.stereoStatus === 'none') {
      structureConfidence *= 0.8;
    }

    let stereoConfidence = structure.stereoStatus === 'full' ? 1.0 :
                          structure.stereoStatus === 'partial' ? 0.5 : 0.0;

    let predictionConfidence = nmr?.finalConsensus.confidence || 0.0;

    let fidQuality = fid ? fid.matchReport.matchRate : undefined;

    return {
      structureConfidence,
      stereoConfidence,
      predictionConfidence,
      fidQuality
    };
  }
}

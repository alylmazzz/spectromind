import { useState, useCallback } from 'react';
import type { FidProcessApiEnvelope } from '@/lib/fid/buildFidProcessResponse';

export type FidPipelinePhase =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'validating'
  | 'done'
  | 'error';

interface FIDData {
  metadata: any;
  ppm: number[];
  intensity: number[];
  peaks: Array<{ ppm: number; height: number; area: number }>;
}

interface ComparisonData {
  matched_peaks: any[];
  impurity_peaks: any[];
  missing_theoretical: number[];
  match_rate: number;
  summary: {
    total_experimental: number;
    total_theoretical: number;
    matched: number;
    impurities: number;
    missing: number;
  };
}

export interface UseFIDUploadOptions {
  theoreticalPeaks?: number[];
  onProcessingComplete?: (data: FIDData, comparison?: ComparisonData) => void;
  /** Tam API zarfı — observed_spectrum / error_code / debug_id */
  onFidApiResult?: (envelope: FidProcessApiEnvelope) => void;
  solventHint?: string;
}

export type FidProcessingPresetId =
  | '1H_standard'
  | '13C_standard'
  | '1H_mnova_parity'
  | '13C_mnova_parity'
  | 'custom';

export interface FidProcessingSpec {
  preset_id: FidProcessingPresetId;
  nucleus: '1H' | '13C';
  apodization: { window: 'exp'; lb_hz: number };
  zeroFill: { factor: number };
  phase: {
    mode: 'auto_entropy' | 'regions_analysis' | 'manual_ph0_ph1';
    manual: boolean;
    ph0_deg?: number;
    ph1_deg?: number;
  };
  baseline: { algorithm: 'xi_rocke_ps' | 'asls' | 'polynomial' | 'whittaker_smoother' };
  reference: {
    method: 'solvent' | 'manual' | 'tms';
    target_ppm: number;
    standard: string;
    confidence: 'high' | 'medium' | 'low';
    solvent?: string;
  };
}

function generateDatasetId() {
  return `fid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function userMessageFromEnvelope(env: FidProcessApiEnvelope): string {
  const parts = [env.error_message, env.user_hint, env.error_code].filter(Boolean);
  return parts.join(' — ') || 'FID işleme başarısız';
}

function normalizeSolventForProcessing(solventHint?: string): string {
  const s = String(solventHint || '').trim();
  if (!s) return 'CDCl3';
  const map: Record<string, string> = {
    DMSO: 'DMSO-d6',
    'DMSO-D6': 'DMSO-d6',
    CDCL3: 'CDCl3',
    PYRIDINE: 'Pyridine-d5',
    'PYRIDINE-D5': 'Pyridine-d5',
    'CD3OD': 'MeOD',
    METHANOL: 'MeOD',
    D2O: 'D2O',
    'C6D6': 'C6D6',
  };
  const key = s.toUpperCase();
  return map[key] || s;
}

function buildProcessingSpec(preset: FidProcessingPresetId, solventHint?: string): FidProcessingSpec {
  const refSolvent = normalizeSolventForProcessing(solventHint);
  switch (preset) {
    case '13C_standard':
      return {
        preset_id: '13C_standard',
        nucleus: '13C',
        apodization: { window: 'exp', lb_hz: 0.8 },
        zeroFill: { factor: 2 },
        phase: { mode: 'regions_analysis', manual: false },
        baseline: { algorithm: 'xi_rocke_ps' },
        reference: {
          method: 'solvent',
          target_ppm: 0,
          standard: 'solvent',
          confidence: 'high',
          solvent: refSolvent,
        },
      };
    case '1H_mnova_parity':
      return {
        preset_id: '1H_mnova_parity',
        nucleus: '1H',
        apodization: { window: 'exp', lb_hz: 0.3 },
        zeroFill: { factor: 4 },
        phase: { mode: 'regions_analysis', manual: false },
        baseline: { algorithm: 'xi_rocke_ps' },
        reference: {
          method: 'solvent',
          target_ppm: 0,
          standard: 'solvent',
          confidence: 'high',
          solvent: refSolvent,
        },
      };
    case '13C_mnova_parity':
      return {
        preset_id: '13C_mnova_parity',
        nucleus: '13C',
        apodization: { window: 'exp', lb_hz: 1.0 },
        zeroFill: { factor: 4 },
        phase: { mode: 'regions_analysis', manual: false },
        baseline: { algorithm: 'xi_rocke_ps' },
        reference: {
          method: 'solvent',
          target_ppm: 0,
          standard: 'solvent',
          confidence: 'high',
          solvent: refSolvent,
        },
      };
    case 'custom':
      return {
        preset_id: 'custom',
        nucleus: '1H',
        apodization: { window: 'exp', lb_hz: 0.3 },
        zeroFill: { factor: 2 },
        phase: { mode: 'auto_entropy', manual: false },
        baseline: { algorithm: 'xi_rocke_ps' },
        reference: { method: 'solvent', target_ppm: 0, standard: 'solvent', confidence: 'medium', solvent: refSolvent },
      };
    case '1H_standard':
    default:
      return {
        preset_id: '1H_standard',
        nucleus: '1H',
        apodization: { window: 'exp', lb_hz: 0.3 },
        zeroFill: { factor: 2 },
        phase: { mode: 'auto_entropy', manual: false },
        baseline: { algorithm: 'xi_rocke_ps' },
        reference: { method: 'solvent', target_ppm: 0, standard: 'solvent', confidence: 'high', solvent: refSolvent },
      };
  }
}

export function useFIDUpload(options: UseFIDUploadOptions = {}) {
  const { theoreticalPeaks, onProcessingComplete, onFidApiResult, solventHint } = options;

  const [phase, setPhase] = useState<FidPipelinePhase>('idle');
  const [fidData, setFidData] = useState<FIDData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEnvelope, setLastEnvelope] = useState<FidProcessApiEnvelope | null>(null);
  const [processingPreset, setProcessingPreset] = useState<FidProcessingPresetId>('1H_standard');

  const handleFolderUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      setPhase('uploading');
      setError(null);
      setLastEnvelope(null);

      try {
        const files = Array.from(fileList);
        const datasetId = generateDatasetId();

        const formData = new FormData();
        formData.append('datasetId', datasetId);
        files.forEach((file) => {
          formData.append('files', file);
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          formData.append('paths', relPath);
        });

        const uploadResponse = await fetch('/api/fid/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || uploadResult.ok === false) {
          const msg =
            uploadResult.message ||
            uploadResult.error ||
            'Klasör yükleme başarısız';
          throw new Error(msg);
        }

        setPhase('processing');
        await new Promise((r) => setTimeout(r, 200));

        const processFormData = new FormData();
        processFormData.append('datasetId', datasetId);
        processFormData.append('format', 'auto');

        // Include ALL files + paths for production (Vercel serverless isolation)
        const relativePaths: string[] = [];
        files.forEach((file) => {
          processFormData.append('files', file);
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          relativePaths.push(relPath);
          processFormData.append('paths', relPath);
        });
        if (relativePaths.length > 0) {
          processFormData.append('relativePaths', JSON.stringify(relativePaths));
        }

        if (theoreticalPeaks && theoreticalPeaks.length > 0) {
          processFormData.append('theoreticalPeaks', JSON.stringify(theoreticalPeaks));
        }
        processFormData.append(
          'processingSpec',
          JSON.stringify(buildProcessingSpec(processingPreset, solventHint))
        );

        let processResponse: Response | null = null;
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          processResponse = await fetch('/api/fid/process', {
            method: 'POST',
            body: processFormData,
          });
          const peek = await processResponse.clone().json();
          if (processResponse.ok || !String(peek.error_message || peek.error || '').toLowerCase().includes('not found')) {
            break;
          }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }

        if (!processResponse) {
          throw new Error('FID işleme isteği gönderilemedi');
        }

        setPhase('validating');
        const result = (await processResponse.json()) as FidProcessApiEnvelope;
        setLastEnvelope(result);
        onFidApiResult?.(result);

        if (!result.success) {
          throw new Error(userMessageFromEnvelope(result));
        }

        if (!result.data?.ppm?.length || !result.data?.intensity?.length) {
          throw new Error(
            userMessageFromEnvelope({
              ...result,
              success: false,
              error_message: 'Spektrum verisi boş (sessiz başarı engellendi).',
              error_code: 'FID_EMPTY_SPECTRUM',
            })
          );
        }

        setFidData(result.data);
        if (result.comparison) {
          setComparison(result.comparison as ComparisonData);
        }
        onProcessingComplete?.(result.data, result.comparison as ComparisonData | undefined);
        setPhase('done');
      } catch (err: any) {
        setError(err.message || 'Klasör işleme hatası');
        setPhase('error');
        setFidData(null);
      }
    },
    [theoreticalPeaks, onProcessingComplete, onFidApiResult, processingPreset, solventHint]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      setPhase('processing');
      setError(null);
      setLastEnvelope(null);

      try {
        const formData = new FormData();
        formData.append('fid', file);
        formData.append('format', 'auto');

        if (theoreticalPeaks && theoreticalPeaks.length > 0) {
          formData.append('theoreticalPeaks', JSON.stringify(theoreticalPeaks));
        }
        formData.append(
          'processingSpec',
          JSON.stringify(buildProcessingSpec(processingPreset, solventHint))
        );

        const response = await fetch('/api/fid/process', {
          method: 'POST',
          body: formData,
        });

        const result = (await response.json()) as FidProcessApiEnvelope;
        setLastEnvelope(result);
        onFidApiResult?.(result);

        if (!result.success) {
          throw new Error(userMessageFromEnvelope(result));
        }

        if (!result.data?.ppm?.length || !result.data?.intensity?.length) {
          throw new Error('Spektrum verisi boş.');
        }

        setFidData(result.data);

        if (result.comparison) {
          setComparison(result.comparison as ComparisonData);
        }

        onProcessingComplete?.(result.data, result.comparison as ComparisonData | undefined);
        setPhase('done');
      } catch (err: any) {
        setError(err.message);
        setPhase('error');
        setFidData(null);
      }
    },
    [theoreticalPeaks, onProcessingComplete, onFidApiResult, processingPreset, solventHint]
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setFidData(null);
    setComparison(null);
    setLastEnvelope(null);
  }, []);

  return {
    phase,
    isProcessing: phase === 'uploading' || phase === 'processing' || phase === 'validating',
    fidData,
    comparison,
    error,
    lastEnvelope,
    processingPreset,
    setProcessingPreset,
    currentProcessingSpec: buildProcessingSpec(processingPreset, solventHint),
    handleFileUpload,
    handleFolderUpload,
    reset,
  };
}

/**
 * Bruker ACQUS file parser
 * Parses Bruker acquisition parameter files
 */

export interface BrukerMetadata {
  sw_hz?: number;
  sw_ppm?: number;
  sfo1_mhz?: number;
  o1_hz?: number;
  o1p_ppm?: number;
  bf1_mhz?: number;
  offset_hz?: number;
  ref_ppm?: number;
  npoints?: number;
  raw: Record<string, any>;
}

/**
 * Parse Bruker ACQUS file content
 * Handles various formats and scientific notation
 */
export function parseAcqus(content: string): BrukerMetadata {
  const result: BrukerMetadata = {
    raw: {}
  };

  const lines = content.split('\n');
  
  for (const line of lines) {
    // Bruker format: ##$KEY= value
    const match = line.match(/^##\$([^=]+)=(.*)$/);
    if (!match) continue;
    
    const key = match[1].trim();
    const value = match[2].trim();
    
    // Store raw value
    result.raw[key] = value;
    
    // Parse known parameters
    try {
      switch (key) {
        case 'SW_h':
        case 'SW':
          // Spectral width in Hz
          result.sw_hz = parseScientific(value);
          break;
          
        case 'SW_p':
          // Spectral width in ppm
          result.sw_ppm = parseScientific(value);
          break;
          
        case 'SFO1':
          // Spectrometer frequency (MHz)
          result.sfo1_mhz = parseScientific(value);
          break;
          
        case 'O1':
          // Offset in Hz
          result.o1_hz = parseScientific(value);
          break;
          
        case 'O1p':
          // Offset in ppm
          result.o1p_ppm = parseScientific(value);
          break;
          
        case 'BF1':
          // Base frequency (MHz)
          result.bf1_mhz = parseScientific(value);
          break;
          
        case 'OFFSET':
          // Alternative offset parameter
          if (!result.o1_hz) {
            result.offset_hz = parseScientific(value);
          }
          break;
          
        case 'TD':
          // Total data points
          result.npoints = parseInt(value, 10);
          break;
      }
    } catch (e) {
      // Ignore parse errors for individual fields
      console.warn(`Failed to parse ${key}: ${value}`, e);
    }
  }
  
  // Calculate derived values
  if (result.sw_hz && result.sfo1_mhz && !result.sw_ppm) {
    result.sw_ppm = result.sw_hz / result.sfo1_mhz;
  }
  
  if (result.sw_ppm && result.sfo1_mhz && !result.sw_hz) {
    result.sw_hz = result.sw_ppm * result.sfo1_mhz;
  }
  
  if (result.o1p_ppm && result.sfo1_mhz && !result.o1_hz) {
    result.o1_hz = result.o1p_ppm * result.sfo1_mhz;
  }
  
  // Default reference ppm (TMS = 0)
  result.ref_ppm = 0;
  
  return result;
}

/**
 * Parse scientific notation and regular numbers
 */
function parseScientific(str: string): number {
  // Remove whitespace
  str = str.trim();
  
  // Handle scientific notation: 1.23e+4, 1.23E-2, etc.
  if (/[eE]/.test(str)) {
    return parseFloat(str);
  }
  
  // Regular number
  const num = parseFloat(str);
  if (isNaN(num)) {
    throw new Error(`Invalid number: ${str}`);
  }
  
  return num;
}

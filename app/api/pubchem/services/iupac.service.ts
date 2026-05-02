/**
 * IUPAC Name Variation Service
 *
 * Generates variations of IUPAC chemical names to handle:
 * - Turkish characters → English
 * - Greek letters → Latin (α → alpha)
 * - Different formatting (parentheses, hyphens, spaces)
 * - Simplified names
 */

export class IUPACService {
  /**
   * Generate all possible variations of an IUPAC name
   */
  static generateVariations(name: string): string[] {
    const variations: string[] = [];
    const normalized = name.trim();

    variations.push(normalized);

    // Step 1: Turkish → English characters
    let englishVersion = this.convertTurkishChars(normalized);
    if (englishVersion !== normalized) {
      variations.push(englishVersion);
    }

    // Step 2: Greek letters → Latin
    let alphanumericVersion = this.convertGreekLetters(englishVersion);
    if (alphanumericVersion !== englishVersion) {
      variations.push(alphanumericVersion);
    }

    // Step 3-5: Format variations
    this.addFormatVariations(alphanumericVersion, variations);

    // Step 6: Simplified names
    this.addSimplifiedNames(alphanumericVersion, variations);

    // Step 7: Remove common prefixes
    this.addWithoutPrefixes(alphanumericVersion, variations);

    // Step 8-9: Case variations
    this.addCaseVariations(alphanumericVersion, variations);

    // Return unique variations, filter too short ones
    return Array.from(new Set(variations)).filter(v => v.length > 2);
  }

  /**
   * Convert Turkish characters to English
   */
  private static convertTurkishChars(text: string): string {
    const map: Record<string, string> = {
      'ş': 's', 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u',
      'Ş': 'S', 'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ü': 'U'
    };

    let result = text;
    for (const [tr, en] of Object.entries(map)) {
      result = result.replace(new RegExp(tr, 'g'), en);
    }
    return result;
  }

  /**
   * Convert Greek letters to Latin equivalents
   */
  private static convertGreekLetters(text: string): string {
    const map: Record<string, string> = {
      'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta',
      'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta',
      'Α': 'alpha', 'Β': 'beta', 'Γ': 'gamma', 'Δ': 'delta'
    };

    let result = text;
    for (const [greek, latin] of Object.entries(map)) {
      result = result.replace(new RegExp(greek, 'g'), latin);
    }
    return result;
  }

  /**
   * Add formatting variations (parentheses, hyphens, spaces)
   */
  private static addFormatVariations(text: string, variations: string[]): void {
    // Remove parentheses
    const withoutParens = text.replace(/\(([^)]+)\)/g, '$1');
    if (withoutParens !== text) variations.push(withoutParens);

    // Hyphens → spaces
    const withSpaces = text.replace(/-/g, ' ');
    if (withSpaces !== text) variations.push(withSpaces);

    // Remove hyphens
    const withoutDashes = text.replace(/-/g, '');
    if (withoutDashes !== text) variations.push(withoutDashes);

    // Spaces → hyphens
    const spacesToHyphens = text.replace(/\s+/g, '-');
    if (spacesToHyphens !== text) variations.push(spacesToHyphens);

    // Remove ALL spaces
    const noSpaces = text.replace(/\s+/g, '');
    if (noSpaces !== text && !variations.includes(noSpaces)) {
      variations.push(noSpaces);
    }

    // Remove spaces AND hyphens
    const noSpacesOrDashes = text.replace(/[\s-]+/g, '');
    if (noSpacesOrDashes !== text && !variations.includes(noSpacesOrDashes)) {
      variations.push(noSpacesOrDashes);
    }
  }

  /**
   * Add simplified name variations (last word, last 2/3 words)
   */
  private static addSimplifiedNames(text: string, variations: string[]): void {
    const parts = text.split(/[-\s]+/);

    // Last word
    const lastPart = parts[parts.length - 1];
    if (lastPart.length > 5 && !variations.includes(lastPart)) {
      variations.push(lastPart);
    }

    // Last 2 words
    if (parts.length >= 2) {
      const lastTwo = parts[parts.length - 2] + parts[parts.length - 1];
      if (lastTwo.length > 8 && !variations.includes(lastTwo)) {
        variations.push(lastTwo);
      }
    }

    // Last 3 words
    if (parts.length >= 3) {
      const lastThree = parts[parts.length - 3] + parts[parts.length - 2] + parts[parts.length - 1];
      if (lastThree.length > 10 && !variations.includes(lastThree)) {
        variations.push(lastThree);
      }
    }
  }

  /**
   * Add variations without common IUPAC prefixes
   */
  private static addWithoutPrefixes(text: string, variations: string[]): void {
    const prefixes = [
      /^\d+,\d+-O-/, /^\d+,\d+-/, /^alpha-/i, /^beta-/i,
      /^gamma-/i, /^L-/, /^D-/, /^cis-/, /^trans-/,
      /^\(E\)-/, /^\(Z\)-/
    ];

    for (const prefix of prefixes) {
      const simplified = text.replace(prefix, '');
      if (simplified !== text && simplified.length > 3) {
        variations.push(simplified);
      }
    }
  }

  /**
   * Add case variations
   */
  private static addCaseVariations(text: string, variations: string[]): void {
    // Lowercase
    const lowercase = text.toLowerCase();
    if (!variations.includes(lowercase)) {
      variations.push(lowercase);
    }

    // Capitalized
    const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    if (!variations.includes(capitalized)) {
      variations.push(capitalized);
    }
  }
}

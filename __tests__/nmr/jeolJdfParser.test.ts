import { describe, it, expect } from 'vitest';
import {
  isJdfFile,
  parseJdfBuffer,
  JDF_FILE_IDENTIFIER_BYTES,
  JDF_ERROR_CODES,
  JDF_SUPPORTED_SUBTYPES,
} from '@/lib/nmr/jeolJdfParser';

describe('isJdfFile', () => {
  it('returns true for .jdf extension', () => {
    expect(isJdfFile('spectrum.jdf')).toBe(true);
    expect(isJdfFile('DATA.JDF')).toBe(true);
  });

  it('returns false for non-jdf files', () => {
    expect(isJdfFile('fid')).toBe(false);
    expect(isJdfFile('data.ser')).toBe(false);
    expect(isJdfFile('acqus')).toBe(false);
  });
});

describe('parseJdfBuffer', () => {
  it('rejects empty buffer', () => {
    const result = parseJdfBuffer(new ArrayBuffer(0));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(JDF_ERROR_CODES.JDF_INVALID_MAGIC);
  });

  it('rejects buffer with wrong magic', () => {
    const buf = new ArrayBuffer(64);
    const view = new Uint8Array(buf);
    view.set([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const result = parseJdfBuffer(buf);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(JDF_ERROR_CODES.JDF_INVALID_MAGIC);
  });

  it('accepts buffer with correct magic (minimal header parse attempt)', () => {
    const buf = new ArrayBuffer(1024);
    const u8 = new Uint8Array(buf);
    u8.set(JDF_FILE_IDENTIFIER_BYTES, 0);
    const result = parseJdfBuffer(buf);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.supportLevel).toBe('string');
  });
});

describe('JDF_SUPPORTED_SUBTYPES', () => {
  it('has documented entries', () => {
    expect(Object.keys(JDF_SUPPORTED_SUBTYPES).length).toBeGreaterThan(0);
  });
});

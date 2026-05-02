/**
 * API Keys and Settings Storage with AES Encryption
 */

import CryptoJS from 'crypto-js';

export const DEFAULT_GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
export const DEFAULT_OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

// Şifreleme anahtarı cache (lazy initialization)
let ENCRYPTION_KEY: string | null = null;

export interface AppSettings {
  geminiApiKey: string;
  openaiApiKey: string;
  aiProvider: 'gemini' | 'chatgpt';
  aiModel: string;
}

/**
 * Browser için benzersiz bir şifreleme anahtarı oluştur veya yükle (Lazy)
 */
function getEncryptionKey(): string {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  if (typeof window === 'undefined') {
    ENCRYPTION_KEY = 'spectromind-default-key';
    return ENCRYPTION_KEY;
  }

  let key = localStorage.getItem('_ek');
  if (!key) {
    // Browser fingerprint benzeri basit bir anahtar üret
    key = CryptoJS.lib.WordArray.random(32).toString();
    localStorage.setItem('_ek', key);
  }

  ENCRYPTION_KEY = key;
  return ENCRYPTION_KEY;
}

/**
 * Veriyi şifrele
 */
function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, getEncryptionKey()).toString();
}

/**
 * Veriyi çöz
 */
function decrypt(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

/**
 * Şifreli veri oku
 */
function getEncrypted(key: string, defaultValue: string = ''): string {
  if (typeof window === 'undefined') return defaultValue;

  const encrypted = localStorage.getItem(key);
  if (!encrypted) return defaultValue;

  // Eğer eski plain text varsa, şifrele ve kaydet
  if (!encrypted.startsWith('U2FsdGVkX1')) {
    setEncrypted(key, encrypted);
    return encrypted;
  }

  const decrypted = decrypt(encrypted);
  return decrypted || defaultValue;
}

/**
 * Şifreli veri yaz
 */
function setEncrypted(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, encrypt(value));
}

/**
 * Load settings from localStorage (encrypted)
 */
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return {
      geminiApiKey: DEFAULT_GEMINI_KEY,
      openaiApiKey: DEFAULT_OPENAI_KEY,
      aiProvider: 'chatgpt',
      aiModel: 'deepseek-v4-pro'
    };
  }

  return {
    geminiApiKey: getEncrypted('geminiApiKey', DEFAULT_GEMINI_KEY),
    openaiApiKey: getEncrypted('openaiApiKey', DEFAULT_OPENAI_KEY),
    aiProvider: (getEncrypted('aiProvider', 'chatgpt')) as 'gemini' | 'chatgpt',
    aiModel: getEncrypted('aiModel', 'deepseek-v4-pro')
  };
}

/**
 * Save settings to localStorage (encrypted)
 * Not: API key'ler kullanıcı tarafından değiştirilemez, default değerler kullanılır
 */
export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === 'undefined') return;

  // API key'leri kaydetme - sadece provider ve model değişebilir
  if (settings.aiProvider) setEncrypted('aiProvider', settings.aiProvider);
  if (settings.aiModel) setEncrypted('aiModel', settings.aiModel);
}

/**
 * Reset to default settings
 */
export function resetToDefaults(): AppSettings {
  if (typeof window === 'undefined') {
    return loadSettings();
  }

  localStorage.clear();
  const defaults: AppSettings = {
    geminiApiKey: DEFAULT_GEMINI_KEY,
    openaiApiKey: DEFAULT_OPENAI_KEY,
    aiProvider: 'chatgpt',
    aiModel: 'deepseek-v4-pro'
  };

  saveSettings(defaults);
  return defaults;
}

/**
 * Initialize default settings if not present
 */
export function initializeDefaults(): void {
  if (typeof window === 'undefined') return;

  // Eski localStorage kalıntılarını temizle
  cleanupOldStorage();

  if (!localStorage.getItem('geminiApiKey')) {
    setEncrypted('geminiApiKey', DEFAULT_GEMINI_KEY);
  }
  if (!localStorage.getItem('openaiApiKey')) {
    setEncrypted('openaiApiKey', DEFAULT_OPENAI_KEY);
  }
  if (!localStorage.getItem('aiProvider')) {
    setEncrypted('aiProvider', 'chatgpt');
  }
  if (!localStorage.getItem('aiModel')) {
    setEncrypted('aiModel', 'deepseek-v4-pro');
  }
}

/**
 * Eski localStorage kalıntılarını temizle
 */
function cleanupOldStorage(): void {
  if (typeof window === 'undefined') return;

  // Eski kullanılmayan anahtarları sil
  const obsoleteKeys = [
    'spectromind_enhanced_library', // Artık /data/ klasöründe (server-side only) JSON olarak saklanıyor
  ];

  obsoleteKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  });

  // Şifresiz API anahtarlarını kontrol et ve şifrele
  const settingsKeys = ['geminiApiKey', 'openaiApiKey', 'aiProvider', 'aiModel'];
  settingsKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && !value.startsWith('U2FsdGVkX1')) {
      setEncrypted(key, value);
    }
  });
}

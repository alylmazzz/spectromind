"""
SpectroMind v2.0 - Tarayıcı Tabanlı FID İşleme Modülü
Pyodide uyumlu, Bruker FID format desteği
"""

import numpy as np
import io
import struct
import json

class BrowserNMRProcessor:
    """
    Tarayıcı tabanlı NMR İşleme Motoru.
    Pyodide üzerinde çalışmak üzere optimize edilmiştir.
    """
    
    def __init__(self):
        self.data = None      # Zaman düzlemi verisi (Complex)
        self.spectrum = None  # Frekans düzlemi verisi (Complex)
        self.params = {}      # Parametreler (sw, car, etc.)
    
    def load_bruker_fid(self, fid_bytes, acqus_content):
        """
        Bruker FID dosyasını (Binary) ve acqus (Text) dosyasını parse eder.
        
        Args:
            fid_bytes: Binary FID verisi (Uint8Array from JS)
            acqus_content: ACQUS dosyası içeriği (string)
        """
        # 1. ACQUS Parametrelerini Parse Et
        self.params = self._parse_acqus(acqus_content)
        
        # 2. Binary FID Verisini Oku (Big Endian, 32-bit Integer)
        # Bruker verileri genellikle interlaced (Real, Imag, Real, Imag...) gelir.
        raw_data = np.frombuffer(fid_bytes, dtype='>i4')
        
        # Complex sayıya çevir (Real + i*Imag)
        real_part = raw_data[0::2]
        imag_part = raw_data[1::2]
        self.data = real_part + 1j * imag_part
        
        return {"status": "Loaded", "points": len(self.data)}
    
    def _parse_acqus(self, content):
        """
        acqus dosyasından SW (Spectral Width) ve SFO1 (Frekans) çeker.
        """
        params = {
            'SW_h': 10000.0,  # Spectral width (Hz)
            'SFO1': 400.0,    # Frequency (MHz)
            'TD': 32768,      # Number of data points
            'O1': 0.0,        # Offset (Hz)
            'BYTORDA': 1      # Byte order (1 = big endian)
        }
        
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('##$SW_h='):
                params['SW_h'] = float(line.split('=')[1].strip())
            elif line.startswith('##$SFO1='):
                params['SFO1'] = float(line.split('=')[1].strip())
            elif line.startswith('##$TD='):
                params['TD'] = int(line.split('=')[1].strip())
            elif line.startswith('##$O1='):
                params['O1'] = float(line.split('=')[1].strip())
            elif line.startswith('##$BYTORDA='):
                params['BYTORDA'] = int(line.split('=')[1].strip())
        
        return params
    
    def process(self, lb=0.3, zf_factor=2, p0=0.0, p1=0.0):
        """
        DSP Zinciri: Windowing -> ZF -> FFT -> Phase -> Baseline
        
        Args:
            lb (float): Line Broadening (Hz)
            zf_factor (int): Zero Filling kat sayısı (2 = 2 katına çıkar)
            p0 (float): Zero order phase (Derece)
            p1 (float): First order phase (Derece)
            
        Returns:
            dict: {"x": ppm_axis, "y": intensity, "meta": {...}}
        """
        if self.data is None:
            return {"error": "Data not loaded"}
        
        # 1. Apodization (Exponential Multiplication)
        # Formül: S(t) * exp(-LB * t * pi)
        # Zaman eksenini oluştur (saniye cinsinden)
        dwell_time = 1.0 / (2 * self.params['SW_h'])  # Nyquist
        t = np.arange(len(self.data)) * dwell_time
        window = np.exp(-lb * np.pi * t)
        apodized_data = self.data * window
        
        # 2. Zero Filling (Çözünürlük Artırma)
        original_len = len(apodized_data)
        target_len = original_len * zf_factor
        # 2'nin kuvvetine tamamla (FFT hızı için)
        next_pow2 = int(2**np.ceil(np.log2(target_len)))
        padded_data = np.zeros(next_pow2, dtype=complex)
        padded_data[:original_len] = apodized_data
        
        # 3. Fast Fourier Transform (FFT)
        # Bruker verisi için genellikle ilk nokta 0.5 ile çarpılır (Digital Shift)
        padded_data[0] *= 0.5
        spectrum = np.fft.fft(padded_data)
        spectrum = np.fft.fftshift(spectrum)  # Sıfır frekansı merkeze al
        
        # 4. Phase Correction (Faz Düzeltme)
        # Formül: S * exp(i * (p0 + p1 * normalized_freq))
        p0_rad = np.deg2rad(p0)
        p1_rad = np.deg2rad(p1)
        
        # Frekans ekseni (-0.5 ile 0.5 arası)
        points = len(spectrum)
        freq_scale = np.linspace(-0.5, 0.5, points)
        
        phase_correction = np.exp(1j * (p0_rad + p1_rad * freq_scale))
        self.spectrum = spectrum * phase_correction
        
        # 5. PPM Skalasını Oluştur
        sw_ppm = self.params['SW_h'] / self.params['SFO1']
        ppm_axis = np.linspace(sw_ppm/2, -sw_ppm/2, points)
        # Kalibrasyon (TMS genelde 0'dadır, basit shift gerekebilir)
        # Burada varsayılan bir offset kullanıyoruz, gerçekte referans piki bulunur.
        center_ppm = 4.7  # Su piki veya TMS offset
        ppm_axis += (center_ppm - 0)
        
        # 6. Real Kısmı Al
        intensity = self.spectrum.real
        
        # Veri boyutunu azalt (Downsampling for Chart.js performance)
        # 64k noktayı 4k noktaya indir (LTTB veya basit decimation)
        factor = max(1, points // 4000)
        
        return {
            "x": ppm_axis[::factor].tolist(),
            "y": intensity[::factor].tolist(),
            "meta": {
                "sw": self.params['SW_h'],
                "freq": self.params['SFO1'],
                "points": points,
                "original_points": original_len
            }
        }


# --- PYODIDE ÇAĞRI ÖRNEĞİ (JAVASCRIPT TARAFINDAN ÇAĞRILIR) ---
# Global instance
processor = BrowserNMRProcessor()

def run_processing(fid_bytes, acqus_str, lb, p0, p1):
    """
    JavaScript'ten gelen veriyi işleyen köprü fonksiyon.
    
    Args:
        fid_bytes: Uint8Array (JS) -> bytes (Python)
        acqus_str: ACQUS dosyası içeriği (string)
        lb: Line broadening (Hz)
        p0: Zero order phase (degrees)
        p1: First order phase (degrees)
        
    Returns:
        JSON string with processed spectrum
    """
    try:
        # Veriyi yükle
        processor.load_bruker_fid(fid_bytes, acqus_str)
        
        # İşle ve JSON dön
        result = processor.process(lb=lb, p0=p0, p1=p1)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})


"""
DFT Verification Service - SpectroMind v2.0
Provides quantum mechanical verification of NMR shifts
using ASE + xTB (semi-empirical QM) with GIAO NMR calculation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import time

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from xtb_nmr_engine import XTB_NMR_Engine

app = Flask(__name__)
CORS(app)

# Global engine instance
engine = XTB_NMR_Engine(xtb_path="xtb")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'dft-verification',
        'version': '2.0.0'
    })

@app.route('/verify', methods=['POST'])
def verify():
    """
    DFT verification endpoint
    
    Request body:
    {
        "smiles": "C1(C(=O)O)CC1",
        "method": "xtb",
        "optimizeGeometry": true,
        "useLinearScaling": true
    }
    """
    try:
        data = request.json
        smiles = data.get('smiles')
        method = data.get('method', 'xtb')
        optimize = data.get('optimizeGeometry', True)
        use_linear_scaling = data.get('useLinearScaling', True)
        
        if not smiles:
            return jsonify({'error': 'SMILES required'}), 400
        
        if method != 'xtb':
            return jsonify({
                'success': False,
                'error': f'Method {method} not yet implemented. Only xTB is supported.'
            }), 400
        
        start_time = time.time()
        
        # Generate shifts using advanced engine
        result = engine.predict_shifts(smiles, optimize=optimize, use_linear_scaling=use_linear_scaling)
        
        computation_time = time.time() - start_time
        
        if 'error' in result:
            return jsonify({
                'success': False,
                'error': result['error'],
                'computationTime': computation_time
            }), 400
        
        # Format response
        shifts = []
        for element_type, element_shifts in result['shifts'].items():
            for shift_data in element_shifts:
                shifts.append({
                    'atomIndex': shift_data['atom_idx'],
                    'shift': shift_data['shift_ppm'],
                    'shielding': shift_data['shielding'],
                    'method': result['method'],
                    'element': shift_data['symbol'],
                    'confidence': 0.9 if optimize else 0.7  # Optimize edilmişse daha yüksek güven
                })
        
        return jsonify({
            'success': True,
            'shifts': shifts,
            'method': result['method'],
            'computationTime': round(computation_time, 2),
            'optimized': result['optimized'],
            'linearScaling': result['linear_scaling'],
            'smiles': result['smiles']
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003, debug=False)

"""
MS Prediction Service - SpectroMind v2.0
Provides in-silico fragmentation and MS spectrum prediction
using BDE-based algorithm with diagnostic ion detection
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ms_predictor import MSPredictor

app = Flask(__name__)
CORS(app)

# Global predictor instance
predictor = MSPredictor()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ms-prediction',
        'version': '2.0.0'
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    MS spectrum prediction endpoint
    
    Request body:
    {
        "smiles": "CC(=O)C1=CC=CC=1",
        "ionization": "EI" | "ESI" | "MALDI" | "APCI",
        "energy": 30.0
    }
    """
    try:
        data = request.json
        smiles = data.get('smiles')
        ionization = data.get('ionization', 'EI')
        energy = float(data.get('energy', 30.0))
        
        if not smiles:
            return jsonify({'error': 'SMILES required'}), 400
        
        # Generate spectrum using advanced predictor
        result = predictor.generate_spectrum(smiles, ionization, energy)
        
        if 'error' in result:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
        
        # Format response
        return jsonify({
            'success': True,
            'formula': result['formula'],
            'molecularIon': result['molecular_weight'],
            'peaks': [
                {
                    'mz': peak['m/z'],
                    'intensity': peak['intensity'],
                    'assignment': peak['type'],
                    'type': peak['type']
                }
                for peak in result['peaks']
            ],
            'diagnosticIons': result.get('diagnostic_ions', []),
            'mclaffertyRearrangements': result.get('mclafferty_rearrangements', []),
            'method': result['method'],
            'parameters': result.get('parameters', {})
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)


"""
UltraThink Service - Flask API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'ultrathink-prediction'})

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        smiles = data.get('smiles')
        
        if not smiles:
            return jsonify({'error': 'SMILES required'}), 400
        
        from ultrathink_engine import predict_ultrathink_spectrum
        result = predict_ultrathink_spectrum(smiles)
        
        if not result.get('success'):
            return jsonify({'success': False, 'error': result.get('error', 'Prediction failed')}), 500

        return jsonify({
            'success': True,
            'prediction': result
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8005, debug=False)


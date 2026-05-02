"""
Conformer Analysis Service - SpectroMind v2.0
Provides 3D conformer generation and Boltzmann weighting
using ETKDGv3 algorithm with vicinal proton analysis
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conformer_engine import ConformerEngine

app = Flask(__name__)
CORS(app)

# Global engine instance
engine = ConformerEngine(n_confs=50, rmsd_threshold=0.5)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'conformer-analysis',
        'version': '2.0.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Conformer analysis endpoint
    
    Request body:
    {
        "smiles": "ClCCCl",
        "numConformers": 50,
        "temperature": 298.15
    }
    """
    try:
        data = request.json
        smiles = data.get('smiles')
        num_conformers = data.get('numConformers', 50)
        temperature = data.get('temperature', 298.15)
        
        if not smiles:
            return jsonify({'error': 'SMILES required'}), 400
        
        # Update engine parameters
        engine.n_confs = num_conformers
        engine.temperature = temperature
        
        # Generate ensemble using advanced engine
        result = engine.generate_ensemble(smiles)
        
        if 'error' in result:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
        
        # Format response
        return jsonify({
            'success': True,
            'smiles': result['smiles'],
            'totalConfsGenerated': result['total_confs_generated'],
            'significantConfs': result['significant_confs'],
            'globalMinEnergy': result['global_min_energy'],
            'vicinalCouplings': result.get('vicinal_couplings', []),
            'topConformerMolBlock': result.get('top_conformer_molblock', ''),
            'ensembleSummary': result.get('ensemble_summary', []),
            'conformers': result.get('conformers', []),
            'warning': result.get('warning'),
            'method': 'ETKDGv3 + MMFF94 + Boltzmann Weighting'
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=False)


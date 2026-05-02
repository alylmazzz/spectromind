"""
Vector Search Service - SpectroMind v2.0
Provides vector-based similarity search using RAG
with molecular fingerprints, spectrum binning, and semantic text embedding
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vector_search_engine import VectorSearchEngine

app = Flask(__name__)
CORS(app)

# Global engine instance
engine = VectorSearchEngine()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    stats = engine.get_database_stats()
    return jsonify({
        'status': 'healthy',
        'service': 'vector-search',
        'version': '2.0.0',
        'stats': stats
    })

@app.route('/search', methods=['POST'])
def search():
    """
    Vector search endpoint
    
    Request body:
    {
        "query": {
            "text": "pain treatment",
            "smiles": "CC(=O)Oc1ccccc1",
            "peaks": [[2.3, 3.0], [7.1, 1.0]]
        },
        "weights": {"text": 0.3, "struct": 0.4, "spec": 0.3},
        "topK": 5,
        "threshold": 0.0
    }
    """
    try:
        data = request.json
        query = data.get('query', {})
        weights = data.get('weights', {"text": 0.3, "struct": 0.4, "spec": 0.3})
        top_k = data.get('topK', 5)
        threshold = data.get('threshold', 0.0)
        
        if not query:
            return jsonify({'error': 'Query object is required'}), 400
        
        # Perform hybrid search
        results = engine.search_hybrid(
            query_obj=query,
            weights=weights,
            top_k=top_k,
            threshold=threshold
        )
        
        return jsonify({
            'success': True,
            'results': results,
            'method': 'Hybrid Vector Search',
            'query': query,
            'weights': weights,
            'count': len(results)
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/add', methods=['POST'])
def add():
    """
    Add item to vector database
    
    Request body:
    {
        "doc_id": 1,
        "name": "Aspirin",
        "smiles": "CC(=O)Oc1ccccc1C(=O)O",
        "abstract": "Aspirin is a salicylate...",
        "nmr_peaks": [[2.35, 3.0], [7.1, 1.0]]
    }
    """
    try:
        data = request.json
        doc_id = data.get('doc_id')
        name = data.get('name')
        smiles = data.get('smiles')
        abstract = data.get('abstract', '')
        nmr_peaks = data.get('nmr_peaks', [])
        
        if not all([doc_id, name, smiles]):
            return jsonify({'error': 'doc_id, name, and smiles are required'}), 400
        
        # Convert peaks to tuples
        peaks_tuples = [(p[0], p[1]) for p in nmr_peaks] if nmr_peaks else []
        
        engine.add_item(
            doc_id=doc_id,
            name=name,
            smiles=smiles,
            abstract=abstract,
            nmr_peaks=peaks_tuples
        )
        
        return jsonify({
            'success': True,
            'message': f'Item {name} added successfully'
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/stats', methods=['GET'])
def stats():
    """Get database statistics"""
    return jsonify({
        'success': True,
        'stats': engine.get_database_stats()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8004, debug=False)


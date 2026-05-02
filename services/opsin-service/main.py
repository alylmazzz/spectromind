"""
Local OPSIN Parser Service
Java OPSIN library wrapped in Python microservice
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# OPSIN JAR path
OPSIN_JAR = os.getenv("OPSIN_JAR_PATH", "lib/opsin-2.8.0-jar-with-dependencies.jar")

def parse_iupac_with_opsin(iupac_name: str) -> dict:
    """
    Parse IUPAC name using OPSIN Java library
    
    Returns SMILES or error
    """
    try:
        # Call OPSIN via Java
        result = subprocess.run(
            ["java", "-jar", OPSIN_JAR, iupac_name],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            smiles = result.stdout.strip()
            if smiles and smiles != "null":
                return {
                    "success": True,
                    "smiles": smiles,
                    "method": "OPSIN"
                }
        
        return {
            "success": False,
            "error": result.stderr or "OPSIN parsing failed"
        }
    
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "OPSIN parsing timeout"
        }
    except Exception as e:
        logger.error(f"OPSIN error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "opsin-parser"})

@app.route("/parse", methods=["POST"])
def parse_iupac():
    try:
        data = request.json
        iupac_name = data.get("iupac")
        
        if not iupac_name:
            return jsonify({"success": False, "error": "IUPAC name required"}), 400
        
        # Validate IUPAC format (basic check)
        if not _is_valid_iupac_format(iupac_name):
            return jsonify({
                "success": False,
                "error": "Invalid IUPAC format",
                "suggestion": "Try PubChem lookup first"
            }), 400
        
        result = parse_iupac_with_opsin(iupac_name)
        
        if result["success"]:
            return jsonify(result)
        else:
            return jsonify(result), 400
    
    except Exception as e:
        logger.error(f"Parse error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def _is_valid_iupac_format(name: str) -> bool:
    """
    Basic IUPAC format validation
    """
    import re
    # Simple pattern: should contain numbers, hyphens, and letters
    pattern = r'^[0-9]*-?[a-z]+(-[0-9]*[a-z]+)*$'
    return bool(re.match(pattern, name, re.IGNORECASE))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=False)


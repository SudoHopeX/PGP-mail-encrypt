# api/index.py

from flask import Flask, request, jsonify
from pgpy import PGPKey, PGPMessage, constants
from pgpy.errors import PGPError
import os
import json

app = Flask(__name__)

# Define the absolute path to the public key file within the Vercel environment
PUBLIC_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'sudohopex-email-pub-key.asc')

@app.route('/', defaults={'path': ''}, methods=['POST', 'OPTIONS'])
@app.route('/<path:path>', methods=['POST', 'OPTIONS'])
def encrypt_handler(path):
    # Set CORS Headers (Crucial for Vercel/API usage)
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if request.method == 'OPTIONS':
        return ('', 204, headers)

    try:
        # Load JSON data from request
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Invalid JSON data.'}), 400, headers

        name = data.get('name')
        email = data.get('email')
        message = data.get('message')
        recipient = data.get('recipient')
        subject_line = data.get('subjectLine', '[PGP] Secure Message')

        if not all([name, email, message, recipient]):
            return jsonify({'success': False, 'error': 'Missing required fields.'}), 400, headers

        # 1. Load Public Key
        if not os.path.exists(PUBLIC_KEY_PATH):
            return jsonify({'success': False, 'error': f'Server key file not found at {PUBLIC_KEY_PATH}'}), 500, headers

        pubkey, _ = PGPKey.from_file(PUBLIC_KEY_PATH)

        # 2. Prepare Message
        full_message = f"From: {name} <{email}>\n\n{message}"
        
        # 3. Encrypt Message
        # The PGPMessage constructor automatically handles string encoding
        plain_msg = PGPMessage.new(full_message) 
        
        # Encrypt the message to the public key
        # By default, pgpy returns the ASCII Armored text
        encrypted_msg = pubkey.encrypt(plain_msg)

        # 4. Extract Armored Text (pgpy object converts to string automatically)
        encrypted_armored_string = str(encrypted_msg)
        
        if not encrypted_armored_string or not encrypted_armored_string.startswith('-----BEGIN PGP MESSAGE-----'):
            raise PGPError("Encryption failed: Output is not a valid PGP armored string.")

        # 5. Generate mailto URL (using urllib for safe URL encoding)
        from urllib.parse import quote
        
        subject = quote(subject_line)
        body = quote(encrypted_armored_string)
        mailto_url = f"mailto:{recipient}?subject={subject}&body={body}"

        return jsonify({'success': True, 'mailtoUrl': mailto_url}), 200, headers

    except PGPError as e:
        return jsonify({'success': False, 'error': 'PGP encryption error.', 'details': str(e)}), 500, headers
    except Exception as e:
        return jsonify({'success': False, 'error': 'An unexpected server error occurred.', 'details': str(e)}), 500, headers

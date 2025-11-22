// api/encrypt.js

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as openpgp from 'openpgp';

// Define the path to your public key relative to the serverless function file
const publicKeyFileName = 'sudohopex-email-pub-key.asc';
const publicKeyPath = resolve(publicKeyFileName);

// This function runs on every API call
export default async function handler(req, res) {
    // 1. Set CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    try {
        const { name, email, message, recipient, subjectLine } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields: name, email, or message.' });
        }

        // --- PGP Key Loading & Encryption Logic ---
        
        console.log('--- STARTING ENCRYPTION PROCESS ---');

        // Check if key file exists
        if (!existsSync(publicKeyPath)) {
             throw new Error(`Public key file not found on server at: ${publicKeyPath}`);
        }
        
        // Load Public Key
        const publicKeyArmored = readFileSync(publicKeyPath, 'utf8');
        console.log('Public Key loaded successfully.');
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        // Prepare Message
        const fullMessage = `From: ${name} <${email}>\n\n${message}`;
        const msg = await openpgp.createMessage({ text: fullMessage });
        console.log('Message created.');

        // Encrypt Message
        const encryptedResult = await openpgp.encrypt({
            message: msg,
            encryptionKeys: publicKey,
        });

        // 🔑 The critical output retrieval attempt
        let encrypted = encryptedResult.data;

        // ** DEBUG LOGGING **
        console.log('Encrypted Result Object Keys:', Object.keys(encryptedResult));
        console.log('Type of encryptedResult.data:', typeof encryptedResult.data);
        console.log('Value of encryptedResult.data (first 50 chars):', encrypted ? encrypted.substring(0, 50) : 'undefined');
        // ** END DEBUG LOGGING **


        // Ensure the output is a string
        if (typeof encrypted !== 'string') {
             // If it's not a string, try the write method as a final fallback for non-standard output
             if (encryptedResult.message && typeof encryptedResult.message.write === 'function') {
                 encrypted = await encryptedResult.message.write();
             } else {
                 // Convert anything else to a string for final failure logging
                 encrypted = String(encrypted); 
             }
        }

        // Final Validation check (This is the line that will trigger the error if output is bad)
        if (!encrypted || encrypted.length < 50 || !encrypted.startsWith('-----BEGIN PGP MESSAGE-----')) {
            console.error('FINAL VALIDATION FAILED. Full Encrypted Value:', encrypted);
            throw new Error("Encryption failed: Could not retrieve PGP armored block.");
        }

        // Generate the full mailto URL for the client
        const subject = encodeURIComponent(subjectLine || "[PGP] Secure Message");
        const body = encodeURIComponent(encrypted);
        const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${body}`;

        // Return the mailto URL to the client
        res.status(200).json({ success: true, mailtoUrl });

    } catch (error) {
        console.error('--- FATAL ENCRYPTION API ERROR ---');
        console.error('Error details:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server-side encryption failed.',
            details: error.message 
        });
    }
}

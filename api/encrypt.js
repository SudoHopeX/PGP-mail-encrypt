// api/encrypt.js

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as openpgp from 'openpgp';

// Define the path to your public key relative to the serverless function file
const publicKeyFileName = 'sudohopex-email-pub-key.asc';
const publicKeyPath = resolve(publicKeyFileName);

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
        
        if (!existsSync(publicKeyPath)) {
             throw new Error(`Public key file not found on server at: ${publicKeyPath}`);
        }
        
        const publicKeyArmored = readFileSync(publicKeyPath, 'utf8');
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        const fullMessage = `From: ${name} <${email}>\n\n${message}`;
        const msg = await openpgp.createMessage({ text: fullMessage });

        // 🔑 THE FINAL FIX: Specify armored: true to force string output.
        const encryptedResult = await openpgp.encrypt({
            message: msg,
            encryptionKeys: publicKey,
            // THIS IS THE CRITICAL ADDITION: Forces ASCII armored string output
            armored: true, 
        });

        // The armored string should now reliably be in encryptedResult.data
        let encrypted = encryptedResult.data;

        // Fallback check if it returns a Buffer or the Message object itself
        if (typeof encrypted !== 'string') {
            // Check if the whole object is the armored output (sometimes happens when armored:true is used)
            if (String(encryptedResult).startsWith('-----BEGIN PGP MESSAGE-----')) {
                encrypted = String(encryptedResult);
            } else if (encryptedResult.message && typeof encryptedResult.message.write === 'function') {
                // Last ditch effort: force serialization of the internal message
                encrypted = await encryptedResult.message.write();
            } else {
                 throw new Error("Encryption failed: Output not a string and not serializable.");
            }
        }
        
        // Final Validation check
        if (!encrypted || encrypted.length < 50 || !encrypted.startsWith('-----BEGIN PGP MESSAGE-----')) {
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

// api/encrypt.js

import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as openpgp from 'openpgp';

// Define the path to your public key relative to the serverless function file
const publicKeyPath = resolve('./sudohopex-email-pub-key.asc');

// This function runs on every API call
export default async function handler(req, res) {
    // 1. Set CORS Headers (Crucial for Vercel/API usage)
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins for simplicity
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

        // Basic input validation
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields: name, email, or message.' });
        }

        // --- PGP Encryption Logic ---
        
        // Load Public Key from the server's file system
        const publicKeyArmored = readFileSync(publicKeyPath, 'utf8');
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        // Prepare Message
        const fullMessage = `From: ${name} <${email}>\n\n${message}`;
        const msg = await openpgp.createMessage({ text: fullMessage });

        // Encrypt Message
        const encryptedResult = await openpgp.encrypt({
            message: msg,
            encryptionKeys: publicKey,
        });

        // Use the standard .data property for the armored string
        const encrypted = encryptedResult.data;

        if (!encrypted || typeof encrypted !== 'string' || encrypted.length < 50) {
            throw new Error("Encryption failed: Could not retrieve PGP armored block.");
        }

        // Generate the full mailto URL for the client
        const subject = encodeURIComponent(subjectLine || "[PGP] Secure Message");
        const body = encodeURIComponent(encrypted);
        const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${body}`;

        // 2. Return the mailto URL to the client
        res.status(200).json({ success: true, mailtoUrl });

    } catch (error) {
        console.error('Encryption API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server-side encryption failed.',
            details: error.message 
        });
    }
}

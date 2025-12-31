/**
 * Google Cloud Credentials Helper for Cloud Deployment
 * 
 * This module handles Google Cloud credentials in both local and cloud environments:
 * - Local: Uses GOOGLE_APPLICATION_CREDENTIALS pointing to a file
 * - Cloud (Render/etc): Uses GOOGLE_CREDENTIALS_JSON containing the JSON content
 * 
 * For cloud deployment, set GOOGLE_CREDENTIALS_JSON environment variable with
 * the entire contents of your service account JSON file.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

let credentialsPath = null;

/**
 * Initialize Google credentials for cloud deployment
 * Creates a temporary credentials file from environment variable if needed
 */
export function initializeGoogleCredentials() {
    // If file path is already set and file exists, use it
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS &&
        fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        console.log('[Credentials] Using file-based credentials:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        return credentialsPath;
    }

    // Check for JSON content in environment variable (for cloud deployment)
    const jsonCredentials = process.env.GOOGLE_CREDENTIALS_JSON;

    if (jsonCredentials) {
        try {
            // Validate it's valid JSON
            JSON.parse(jsonCredentials);

            // Create a temporary file to store credentials
            const tempDir = os.tmpdir();
            const credFile = path.join(tempDir, 'google-credentials.json');

            fs.writeFileSync(credFile, jsonCredentials, 'utf8');
            console.log('[Credentials] Created temporary credentials file from GOOGLE_CREDENTIALS_JSON');

            // Set the environment variable to point to the temp file
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
            credentialsPath = credFile;

            return credentialsPath;
        } catch (error) {
            console.error('[Credentials] Failed to parse GOOGLE_CREDENTIALS_JSON:', error.message);
            throw new Error('GOOGLE_CREDENTIALS_JSON environment variable contains invalid JSON');
        }
    }

    console.warn('[Credentials] No Google credentials configured. STT/TTS features will be disabled.');
    console.warn('[Credentials] Set either:');
    console.warn('[Credentials]   - GOOGLE_APPLICATION_CREDENTIALS (path to JSON file) for local development');
    console.warn('[Credentials]   - GOOGLE_CREDENTIALS_JSON (JSON content) for cloud deployment');

    return null;
}

/**
 * Check if Google credentials are available
 */
export function hasGoogleCredentials() {
    return credentialsPath !== null ||
        (process.env.GOOGLE_APPLICATION_CREDENTIALS &&
            fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));
}

/**
 * Get the path to credentials file
 */
export function getCredentialsPath() {
    return credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

// Auto-initialize on module load
initializeGoogleCredentials();

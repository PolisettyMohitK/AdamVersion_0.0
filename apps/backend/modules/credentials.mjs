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
    const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const googleJsonCreds = process.env.GOOGLE_CREDENTIALS_JSON;

    // Helper to check if string is JSON
    const isJson = (str) => {
        if (!str) return false;
        try {
            const parsed = JSON.parse(str);
            return parsed && typeof parsed === 'object' && parsed.type === 'service_account';
        } catch (e) {
            return false;
        }
    };

    // 1. Check if GOOGLE_APPLICATION_CREDENTIALS is already a valid file
    if (googleAppCreds && !isJson(googleAppCreds) && fs.existsSync(googleAppCreds)) {
        console.log('[Credentials] Using file-based credentials:', googleAppCreds);
        credentialsPath = googleAppCreds;
        return credentialsPath;
    }

    // 2. Check if either variable contains the RAW JSON content
    const rawJson = isJson(googleAppCreds) ? googleAppCreds : (isJson(googleJsonCreds) ? googleJsonCreds : null);

    if (rawJson) {
        try {
            // Create a temporary file to store credentials
            const tempDir = os.tmpdir();
            const credFile = path.join(tempDir, `google-creds-${Date.now()}.json`);

            fs.writeFileSync(credFile, rawJson, 'utf8');
            console.log('[Credentials] Created temporary credentials file from raw JSON content');

            // Set the environment variable to point to the temp file
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
            credentialsPath = credFile;

            return credentialsPath;
        } catch (error) {
            console.error('[Credentials] Failed to create temp credentials file:', error.message);
            throw new Error(`Failed to initialize Google credentials: ${error.message}`);
        }
    }

    console.warn('[Credentials] No valid Google credentials found.');
    console.warn('[Credentials] Please set GOOGLE_CREDENTIALS_JSON to your service account JSON content.');

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

/**
 * Credential Vault - Secure credential management system
 * Handles encryption, storage, and retrieval of sensitive credentials
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const keytar = require('keytar'); // System keychain integration

class CredentialVault extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            vaultPath: config.vaultPath || path.join(process.env.HOME || process.env.USERPROFILE, '.n8n-agent-platform', 'vault'),
            encryptionAlgorithm: config.encryptionAlgorithm || 'aes-256-gcm',
            keyDerivationIterations: config.keyDerivationIterations || 100000,
            useSystemKeychain: config.useSystemKeychain !== false,
            serviceName: config.serviceName || 'n8n-agent-platform',
            auditLog: config.auditLog !== false,
            ...config
        };

        this.masterKey = null;
        this.isUnlocked = false;
        this.credentials = new Map();
        this.credentialTypes = new Map();
        this.accessLog = [];
        
        this.initializeCredentialTypes();
    }

    /**
     * Initialize supported credential types
     */
    initializeCredentialTypes() {
        // OAuth2
        this.registerCredentialType('oauth2', {
            fields: ['clientId', 'clientSecret', 'accessToken', 'refreshToken', 'tokenExpiry'],
            required: ['clientId', 'clientSecret'],
            sensitive: ['clientSecret', 'accessToken', 'refreshToken']
        });

        // API Key
        this.registerCredentialType('apiKey', {
            fields: ['apiKey', 'headerName'],
            required: ['apiKey'],
            sensitive: ['apiKey']
        });

        // Basic Auth
        this.registerCredentialType('basicAuth', {
            fields: ['username', 'password'],
            required: ['username', 'password'],
            sensitive: ['password']
        });

        // Database
        this.registerCredentialType('database', {
            fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
            required: ['host', 'database', 'username', 'password'],
            sensitive: ['password']
        });

        // AWS
        this.registerCredentialType('aws', {
            fields: ['accessKeyId', 'secretAccessKey', 'region', 'sessionToken'],
            required: ['accessKeyId', 'secretAccessKey', 'region'],
            sensitive: ['secretAccessKey', 'sessionToken']
        });

        // Google Cloud
        this.registerCredentialType('googleCloud', {
            fields: ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'],
            required: ['type', 'project_id', 'private_key', 'client_email'],
            sensitive: ['private_key']
        });

        // Stripe
        this.registerCredentialType('stripe', {
            fields: ['secretKey', 'publishableKey', 'webhookSecret'],
            required: ['secretKey'],
            sensitive: ['secretKey', 'webhookSecret']
        });

        // SendGrid
        this.registerCredentialType('sendgrid', {
            fields: ['apiKey', 'fromEmail', 'fromName'],
            required: ['apiKey'],
            sensitive: ['apiKey']
        });

        // Slack
        this.registerCredentialType('slack', {
            fields: ['botToken', 'appToken', 'signingSecret', 'webhookUrl'],
            required: ['botToken'],
            sensitive: ['botToken', 'appToken', 'signingSecret']
        });

        // Custom
        this.registerCredentialType('custom', {
            fields: [],
            required: [],
            sensitive: []
        });
    }

    /**
     * Initialize vault
     */
    async initialize(masterPassword) {
        console.log('🔐 Initializing Credential Vault...');
        
        try {
            // Ensure vault directory exists
            await fs.mkdir(this.config.vaultPath, { recursive: true });
            
            // Derive master key from password
            this.masterKey = await this.deriveMasterKey(masterPassword);
            
            // Try to load existing vault
            await this.loadVault();
            
            this.isUnlocked = true;
            this.emit('vault-unlocked');
            
            console.log('✅ Credential Vault initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize vault:', error);
            throw error;
        }
    }

    /**
     * Derive master key from password
     */
    async deriveMasterKey(password) {
        const salt = await this.getOrCreateSalt();
        
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, this.config.keyDerivationIterations, 32, 'sha256', (err, derivedKey) => {
                if (err) reject(err);
                else resolve(derivedKey);
            });
        });
    }

    /**
     * Get or create salt
     */
    async getOrCreateSalt() {
        const saltPath = path.join(this.config.vaultPath, 'salt');
        
        try {
            const salt = await fs.readFile(saltPath);
            return salt;
        } catch (error) {
            // Create new salt
            const salt = crypto.randomBytes(32);
            await fs.writeFile(saltPath, salt);
            return salt;
        }
    }

    /**
     * Load vault from disk
     */
    async loadVault() {
        const vaultFile = path.join(this.config.vaultPath, 'credentials.vault');
        
        try {
            const encryptedData = await fs.readFile(vaultFile);
            const decryptedData = await this.decrypt(encryptedData);
            const vaultData = JSON.parse(decryptedData);
            
            // Load credentials
            for (const [id, credential] of Object.entries(vaultData.credentials || {})) {
                this.credentials.set(id, credential);
            }
            
            console.log(`📋 Loaded ${this.credentials.size} credentials from vault`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📋 No existing vault found, starting fresh');
            } else {
                throw error;
            }
        }
    }

    /**
     * Save vault to disk
     */
    async saveVault() {
        const vaultFile = path.join(this.config.vaultPath, 'credentials.vault');
        
        const vaultData = {
            version: '1.0',
            lastModified: new Date().toISOString(),
            credentials: Object.fromEntries(this.credentials)
        };
        
        const encryptedData = await this.encrypt(JSON.stringify(vaultData));
        await fs.writeFile(vaultFile, encryptedData);
        
        this.emit('vault-saved');
    }

    /**
     * Store credential
     */
    async storeCredential(id, type, data, metadata = {}) {
        if (!this.isUnlocked) {
            throw new Error('Vault is locked');
        }

        console.log(`🔑 Storing credential: ${id} (${type})`);
        
        // Validate credential type
        const credentialType = this.credentialTypes.get(type);
        if (!credentialType && type !== 'custom') {
            throw new Error(`Unknown credential type: ${type}`);
        }

        // Validate required fields
        if (credentialType) {
            for (const field of credentialType.required) {
                if (!data[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
        }

        // Encrypt sensitive fields
        const encryptedData = await this.encryptCredentialData(type, data);
        
        // Store credential
        const credential = {
            id,
            type,
            data: encryptedData,
            metadata: {
                ...metadata,
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                lastAccessed: null,
                accessCount: 0
            }
        };
        
        this.credentials.set(id, credential);
        
        // Save vault
        await this.saveVault();
        
        // Audit log
        this.auditLog('store', id, type);
        
        this.emit('credential-stored', { id, type });
        
        return { id, type, metadata: credential.metadata };
    }

    /**
     * Retrieve credential
     */
    async retrieveCredential(id) {
        if (!this.isUnlocked) {
            throw new Error('Vault is locked');
        }

        const credential = this.credentials.get(id);
        if (!credential) {
            throw new Error(`Credential not found: ${id}`);
        }

        console.log(`🔑 Retrieving credential: ${id}`);
        
        // Decrypt sensitive data
        const decryptedData = await this.decryptCredentialData(credential.type, credential.data);
        
        // Update access metadata
        credential.metadata.lastAccessed = new Date().toISOString();
        credential.metadata.accessCount++;
        
        // Save updated metadata
        await this.saveVault();
        
        // Audit log
        this.auditLog('retrieve', id, credential.type);
        
        return {
            id,
            type: credential.type,
            data: decryptedData,
            metadata: credential.metadata
        };
    }

    /**
     * Update credential
     */
    async updateCredential(id, updates) {
        if (!this.isUnlocked) {
            throw new Error('Vault is locked');
        }

        const credential = this.credentials.get(id);
        if (!credential) {
            throw new Error(`Credential not found: ${id}`);
        }

        console.log(`🔑 Updating credential: ${id}`);
        
        // Decrypt existing data
        const currentData = await this.decryptCredentialData(credential.type, credential.data);
        
        // Merge updates
        const updatedData = { ...currentData, ...updates };
        
        // Re-encrypt
        const encryptedData = await this.encryptCredentialData(credential.type, updatedData);
        
        // Update credential
        credential.data = encryptedData;
        credential.metadata.lastModified = new Date().toISOString();
        
        // Save vault
        await this.saveVault();
        
        // Audit log
        this.auditLog('update', id, credential.type);
        
        this.emit('credential-updated', { id, type: credential.type });
        
        return { id, type: credential.type, metadata: credential.metadata };
    }

    /**
     * Delete credential
     */
    async deleteCredential(id) {
        if (!this.isUnlocked) {
            throw new Error('Vault is locked');
        }

        const credential = this.credentials.get(id);
        if (!credential) {
            throw new Error(`Credential not found: ${id}`);
        }

        console.log(`🔑 Deleting credential: ${id}`);
        
        this.credentials.delete(id);
        
        // Save vault
        await this.saveVault();
        
        // Audit log
        this.auditLog('delete', id, credential.type);
        
        this.emit('credential-deleted', { id, type: credential.type });
        
        return true;
    }

    /**
     * List credentials
     */
    listCredentials(filter = {}) {
        const credentials = [];
        
        for (const [id, credential] of this.credentials.entries()) {
            // Apply filters
            if (filter.type && credential.type !== filter.type) continue;
            if (filter.metadata) {
                let match = true;
                for (const [key, value] of Object.entries(filter.metadata)) {
                    if (credential.metadata[key] !== value) {
                        match = false;
                        break;
                    }
                }
                if (!match) continue;
            }
            
            credentials.push({
                id,
                type: credential.type,
                metadata: credential.metadata
            });
        }
        
        return credentials;
    }

    /**
     * Search credentials
     */
    searchCredentials(query) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (const [id, credential] of this.credentials.entries()) {
            if (id.toLowerCase().includes(queryLower) ||
                credential.type.toLowerCase().includes(queryLower) ||
                JSON.stringify(credential.metadata).toLowerCase().includes(queryLower)) {
                
                results.push({
                    id,
                    type: credential.type,
                    metadata: credential.metadata
                });
            }
        }
        
        return results;
    }

    /**
     * Encrypt credential data
     */
    async encryptCredentialData(type, data) {
        const credentialType = this.credentialTypes.get(type);
        const encryptedData = { ...data };
        
        if (credentialType) {
            // Encrypt only sensitive fields
            for (const field of credentialType.sensitive) {
                if (data[field]) {
                    encryptedData[field] = await this.encryptField(data[field]);
                }
            }
        } else {
            // For custom type, encrypt all string values
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string') {
                    encryptedData[key] = await this.encryptField(value);
                }
            }
        }
        
        return encryptedData;
    }

    /**
     * Decrypt credential data
     */
    async decryptCredentialData(type, encryptedData) {
        const credentialType = this.credentialTypes.get(type);
        const decryptedData = { ...encryptedData };
        
        if (credentialType) {
            // Decrypt only sensitive fields
            for (const field of credentialType.sensitive) {
                if (encryptedData[field]) {
                    decryptedData[field] = await this.decryptField(encryptedData[field]);
                }
            }
        } else {
            // For custom type, decrypt all encrypted values
            for (const [key, value] of Object.entries(encryptedData)) {
                if (typeof value === 'object' && value.encrypted) {
                    decryptedData[key] = await this.decryptField(value);
                }
            }
        }
        
        return decryptedData;
    }

    /**
     * Encrypt field
     */
    async encryptField(value) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.config.encryptionAlgorithm, this.masterKey, iv);
        
        let encrypted = cipher.update(value, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: true,
            algorithm: this.config.encryptionAlgorithm,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            data: encrypted
        };
    }

    /**
     * Decrypt field
     */
    async decryptField(encryptedField) {
        const iv = Buffer.from(encryptedField.iv, 'base64');
        const authTag = Buffer.from(encryptedField.authTag, 'base64');
        
        const decipher = crypto.createDecipheriv(
            encryptedField.algorithm || this.config.encryptionAlgorithm,
            this.masterKey,
            iv
        );
        
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedField.data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Encrypt data
     */
    async encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.config.encryptionAlgorithm, this.masterKey, iv);
        
        let encrypted = cipher.update(data, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const authTag = cipher.getAuthTag();
        
        // Combine IV + authTag + encrypted data
        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypt data
     */
    async decrypt(encryptedData) {
        // Extract IV, authTag, and encrypted data
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);
        
        const decipher = crypto.createDecipheriv(this.config.encryptionAlgorithm, this.masterKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    }

    /**
     * Register credential type
     */
    registerCredentialType(type, schema) {
        this.credentialTypes.set(type, schema);
        console.log(`📝 Registered credential type: ${type}`);
    }

    /**
     * Store in system keychain (for master password)
     */
    async storeInKeychain(account, password) {
        if (!this.config.useSystemKeychain) return;
        
        try {
            await keytar.setPassword(this.config.serviceName, account, password);
            console.log('🔐 Stored in system keychain');
        } catch (error) {
            console.error('Failed to store in keychain:', error);
        }
    }

    /**
     * Retrieve from system keychain
     */
    async retrieveFromKeychain(account) {
        if (!this.config.useSystemKeychain) return null;
        
        try {
            const password = await keytar.getPassword(this.config.serviceName, account);
            return password;
        } catch (error) {
            console.error('Failed to retrieve from keychain:', error);
            return null;
        }
    }

    /**
     * Rotate encryption keys
     */
    async rotateKeys(newMasterPassword) {
        console.log('🔄 Rotating encryption keys...');
        
        // Create backup
        await this.createBackup();
        
        // Decrypt all credentials with old key
        const decryptedCredentials = new Map();
        for (const [id, credential] of this.credentials.entries()) {
            const decryptedData = await this.decryptCredentialData(credential.type, credential.data);
            decryptedCredentials.set(id, { ...credential, data: decryptedData });
        }
        
        // Generate new master key
        const newMasterKey = await this.deriveMasterKey(newMasterPassword);
        const oldMasterKey = this.masterKey;
        this.masterKey = newMasterKey;
        
        try {
            // Re-encrypt all credentials with new key
            for (const [id, credential] of decryptedCredentials.entries()) {
                const encryptedData = await this.encryptCredentialData(credential.type, credential.data);
                credential.data = encryptedData;
                this.credentials.set(id, credential);
            }
            
            // Save with new encryption
            await this.saveVault();
            
            console.log('✅ Key rotation completed');
            
        } catch (error) {
            // Rollback on failure
            this.masterKey = oldMasterKey;
            throw error;
        }
    }

    /**
     * Create backup
     */
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.config.vaultPath, `backup_${timestamp}.vault`);
        
        const vaultFile = path.join(this.config.vaultPath, 'credentials.vault');
        await fs.copyFile(vaultFile, backupPath);
        
        console.log(`💾 Created backup: ${backupPath}`);
        
        // Clean old backups (keep last 10)
        await this.cleanOldBackups();
    }

    /**
     * Clean old backups
     */
    async cleanOldBackups() {
        const files = await fs.readdir(this.config.vaultPath);
        const backups = files.filter(f => f.startsWith('backup_')).sort().reverse();
        
        for (let i = 10; i < backups.length; i++) {
            await fs.unlink(path.join(this.config.vaultPath, backups[i]));
        }
    }

    /**
     * Audit log
     */
    auditLog(action, credentialId, credentialType) {
        if (!this.config.auditLog) return;
        
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            credentialId,
            credentialType,
            user: process.env.USER || process.env.USERNAME || 'unknown'
        };
        
        this.accessLog.push(entry);
        this.emit('audit-log', entry);
        
        // Write to audit file
        this.writeAuditLog(entry).catch(console.error);
    }

    /**
     * Write audit log to file
     */
    async writeAuditLog(entry) {
        const auditFile = path.join(this.config.vaultPath, 'audit.log');
        const logLine = JSON.stringify(entry) + '\n';
        await fs.appendFile(auditFile, logLine);
    }

    /**
     * Get audit log
     */
    async getAuditLog(filter = {}) {
        const auditFile = path.join(this.config.vaultPath, 'audit.log');
        
        try {
            const content = await fs.readFile(auditFile, 'utf8');
            const logs = content.split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
            
            // Apply filters
            return logs.filter(log => {
                if (filter.action && log.action !== filter.action) return false;
                if (filter.credentialId && log.credentialId !== filter.credentialId) return false;
                if (filter.credentialType && log.credentialType !== filter.credentialType) return false;
                if (filter.startDate && new Date(log.timestamp) < new Date(filter.startDate)) return false;
                if (filter.endDate && new Date(log.timestamp) > new Date(filter.endDate)) return false;
                return true;
            });
        } catch (error) {
            return [];
        }
    }

    /**
     * Export credentials (encrypted)
     */
    async exportCredentials(exportPassword) {
        const exportData = {
            version: '1.0',
            exported: new Date().toISOString(),
            credentials: Object.fromEntries(this.credentials)
        };
        
        // Encrypt with export password
        const exportKey = await this.deriveMasterKey(exportPassword);
        const originalKey = this.masterKey;
        this.masterKey = exportKey;
        
        try {
            const encrypted = await this.encrypt(JSON.stringify(exportData));
            this.masterKey = originalKey;
            return encrypted;
        } catch (error) {
            this.masterKey = originalKey;
            throw error;
        }
    }

    /**
     * Import credentials
     */
    async importCredentials(encryptedData, importPassword) {
        // Decrypt with import password
        const importKey = await this.deriveMasterKey(importPassword);
        const originalKey = this.masterKey;
        this.masterKey = importKey;
        
        try {
            const decrypted = await this.decrypt(encryptedData);
            const importData = JSON.parse(decrypted);
            
            this.masterKey = originalKey;
            
            // Import credentials
            for (const [id, credential] of Object.entries(importData.credentials)) {
                // Re-encrypt with current master key
                const decryptedData = await this.decryptCredentialData(credential.type, credential.data);
                await this.storeCredential(id, credential.type, decryptedData, credential.metadata);
            }
            
            console.log(`📥 Imported ${Object.keys(importData.credentials).length} credentials`);
            
        } catch (error) {
            this.masterKey = originalKey;
            throw error;
        }
    }

    /**
     * Lock vault
     */
    lock() {
        this.masterKey = null;
        this.isUnlocked = false;
        this.credentials.clear();
        this.emit('vault-locked');
        console.log('🔒 Vault locked');
    }

    /**
     * Get vault statistics
     */
    getStats() {
        return {
            isUnlocked: this.isUnlocked,
            credentialCount: this.credentials.size,
            credentialTypes: this.getCredentialTypeStats(),
            lastAccessed: this.getLastAccessedCredentials(5),
            mostAccessed: this.getMostAccessedCredentials(5)
        };
    }

    /**
     * Get credential type statistics
     */
    getCredentialTypeStats() {
        const stats = {};
        
        for (const credential of this.credentials.values()) {
            stats[credential.type] = (stats[credential.type] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Get last accessed credentials
     */
    getLastAccessedCredentials(limit) {
        return Array.from(this.credentials.entries())
            .filter(([_, cred]) => cred.metadata.lastAccessed)
            .sort((a, b) => new Date(b[1].metadata.lastAccessed) - new Date(a[1].metadata.lastAccessed))
            .slice(0, limit)
            .map(([id, cred]) => ({
                id,
                type: cred.type,
                lastAccessed: cred.metadata.lastAccessed
            }));
    }

    /**
     * Get most accessed credentials
     */
    getMostAccessedCredentials(limit) {
        return Array.from(this.credentials.entries())
            .sort((a, b) => b[1].metadata.accessCount - a[1].metadata.accessCount)
            .slice(0, limit)
            .map(([id, cred]) => ({
                id,
                type: cred.type,
                accessCount: cred.metadata.accessCount
            }));
    }
}

module.exports = CredentialVault;
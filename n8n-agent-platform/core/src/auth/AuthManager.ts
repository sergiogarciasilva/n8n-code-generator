import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { DatabaseManager } from '../database/DatabaseManager';

interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'developer' | 'analyst' | 'viewer';
  organizationId: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  encryptionKey: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  deviceInfo: string;
  ipAddress: string;
  expiresAt: Date;
  createdAt: Date;
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  sessionId: string;
}

export class AuthManager {
  private jwtSecret: string;
  private refreshSecret: string;
  private encryptionMasterKey: string;
  private database: DatabaseManager;

  constructor(database: DatabaseManager) {
    this.database = database;
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.refreshSecret = process.env.REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
    this.encryptionMasterKey = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
  }

  // User Registration with encryption
  async register(userData: {
    email: string;
    username: string;
    password: string;
    organizationId: string;
    role?: string;
  }): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    // Validate password strength
    this.validatePasswordStrength(userData.password);

    // Check if user exists
    const existingUser = await this.database.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [userData.email, userData.username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Generate unique encryption key for user data
    const userEncryptionKey = crypto.randomBytes(32).toString('hex');
    const encryptedKey = this.encryptData(userEncryptionKey, this.encryptionMasterKey);

    // Create user
    const user = await this.database.query(
      `INSERT INTO users (
        email, username, password_hash, role, organization_id, 
        encryption_key, two_factor_enabled, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        userData.email,
        userData.username,
        passwordHash,
        userData.role || 'viewer',
        userData.organizationId,
        encryptedKey,
        false,
        true
      ]
    );

    // Create session
    const tokens = await this.createSession(user.rows[0]);

    return {
      user: user.rows[0],
      tokens
    };
  }

  // Login with 2FA support
  async login(credentials: {
    email: string;
    password: string;
    twoFactorCode?: string;
    deviceInfo: string;
    ipAddress: string;
  }): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } } | { requiresTwoFactor: true }> {
    // Get user
    const userResult = await this.database.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [credentials.email]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(credentials.password, user.password_hash);
    if (!passwordValid) {
      // Log failed attempt
      await this.logSecurityEvent(user.id, 'login_failed', credentials.ipAddress);
      throw new Error('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!credentials.twoFactorCode) {
        return { requiresTwoFactor: true };
      }

      const isValid = authenticator.verify({
        token: credentials.twoFactorCode,
        secret: this.decryptData(user.two_factor_secret, this.encryptionMasterKey)
      });

      if (!isValid) {
        await this.logSecurityEvent(user.id, 'two_factor_failed', credentials.ipAddress);
        throw new Error('Invalid 2FA code');
      }
    }

    // Create session
    const tokens = await this.createSession(user, credentials.deviceInfo, credentials.ipAddress);

    // Update last login
    await this.database.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Log successful login
    await this.logSecurityEvent(user.id, 'login_success', credentials.ipAddress);

    return { user, tokens };
  }

  // Create JWT tokens
  private async createSession(
    user: User,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = crypto.randomUUID();

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      sessionId
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '15m',
      issuer: 'n8n-agent-platform',
      audience: 'api'
    });

    const refreshToken = jwt.sign(
      { sessionId, userId: user.id },
      this.refreshSecret,
      { expiresIn: '7d' }
    );

    // Store session
    await this.database.query(
      `INSERT INTO sessions (
        id, user_id, access_token, refresh_token, 
        device_info, ip_address, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        user.id,
        this.hashToken(accessToken),
        this.hashToken(refreshToken),
        deviceInfo || 'unknown',
        ipAddress || 'unknown',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ]
    );

    return { accessToken, refreshToken };
  }

  // Verify and decode token
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'n8n-agent-platform',
        audience: 'api'
      }) as TokenPayload;

      // Check if session is still valid
      const session = await this.database.query(
        'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
        [decoded.sessionId]
      );

      if (session.rows.length === 0) {
        throw new Error('Session expired');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as any;

      // Get session
      const session = await this.database.query(
        'SELECT * FROM sessions WHERE id = $1 AND refresh_token = $2',
        [decoded.sessionId, this.hashToken(refreshToken)]
      );

      if (session.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.database.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      // Create new access token
      const payload: TokenPayload = {
        userId: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        organizationId: user.rows[0].organization_id,
        sessionId: decoded.sessionId
      };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: '15m',
        issuer: 'n8n-agent-platform',
        audience: 'api'
      });

      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Enable 2FA
  async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const secret = authenticator.generateSecret();
    const user = await this.database.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    const otpauth = `otpauth://totp/n8n%20Agent%20Platform:${encodeURIComponent(user.rows[0].email)}?secret=${secret}&issuer=n8n%20Agent%20Platform`;

    // Encrypt and store secret
    const encryptedSecret = this.encryptData(secret, this.encryptionMasterKey);
    await this.database.query(
      'UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2',
      [encryptedSecret, userId]
    );

    // Generate QR code (you'd use a library like qrcode here)
    const qrCode = `otpauth://totp/n8n-agent:${user.rows[0].email}?secret=${secret}&issuer=n8n-agent`;

    return { secret, qrCode };
  }

  // Encryption utilities
  private encryptData(data: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decryptData(encryptedData: string, key: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Encrypt user data
  async encryptUserData(userId: string, data: any): Promise<string> {
    const user = await this.database.query(
      'SELECT encryption_key FROM users WHERE id = $1',
      [userId]
    );

    const userKey = this.decryptData(
      user.rows[0].encryption_key,
      this.encryptionMasterKey
    );

    return this.encryptData(JSON.stringify(data), userKey);
  }

  async decryptUserData(userId: string, encryptedData: string): Promise<any> {
    const user = await this.database.query(
      'SELECT encryption_key FROM users WHERE id = $1',
      [userId]
    );

    const userKey = this.decryptData(
      user.rows[0].encryption_key,
      this.encryptionMasterKey
    );

    const decrypted = this.decryptData(encryptedData, userKey);
    return JSON.parse(decrypted);
  }

  // Password validation
  private validatePasswordStrength(password: string): void {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
  }

  // Hash token for storage
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Security logging
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    ipAddress: string,
    metadata?: any
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO security_logs (
        user_id, event_type, ip_address, metadata, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [userId, eventType, ipAddress, metadata ? JSON.stringify(metadata) : null]
    );
  }

  // Logout
  async logout(sessionId: string): Promise<void> {
    await this.database.query(
      'DELETE FROM sessions WHERE id = $1',
      [sessionId]
    );
  }

  // Revoke all sessions for a user
  async revokeAllSessions(userId: string): Promise<void> {
    await this.database.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [userId]
    );
  }
}
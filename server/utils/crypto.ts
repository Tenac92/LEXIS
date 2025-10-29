import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): Buffer {
  const secret = process.env.AFM_KEY;
  if (!secret) {
    throw new Error('AFM_KEY environment variable is not set');
  }
  
  const salt = Buffer.from('afm-encryption-salt-v1');
  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encryptAFM(afm: string | null | undefined): string | null {
  if (!afm) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(afm, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    
    return result;
  } catch (error) {
    console.error('[Crypto] Error encrypting AFM:', error);
    throw new Error('Failed to encrypt AFM');
  }
}

export function decryptAFM(encryptedAFM: string | null | undefined): string | null {
  if (!encryptedAFM) {
    return null;
  }

  try {
    const parts = encryptedAFM.split(':');
    if (parts.length !== 3) {
      console.error('[Crypto] Invalid encrypted AFM format - expected 3 parts separated by ":"');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Crypto] Error decrypting AFM - data may be corrupted:', error);
    return null;
  }
}

export function hashAFM(afm: string): string {
  if (!afm) {
    throw new Error('AFM cannot be empty');
  }
  
  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(afm);
  return hmac.digest('hex');
}

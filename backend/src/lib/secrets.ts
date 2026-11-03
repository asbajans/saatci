import crypto from 'crypto';

const SECRET_PLACEHOLDER = '••••••••';
const SENSITIVE_KEY = /(token|secret|password|authorization|apikey|api_key|clientsecret|refreshtoken|accesstoken|verifytoken)/i;

function encryptionKey() {
  const material = process.env.INTEGRATION_SECRET || process.env.JWT_SECRET;
  if (!material) {
    throw new Error('INTEGRATION_SECRET veya JWT_SECRET tanımlanmalıdır');
  }
  return crypto.createHash('sha256').update(material).digest();
}

export function encryptConfig(config: unknown): { __encrypted: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = JSON.stringify(config ?? {});
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    __encrypted: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
  };
}

export function decryptConfig(config: unknown): Record<string, any> {
  if (!config || typeof config !== 'object') return {};
  const value = config as Record<string, unknown>;
  if (typeof value.__encrypted !== 'string') return value as Record<string, any>;

  const payload = Buffer.from(value.__encrypted, 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as Record<string, any>;
}

export function redactConfig(config: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactConfig(value as Record<string, any>);
    } else if (SENSITIVE_KEY.test(key) && typeof value === 'string' && value.length > 0) {
      result[key] = SECRET_PLACEHOLDER;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function mergeSecrets(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeSecrets((existing?.[key] || {}) as Record<string, any>, value as Record<string, any>);
    } else if (value === SECRET_PLACEHOLDER) {
      result[key] = existing?.[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function isSecretField(key: string) {
  return SENSITIVE_KEY.test(key);
}

export { SECRET_PLACEHOLDER };

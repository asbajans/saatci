import { prisma } from './prisma';

const SENSITIVE_KEYS = /(password|passwd|token|secret|authorization|api[_-]?key|cookie)/i;

function truncate(value: string, max = 2000) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[derin nesne]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeForAudit(item, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.test(key) ? '[gizlendi]' : sanitizeForAudit(item, depth + 1);
    }
    return result;
  }
  return String(value);
}

export type AuditInput = {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  role?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  description?: string | null;
  changes?: unknown;
};

export async function recordAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        userName: input.userName || null,
        userEmail: input.userEmail || null,
        role: input.role || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        method: input.method || null,
        path: input.path || null,
        statusCode: input.statusCode ?? null,
        ip: input.ip || null,
        userAgent: input.userAgent ? truncate(input.userAgent, 500) : null,
        description: input.description || null,
        changes: input.changes === undefined ? undefined : (sanitizeForAudit(input.changes) as any),
      },
    });
  } catch (error) {
    console.error('[audit] kayıt yazılamadı:', error);
  }
}

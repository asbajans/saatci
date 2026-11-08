import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from './auth';
import { recordAudit } from '../lib/audit';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIPPED_PREFIXES = ['/api/public', '/api/webhooks', '/api/auth', '/health', '/api/health'];

function resolveAction(req: Request) {
  const path = req.path.toLowerCase();
  if (path.includes('/sync')) return 'SYNC';
  if (path.includes('/backups')) return 'BACKUP';
  if (path.includes('/audit-logs')) return 'AUDIT';
  if (path.includes('/approve')) return 'APPROVE';
  if (path.includes('/pay')) return 'PAYMENT';
  if (path.includes('/import')) return 'IMPORT';
  if (path.includes('/status')) return 'STATUS_CHANGE';
  switch (req.method) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return req.method;
  }
}

function resolveEntity(req: Request) {
  const parts = req.path.split('/').filter(Boolean);
  const index = parts[0] === 'api' ? 1 : 0;
  return parts[index] || 'system';
}

function resolveEntityId(req: Request) {
  const params = req.params as Record<string, string | undefined>;
  const body = (req.body || {}) as Record<string, unknown>;
  return (
    params.id ||
    params.patientId ||
    params.leadId ||
    params.appointmentId ||
    params.invoiceId ||
    (typeof body.id === 'string' ? body.id : undefined) ||
    (typeof body.patientId === 'string' ? body.patientId : undefined) ||
    null
  );
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api') || !MUTATING_METHODS.has(req.method)) {
    return next();
  }
  if (SKIPPED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  const startedAt = Date.now();
  res.on('finish', () => {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const action = resolveAction(req);
    const entity = resolveEntity(req);
    const entityId = resolveEntityId(req);
    const body = (req.body || {}) as Record<string, unknown>;
    const label =
      (typeof body.name === 'string' && body.name) ||
      (typeof body.title === 'string' && body.title) ||
      (typeof body.description === 'string' && body.description) ||
      null;

    void recordAudit({
      userId: user?.id,
      userEmail: user?.email,
      role: user?.role,
      action,
      entity,
      entityId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      ip: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      userAgent: req.headers['user-agent'] || null,
      description: `${req.method} ${req.originalUrl.split('?')[0]}${label ? ` · ${label}` : ''}${
        res.statusCode >= 400 ? ` · HTTP ${res.statusCode}` : ''
      }`,
      changes: {
        params: req.params,
        query: req.query,
        body: req.body,
        durationMs: Date.now() - startedAt,
      },
    });
  });

  next();
}

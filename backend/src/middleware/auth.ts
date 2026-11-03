import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token gerekli' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ success: false, message: 'Sunucu yapılandırması hatalı' });
  }

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Geçersiz veya süresi dolmuş token' });
  }
};

export const roleGuard = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
    }
    next();
  };
};

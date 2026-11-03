import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});

function signToken(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET tanımlanmalıdır');
  }
  const expiresIn = (process.env.JWT_EXPIRE || '7d') as import('jsonwebtoken').SignOptions['expiresIn'];
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn });
}

router.get(
  '/setup-status',
  asyncHandler(async (_req: Request, res: Response) => {
    const userCount = await prisma.user.count();
    res.json({ success: true, data: { needsSetup: userCount === 0 } });
  })
);

router.post(
  '/setup',
  asyncHandler(async (req: Request, res: Response) => {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ success: false, message: 'İlk kurulum daha önce tamamlanmış' });
    }
    const data = setupSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();
    const password = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { name: data.name.trim(), email, password, role: 'ADMIN' },
      select: { id: true, name: true, email: true, role: true },
    });
    const token = signToken(user);
    res.status(201).json({ success: true, data: { user, token } });
  })
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı' });
    }
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'E-posta veya şifre hatalı' });
    }
    const token = signToken(user);
    res.json({
      success: true,
      data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, token },
    });
  })
);

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }
    res.json({ success: true, data: user });
  })
);

export default router;

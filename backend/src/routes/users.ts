import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'DENTIST', 'CALL_CENTER', 'SALES', 'BANKO']),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'DENTIST', 'CALL_CENTER', 'SALES', 'BANKO']).optional(),
});

router.use(authMiddleware);

router.get(
  '/staff',
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { role: { in: ['DENTIST', 'SALES'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: users });
  })
);

router.get(
  '/',
  roleGuard('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  })
);

router.post(
  '/',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bu e-posta zaten kayıtlı' });
    }
    const password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password, role: data.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: user });
  })
);

router.put(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        password: data.password ? await bcrypt.hash(data.password, 10) : undefined,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  })
);

router.delete(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.id === req.params.id) {
      return res.status(400).json({ success: false, message: 'Kendi hesabınızı silemezsiniz' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  })
);

router.get(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }
    res.json({ success: true, data: user });
  })
);

export default router;

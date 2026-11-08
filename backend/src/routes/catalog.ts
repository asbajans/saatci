import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authMiddleware);

router.get(
  '/services',
  asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.category) where.category = String(req.query.category);

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: services });
  })
);

router.get(
  '/tariffs',
  asyncHandler(async (_req: Request, res: Response) => {
    const tariffs = await prisma.tariff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        year: true,
        type: true,
        effectiveDate: true,
        _count: { select: { items: true } },
      },
      orderBy: [{ year: 'desc' }, { effectiveDate: 'desc' }],
    });
    res.json({ success: true, data: tariffs });
  })
);

router.get(
  '/dentists',
  asyncHandler(async (_req: Request, res: Response) => {
    const dentists = await prisma.user.findMany({
      where: { role: 'DENTIST' },
      select: {
        id: true,
        name: true,
        email: true,
        dentistProfile: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: dentists });
  })
);

router.get(
  '/service-categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.service.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    res.json({ success: true, data: categories.map((item) => item.category) });
  })
);

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { fetchTdbDocuments, importTariffItemsToServices, syncTdbTariff } from '../services/tdbTariff';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  roleGuard('ADMIN', 'DENTIST', 'SALES', 'BANKO', 'CALL_CENTER'),
  asyncHandler(async (req: Request, res: Response) => {
    const where: Prisma.TariffWhereInput = {};
    if (req.query.all !== '1') where.isActive = true;
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.type) where.type = String(req.query.type) as 'TDB' | 'CUSTOM';

    const tariffs = await prisma.tariff.findMany({
      where,
      orderBy: [{ year: 'desc' }, { effectiveDate: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { items: true } } },
    });
    res.json({ success: true, data: tariffs });
  })
);

router.get(
  '/remote-docs',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const docs = await fetchTdbDocuments(req.query.type ? String(req.query.type) : undefined);
    res.json({ success: true, data: docs });
  })
);

router.post(
  '/sync-tdb',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        docId: z.coerce.number().int().positive().optional(),
        year: z.coerce.number().int().min(2000).max(2100).optional(),
        type: z.string().min(1).optional(),
      })
      .parse(req.body || {});

    const result = await syncTdbTariff(data);
    res.status(201).json({
      success: true,
      data: {
        tariff: result.tariff,
        itemCount: result.itemCount,
        document: result.document,
      },
    });
  })
);

router.get(
  '/:id/items',
  roleGuard('ADMIN', 'DENTIST', 'SALES', 'BANKO', 'CALL_CENTER'),
  asyncHandler(async (req: Request, res: Response) => {
    const where: Prisma.TariffItemWhereInput = { tariffId: req.params.id };
    if (req.query.all !== '1') where.isActive = true;
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.q) {
      const q = String(req.query.q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.tariffItem.findMany({
      where,
      orderBy: [{ categoryCode: 'asc' }, { code: 'asc' }],
      take: 2000,
    });
    res.json({ success: true, data: items });
  })
);

router.patch(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const tariff = await prisma.tariff.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: tariff });
  })
);

router.post(
  '/:id/import-services',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await importTariffItemsToServices(req.params.id);
    res.status(201).json({
      success: true,
      data: { tariff: result.tariff, itemCount: result.itemCount, imported: true },
    });
  })
);

router.delete(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.tariff.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;


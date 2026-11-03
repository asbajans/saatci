import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { changePatientLeadStatuses, logConversionEvent } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const includeRelations = {
  method: true,
  collectedBy: { select: { id: true, name: true, role: true } },
  patient: { select: { id: true, hastaNo: true, name: true, surname: true, phone: true } },
  invoice: { select: { id: true, amount: true, paidAmount: true, status: true } },
} as const;

const handoverInclude = {
  fromUser: { select: { id: true, name: true, role: true } },
  toUser: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
} as const;

const dateBoundary = (dateStr: string, endOfDay = false) =>
  new Date(`${dateStr}T${endOfDay ? '23:59:59' : '00:00:00'}+03:00`);

const istanbulToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());

router.use(authMiddleware);

// Payment methods
router.get(
  '/payment-methods',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (_req: Request, res: Response) => {
    const methods = await prisma.paymentMethod.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: methods });
  })
);

router.post(
  '/payment-methods',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({ name: z.string().min(1), isActive: z.boolean().optional() })
      .parse(req.body);
    const method = await prisma.paymentMethod.create({
      data: { name: data.name.trim(), isActive: data.isActive ?? true },
    });
    res.status(201).json({ success: true, data: method });
  })
);

router.patch(
  '/payment-methods/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() })
      .parse(req.body);
    const method = await prisma.paymentMethod.update({
      where: { id: req.params.id },
      data: {
        name: data.name?.trim(),
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: method });
  })
);

router.delete(
  '/payment-methods/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.paymentMethod.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

// Collections
router.get(
  '/',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.userId) where.collectedById = req.query.userId as string;
    if (req.query.methodId) where.methodId = req.query.methodId as string;
    if (req.query.invoiceId) where.invoiceId = req.query.invoiceId as string;

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: dateBoundary(from) } : {}),
        ...(to ? { lte: dateBoundary(to, true) } : {}),
      };
    }

    const collections = await prisma.collection.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    res.json({ success: true, data: collections });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = z
      .object({
        invoiceId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        amount: z.coerce.number().positive(),
        methodId: z.string().uuid(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    if (!data.invoiceId && !data.patientId) {
      return res.status(400).json({ success: false, message: 'Fatura veya hasta seçilmelidir' });
    }

    const method = await prisma.paymentMethod.findUnique({ where: { id: data.methodId } });
    if (!method || !method.isActive) {
      return res.status(400).json({ success: false, message: 'Geçerli bir tahsilat türü seçin' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let invoice:
        | {
            id: string;
            amount: Prisma.Decimal;
            paidAmount: Prisma.Decimal;
            plan: { id: string; patientId: string; campaignId: string | null };
          }
        | null = null;

      if (data.invoiceId) {
        invoice = await tx.invoice.findUnique({
          where: { id: data.invoiceId },
          include: { plan: { select: { id: true, patientId: true, campaignId: true } } },
        });
        if (!invoice) {
          throw Object.assign(new Error('Fatura bulunamadı'), { statusCode: 404 });
        }
        const remaining = Number(invoice.amount) - Number(invoice.paidAmount);
        if (data.amount > remaining + 0.01) {
          throw Object.assign(new Error(`Tahsilat tutarı kalan bakiyeden fazla olamaz (${remaining})`), {
            statusCode: 400,
          });
        }
      }

      const patientId = data.patientId || invoice?.plan.patientId || null;

      const collection = await tx.collection.create({
        data: {
          invoiceId: data.invoiceId || null,
          patientId,
          amount: data.amount,
          methodId: data.methodId,
          collectedById: req.user!.id,
          notes: data.notes,
        },
        include: includeRelations,
      });

      await tx.cashRegister.upsert({
        where: { userId: req.user!.id },
        update: { balance: { increment: data.amount } },
        create: { userId: req.user!.id, balance: data.amount },
      });

      if (invoice) {
        const newPaid = Number(invoice.paidAmount) + data.amount;
        const status = newPaid >= Number(invoice.amount) ? 'PAID' : 'PARTIAL';
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            status,
            paidAt: status === 'PAID' ? new Date() : null,
          },
        });
      }

      return collection;
    });

    const paidInvoice = data.invoiceId
      ? await prisma.invoice.findUnique({
          where: { id: data.invoiceId },
          include: { plan: { select: { id: true, patientId: true, campaignId: true } } },
        })
      : null;

    if (paidInvoice && paidInvoice.status === 'PAID') {
      await changePatientLeadStatuses({
        patientId: paidInvoice.plan.patientId,
        status: 'SOLD',
        changedById: req.user!.id,
        note: 'Tahsilat ile fatura tamamen ödendi',
        planId: paidInvoice.plan.id,
        value: Number(paidInvoice.amount),
      });
    } else {
      await logConversionEvent({
        type: 'PAYMENT_RECEIVED',
        patientId: result.patientId,
        campaignId: paidInvoice?.plan.campaignId || null,
        planId: paidInvoice?.plan.id || null,
        invoiceId: data.invoiceId || null,
        value: data.amount,
        payload: { methodId: data.methodId, invoiceStatus: paidInvoice?.status || null },
      });
    }

    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  '/my-register',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const register = await prisma.cashRegister.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id, balance: 0 },
    });
    const start = dateBoundary(istanbulToday());
    const todayTotal = await prisma.collection.aggregate({
      where: { collectedById: req.user!.id, createdAt: { gte: start } },
      _sum: { amount: true },
    });
    res.json({
      success: true,
      data: { register, todayTotal: Number(todayTotal._sum.amount || 0) },
    });
  })
);

router.get(
  '/registers',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'BANKO'] } },
      select: {
        id: true,
        name: true,
        role: true,
        cashRegister: { select: { balance: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({
      success: true,
      data: users.map((u) => ({
        userId: u.id,
        name: u.name,
        role: u.role,
        balance: Number(u.cashRegister?.balance || 0),
      })),
    });
  })
);

router.get(
  '/handovers',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.user!.role === 'BANKO') {
      where.OR = [{ fromUserId: req.user!.id }, { toUserId: req.user!.id }];
    }
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.fromUserId) where.fromUserId = req.query.fromUserId as string;
    if (req.query.toUserId) where.toUserId = req.query.toUserId as string;

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: dateBoundary(from) } : {}),
        ...(to ? { lte: dateBoundary(to, true) } : {}),
      };
    }

    const handovers = await prisma.cashHandover.findMany({
      where,
      include: handoverInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ success: true, data: handovers });
  })
);

router.post(
  '/handovers',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = z
      .object({
        toUserId: z.string().uuid(),
        amount: z.coerce.number().positive(),
        note: z.string().optional(),
      })
      .parse(req.body);

    if (data.toUserId === req.user!.id) {
      return res.status(400).json({ success: false, message: 'Kasa teslimi başka bir kullanıcıya yapılmalıdır' });
    }

    const recipient = await prisma.user.findUnique({ where: { id: data.toUserId } });
    if (!recipient || !['ADMIN', 'BANKO'].includes(recipient.role)) {
      return res.status(400).json({ success: false, message: 'Geçerli bir teslim alıcısı seçin' });
    }

    const register = await prisma.cashRegister.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id, balance: 0 },
    });
    if (Number(register.balance) < data.amount) {
      return res.status(400).json({ success: false, message: 'Kasa bakiyesi yetersiz' });
    }

    const handover = await prisma.cashHandover.create({
      data: {
        fromUserId: req.user!.id,
        toUserId: data.toUserId,
        amount: data.amount,
        note: data.note,
      },
      include: handoverInclude,
    });
    res.status(201).json({ success: true, data: handover });
  })
);

router.patch(
  '/handovers/:id/approve',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const handover = await prisma.cashHandover.findUnique({ where: { id: req.params.id } });
    if (!handover) {
      return res.status(404).json({ success: false, message: 'Kasa teslimi bulunamadı' });
    }
    if (handover.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Bu kasa teslimi zaten sonuçlandırılmış' });
    }
    if (handover.toUserId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Bu teslimi yalnızca teslim alıcısı onaylayabilir' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const sender = await tx.cashRegister.findUnique({ where: { userId: handover.fromUserId } });
      if (!sender || Number(sender.balance) < Number(handover.amount)) {
        throw Object.assign(new Error('Göndericinin kasa bakiyesi yetersiz'), { statusCode: 400 });
      }

      await tx.cashRegister.update({
        where: { userId: handover.fromUserId },
        data: { balance: { decrement: handover.amount } },
      });
      await tx.cashRegister.upsert({
        where: { userId: handover.toUserId },
        update: { balance: { increment: handover.amount } },
        create: { userId: handover.toUserId, balance: handover.amount },
      });

      return tx.cashHandover.update({
        where: { id: handover.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: req.user!.id,
        },
        include: handoverInclude,
      });
    });

    res.json({ success: true, data: updated });
  })
);

router.patch(
  '/handovers/:id/reject',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const handover = await prisma.cashHandover.findUnique({ where: { id: req.params.id } });
    if (!handover) {
      return res.status(404).json({ success: false, message: 'Kasa teslimi bulunamadı' });
    }
    if (handover.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Bu kasa teslimi zaten sonuçlandırılmış' });
    }
    if (handover.toUserId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Bu teslimi yalnızca teslim alıcısı reddedebilir' });
    }

    const updated = await prisma.cashHandover.update({
      where: { id: handover.id },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approvedById: req.user!.id,
      },
      include: handoverInclude,
    });
    res.json({ success: true, data: updated });
  })
);

export default router;

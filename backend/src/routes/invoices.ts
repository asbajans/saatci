import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { changePatientLeadStatuses, logConversionEvent } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const invoiceSchema = z.object({
  planId: z.string().uuid(),
  amount: z.string(),
  dueDate: z.string().datetime().optional(),
});

router.use(authMiddleware);

router.get(
  '/',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (_req: Request, res: Response) => {
    const invoices = await prisma.invoice.findMany({
      include: {
        plan: {
          include: {
            patient: { select: { id: true, hastaNo: true, name: true, surname: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invoices });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = invoiceSchema.parse(req.body);
    const invoice = await prisma.invoice.create({
      data: {
        planId: data.planId,
        amount: parseFloat(data.amount),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: { plan: { include: { patient: true } } },
    });
    res.status(201).json({ success: true, data: invoice });
  })
);

router.patch(
  '/:id/pay',
  roleGuard('ADMIN', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { paidAmount } = z.object({ paidAmount: z.string() }).parse(req.body);
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { id: true, patientId: true, campaignId: true } } },
    });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Fatura bulunamadı' });
    }
    const newPaid = Number(invoice.paidAmount) + Number(paidAmount);
    const status = newPaid >= Number(invoice.amount) ? 'PAID' : 'PARTIAL';
    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { paidAmount: newPaid, status, paidAt: newPaid >= Number(invoice.amount) ? new Date() : null },
    });

    if (status === 'PAID') {
      await changePatientLeadStatuses({
        patientId: invoice.plan.patientId,
        status: 'SOLD',
        changedById: req.user!.id,
        note: 'Fatura tamamen ödendi',
        planId: invoice.plan.id,
        value: Number(invoice.amount),
      });
    } else {
      await logConversionEvent({
        type: 'PAYMENT_RECEIVED',
        patientId: invoice.plan.patientId,
        campaignId: invoice.plan.campaignId,
        planId: invoice.plan.id,
        invoiceId: invoice.id,
        value: Number(paidAmount),
        payload: { status, newPaid },
      });
    }

    res.json({ success: true, data: updated });
  })
);

export default router;

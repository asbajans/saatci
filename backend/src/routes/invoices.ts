import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { changePatientLeadStatuses, logConversionEvent } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const invoiceItemSchema = z.object({
  serviceId: z.string().uuid().optional(),
  tariffItemId: z.string().uuid().optional(),
  code: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().min(0.01).optional(),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0).optional(),
});

const invoiceSchema = z.object({
  planId: z.string().uuid(),
  amount: z.coerce.string().optional(),
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().datetime().optional(),
  invoiceType: z.string().optional(),
  subtotal: z.coerce.string().optional(),
  vatAmount: z.coerce.string().optional(),
  discount: z.coerce.string().optional(),
  grandTotal: z.coerce.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.coerce.string().optional(),
  description: z.string().optional(),
  senderTaxpayerId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

function nextInvoiceNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `FTR-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}`;
}

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
        items: true,
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
    const items = (data.items || []).map((item) => {
      const quantity = item.quantity ?? 1;
      const vatRate = item.vatRate ?? 10;
      const discount = item.discount ?? 0;
      const net = quantity * item.unitPrice - discount;
      const vatAmount = (net * vatRate) / 100;
      return {
        serviceId: item.serviceId,
        tariffItemId: item.tariffItemId,
        code: item.code,
        description: item.description,
        quantity,
        unitPrice: item.unitPrice,
        vatRate,
        vatAmount,
        discount,
        total: item.total ?? net + vatAmount,
        currency: data.currency || 'TRY',
      };
    });

    const subtotal = data.subtotal
      ? parseFloat(data.subtotal)
      : items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const vatAmount = data.vatAmount
      ? parseFloat(data.vatAmount)
      : items.reduce((sum, item) => sum + item.vatAmount, 0);
    const discount = data.discount ? parseFloat(data.discount) : 0;
    const computedGrand = data.grandTotal
      ? parseFloat(data.grandTotal)
      : subtotal + vatAmount - discount;
    const amount = data.amount ? parseFloat(data.amount) : computedGrand;

    const invoice = await prisma.invoice.create({
      data: {
        planId: data.planId,
        invoiceNo: data.invoiceNo || nextInvoiceNo(),
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        invoiceType: data.invoiceType || 'OUTGOING',
        amount,
        subtotal,
        vatAmount,
        discount,
        grandTotal: computedGrand,
        currency: data.currency || 'TRY',
        exchangeRate: data.exchangeRate ? parseFloat(data.exchangeRate) : 1,
        description: data.description,
        senderTaxpayerId: data.senderTaxpayerId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        items: items.length > 0 ? { create: items } : undefined,
      },
      include: { plan: { include: { patient: true } }, items: true },
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
      return res.status(404).json({ success: false, message: 'Fatura bulunamadÄ±' });
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
        note: 'Fatura tamamen Ã¶dendi',
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


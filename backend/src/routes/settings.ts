import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

const expenseCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const expenseSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  amount: z.coerce.string().min(1),
  expenseDate: z.string().datetime(),
  description: z.string().optional(),
});

router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

// Expense Categories
router.get('/expense-categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: categories });
}));

router.post('/expense-categories', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = expenseCategorySchema.parse(req.body);
  const category = await prisma.expenseCategory.create({
    data,
  });
  res.status(201).json({ success: true, data: category });
}));

router.patch('/expense-categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = expenseCategorySchema.partial().parse(req.body);
  const category = await prisma.expenseCategory.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ success: true, data: category });
}));

router.delete('/expense-categories/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.expenseCategory.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

// Expenses
router.get('/expenses', asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = {};
  if (req.query.categoryId) {
    where.categoryId = req.query.categoryId as string;
  }
  if (req.query.from || req.query.to) {
    where.expenseDate = {};
    if (req.query.from) {
      (where.expenseDate as Record<string, unknown>).gte = new Date(req.query.from as string);
    }
    if (req.query.to) {
      (where.expenseDate as Record<string, unknown>).lte = new Date(req.query.to as string);
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: { expenseDate: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: expenses });
}));

router.post('/expenses', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = expenseSchema.parse(req.body);
  const expense = await prisma.expense.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      amount: parseFloat(data.amount),
      expenseDate: new Date(data.expenseDate),
      description: data.description,
    },
  });
  res.status(201).json({ success: true, data: expense });
}));

router.patch('/expenses/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = expenseSchema.partial().parse(req.body);
  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      categoryId: data.categoryId,
      name: data.name,
      amount: data.amount ? parseFloat(data.amount) : undefined,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      description: data.description,
    },
  });
  res.json({ success: true, data: expense });
}));

router.delete('/expenses/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.expense.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

// Commission Rates
router.get('/commission-rates', asyncHandler(async (_req: Request, res: Response) => {
  const rates = await prisma.commissionRate.findMany({
    orderBy: [{ role: 'asc' }, { type: 'asc' }],
  });
  res.json({ success: true, data: rates });
}));

router.post('/commission-rates', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    role: z.enum(['ADMIN', 'DENTIST', 'CALL_CENTER', 'SALES', 'BANKO']),
    type: z.string(),
    serviceCategory: z.string().optional(),
    rate: z.coerce.string().min(1),
    isActive: z.boolean().optional(),
  }).parse(req.body);

  const rate = await prisma.commissionRate.create({
    data: {
      role: data.role,
      type: data.type,
      serviceCategory: data.serviceCategory,
      rate: parseFloat(data.rate),
      isActive: data.isActive ?? true,
    },
  });
  res.status(201).json({ success: true, data: rate });
}));

router.patch('/commission-rates/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = z.object({
    role: z.enum(['ADMIN', 'DENTIST', 'CALL_CENTER', 'SALES', 'BANKO']).optional(),
    type: z.string().optional(),
    serviceCategory: z.string().optional(),
    rate: z.coerce.string().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);

  const rate = await prisma.commissionRate.update({
    where: { id: req.params.id },
    data: {
      role: data.role,
      type: data.type,
      serviceCategory: data.serviceCategory,
      rate: data.rate ? parseFloat(data.rate) : undefined,
      isActive: data.isActive,
    },
  });
  res.json({ success: true, data: rate });
}));

router.delete('/commission-rates/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.commissionRate.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

// Services / Products Management
const serviceSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.string().min(1),
  isActive: z.boolean().optional(),
});

router.get('/services', asyncHandler(async (_req: Request, res: Response) => {
  const services = await prisma.service.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: services });
}));

router.get('/service-categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await prisma.serviceCategory.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: categories });
}));

router.post('/service-categories', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }).parse(req.body);
  const category = await prisma.serviceCategory.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });
  res.status(201).json({ success: true, data: category });
}));

router.delete('/service-categories/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.serviceCategory.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

router.post('/services', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = serviceSchema.parse(req.body);
  const service = await prisma.service.create({
    data: {
      category: data.category,
      name: data.name,
      description: data.description,
      price: parseFloat(data.price),
      isActive: data.isActive ?? true,
    },
  });
  res.status(201).json({ success: true, data: service });
}));

router.patch('/services/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = serviceSchema.partial().parse(req.body);
  const service = await prisma.service.update({
    where: { id: req.params.id },
    data: {
      category: data.category,
      name: data.name,
      description: data.description,
      price: data.price ? parseFloat(data.price) : undefined,
      isActive: data.isActive,
    },
  });
  res.json({ success: true, data: service });
}));

router.delete('/services/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.service.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

// Commission Management
router.get('/commissions', asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = {};
  if (req.query.userId) where.userId = req.query.userId as string;
  if (req.query.type) where.type = req.query.type as string;
  if (req.query.status) where.status = req.query.status as string;

  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  if (from || to) {
    where.periodStart = {};
    if (from) (where.periodStart as Record<string, unknown>).gte = from;
    if (to) (where.periodStart as Record<string, unknown>).lte = to;
  }

  const commissions = await prisma.commission.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, role: true } },
      doctorPatient: true,
      salesPatient: true,
      callcenterLead: true,
      bankoInvoice: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: commissions });
}));

router.post('/commissions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    userId: z.string(),
    type: z.enum(['doctor', 'sales', 'callcenter', 'banko']),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    totalAmount: z.string(),
    commissionRate: z.string(),
    calculatedAmount: z.string(),
    doctorPatientId: z.string().optional(),
    salesPatientId: z.string().optional(),
    callcenterLeadId: z.string().optional(),
    bankoInvoiceId: z.string().optional(),
  }).parse(req.body);

  const commission = await prisma.commission.create({
    data: {
      userId: data.userId,
      type: data.type,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      totalAmount: parseFloat(data.totalAmount),
      commissionRate: parseFloat(data.commissionRate),
      calculatedAmount: parseFloat(data.calculatedAmount),
      status: 'calculated',
      calculatedAt: new Date(),
      doctorPatientId: data.doctorPatientId,
      salesPatientId: data.salesPatientId,
      callcenterLeadId: data.callcenterLeadId,
      bankoInvoiceId: data.bankoInvoiceId,
    },
    include: {
      user: true,
      doctorPatient: true,
      salesPatient: true,
      callcenterLead: true,
      bankoInvoice: true,
    },
  });
  res.status(201).json({ success: true, data: commission });
}));

router.patch('/commissions/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = z.object({
    status: z.enum(['pending', 'calculated', 'paid']).optional(),
    paidAt: z.string().datetime().optional(),
    paymentReference: z.string().optional(),
  }).parse(req.body);

  const commission = await prisma.commission.update({
    where: { id: req.params.id },
    data: {
      status: data.status,
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      paymentReference: data.paymentReference,
    },
    include: {
      user: true,
      doctorPatient: true,
      salesPatient: true,
      callcenterLead: true,
      bankoInvoice: true,
    },
  });
  res.json({ success: true, data: commission });
}));

router.delete('/commissions/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.commission.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, data: { deleted: true } });
}));

export default router;

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { changeLeadStatus, recordLeadCreated, resolveCampaignId } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const leadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'CLINIC_VISIT',
  'TREATMENT_APPROVED',
  'APPOINTMENT_BOOKED',
  'SOLD',
  'IRRELEVANT',
  'PRICE_HIGH',
  'CALLBACK',
]);

const callbackFields = {
  callbackAt: z.string().datetime({ offset: true }).nullable().optional(),
  callbackNote: z.string().max(1000).nullable().optional(),
};

const attributionFields = {
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  fbclid: z.string().optional(),
  gclid: z.string().optional(),
  ttclid: z.string().optional(),
  landingPage: z.string().optional(),
  referrer: z.string().optional(),
  externalId: z.string().optional(),
  rawPayload: z.record(z.any()).optional(),
};

const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  campaignId: z.string().uuid().optional().nullable(),
  status: leadStatusEnum.optional(),
  patientId: z.string().uuid().optional().nullable(),
  description: z.string().max(5000).nullable().optional(),
  ...attributionFields,
  ...callbackFields,
});

const leadUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  status: leadStatusEnum.optional(),
  patientId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  ...attributionFields,
  ...callbackFields,
});

const leadNoteSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const includeRelations = {
  campaign: true,
  form: { select: { id: true, name: true, token: true } },
  patient: { select: { id: true, hastaNo: true, name: true, surname: true } },
  statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 20 },
  appointments: {
    select: { id: true, randevuNo: true, type: true, status: true, appointmentDate: true },
    orderBy: { appointmentDate: 'desc' as const },
    take: 3,
  },
  visits: { select: { id: true, protokolNo: true, status: true, visitDate: true } },
  _count: { select: { notes: true } },
} as const;

const leadsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: leadStatusEnum.optional(),
  source: z.string().trim().optional(),
  campaignId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.union([z.literal('all'), z.coerce.number().int().min(1).max(500)]).optional(),
});

function phoneSearchChunks(value: string): string[] {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length > 3) digits = digits.slice(1);
  if (digits.length < 3) return [];

  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(
    (chunk) => chunk.length > 0
  );
}

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const params = leadsQuerySchema.parse(req.query);
    const where: Prisma.LeadWhereInput = {};

    if (params.status) where.status = params.status;
    if (params.source) where.source = params.source;
    if (params.campaignId) where.campaignId = params.campaignId;

    const from = params.dateFrom ? new Date(params.dateFrom) : undefined;
    const to = params.dateTo ? new Date(params.dateTo) : undefined;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.createdAt = {
        ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
        ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
      };
    }

    if (params.q) {
      const phoneChunks = phoneSearchChunks(params.q);
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
        phoneChunks.length
          ? { AND: phoneChunks.map((chunk) => ({ phone: { contains: chunk } })) }
          : { phone: { contains: params.q } },
      ];
    }

    const paginated = params.page !== undefined || params.pageSize !== undefined;
    if (!paginated) {
      const leads = await prisma.lead.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, data: leads });
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const total = await prisma.lead.count({ where });
    const leads = await prisma.lead.findMany({
      where,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
      ...(pageSize === 'all' ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    });

    res.json({
      success: true,
      data: leads,
      meta: {
        total,
        page,
        pageSize,
        totalPages: pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  })
);

router.get(
  '/sources',
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.lead.findMany({
      distinct: ['source'],
      select: { source: true },
      orderBy: { source: 'asc' },
    });
    res.json({ success: true, data: rows.map((row) => row.source).filter(Boolean) });
  })
);

router.get(
  '/reminders',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const select = {
      id: true,
      name: true,
      phone: true,
      source: true,
      status: true,
      callbackAt: true,
      callbackNote: true,
      campaign: { select: { id: true, name: true } },
    } as const;

    const [due, upcoming] = await Promise.all([
      prisma.lead.findMany({
        where: { status: 'CALLBACK', callbackAt: { lte: now } },
        select,
        orderBy: { callbackAt: 'asc' },
        take: 50,
      }),
      prisma.lead.findMany({
        where: { status: 'CALLBACK', callbackAt: { gt: now } },
        select,
        orderBy: { callbackAt: 'asc' },
        take: 20,
      }),
    ]);

    res.json({ success: true, data: { due, upcoming, serverTime: now } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        ...includeRelations,
        notes: {
          include: { createdBy: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' as const },
        },
        conversionEvents: {
          include: {
            deliveries: { include: { integration: { select: { id: true, name: true, type: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead bulunamadı' });
    }
    res.json({ success: true, data: lead });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = leadSchema.parse(req.body);
    const campaignId = await resolveCampaignId({
      campaignId: data.campaignId,
      utmCampaign: data.utmCampaign,
      utmSource: data.utmSource,
    });
    const campaign = campaignId
      ? await prisma.campaign.findUnique({ where: { id: campaignId }, select: { channel: true } })
      : null;
    const status = data.status ?? 'NEW';
    if (status === 'CALLBACK' && !data.callbackAt) {
      return res.status(400).json({ success: false, message: 'Tekrar arama zamanı seçilmelidir' });
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email || null,
        source: data.source?.trim() || campaign?.channel || 'Diğer',
        campaignId: campaignId || null,
        status,
        patientId: data.patientId || null,
        description: data.description?.trim() || null,
        callbackAt: data.callbackAt ? new Date(data.callbackAt) : null,
        callbackNote: data.callbackNote || null,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmTerm: data.utmTerm,
        utmContent: data.utmContent,
        fbclid: data.fbclid,
        gclid: data.gclid,
        ttclid: data.ttclid,
        landingPage: data.landingPage,
        referrer: data.referrer,
        externalId: data.externalId,
        rawPayload: data.rawPayload,
      },
      include: { campaign: true, form: true },
    });

    await recordLeadCreated(lead, req.user!.id);
    const refreshed = await prisma.lead.findUnique({ where: { id: lead.id }, include: includeRelations });
    res.status(201).json({ success: true, data: refreshed });
  })
);

router.patch(
  '/:id',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = leadUpdateSchema.parse(req.body);
    const { email, campaignId, patientId, status, callbackAt, callbackNote, description, ...rest } = data;

    if (status === 'CALLBACK' && !callbackAt) {
      return res.status(400).json({ success: false, message: 'Tekrar arama zamanı seçilmelidir' });
    }

    const campaignIdResolved =
      campaignId === undefined
        ? undefined
        : campaignId === null
          ? null
          : await resolveCampaignId({ campaignId, utmCampaign: data.utmCampaign });

    await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(email !== undefined ? { email: email || null } : {}),
        ...(patientId !== undefined ? { patientId } : {}),
        ...(campaignIdResolved !== undefined ? { campaignId: campaignIdResolved } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(callbackAt !== undefined ? { callbackAt: callbackAt ? new Date(callbackAt) : null } : {}),
        ...(callbackNote !== undefined ? { callbackNote: callbackNote || null } : {}),
      },
    });

    if (status) {
      await changeLeadStatus({
        leadId: req.params.id,
        status,
        changedById: req.user!.id,
        note: 'Lead güncelleme ekranından değiştirildi',
        callbackAt: callbackAt !== undefined ? (callbackAt ? new Date(callbackAt) : null) : undefined,
        callbackNote: callbackNote !== undefined ? callbackNote || null : undefined,
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { campaign: true, patient: true },
    });
    res.json({ success: true, data: lead });
  })
);

router.post(
  '/:id/notes',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = leadNoteSchema.parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead bulunamadı' });
    }

    const note = await prisma.leadNote.create({
      data: {
        leadId: req.params.id,
        content: data.content,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json({ success: true, data: note });
  })
);

router.patch(
  '/:id/status',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, note, callbackAt, callbackNote } = z
      .object({ status: leadStatusEnum, note: z.string().optional(), ...callbackFields })
      .parse(req.body);
    if (status === 'CALLBACK' && !callbackAt) {
      return res.status(400).json({ success: false, message: 'Tekrar arama zamanı seçilmelidir' });
    }
    const lead = await changeLeadStatus({
      leadId: req.params.id,
      status,
      changedById: req.user!.id,
      note,
      callbackAt: callbackAt ? new Date(callbackAt) : undefined,
      callbackNote: callbackNote !== undefined ? callbackNote || null : undefined,
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead bulunamadı' });
    }
    const refreshed = await prisma.lead.findUnique({ where: { id: lead.id }, include: includeRelations });
    res.json({ success: true, data: refreshed });
  })
);

export default router;

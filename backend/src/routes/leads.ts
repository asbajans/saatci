import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { changeLeadStatus, recordLeadCreated, resolveCampaignId } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const leadStatusEnum = z.enum(['NEW', 'CONTACTED', 'CLINIC_VISIT', 'TREATMENT_APPROVED', 'APPOINTMENT_BOOKED', 'SOLD']);

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
  ...attributionFields,
});

const leadUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  status: leadStatusEnum.optional(),
  patientId: z.string().uuid().nullable().optional(),
  ...attributionFields,
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
} as const;

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const leads = await prisma.lead.findMany({
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: leads });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        ...includeRelations,
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

    const lead = await prisma.lead.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email || null,
        source: data.source?.trim() || campaign?.channel || 'Diğer',
        campaignId: campaignId || null,
        status,
        patientId: data.patientId || null,
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
    const { email, campaignId, patientId, status, ...rest } = data;

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
      },
    });

    if (status) {
      await changeLeadStatus({
        leadId: req.params.id,
        status,
        changedById: req.user!.id,
        note: 'Lead güncelleme ekranından değiştirildi',
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { campaign: true, patient: true },
    });
    res.json({ success: true, data: lead });
  })
);

router.patch(
  '/:id/status',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, note } = z
      .object({ status: leadStatusEnum, note: z.string().optional() })
      .parse(req.body);
    const lead = await changeLeadStatus({
      leadId: req.params.id,
      status,
      changedById: req.user!.id,
      note,
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead bulunamadı' });
    }
    const refreshed = await prisma.lead.findUnique({ where: { id: lead.id }, include: includeRelations });
    res.json({ success: true, data: refreshed });
  })
);

export default router;

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { resolveCampaignId, recordLeadCreated } from '../lib/tracking';

const router = Router();
export const publicFormsRouter = Router();

const DEFAULT_FIELDS = [
  { key: 'name', label: 'Ad Soyad', type: 'text', required: true },
  { key: 'phone', label: 'Telefon', type: 'tel', required: true },
  { key: 'email', label: 'E-posta', type: 'email', required: false },
  { key: 'message', label: 'Mesajınız', type: 'textarea', required: false },
];

const formSchema = z.object({
  name: z.string().min(2),
  source: z.string().min(1).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  successMessage: z.string().optional(),
  redirectUrl: z.string().url().optional().or(z.literal('')),
  allowedOrigins: z.string().optional(),
  fields: z.array(z.record(z.any())).optional(),
});

const publicLeadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(),
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
  _hp: z.string().optional(),
  _campaignId: z.string().uuid().optional(),
});

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, limit = 12, windowMs = 60000) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function generateToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function serializeForm(form: any) {
  const origin = process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || '';
  return {
    ...form,
    fields: form.fields || DEFAULT_FIELDS,
    publicUrl: origin ? `${origin.replace(/\/$/, '')}/f/${form.token}` : `/f/${form.token}`,
  };
}

router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const forms = await prisma.websiteForm.findMany({
      include: {
        campaign: { select: { id: true, name: true, channel: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: forms.map(serializeForm) });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = formSchema.parse(req.body);
    const form = await prisma.websiteForm.create({
      data: {
        name: data.name.trim(),
        token: generateToken(),
        source: data.source?.trim() || 'Web',
        campaignId: data.campaignId || null,
        isActive: data.isActive ?? true,
        successMessage: data.successMessage?.trim() || undefined,
        redirectUrl: data.redirectUrl || null,
        allowedOrigins: data.allowedOrigins?.trim() || null,
        fields: (data.fields as any) || DEFAULT_FIELDS,
      },
      include: { campaign: true },
    });
    res.status(201).json({ success: true, data: serializeForm(form) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = formSchema.partial().parse(req.body);
    const form = await prisma.websiteForm.update({
      where: { id: req.params.id },
      data: {
        name: data.name?.trim(),
        source: data.source?.trim(),
        campaignId: data.campaignId,
        isActive: data.isActive,
        successMessage: data.successMessage,
        ...(data.redirectUrl !== undefined ? { redirectUrl: data.redirectUrl || null } : {}),
        ...(data.allowedOrigins !== undefined ? { allowedOrigins: data.allowedOrigins || null } : {}),
        fields: (data.fields as any) || undefined,
      },
      include: { campaign: true },
    });
    res.json({ success: true, data: serializeForm(form) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.websiteForm.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

publicFormsRouter.get(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const form = await prisma.websiteForm.findUnique({
      where: { token: req.params.token },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!form || !form.isActive) {
      return res.status(404).json({ success: false, message: 'Form bulunamadı veya kapalı' });
    }

    const trackingIntegrations = await prisma.integration.findMany({
      where: { isActive: true, type: { in: ['META_PIXEL', 'GA4', 'TIKTOK_PIXEL'] } },
      select: { type: true, config: true },
    });
    const { decryptConfig } = await import('../lib/secrets');
    const tracking = { metaPixelId: '', ga4MeasurementId: '', tiktokPixelId: '' };
    for (const integration of trackingIntegrations) {
      const config = decryptConfig(integration.config);
      if (integration.type === 'META_PIXEL' && config.pixelId) tracking.metaPixelId = String(config.pixelId);
      if (integration.type === 'GA4' && config.measurementId) {
        tracking.ga4MeasurementId = String(config.measurementId);
      }
      if (integration.type === 'TIKTOK_PIXEL' && config.pixelId) {
        tracking.tiktokPixelId = String(config.pixelId);
      }
    }

    res.json({
      success: true,
      data: {
        name: form.name,
        source: form.source,
        successMessage: form.successMessage,
        redirectUrl: form.redirectUrl,
        fields: form.fields || DEFAULT_FIELDS,
        campaign: form.campaign,
        tracking,
      },
    });
  })
);

publicFormsRouter.post(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const form = await prisma.websiteForm.findUnique({
      where: { token: req.params.token },
      include: { campaign: { select: { id: true, channel: true } } },
    });
    if (!form || !form.isActive) {
      return res.status(404).json({ success: false, message: 'Form bulunamadı veya kapalı' });
    }

    if (form.allowedOrigins) {
      const origin = req.headers.origin;
      const allowed = form.allowedOrigins
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (origin && allowed.length > 0 && !allowed.includes(origin)) {
        return res.status(403).json({ success: false, message: 'Bu form bu kaynaktan kullanılamaz' });
      }
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (rateLimited(`${form.id}:${ip}`)) {
      return res.status(429).json({ success: false, message: 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.' });
    }

    const data = publicLeadSchema.parse(req.body);
    if (data._hp) {
      return res.json({ success: true, message: form.successMessage, redirectUrl: form.redirectUrl });
    }

    const campaignId =
      (data._campaignId && form.campaignId && data._campaignId === form.campaignId ? data._campaignId : null) ||
      form.campaignId ||
      (await resolveCampaignId({ utmCampaign: data.utmCampaign, utmSource: data.utmSource }));

    const lead = await prisma.lead.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email || null,
        source: form.source || form.campaign?.channel || 'Web',
        campaignId: campaignId || null,
        formId: form.id,
        status: 'NEW',
        externalId: data.externalId,
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
        rawPayload: { ...req.body, message: data.message },
      },
      include: { campaign: true },
    });

    await recordLeadCreated(lead);
    await prisma.inboundEvent.create({
      data: {
        type: 'WEB_FORM',
        externalId: data.externalId,
        payload: { formId: form.id, formName: form.name, ...req.body },
        status: 'PROCESSED',
        leadId: lead.id,
        processedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: form.successMessage || 'Başvurunuz alındı.',
      redirectUrl: form.redirectUrl,
      data: { leadId: lead.id },
    });
  })
);

export default router;

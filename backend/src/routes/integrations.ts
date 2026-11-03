import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, TrackingStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { decryptConfig, encryptConfig, mergeSecrets, redactConfig } from '../lib/secrets';

const router = Router();

const integrationTypeEnum = z.enum([
  'META_PIXEL',
  'META_CAPI',
  'META_LEAD_ADS',
  'META_MESSENGER',
  'INSTAGRAM_DM',
  'WHATSAPP',
  'GOOGLE_ADS',
  'GA4',
  'TIKTOK_PIXEL',
  'CUSTOM_WEBHOOK',
]);

const integrationSchema = z.object({
  name: z.string().min(2),
  type: integrationTypeEnum,
  isActive: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

const REQUIRED_FIELDS: Record<string, string[]> = {
  META_CAPI: ['pixelId', 'accessToken'],
  META_PIXEL: ['pixelId'],
  META_LEAD_ADS: ['pageId', 'pageAccessToken'],
  META_MESSENGER: ['pageId', 'pageAccessToken'],
  INSTAGRAM_DM: ['accountId', 'accessToken'],
  WHATSAPP: ['phoneNumberId', 'accessToken'],
  GOOGLE_ADS: ['customerId', 'conversionActionId'],
  GA4: ['measurementId', 'apiSecret'],
  TIKTOK_PIXEL: ['pixelId', 'accessToken'],
  CUSTOM_WEBHOOK: ['url'],
};

function validateConfig(type: string, config: Record<string, any>) {
  const required = REQUIRED_FIELDS[type] || [];
  return required.filter((key) => !String(config[key] || '').trim());
}

function serializeIntegration(integration: {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  config: Prisma.JsonValue | null;
  lastEventAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { deliveries: number };
}) {
  return {
    ...integration,
    config: redactConfig(decryptConfig(integration.config)),
  };
}

router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const integrations = await prisma.integration.findMany({
      include: { _count: { select: { deliveries: true } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: integrations.map(serializeIntegration) });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = integrationSchema.parse(req.body);
    const config = data.config || {};
    const missing = validateConfig(data.type, config);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Eksik alanlar: ${missing.join(', ')}`,
      });
    }
    const integration = await prisma.integration.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        isActive: data.isActive ?? true,
        config: encryptConfig(config),
      },
    });
    res.status(201).json({ success: true, data: serializeIntegration(integration) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        name: z.string().min(2).optional(),
        isActive: z.boolean().optional(),
        config: z.record(z.any()).optional(),
      })
      .parse(req.body);

    const existing = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Entegrasyon bulunamadı' });
    }

    const nextConfig = data.config
      ? mergeSecrets(decryptConfig(existing.config), data.config)
      : decryptConfig(existing.config);
    const missing = validateConfig(existing.type, nextConfig);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Eksik alanlar: ${missing.join(', ')}`,
      });
    }

    const integration = await prisma.integration.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        isActive: data.isActive,
        ...(data.config ? { config: encryptConfig(nextConfig) } : {}),
      },
    });
    res.json({ success: true, data: serializeIntegration(integration) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.integration.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

router.post(
  '/:id/test',
  asyncHandler(async (req: Request, res: Response) => {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) {
      return res.status(404).json({ success: false, message: 'Entegrasyon bulunamadı' });
    }
    const config = decryptConfig(integration.config);
    const missing = validateConfig(integration.type, config);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Eksik alanlar: ${missing.join(', ')}` });
    }
    if (integration.type === 'GOOGLE_ADS' && !config.webhookUrl) {
      return res.json({
        success: true,
        data: {
          ok: true,
          message:
            'Temel alanlar dolu. Google Ads OAuth/webhook adresi tanımlanmadığı için olaylar gclid ile kaydedilir ve CSV olarak dışa aktarılabilir.',
        },
      });
    }
    if (integration.type === 'META_LEAD_ADS' || integration.type === 'META_MESSENGER') {
      const verifyToken = process.env.META_VERIFY_TOKEN;
      return res.json({
        success: true,
        data: {
          ok: true,
          message: verifyToken
            ? 'Alanlar dolu. Meta webhook doğrulama adresi hazır.'
            : 'Alanlar dolu ancak META_VERIFY_TOKEN ortam değişkeni tanımlanmalı.',
        },
      });
    }
    return res.json({ success: true, data: { ok: true, message: 'Yapılandırma alanları doğrulandı.' } });
  })
);

router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const where: Prisma.ConversionEventWhereInput = {};
    if (req.query.type) where.type = String(req.query.type) as any;
    if (req.query.leadId) where.leadId = String(req.query.leadId);
    if (req.query.campaignId) where.campaignId = String(req.query.campaignId);
    if (req.query.from || req.query.to) {
      where.createdAt = {
        ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
        ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}),
      };
    }
    if (req.query.deliveryStatus) {
      where.deliveries = { some: { status: String(req.query.deliveryStatus) as TrackingStatus } };
    }

    const events = await prisma.conversionEvent.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, source: true } },
        campaign: { select: { id: true, name: true, channel: true, platform: true } },
        deliveries: {
          include: {
            integration: { select: { id: true, name: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 200, 1000),
    });
    res.json({ success: true, data: events });
  })
);

router.get(
  '/conversion-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const [campaigns, histories, events, integrations] = await Promise.all([
      prisma.campaign.findMany({
        include: { _count: { select: { leads: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadStatusHistory.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { campaignId: true, toStatus: true, createdAt: true },
      }),
      prisma.conversionEvent.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          type: true,
          campaignId: true,
          createdAt: true,
          deliveries: { select: { status: true } },
        },
      }),
      prisma.integration.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
          lastEventAt: true,
          lastError: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const byCampaign = campaigns.map((campaign) => {
      const campaignHistories = histories.filter((row) => row.campaignId === campaign.id);
      const stages: Record<string, number> = {};
      for (const row of campaignHistories) {
        stages[row.toStatus] = (stages[row.toStatus] || 0) + 1;
      }
      const campaignEvents = events.filter((row) => row.campaignId === campaign.id);
      return {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        platform: campaign.platform,
        isActive: campaign.isActive,
        leads: campaign._count.leads,
        stages,
        conversions: campaignEvents.length,
        sent: campaignEvents.reduce(
          (sum, event) => sum + event.deliveries.filter((d) => d.status === 'SENT').length,
          0
        ),
        failed: campaignEvents.reduce(
          (sum, event) => sum + event.deliveries.filter((d) => d.status === 'FAILED').length,
          0
        ),
      };
    });

    const byType: Record<string, number> = {};
    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    const deliveryCounts = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const event of events) {
      for (const delivery of event.deliveries) {
        deliveryCounts[delivery.status] += 1;
      }
    }

    res.json({
      success: true,
      data: {
        range: { from: from.toISOString(), to: to.toISOString() },
        totals: {
          events: events.length,
          integrations: integrations.length,
          activeIntegrations: integrations.filter((i) => i.isActive).length,
          deliveries: deliveryCounts,
        },
        byType,
        byCampaign,
        integrations,
      },
    });
  })
);

router.get(
  '/inbound-events',
  asyncHandler(async (req: Request, res: Response) => {
    const where: Prisma.InboundEventWhereInput = {};
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.status) where.status = String(req.query.status);
    const events = await prisma.inboundEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 200, 1000),
    });
    res.json({ success: true, data: events });
  })
);

router.get(
  '/google-ads.csv',
  asyncHandler(async (req: Request, res: Response) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const events = await prisma.conversionEvent.findMany({
      where: {
        lead: { gclid: { not: null } },
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: {
        lead: { select: { gclid: true } },
        campaign: { select: { name: true, externalId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const rows = [
      ['Event Time', 'Google Click ID', 'Conversion Name', 'Value', 'Currency', 'Campaign'],
      ...events.map((event) => [
        event.createdAt.toISOString(),
        event.lead?.gclid || '',
        event.type,
        String(event.value ?? ''),
        event.currency,
        event.campaign?.name || '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="google-ads-donusumler.csv"');
    res.send(`\uFEFF${csv}`);
  })
);

export default router;

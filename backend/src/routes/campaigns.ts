import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

const campaignSchema = z.object({
  name: z.string().min(2),
  channel: z.string().min(1),
  platform: z.string().optional(),
  externalId: z.string().optional(),
  pixelId: z.string().optional(),
  utmCampaign: z.string().optional(),
  notes: z.string().optional(),
  budget: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const campaigns = await prisma.campaign.findMany({
      include: { _count: { select: { leads: true, websiteForms: true, conversionEvents: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: campaigns });
  })
);

router.get(
  '/funnel',
  roleGuard('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [campaigns, histories, events] = await Promise.all([
      prisma.campaign.findMany({
        include: { _count: { select: { leads: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadStatusHistory.findMany({
        select: { campaignId: true, fromStatus: true, toStatus: true, createdAt: true },
      }),
      prisma.conversionEvent.findMany({
        select: {
          campaignId: true,
          type: true,
          createdAt: true,
          deliveries: { select: { status: true } },
        },
      }),
    ]);

    const data = campaigns.map((campaign) => {
      const ownHistories = histories.filter((row) => row.campaignId === campaign.id);
      const stages: Record<string, number> = {};
      for (const row of ownHistories) {
        stages[row.toStatus] = (stages[row.toStatus] || 0) + 1;
      }
      const ownEvents = events.filter((row) => row.campaignId === campaign.id);
      const deliveries = ownEvents.flatMap((event) => event.deliveries);
      return {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        platform: campaign.platform,
        externalId: campaign.externalId,
        utmCampaign: campaign.utmCampaign,
        pixelId: campaign.pixelId,
        budget: Number(campaign.budget || 0),
        isActive: campaign.isActive,
        leads: campaign._count.leads,
        stages,
        conversionEvents: ownEvents.length,
        deliveries: {
          sent: deliveries.filter((d) => d.status === 'SENT').length,
          failed: deliveries.filter((d) => d.status === 'FAILED').length,
          pending: deliveries.filter((d) => d.status === 'PENDING').length,
          skipped: deliveries.filter((d) => d.status === 'SKIPPED').length,
        },
      };
    });

    res.json({ success: true, data });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'SALES'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = campaignSchema.parse(req.body);
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name.trim(),
        channel: data.channel.trim(),
        platform: data.platform?.trim() || null,
        externalId: data.externalId?.trim() || null,
        pixelId: data.pixelId?.trim() || null,
        utmCampaign: data.utmCampaign?.trim() || null,
        notes: data.notes?.trim() || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive ?? true,
      },
    });
    res.status(201).json({ success: true, data: campaign });
  })
);

router.patch(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = campaignSchema.partial().parse(req.body);
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        name: data.name?.trim(),
        channel: data.channel?.trim(),
        platform: data.platform?.trim(),
        externalId: data.externalId?.trim(),
        pixelId: data.pixelId?.trim(),
        utmCampaign: data.utmCampaign?.trim(),
        notes: data.notes?.trim(),
        budget: data.budget ? parseFloat(data.budget) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: campaign });
  })
);

router.delete(
  '/:id',
  roleGuard('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;

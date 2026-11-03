import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { decryptConfig } from '../lib/secrets';
import { recordLeadCreated, resolveCampaignId } from '../lib/tracking';

const router = Router();

const verifyTokenQuery = {
  'hub.mode': 'query',
  'hub.challenge': 'query',
  'hub.verify_token': 'query',
} as const;

async function integrationConfig(type: string) {
  const integration = await prisma.integration.findFirst({
    where: { type: type as any, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return integration ? { integration, config: decryptConfig(integration.config) } : null;
}

async function validVerifyToken(token: string) {
  if (process.env.META_VERIFY_TOKEN && token === process.env.META_VERIFY_TOKEN) return true;
  const leadAds = await integrationConfig('META_LEAD_ADS');
  if (leadAds?.config.verifyToken && token === leadAds.config.verifyToken) return true;
  const messenger = await integrationConfig('META_MESSENGER');
  if (messenger?.config.verifyToken && token === messenger.config.verifyToken) return true;
  const instagram = await integrationConfig('INSTAGRAM_DM');
  if (instagram?.config.verifyToken && token === instagram.config.verifyToken) return true;
  const whatsapp = await integrationConfig('WHATSAPP');
  return !!whatsapp?.config.verifyToken && token === whatsapp.config.verifyToken;
}

function verifySignature(req: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function challengeHandler(req: Request, res: Response) {
  const mode = String(req.query['hub.mode'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  void validVerifyToken(token).then((valid) => {
    if (mode === 'subscribe' && valid) return res.status(200).send(challenge);
    return res.status(403).json({ success: false, message: 'Doğrulama başarısız' });
  });
}

router.get(
  '/meta/leadads',
  asyncHandler(async (req: Request, res: Response) => challengeHandler(req, res))
);
router.get(
  '/meta/messenger',
  asyncHandler(async (req: Request, res: Response) => challengeHandler(req, res))
);
router.get(
  '/meta/instagram',
  asyncHandler(async (req: Request, res: Response) => challengeHandler(req, res))
);
router.get(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => challengeHandler(req, res))
);

function extractPhone(text: string) {
  const match = text.match(/(?:\+?90|0)?[\s.-]?(5\d{2})[\s.-]?(\d{3})[\s.-]?(\d{2})[\s.-]?(\d{2})/);
  if (!match) return '';
  return `0${match[1]}${match[2]}${match[3]}${match[4]}`;
}

type LeadPayload = {
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  externalId?: string | null;
  campaignId?: string | null;
  raw: Record<string, unknown>;
};

async function createInboundLead(payload: LeadPayload) {
  if (!payload.phone || payload.phone.trim().length < 5) return null;
  const campaignId = await resolveCampaignId({ campaignId: payload.campaignId });
  const lead = await prisma.lead.create({
    data: {
      name: payload.name.trim() || 'Meta Lead',
      phone: payload.phone.trim(),
      email: payload.email || null,
      source: payload.source,
      campaignId: campaignId || null,
      externalId: payload.externalId || null,
      status: 'NEW',
      rawPayload: payload.raw as any,
    },
  });
  await recordLeadCreated(lead);
  return lead;
}

async function logInbound(
  type: string,
  externalId: string | null,
  payload: unknown,
  result: { status: string; error?: string; leadId?: string | null }
) {
  await prisma.inboundEvent.create({
    data: {
      type,
      externalId,
      payload: payload as any,
      status: result.status,
      error: result.error,
      leadId: result.leadId || null,
      processedAt: new Date(),
    },
  });
}

async function processLeadAds(body: any) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'leadgen') continue;
      const value = change.value || {};
      const leadgenId = String(value.leadgen_id || '');
      if (!leadgenId) continue;

      const existing = await prisma.inboundEvent.findFirst({
        where: { type: 'META_LEAD_ADS', externalId: leadgenId, status: 'PROCESSED' },
      });
      if (existing) continue;

      const configInfo = await integrationConfig('META_LEAD_ADS');
      const accessToken =
        configInfo?.config.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
      if (!accessToken) {
        await logInbound('META_LEAD_ADS', leadgenId, body, {
          status: 'PENDING',
          error: 'Meta Lead Ads için Page Access Token tanımlanmalı',
        });
        continue;
      }

      try {
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(
            String(accessToken)
          )}`
        );
        const data = (await response.json()) as any;
        if (!response.ok) throw new Error(data?.error?.message || `Meta API hatası (${response.status})`);

        const fieldMap: Record<string, string> = {};
        for (const field of data.field_data || []) {
          const key = String(field.name || '');
          const value = Array.isArray(field.values) ? field.values[0] : field.values;
          if (key && value) fieldMap[key] = String(value);
        }
        const fullName =
          fieldMap.full_name ||
          [fieldMap.first_name, fieldMap.last_name].filter(Boolean).join(' ') ||
          'Meta Lead';
        const phone = fieldMap.phone_number || fieldMap.phone || '';
        const email = fieldMap.email || fieldMap.email_address || null;

        let campaignId = configInfo?.config.campaignId || null;
        if (!campaignId && value.ad_id) {
          const campaign = await prisma.campaign.findFirst({
            where: { externalId: String(value.ad_id) },
            select: { id: true },
          });
          campaignId = campaign?.id || null;
        }

        const lead = await createInboundLead({
          name: fullName,
          phone,
          email,
          source: 'Meta Lead Ads',
          externalId: leadgenId,
          campaignId,
          raw: { value, field_data: data.field_data, form_id: data.form_id },
        });
        await logInbound('META_LEAD_ADS', leadgenId, body, {
          status: lead ? 'PROCESSED' : 'FAILED',
          error: lead ? undefined : 'Telefon numarası bulunamadı',
          leadId: lead?.id,
        });
      } catch (error) {
        await logInbound('META_LEAD_ADS', leadgenId, body, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

async function processMessaging(body: any, type: 'META_MESSENGER' | 'INSTAGRAM_DM') {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
    for (const item of messaging) {
      const messageId = String(item?.message?.mid || '');
      if (!messageId) continue;
      const existing = await prisma.inboundEvent.findFirst({
        where: { type, externalId: messageId, status: 'PROCESSED' },
      });
      if (existing) continue;

      const text = String(item?.message?.text || '');
      const phone = extractPhone(text);
      const configInfo = await integrationConfig(type);
      const lead = phone
        ? await createInboundLead({
            name: type === 'INSTAGRAM_DM' ? 'Instagram DM' : 'Messenger DM',
            phone,
            source: type === 'INSTAGRAM_DM' ? 'Instagram' : 'Facebook',
            externalId: messageId,
            campaignId: configInfo?.config.campaignId || null,
            raw: item,
          })
        : null;

      await logInbound(type, messageId, body, {
        status: lead ? 'PROCESSED' : 'IGNORED',
        error: lead ? undefined : 'Mesajda telefon numarası bulunamadı; yalnızca olay kaydedildi',
        leadId: lead?.id,
      });
    }
  }
}

async function processWhatsApp(body: any) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      for (const message of messages) {
        const messageId = String(message?.id || '');
        if (!messageId) continue;
        const existing = await prisma.inboundEvent.findFirst({
          where: { type: 'WHATSAPP', externalId: messageId, status: 'PROCESSED' },
        });
        if (existing) continue;

        const phone = String(message?.from || '');
        const contact = contacts.find((c: any) => c?.wa_id === phone);
        const configInfo = await integrationConfig('WHATSAPP');
        const lead = await createInboundLead({
          name: contact?.profile?.name || 'WhatsApp Lead',
          phone,
          source: 'WhatsApp',
          externalId: messageId,
          campaignId: configInfo?.config.campaignId || null,
          raw: message,
        });
        await logInbound('WHATSAPP', messageId, body, {
          status: lead ? 'PROCESSED' : 'FAILED',
          error: lead ? undefined : 'Telefon numarası bulunamadı',
          leadId: lead?.id,
        });
      }
    }
  }
}

router.post(
  '/meta/leadads',
  asyncHandler(async (req: Request, res: Response) => {
    if (!verifySignature(req)) {
      return res.status(403).json({ success: false, message: 'Meta imzası doğrulanamadı' });
    }
    await processLeadAds(req.body);
    res.sendStatus(200);
  })
);

router.post(
  '/meta/messenger',
  asyncHandler(async (req: Request, res: Response) => {
    if (!verifySignature(req)) {
      return res.status(403).json({ success: false, message: 'Meta imzası doğrulanamadı' });
    }
    await logInbound('META_MESSENGER', null, req.body, { status: 'PENDING' });
    await processMessaging(req.body, 'META_MESSENGER');
    res.sendStatus(200);
  })
);

router.post(
  '/meta/instagram',
  asyncHandler(async (req: Request, res: Response) => {
    if (!verifySignature(req)) {
      return res.status(403).json({ success: false, message: 'Meta imzası doğrulanamadı' });
    }
    await processMessaging(req.body, 'INSTAGRAM_DM');
    res.sendStatus(200);
  })
);

router.post(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    if (!verifySignature(req)) {
      return res.status(403).json({ success: false, message: 'Meta imzası doğrulanamadı' });
    }
    await processWhatsApp(req.body);
    res.sendStatus(200);
  })
);

export default router;

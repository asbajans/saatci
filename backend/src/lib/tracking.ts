import crypto from 'crypto';
import { ConversionEventType, IntegrationType, LeadStatus, Prisma, TrackingStatus } from '@prisma/client';
import { prisma } from './prisma';
import { decryptConfig } from './secrets';
import { graphRequest } from './graph';

const OUTBOUND_TYPES: IntegrationType[] = [
  IntegrationType.META_CAPI,
  IntegrationType.GOOGLE_ADS,
  IntegrationType.GA4,
  IntegrationType.TIKTOK_PIXEL,
  IntegrationType.CUSTOM_WEBHOOK,
];

const statusToEvent: Partial<Record<LeadStatus, ConversionEventType>> = {
  CONTACTED: ConversionEventType.LEAD_CONTACTED,
  APPOINTMENT_BOOKED: ConversionEventType.APPOINTMENT_BOOKED,
  CLINIC_VISIT: ConversionEventType.CLINIC_VISIT,
  TREATMENT_APPROVED: ConversionEventType.TREATMENT_APPROVED,
  SOLD: ConversionEventType.SALE,
};

const META_EVENT_NAMES: Record<ConversionEventType, string> = {
  LEAD_CREATED: 'Lead',
  LEAD_CONTACTED: 'Contact',
  APPOINTMENT_BOOKED: 'Schedule',
  CLINIC_VISIT: 'ClinicVisit',
  TREATMENT_APPROVED: 'TreatmentApproved',
  SALE: 'Purchase',
  PAYMENT_RECEIVED: 'PaymentReceived',
};

const GA4_EVENT_NAMES: Record<ConversionEventType, string> = {
  LEAD_CREATED: 'generate_lead',
  LEAD_CONTACTED: 'contact',
  APPOINTMENT_BOOKED: 'schedule_appointment',
  CLINIC_VISIT: 'clinic_visit',
  TREATMENT_APPROVED: 'treatment_approved',
  SALE: 'purchase',
  PAYMENT_RECEIVED: 'payment_received',
};

const TIKTOK_EVENT_NAMES: Record<ConversionEventType, string> = {
  LEAD_CREATED: 'SubmitForm',
  LEAD_CONTACTED: 'Contact',
  APPOINTMENT_BOOKED: 'Schedule',
  CLINIC_VISIT: 'ViewContent',
  TREATMENT_APPROVED: 'SubmitForm',
  SALE: 'CompletePayment',
  PAYMENT_RECEIVED: 'CompletePayment',
};

type TrackingContext = {
  type: ConversionEventType;
  leadId?: string | null;
  campaignId?: string | null;
  appointmentId?: string | null;
  patientId?: string | null;
  planId?: string | null;
  invoiceId?: string | null;
  value?: number | string | null;
  currency?: string;
  payload?: Record<string, unknown>;
};

type SendResult = {
  response?: unknown;
  skipped?: boolean;
  reason?: string;
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const normalizePhone = (phone?: string | null) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0')) return `90${digits.slice(1)}`;
  return `90${digits}`;
};

async function fetchJson(url: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // Keep plain text response
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function sendToIntegration(
  integration: { type: IntegrationType; config: Prisma.JsonValue | null },
  event: {
    id: string;
    type: ConversionEventType;
    value: Prisma.Decimal | null;
    currency: string;
    createdAt: Date;
    campaignId: string | null;
    lead: {
      id: string;
      name: string;
      phone: string;
      email: string | null;
      externalId?: string | null;
      source?: string | null;
      fbclid: string | null;
      gclid: string | null;
      ttclid: string | null;
      landingPage: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
    } | null;
    campaign: { id: string; name: string; externalId: string | null; channel: string } | null;
    payload: Prisma.JsonValue | null;
  }
): Promise<SendResult> {
  const config = decryptConfig(integration.config);
  const value = Number(event.value || 0);
  const lead = event.lead;
  const campaign = event.campaign;

  switch (integration.type) {
    case IntegrationType.META_CAPI: {
      const pixelId = String(config.pixelId || '').trim();
      const accessToken = String(config.accessToken || '').trim();
      if (!pixelId || !accessToken) {
        throw new Error('Meta CAPI için Pixel ID ve Access Token zorunludur');
      }
      const userData: Record<string, string> = {};
      if (lead?.email) userData.em = sha256(normalizeEmail(lead.email));
      if (lead?.phone) userData.ph = sha256(normalizePhone(lead.phone));
      if (lead?.externalId && lead.source === 'Meta Lead Ads') {
        userData.lead_id = String(lead.externalId);
      }
      if (lead?.fbclid) userData.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;
      const customData: Record<string, unknown> = {
        currency: event.currency,
        value,
        campaign_id: campaign?.externalId || campaign?.id || event.campaignId,
        campaign_name: campaign?.name,
        lead_event_source: 'Saatçi CRM',
        event_source: 'crm',
        utm_source: lead?.utmSource,
        utm_medium: lead?.utmMedium,
        utm_campaign: lead?.utmCampaign,
      };
      const body: Record<string, unknown> = {
        data: [
          {
            event_name: META_EVENT_NAMES[event.type],
            event_time: Math.floor(event.createdAt.getTime() / 1000),
            event_id: event.id,
            action_source: 'system_generated',
            user_data: userData,
            custom_data: customData,
          },
        ],
        access_token: accessToken,
      };
      if (config.testEventCode) body.test_event_code = config.testEventCode;
      const response = await graphRequest({
        method: 'POST',
        path: `${encodeURIComponent(pixelId)}/events`,
        body,
        timeoutMs: 15000,
      });
      return { response };
    }

    case IntegrationType.GA4: {
      const measurementId = String(config.measurementId || '').trim();
      const apiSecret = String(config.apiSecret || '').trim();
      if (!measurementId || !apiSecret) {
        throw new Error('GA4 için Measurement ID ve API Secret zorunludur');
      }
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
        measurementId
      )}&api_secret=${encodeURIComponent(apiSecret)}`;
      const body = {
        client_id: lead?.id || event.id,
        events: [
          {
            name: GA4_EVENT_NAMES[event.type],
            params: {
              event_id: event.id,
              value,
              currency: event.currency,
              campaign_id: campaign?.id || event.campaignId,
              campaign_name: campaign?.name,
              lead_id: lead?.id,
              utm_source: lead?.utmSource,
              utm_medium: lead?.utmMedium,
              utm_campaign: lead?.utmCampaign,
            },
          },
        ],
      };
      const response = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { response };
    }

    case IntegrationType.TIKTOK_PIXEL: {
      const pixelId = String(config.pixelId || '').trim();
      const accessToken = String(config.accessToken || '').trim();
      if (!pixelId || !accessToken) {
        throw new Error('TikTok Pixel için Pixel ID ve Access Token zorunludur');
      }
      const body = {
        event_source: 'web',
        event_source_id: pixelId,
        data: [
          {
            event: TIKTOK_EVENT_NAMES[event.type],
            event_time: Math.floor(event.createdAt.getTime() / 1000),
            event_id: event.id,
            user: {
              email: lead?.email ? sha256(normalizeEmail(lead.email)) : undefined,
              phone: lead?.phone ? sha256(normalizePhone(lead.phone)) : undefined,
              external_id: lead?.id ? sha256(lead.id) : undefined,
              ttclid: lead?.ttclid || undefined,
            },
            properties: {
              value,
              currency: event.currency,
              content_name: campaign?.name,
              campaign_id: campaign?.externalId || campaign?.id || event.campaignId,
            },
          },
        ],
      };
      const response = await fetchJson('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify(body),
      });
      return { response };
    }

    case IntegrationType.GOOGLE_ADS: {
      const webhookUrl = String(config.webhookUrl || '').trim();
      if (!webhookUrl) {
        return {
          skipped: true,
          reason: 'Google Ads API OAuth bağlantısı yapılandırılmadı. Olay gclid ile kaydedildi; CSV dışa aktarımı kullanılabilir.',
        };
      }
      const response = await fetchJson(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret ? { 'X-Webhook-Secret': String(config.secret) } : {}),
        },
        body: JSON.stringify({
          event_id: event.id,
          event_type: event.type,
          occurred_at: event.createdAt.toISOString(),
          gclid: lead?.gclid,
          value,
          currency: event.currency,
          campaign: campaign
            ? { id: campaign.id, external_id: campaign.externalId, name: campaign.name, channel: campaign.channel }
            : null,
          lead: lead ? { id: lead.id } : null,
        }),
      });
      return { response };
    }

    case IntegrationType.CUSTOM_WEBHOOK: {
      const url = String(config.url || '').trim();
      if (!url) throw new Error('Webhook URL zorunludur');
      const response = await fetchJson(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret ? { 'X-Webhook-Secret': String(config.secret) } : {}),
        },
        body: JSON.stringify({
          event_id: event.id,
          event_type: event.type,
          occurred_at: event.createdAt.toISOString(),
          value,
          currency: event.currency,
          lead: lead
            ? {
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                utm_source: lead.utmSource,
                utm_medium: lead.utmMedium,
                utm_campaign: lead.utmCampaign,
                fbclid: lead.fbclid,
                gclid: lead.gclid,
                ttclid: lead.ttclid,
              }
            : null,
          campaign: campaign
            ? { id: campaign.id, external_id: campaign.externalId, name: campaign.name, channel: campaign.channel }
            : null,
          payload: event.payload,
        }),
      });
      return { response };
    }

    default:
      return { skipped: true, reason: 'Bu entegrasyon türü giden dönüşüm gönderimi desteklemiyor' };
  }
}

export async function dispatchDelivery(deliveryId: string) {
  const delivery = await prisma.integrationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      integration: true,
      event: {
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              externalId: true,
              source: true,
              fbclid: true,
              gclid: true,
              ttclid: true,
              landingPage: true,
              utmSource: true,
              utmMedium: true,
              utmCampaign: true,
            },
          },
          campaign: { select: { id: true, name: true, externalId: true, channel: true } },
        },
      },
    },
  });
  if (!delivery || delivery.status !== TrackingStatus.PENDING) return;

  try {
    const result = await sendToIntegration(delivery.integration, delivery.event);
    const status = result.skipped ? TrackingStatus.SKIPPED : TrackingStatus.SENT;
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
        response: (result.response as Prisma.InputJsonValue | undefined) ?? undefined,
        error: result.reason,
        sentAt: result.skipped ? null : new Date(),
      },
    });
    await prisma.integration.update({
      where: { id: delivery.integrationId },
      data: result.skipped
        ? { lastError: result.reason }
        : { lastEventAt: new Date(), lastError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: { status: TrackingStatus.FAILED, error: message },
    });
    await prisma.integration.update({
      where: { id: delivery.integrationId },
      data: { lastError: message },
    });
  }
}

export async function logConversionEvent(context: TrackingContext) {
  const event = await prisma.conversionEvent.create({
    data: {
      type: context.type,
      leadId: context.leadId || null,
      campaignId: context.campaignId || null,
      appointmentId: context.appointmentId || null,
      patientId: context.patientId || null,
      planId: context.planId || null,
      invoiceId: context.invoiceId || null,
      value: context.value === undefined || context.value === null ? null : Number(context.value),
      currency: context.currency || 'TRY',
      payload: (context.payload as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  try {
    const integrations = await prisma.integration.findMany({
      where: { isActive: true, type: { in: OUTBOUND_TYPES } },
      select: { id: true },
    });
    if (integrations.length > 0) {
      await prisma.integrationDelivery.createMany({
        data: integrations.map((integration) => ({
          eventId: event.id,
          integrationId: integration.id,
        })),
      });
      const deliveries = await prisma.integrationDelivery.findMany({
        where: { eventId: event.id, status: TrackingStatus.PENDING },
        select: { id: true },
      });
      for (const delivery of deliveries) {
        void dispatchDelivery(delivery.id);
      }
    }
  } catch (error) {
    console.error('[tracking] dönüşüm olayı dağıtılamadı', error);
  }

  return event;
}

export async function resolveCampaignId(params: {
  campaignId?: string | null;
  utmCampaign?: string | null;
  utmSource?: string | null;
}) {
  if (params.campaignId) return params.campaignId;
  const utmCampaign = params.utmCampaign?.trim();
  if (!utmCampaign) return null;
  const campaign = await prisma.campaign.findFirst({
    where: {
      OR: [
        { utmCampaign: { equals: utmCampaign, mode: 'insensitive' } },
        { name: { equals: utmCampaign, mode: 'insensitive' } },
        { externalId: { equals: utmCampaign, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return campaign?.id || null;
}

export async function recordLeadCreated(
  lead: {
    id: string;
    status: LeadStatus;
    campaignId: string | null;
    patientId: string | null;
    name: string;
    phone: string;
    email: string | null;
  },
  changedById?: string | null
) {
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      campaignId: lead.campaignId,
      fromStatus: null,
      toStatus: lead.status,
      changedById: changedById || null,
      note: 'Lead oluşturuldu',
    },
  });

  await logConversionEvent({
    type: ConversionEventType.LEAD_CREATED,
    leadId: lead.id,
    campaignId: lead.campaignId,
    patientId: lead.patientId,
    payload: { name: lead.name, phone: lead.phone, email: lead.email, status: lead.status },
  });

  if (lead.status !== 'NEW') {
    const type = statusToEvent[lead.status];
    if (type) {
      await logConversionEvent({
        type,
        leadId: lead.id,
        campaignId: lead.campaignId,
        patientId: lead.patientId,
        payload: { status: lead.status },
      });
    }
  }
}

export async function changeLeadStatus(params: {
  leadId: string;
  status: LeadStatus;
  changedById?: string | null;
  note?: string;
  value?: number | string | null;
  appointmentId?: string | null;
  planId?: string | null;
  invoiceId?: string | null;
  payload?: Record<string, unknown>;
  callbackAt?: Date | null;
  callbackNote?: string | null;
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: { campaign: { select: { id: true, name: true, channel: true } } },
  });
  if (!lead) return null;

  const fromStatus = lead.status;
  const statusChanged = fromStatus !== params.status;
  const hasCallbackUpdate = params.callbackAt !== undefined || params.callbackNote !== undefined;
  if (!statusChanged && !hasCallbackUpdate) return lead;

  const callbackData =
    params.status === 'CALLBACK'
      ? {
          ...(params.callbackAt !== undefined ? { callbackAt: params.callbackAt } : {}),
          ...(params.callbackNote !== undefined ? { callbackNote: params.callbackNote } : {}),
        }
      : { callbackAt: null, callbackNote: null };

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: params.status,
      ...(params.status === 'CONTACTED' ? { lastContactAt: new Date() } : {}),
      ...callbackData,
    },
  });

  if (!statusChanged) return updated;

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      campaignId: updated.campaignId,
      fromStatus,
      toStatus: params.status,
      changedById: params.changedById || null,
      note: params.note,
    },
  });

  const eventType = statusToEvent[params.status];
  if (eventType) {
    await logConversionEvent({
      type: eventType,
      leadId: lead.id,
      campaignId: updated.campaignId,
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      planId: params.planId,
      invoiceId: params.invoiceId,
      value: params.value,
      payload: {
        fromStatus,
        toStatus: params.status,
        campaign: lead.campaign?.name,
        ...(params.payload || {}),
      },
    });
  }

  return updated;
}

const STATUS_ORDER: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.CALLBACK,
  LeadStatus.PRICE_HIGH,
  LeadStatus.APPOINTMENT_BOOKED,
  LeadStatus.CLINIC_VISIT,
  LeadStatus.TREATMENT_APPROVED,
  LeadStatus.SOLD,
];

function statusesBelow(target: LeadStatus) {
  const index = STATUS_ORDER.indexOf(target);
  return index > 0 ? STATUS_ORDER.slice(0, index) : [];
}

export async function changePatientLeadStatuses(params: {
  patientId: string;
  status: LeadStatus;
  changedById?: string | null;
  note?: string;
  value?: number | string | null;
  planId?: string | null;
}) {
  const leads = await prisma.lead.findMany({
    where: { patientId: params.patientId, status: { in: statusesBelow(params.status) } },
    select: { id: true },
  });
  for (const lead of leads) {
    await changeLeadStatus({
      leadId: lead.id,
      status: params.status,
      changedById: params.changedById,
      note: params.note,
      value: params.value,
      planId: params.planId,
    });
  }
}

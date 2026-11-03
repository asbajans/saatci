import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { recordLeadCreated } from './tracking';

const META_VERSION = 'v20.0';

async function metaRequest(accessToken: string, path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ access_token: accessToken, ...params });
  let url = `https://graph.facebook.com/${META_VERSION}/${path}?${qs}`;
  let all: any[] = [];

  for (let i = 0; i < 10; i += 1) {
    const res = await fetch(url);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // keep plain text
    }
    if (!res.ok) {
      throw new Error(`Meta Graph API hatası (${res.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    const data = body as any;
    if (Array.isArray(data?.data)) all.push(...data.data);
    const next = data?.paging?.next;
    if (!next) break;
    url = next;
  }
  return all;
}

function parseFieldData(fieldData: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of fieldData || []) {
    const name = String(item?.name || '');
    if (!name) continue;
    const values = Array.isArray(item?.values) ? item.values : [item?.values];
    out[name] = values.filter(Boolean).join(', ');
  }
  return out;
}

function leadName(fields: Record<string, string>, lead: any): string {
  return (
    fields.full_name ||
    [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
    lead.ad_name ||
    'Meta Lead'
  );
}

function leadPhone(fields: Record<string, string>): string {
  return fields.phone_number || fields.phone || fields.msisdn || '';
}

function leadEmail(fields: Record<string, string>): string | null {
  return fields.email || fields.email_address || null;
}

export async function syncMetaCampaigns(params: {
  accessToken?: string | null;
  adAccountId?: string | null;
}) {
  const accessToken = params.accessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const adAccountId = params.adAccountId || process.env.META_AD_ACCOUNT_ID;

  if (!accessToken) throw new Error('Meta sayfa erişim tokenı tanımlı değil');
  if (!adAccountId) throw new Error('Meta reklam hesabı ID tanımlı değil (META_AD_ACCOUNT_ID)');

  const campaigns = await metaRequest(accessToken, `act_${adAccountId}/campaigns`, {
    fields: 'id,name,status,effective_status,created_time,updated_time',
    limit: '1000',
  });

  let upserted = 0;
  for (const c of campaigns) {
    const externalId = String(c.id || '');
    if (!externalId) continue;
    const existing = await prisma.campaign.findFirst({ where: { externalId } });
    const isActive = c.status === 'ACTIVE' || c.effective_status === 'ACTIVE';
    if (existing) {
      await prisma.campaign.update({
        where: { id: existing.id },
        data: {
          name: c.name || existing.name,
          channel: 'Meta',
          platform: 'Meta',
          utmCampaign: c.name || existing.utmCampaign,
          isActive,
        },
      });
    } else {
      await prisma.campaign.create({
        data: {
          externalId,
          name: c.name || 'Meta Kampanya',
          channel: 'Meta',
          platform: 'Meta',
          utmCampaign: c.name,
          isActive,
        },
      });
    }
    upserted += 1;
  }

  return { campaigns: upserted };
}

export async function syncMetaLeads(params: {
  accessToken?: string | null;
  adAccountId?: string | null;
}) {
  const accessToken = params.accessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const adAccountId = params.adAccountId || process.env.META_AD_ACCOUNT_ID;

  if (!accessToken) throw new Error('Meta sayfa erişim tokenı tanımlı değil');
  if (!adAccountId) throw new Error('Meta reklam hesabı ID tanımlı değil (META_AD_ACCOUNT_ID)');

  const leads = await metaRequest(accessToken, `act_${adAccountId}/leads`, {
    fields: 'id,created_time,ad_id,ad_name,campaign_id,campaign_name,form_id,form_name,platform,field_data{name,values}',
    limit: '1000',
  });

  let created = 0;
  let updated = 0;

  for (const lead of leads) {
    const externalId = String(lead.id || '');
    if (!externalId) continue;

    const fields = parseFieldData(lead.field_data);
    const name = leadName(fields, lead).trim();
    const phone = leadPhone(fields);
    if (!phone || phone.length < 5) continue;

    let campaignId: string | null = null;
    if (lead.campaign_id) {
      const campaign = await prisma.campaign.findFirst({
        where: { externalId: String(lead.campaign_id) },
      });
      if (campaign) {
        campaignId = campaign.id;
      } else {
        const newCampaign = await prisma.campaign.create({
          data: {
            externalId: String(lead.campaign_id),
            name: lead.campaign_name || 'Meta Kampanya',
            channel: 'Meta',
            platform: 'Meta',
            utmCampaign: lead.campaign_name,
            isActive: true,
          },
        });
        campaignId = newCampaign.id;
      }
    }

    const payload: Prisma.InputJsonValue = {
      ...lead,
      field_data: lead.field_data,
      parsed_fields: fields,
    };

    const existing = await prisma.lead.findFirst({
      where: { externalId, source: 'Meta Lead Ads' },
      select: { id: true, campaignId: true },
    });

    const data: any = {
      name,
      phone,
      email: leadEmail(fields),
      source: 'Meta Lead Ads',
      campaignId,
      status: 'NEW',
      externalId,
      utmSource: fields.utm_source,
      utmMedium: fields.utm_medium,
      utmCampaign: fields.utm_campaign || lead.campaign_name,
      utmTerm: fields.utm_term,
      utmContent: fields.utm_content,
      fbclid: fields.fbclid,
      gclid: fields.gclid,
      ttclid: fields.ttclid,
      landingPage: fields.landing_page || fields.landing_page_url,
      referrer: fields.referrer,
      rawPayload: payload,
    };

    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          campaignId: data.campaignId ?? existing.campaignId,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          fbclid: data.fbclid,
          gclid: data.gclid,
          ttclid: data.ttclid,
          landingPage: data.landingPage,
          referrer: data.referrer,
          rawPayload: data.rawPayload,
        },
      });
      updated += 1;
      continue;
    }

    const newLead = await prisma.lead.create({
      data,
      include: { campaign: true },
    });

    await recordLeadCreated(
      {
        id: newLead.id,
        status: newLead.status,
        campaignId: newLead.campaignId,
        patientId: newLead.patientId,
        name: newLead.name,
        phone: newLead.phone,
        email: newLead.email,
      },
      undefined
    );

    await prisma.inboundEvent.create({
      data: {
        type: 'META_LEAD_ADS',
        externalId,
        status: 'PROCESSED',
        leadId: newLead.id,
        processedAt: new Date(),
        payload,
      },
    });

    created += 1;
  }

  return { created, updated };
}

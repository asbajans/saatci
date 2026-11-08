import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { recordLeadCreated } from './tracking';
import { graphGetAll, graphRequest, normalizeAdAccountId } from './graph';
import {
  fieldMappingsFromQuestions,
  parseFieldData,
  resolveEmail,
  resolveName,
  resolvePhone,
  summarizeFieldKeys,
} from './leadFields';

export type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string; username?: string } | null;
};

export type MetaAdAccount = {
  id: string;
  account_id?: string;
  name?: string;
  account_status?: number;
  currency?: string;
};

export type MetaPixel = {
  id: string;
  name?: string;
};

function metaToken(override?: string | null) {
  return (
    override?.trim() ||
    process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
    process.env.META_ACCESS_TOKEN?.trim() ||
    ''
  );
}


export async function getMetaPages(accessToken: string): Promise<MetaPage[]> {
  return graphGetAll<MetaPage>({
    path: 'me/accounts',
    accessToken,
    params: { fields: 'id,name,access_token,tasks,instagram_business_account{id,username}', limit: 100 },
  });
}

export async function getMetaPage(accessToken: string, pageId: string): Promise<MetaPage> {
  return graphRequest<MetaPage>({
    path: pageId,
    accessToken,
    params: { fields: 'id,name,access_token,instagram_business_account{id,username}' },
  });
}

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  return graphGetAll<MetaAdAccount>({
    path: 'me/adaccounts',
    accessToken,
    params: { fields: 'id,account_id,name,account_status,currency', limit: 100 },
  });
}

export async function getMetaPixels(accessToken: string, adAccountId: string): Promise<MetaPixel[]> {
  const normalized = normalizeAdAccountId(adAccountId);
  if (!normalized) return [];
  try {
    return await graphGetAll<MetaPixel>({
      path: `act_${normalized}/adspixels`,
      accessToken,
      params: { fields: 'id,name', limit: 100 },
    });
  } catch {
    return [];
  }
}

export async function resolveMetaPageId(accessToken: string, pageId?: string | null) {
  const explicit = String(pageId || process.env.META_PAGE_ID || '').trim();
  if (explicit) return explicit;
  const pages = await getMetaPages(accessToken);
  if (pages.length > 0) return pages[0].id;
  const me = await graphRequest<{ id: string; name?: string }>({
    path: 'me',
    accessToken,
    params: { fields: 'id,name' },
  });
  return me.id;
}

export async function resolveMetaAdAccountId(accessToken: string, adAccountId?: string | null) {
  const explicit = normalizeAdAccountId(adAccountId || process.env.META_AD_ACCOUNT_ID);
  if (explicit) return explicit;
  const accounts = await getMetaAdAccounts(accessToken);
  const first = accounts[0];
  return normalizeAdAccountId(first?.account_id || first?.id || '');
}

export async function syncMetaCampaigns(params: {
  accessToken?: string | null;
  adAccountId?: string | null;
}) {
  const accessToken = metaToken(params.accessToken);
  if (!accessToken) throw new Error('Meta sayfa erişim tokenı tanımlı değil');

  const adAccountId = await resolveMetaAdAccountId(accessToken, params.adAccountId);
  if (!adAccountId) throw new Error('Meta reklam hesabı bulunamadı (META_AD_ACCOUNT_ID veya token yetkileri)');

  const campaigns = await graphGetAll<any>({
    path: `act_${adAccountId}/campaigns`,
    accessToken,
    params: { fields: 'id,name,status,effective_status,created_time,updated_time', limit: 500 },
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

  return { campaigns: upserted, adAccountId };
}

export async function syncMetaLeads(params: {
  accessToken?: string | null;
  pageId?: string | null;
  adAccountId?: string | null;
}) {
  const accessToken = metaToken(params.accessToken);
  if (!accessToken) throw new Error('Meta sayfa erişim tokenı tanımlı değil');

  const pageId = await resolveMetaPageId(accessToken, params.pageId);
  const adAccountId = await resolveMetaAdAccountId(accessToken, params.adAccountId).catch(() => '');
  const warnings: string[] = [];

  let forms: any[] = [];
  try {
    forms = await graphGetAll<any>({
      path: `${pageId}/leadgen_forms`,
      accessToken,
      params: { fields: 'id,name,status,leads_count,created_time,questions', limit: 100 },
    });
  } catch {
    forms = await graphGetAll<any>({
      path: `${pageId}/leadgen_forms`,
      accessToken,
      params: { fields: 'id,name,status,leads_count,created_time', limit: 100 },
    });
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let scanned = 0;

  for (const form of forms) {
    const formId = String(form.id || '');
    if (!formId) continue;
    const mappings = fieldMappingsFromQuestions(form.questions);
    let leads: any[] = [];
    try {
      leads = await graphGetAll<any>({
        path: `${formId}/leads`,
        accessToken,
        params: {
          fields:
            'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,platform,is_organic,field_data',
          limit: 100,
        },
      });
    } catch (error) {
      warnings.push(
        `${form.name || formId}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    for (const lead of leads) {
      scanned += 1;
      const externalId = String(lead.id || '');
      if (!externalId) continue;

      const fields = parseFieldData(lead.field_data);
      const name = (resolveName(fields, mappings) || lead.ad_name || 'Meta Lead').trim();
      const phone = resolvePhone(fields, mappings.phone).trim();
      if (!phone || phone.length < 5) {
        warnings.push(`${externalId}: telefon numarası bulunamadı (alanlar: ${summarizeFieldKeys(fields)})`);
        continue;
      }

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
        page_id: pageId,
        ad_account_id: adAccountId || null,
      };

      const existing = await prisma.lead.findFirst({
        where: { externalId, source: 'Meta Lead Ads' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          campaignId: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          fbclid: true,
          gclid: true,
          ttclid: true,
          landingPage: true,
          referrer: true,
        },
      });

      const data: any = {
        name,
        phone,
        email: resolveEmail(fields, mappings.email),
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
        const nextCampaignId = data.campaignId ?? existing.campaignId;
        const changed =
          data.name !== existing.name ||
          data.phone !== existing.phone ||
          (data.email ?? null) !== (existing.email ?? null) ||
          nextCampaignId !== existing.campaignId ||
          (data.utmSource ?? null) !== (existing.utmSource ?? null) ||
          (data.utmMedium ?? null) !== (existing.utmMedium ?? null) ||
          (data.utmCampaign ?? null) !== (existing.utmCampaign ?? null) ||
          (data.fbclid ?? null) !== (existing.fbclid ?? null) ||
          (data.gclid ?? null) !== (existing.gclid ?? null) ||
          (data.ttclid ?? null) !== (existing.ttclid ?? null) ||
          (data.landingPage ?? null) !== (existing.landingPage ?? null) ||
          (data.referrer ?? null) !== (existing.referrer ?? null);

        if (!changed) {
          unchanged += 1;
          continue;
        }

        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            phone: data.phone,
            email: data.email,
            campaignId: nextCampaignId,
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

      const processed = await prisma.inboundEvent.findFirst({
        where: { type: 'META_LEAD_ADS', externalId },
      });
      if (!processed) {
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
      }

      created += 1;
    }
  }

  return {
    created,
    updated,
    unchanged,
    scanned,
    forms: forms.length,
    pageId,
    adAccountId,
    warnings,
  };
}



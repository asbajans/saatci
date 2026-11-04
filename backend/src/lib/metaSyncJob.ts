import { IntegrationType } from '@prisma/client';
import { prisma } from './prisma';
import { decryptConfig } from './secrets';
import { syncMetaLeads } from './meta';

let timer: NodeJS.Timeout | null = null;
let running = false;

async function syncIntegration(integration: {
  id: string;
  config: unknown;
}) {
  const config = decryptConfig(integration.config);
  const accessToken = String(
    config.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || ''
  );
  if (!accessToken) return null;

  const result = await syncMetaLeads({
    accessToken,
    pageId: config.pageId || process.env.META_PAGE_ID,
    adAccountId: config.adAccountId || process.env.META_AD_ACCOUNT_ID,
  });

  if (result.created > 0 || result.updated > 0 || result.warnings.length > 0) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        ...(result.created > 0 ? { lastEventAt: new Date() } : {}),
        lastError: result.warnings.length > 0 ? result.warnings.slice(0, 3).join(' | ') : null,
      },
    });
  }
  if (result.created > 0) {
    console.log(
      `[meta-sync] ${result.created} yeni lead, ${result.updated} güncelleme, ${result.forms} form`
    );
  }

  return result;
}

export async function runMetaLeadSync() {
  if (running) return;
  running = true;
  try {
    const integrations = await prisma.integration.findMany({
      where: { type: IntegrationType.META_LEAD_ADS, isActive: true },
    });

    for (const integration of integrations) {
      try {
        await syncIntegration(integration);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[meta-sync] ${integration.name}: ${message}`);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastError: message },
        });
      }
    }

    if (integrations.length === 0) {
      const accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
      if (!accessToken) return;
      try {
        const result = await syncMetaLeads({
          accessToken,
          pageId: process.env.META_PAGE_ID,
          adAccountId: process.env.META_AD_ACCOUNT_ID,
        });
        if (result.created > 0) {
          console.log(
            `[meta-sync] ortam değişkenlerinden ${result.created} yeni lead, ${result.updated} güncelleme`
          );
        }
      } catch (error) {
        console.error('[meta-sync] ortam tokenı ile senkronizasyon başarısız', error);
      }
    }
  } finally {
    running = false;
  }
}

export function startMetaLeadSyncJob() {
  const minutes = Number(process.env.META_SYNC_INTERVAL_MINUTES || 5);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  const startup = setTimeout(() => void runMetaLeadSync(), 15000);
  startup.unref?.();

  timer = setInterval(() => void runMetaLeadSync(), minutes * 60 * 1000);
  timer.unref?.();

  console.log(`[meta-sync] arka plan senkronizasyonu açık (${minutes} dk)`);
}

export function stopMetaLeadSyncJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

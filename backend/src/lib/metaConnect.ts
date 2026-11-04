import jwt from 'jsonwebtoken';
import { IntegrationType } from '@prisma/client';
import { prisma } from './prisma';
import { appAccessToken, graphGetAll, graphRequest, graphVersion, normalizeAdAccountId } from './graph';
import { decryptConfig, encryptConfig } from './secrets';
import { getMetaAdAccounts, getMetaPage, getMetaPages, getMetaPixels, MetaAdAccount, MetaPage, MetaPixel } from './meta';

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
  'ads_read',
  'business_management',
];

type MetaTokenInfo = {
  is_valid: boolean;
  type?: string;
  app_id?: string;
  user_id?: string;
  scopes?: string[];
  expires_at?: number;
  data_access_expires_at?: number;
  error?: { code?: number; message?: string };
};

type AutoSetupResult = {
  ok: boolean;
  pages: { id: string; name?: string }[];
  adAccountId: string | null;
  pixels: { id: string; name?: string }[];
  webhook: { registered: boolean; callbackUrl: string | null; error?: string };
  steps: { key: string; label: string; ok: boolean; detail?: string }[];
  warnings: string[];
};

type DiagnosticCheck = {
  key: string;
  label: string;
  ok: boolean;
  level: 'error' | 'warning' | 'info';
  detail?: string;
};

export function metaOAuthSettings() {
  const appId = process.env.META_APP_ID?.trim() || '';
  const appSecret = process.env.META_APP_SECRET?.trim() || '';
  const publicUrl = (process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, '');
  const redirectUri =
    process.env.META_OAUTH_REDIRECT_URI?.trim() || `${publicUrl}/api/integrations/meta/oauth/callback`;
  const verifyToken = process.env.META_VERIFY_TOKEN?.trim() || 'saatci_verify_token_change_me';
  const scopes = (process.env.META_OAUTH_SCOPES?.trim() || DEFAULT_SCOPES.join(','))
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  return {
    appId,
    appSecret,
    publicUrl,
    redirectUri,
    verifyToken,
    scopes,
    configured: !!(appId && appSecret),
  };
}

export function buildMetaOAuthUrl(state: string) {
  const settings = metaOAuthSettings();
  if (!settings.configured) {
    throw new Error('META_APP_ID ve META_APP_SECRET tanımlanmalıdır');
  }
  const params = new URLSearchParams({
    client_id: settings.appId,
    redirect_uri: settings.redirectUri,
    state,
    response_type: 'code',
    scope: settings.scopes.join(','),
  });
  return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params.toString()}`;
}

export function signMetaOAuthState(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return jwt.sign({ scope: 'meta_oauth', userId }, secret, { expiresIn: '15m' });
}

export function verifyMetaOAuthState(state: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(state, secret) as jwt.JwtPayload;
    if (payload.scope !== 'meta_oauth' || typeof payload.userId !== 'string') return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function exchangeMetaCode(code: string) {
  const settings = metaOAuthSettings();
  const short = await graphRequest<{ access_token: string; expires_in?: number }>({
    path: 'oauth/access_token',
    params: {
      client_id: settings.appId,
      client_secret: settings.appSecret,
      redirect_uri: settings.redirectUri,
      code,
    },
  });
  if (!short.access_token) throw new Error('Meta erişim tokenı alınamadı');

  try {
    const long = await graphRequest<{ access_token: string; expires_in?: number }>({
      path: 'oauth/access_token',
      params: {
        grant_type: 'fb_exchange_token',
        client_id: settings.appId,
        client_secret: settings.appSecret,
        fb_exchange_token: short.access_token,
      },
    });
    return long.access_token || short.access_token;
  } catch {
    return short.access_token;
  }
}

export async function debugMetaToken(accessToken: string): Promise<MetaTokenInfo> {
  const appToken = appAccessToken();
  if (appToken) {
    try {
      const response = await graphRequest<{ data?: MetaTokenInfo }>({
        path: 'debug_token',
        accessToken: appToken,
        params: { input_token: accessToken },
      });
      return response.data || { is_valid: false };
    } catch {
      // fall through to /me
    }
  }
  try {
    const me = await graphRequest<{ id: string; name?: string }>({
      path: 'me',
      accessToken,
      params: { fields: 'id,name' },
    });
    return { is_valid: !!me.id, type: 'unknown', user_id: me.id };
  } catch {
    return { is_valid: false };
  }
}

export async function subscribeMetaPage(pageId: string, pageToken: string) {
  try {
    return await graphRequest({
      method: 'POST',
      path: `${pageId}/subscribed_apps`,
      accessToken: pageToken,
      body: { subscribed_fields: 'leadgen,messaging' },
    });
  } catch {
    return graphRequest({
      method: 'POST',
      path: `${pageId}/subscribed_apps`,
      accessToken: pageToken,
      body: { subscribed_fields: 'leadgen' },
    });
  }
}

export async function getMetaPageSubscription(pageId: string, accessToken: string) {
  return graphGetAll<any>({
    path: `${pageId}/subscribed_apps`,
    accessToken,
  });
}

export async function getMetaAppSubscriptions() {
  const settings = metaOAuthSettings();
  const appToken = appAccessToken();
  if (!settings.appId || !appToken) return [];
  return graphGetAll<any>({
    path: `${settings.appId}/subscriptions`,
    accessToken: appToken,
    params: { limit: 100 },
  });
}

export async function registerMetaWebhook() {
  const settings = metaOAuthSettings();
  const appToken = appAccessToken();
  if (!settings.configured || !appToken) {
    throw new Error('META_APP_ID ve META_APP_SECRET tanımlanmalıdır');
  }
  const callbackUrl = `${settings.publicUrl}/api/webhooks/meta`;
  let lastError: unknown = null;

  for (const fields of ['leadgen,messaging', 'leadgen']) {
    try {
      await graphRequest({
        method: 'POST',
        path: `${settings.appId}/subscriptions`,
        accessToken: appToken,
        body: {
          object: 'page',
          callback_url: callbackUrl,
          fields,
          verify_token: settings.verifyToken,
        },
      });
      return { callbackUrl, verifyToken: settings.verifyToken, fields };
    } catch (error) {
      lastError = error;
      if (fields === 'leadgen') break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Webhook aboneliği kurulamadı'));
}

async function upsertIntegration(type: IntegrationType, name: string, config: Record<string, unknown>) {
  const existing = await prisma.integration.findFirst({ where: { type, name } });
  const merged = { ...(existing ? decryptConfig(existing.config) : {}), ...config };
  const encrypted = encryptConfig(merged);
  if (existing) {
    return prisma.integration.update({
      where: { id: existing.id },
      data: { config: encrypted, isActive: true },
    });
  }
  return prisma.integration.create({
    data: { type, name, config: encrypted, isActive: true },
  });
}

function tokenExpiry(tokenInfo: MetaTokenInfo) {
  const expiresAt = tokenInfo.expires_at || 0;
  return expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : null;
}

export async function connectMetaAssets(params: {
  accessToken: string;
  pageId?: string | null;
  adAccountId?: string | null;
  pixelId?: string | null;
  userId?: string;
  namePrefix?: string | null;
}): Promise<AutoSetupResult> {
  const accessToken = params.accessToken?.trim();
  if (!accessToken) throw new Error('Meta erişim tokenı gerekli');

  const settings = metaOAuthSettings();
  const steps: AutoSetupResult['steps'] = [];
  const warnings: string[] = [];

  const tokenInfo = await debugMetaToken(accessToken);
  if (!tokenInfo.is_valid) {
    throw new Error('Meta erişim tokenı geçersiz veya süresi dolmuş');
  }
  steps.push({
    key: 'token',
    label: 'Erişim tokenı doğrulandı',
    ok: true,
    detail: tokenInfo.expires_at ? `Bitiş: ${new Date(tokenInfo.expires_at * 1000).toISOString()}` : 'Süresiz token',
  });

  let selectedPages: MetaPage[] = [];
  try {
    selectedPages = params.pageId ? [await getMetaPage(accessToken, params.pageId)] : await getMetaPages(accessToken);
  } catch (error) {
    warnings.push(`Sayfalar okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (selectedPages.length === 0 && !params.pageId) {
    try {
      const me = await graphRequest<{ id: string; name?: string }>({
        path: 'me',
        accessToken,
        params: { fields: 'id,name' },
      });
      if (me.id) {
        selectedPages = [{ id: me.id, name: me.name, access_token: accessToken }];
        warnings.push('Token bir sayfa tokenı olduğu için sayfa bilgisi /me üzerinden alındı');
      }
    } catch {
      // no page token fallback available
    }
  }
  if (selectedPages.length === 0) {
    throw new Error(
      params.pageId
        ? `Belirtilen Facebook Sayfası okunamadı (${params.pageId}); token yetkilerini kontrol edin`
        : 'Token ile erişilebilen Facebook Sayfası bulunamadı (pages_show_list yetkisi gerekli)'
    );
  }
  steps.push({
    key: 'pages',
    label: 'Facebook Sayfaları bulundu',
    ok: true,
    detail: selectedPages.map((page) => page.name || page.id).join(', '),
  });

  let adAccounts: MetaAdAccount[] = [];
  try {
    adAccounts = params.adAccountId
      ? [{ id: normalizeAdAccountId(params.adAccountId), account_id: normalizeAdAccountId(params.adAccountId) }]
      : await getMetaAdAccounts(accessToken);
  } catch (error) {
    warnings.push(`Reklam hesapları okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }
  const adAccountId = normalizeAdAccountId(params.adAccountId || adAccounts[0]?.account_id || adAccounts[0]?.id || '');
  steps.push({
    key: 'adaccounts',
    label: 'Reklam hesabı belirlendi',
    ok: !!adAccountId,
    detail: adAccountId ? `act_${adAccountId}` : 'Reklam hesabı bulunamadı',
  });

  let pixels: MetaPixel[] = [];
  if (params.pixelId) {
    pixels = [{ id: params.pixelId }];
  } else if (adAccountId) {
    try {
      pixels = await getMetaPixels(accessToken, adAccountId);
    } catch (error) {
      warnings.push(`Pixel listesi okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  steps.push({
    key: 'pixels',
    label: 'Meta Pixel belirlendi',
    ok: pixels.length > 0,
    detail: pixels.map((pixel) => pixel.name || pixel.id).join(', ') || 'Pixel bulunamadı',
  });

  let webhook: AutoSetupResult['webhook'] = { registered: false, callbackUrl: null };
  try {
    const registered = await registerMetaWebhook();
    webhook = { registered: true, callbackUrl: registered.callbackUrl };
    steps.push({ key: 'app_webhook', label: 'Uygulama webhook aboneliği kuruldu', ok: true, detail: registered.callbackUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    webhook = { registered: false, callbackUrl: `${settings.publicUrl}/api/webhooks/meta`, error: message };
    warnings.push(`Webhook aboneliği kurulamadı: ${message}`);
    steps.push({ key: 'app_webhook', label: 'Uygulama webhook aboneliği kurulamadı', ok: false, detail: message });
  }

  const prefix = params.namePrefix?.trim();
  const expiresAt = tokenExpiry(tokenInfo);
  const connectedAt = new Date().toISOString();

  for (const page of selectedPages.slice(0, 10)) {
    let pageToken = page.access_token || '';
    if (!pageToken) {
      try {
        pageToken = (await getMetaPage(accessToken, page.id)).access_token || accessToken;
      } catch {
        pageToken = accessToken;
      }
    }
    try {
      await subscribeMetaPage(page.id, pageToken);
      steps.push({
        key: `page_subscribe_${page.id}`,
        label: `${page.name || page.id} sayfası uygulamaya abone edildi`,
        ok: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${page.name || page.id} sayfası abone edilemedi: ${message}`);
      steps.push({
        key: `page_subscribe_${page.id}`,
        label: `${page.name || page.id} sayfası abone edilemedi`,
        ok: false,
        detail: message,
      });
    }

    const pageLabel = page.name || page.id;
    await upsertIntegration(IntegrationType.META_LEAD_ADS, `${prefix ? `${prefix} - ` : ''}Meta Lead Ads - ${pageLabel}`, {
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: pageToken,
      adsAccessToken: accessToken,
      verifyToken: settings.verifyToken,
      adAccountId: adAccountId ? `act_${adAccountId}` : null,
      tokenExpiresAt: expiresAt,
      scopes: tokenInfo.scopes || settings.scopes,
      connectedAt,
      connectionMethod: 'auto',
      connectionUserId: params.userId || null,
    });

    await upsertIntegration(IntegrationType.META_MESSENGER, `${prefix ? `${prefix} - ` : ''}Meta Messenger - ${pageLabel}`, {
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: pageToken,
      verifyToken: settings.verifyToken,
      tokenExpiresAt: expiresAt,
      connectedAt,
      connectionMethod: 'auto',
      connectionUserId: params.userId || null,
    });
  }

  const selectedPixels = pixels.slice(0, 1);
  for (const pixel of selectedPixels) {
    const label = `${prefix ? `${prefix} - ` : ''}Meta Pixel - ${pixel.name || pixel.id}`;
    await upsertIntegration(IntegrationType.META_PIXEL, label, {
      pixelId: pixel.id,
      connectedAt,
      connectionMethod: 'auto',
      connectionUserId: params.userId || null,
    });
    await upsertIntegration(IntegrationType.META_CAPI, `${prefix ? `${prefix} - ` : ''}Meta CAPI - ${pixel.name || pixel.id}`, {
      pixelId: pixel.id,
      accessToken,
      tokenExpiresAt: expiresAt,
      scopes: tokenInfo.scopes || settings.scopes,
      connectedAt,
      connectionMethod: 'auto',
      connectionUserId: params.userId || null,
    });
  }

  steps.push({
    key: 'integrations',
    label: 'CRM entegrasyon kayıtları oluşturuldu',
    ok: true,
    detail: `${selectedPages.length} sayfa, ${selectedPixels.length} pixel (${pixels.length} bulundu)`,
  });

  const critical = (key: string) =>
    key === 'token' || key === 'pages' || key === 'app_webhook' || key === 'integrations' || key.startsWith('page_subscribe_');

  return {
    ok: steps.filter((step) => critical(step.key)).every((step) => step.ok),
    pages: selectedPages.map((page) => ({ id: page.id, name: page.name })),
    adAccountId: adAccountId ? `act_${adAccountId}` : null,
    pixels: pixels.map((pixel) => ({ id: pixel.id, name: pixel.name })),
    webhook,
    steps,
    warnings,
  };
}

function maskToken(token?: string | null) {
  const value = String(token || '');
  if (!value) return '-';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function diagnoseMeta() {
  const settings = metaOAuthSettings();
  const checks: DiagnosticCheck[] = [];

  checks.push({
    key: 'env_app',
    label: 'META_APP_ID ve META_APP_SECRET tanımlı',
    ok: !!(settings.appId && settings.appSecret),
    level: 'error',
  });
  checks.push({
    key: 'env_verify',
    label: 'META_VERIFY_TOKEN tanımlı',
    ok: !!process.env.META_VERIFY_TOKEN,
    level: 'warning',
    detail: process.env.META_VERIFY_TOKEN ? undefined : 'Varsayılan doğrulama anahtarı kullanılıyor',
  });
  checks.push({
    key: 'graph_version',
    label: 'Graph API sürümü',
    ok: true,
    level: 'info',
    detail: graphVersion(),
  });

  const integrations = await prisma.integration.findMany({
    where: { type: { in: [IntegrationType.META_LEAD_ADS, IntegrationType.META_CAPI] } },
    orderBy: { createdAt: 'desc' },
  });
  const leadAds = integrations.filter((item) => item.type === IntegrationType.META_LEAD_ADS);
  const capi = integrations.filter((item) => item.type === IntegrationType.META_CAPI);

  checks.push({
    key: 'leadads_integration',
    label: 'Meta Lead Ads entegrasyonu',
    ok: leadAds.some((item) => item.isActive),
    level: 'error',
    detail: leadAds.length ? `${leadAds.length} kayıt` : 'Kayıt yok',
  });

  for (const integration of leadAds) {
    const config = decryptConfig(integration.config);
    const pageId = String(config.pageId || '');
    const token = String(config.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '');
    const label = integration.name;
    if (!pageId || !token) {
      checks.push({
        key: `leadads_config_${integration.id}`,
        label: `${label}: sayfa ID / token`,
        ok: false,
        level: 'error',
        detail: 'Sayfa ID veya Page Access Token eksik',
      });
      continue;
    }

    const tokenInfo = await debugMetaToken(token);
    checks.push({
      key: `leadads_token_${integration.id}`,
      label: `${label}: token geçerli`,
      ok: tokenInfo.is_valid,
      level: 'error',
      detail: tokenInfo.is_valid
        ? tokenInfo.expires_at
          ? `Bitiş: ${new Date(tokenInfo.expires_at * 1000).toISOString()}`
          : 'Süresiz'
        : 'Token geçersiz veya süresi dolmuş',
    });

    try {
      const subscribed = await getMetaPageSubscription(pageId, token);
      const appSubscribed = settings.appId
        ? subscribed.some((row) => String(row.id || '') === settings.appId)
        : subscribed.length > 0;
      checks.push({
        key: `leadads_subscription_${integration.id}`,
        label: `${label}: sayfa uygulamaya abone`,
        ok: appSubscribed,
        level: 'error',
        detail: appSubscribed
          ? undefined
          : 'Sayfa uygulamaya abone değil. Otomatik kurulumu çalıştırın veya /{page-id}/subscribed_apps çağırın.',
      });
    } catch (error) {
      checks.push({
        key: `leadads_subscription_${integration.id}`,
        label: `${label}: sayfa aboneliği okunamadı`,
        ok: false,
        level: 'warning',
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const forms = await graphGetAll<any>({
        path: `${pageId}/leadgen_forms`,
        accessToken: token,
        params: { fields: 'id,name,status,leads_count', limit: 5 },
      });
      checks.push({
        key: `leadads_forms_${integration.id}`,
        label: `${label}: formlar okunabiliyor`,
        ok: true,
        level: 'info',
        detail: forms.length ? `${forms.length} form bulundu` : 'Form bulunamadı',
      });
    } catch (error) {
      checks.push({
        key: `leadads_forms_${integration.id}`,
        label: `${label}: formlar okunamıyor`,
        ok: false,
        level: 'error',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (settings.appId && settings.appSecret) {
    try {
      const subscriptions = await getMetaAppSubscriptions();
      const pageSubscription = subscriptions.find((row) => row.object === 'page');
      const rawFields = pageSubscription?.fields;
      const fields = Array.isArray(rawFields)
        ? rawFields
        : typeof rawFields === 'string'
          ? rawFields.split(',').map((field) => field.trim()).filter(Boolean)
          : [];
      const hasLeadgenField = fields.length === 0 || fields.includes('leadgen');
      const expectedCallback = `${settings.publicUrl}/api/webhooks/meta`;
      const callbackMatches =
        !pageSubscription?.callback_url || String(pageSubscription.callback_url) === expectedCallback;
      checks.push({
        key: 'app_webhook',
        label: 'Uygulama webhook aboneliği (page)',
        ok: !!pageSubscription && hasLeadgenField && callbackMatches,
        level: 'error',
        detail: pageSubscription
          ? `${pageSubscription.callback_url || ''} · ${fields.join(',') || 'alan bilgisi yok'}${
              callbackMatches ? '' : ` · beklenen: ${expectedCallback}`
            }${hasLeadgenField ? '' : ' · leadgen alanı eksik'}`
          : 'page objesi için webhook aboneliği yok',
      });
    } catch (error) {
      checks.push({
        key: 'app_webhook',
        label: 'Uygulama webhook aboneliği okunamadı',
        ok: false,
        level: 'warning',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const [lastInbound, lastLead] = await Promise.all([
    prisma.inboundEvent.findFirst({
      where: { type: 'META_LEAD_ADS' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.findFirst({
      where: { source: 'Meta Lead Ads' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  checks.push({
    key: 'last_inbound',
    label: 'Son Meta webhook olayı',
    ok: !!lastInbound && lastInbound.status === 'PROCESSED',
    level: lastInbound ? 'warning' : 'error',
    detail: lastInbound
      ? `${lastInbound.createdAt.toISOString()} · ${lastInbound.status}${lastInbound.error ? ` · ${lastInbound.error}` : ''}`
      : 'Hiç Meta webhook olayı alınmadı',
  });

  const capiStates: { id: string; name: string; active: boolean; lastStatus: string | null; lastError: string | null }[] = [];
  for (const integration of capi) {
    const config = decryptConfig(integration.config);
    const lastDelivery = await prisma.integrationDelivery.findFirst({
      where: { integrationId: integration.id },
      orderBy: { createdAt: 'desc' },
      select: { status: true, error: true, createdAt: true },
    });
    const token = String(config.accessToken || '');
    const pixelId = String(config.pixelId || '');
    const valid = !!(token && pixelId);
    checks.push({
      key: `capi_${integration.id}`,
      label: `${integration.name}: CAPI yapılandırması`,
      ok: valid && integration.isActive,
      level: 'error',
      detail: valid
        ? `Pixel ${pixelId} · token ${maskToken(token)}${
            lastDelivery ? ` · son gönderim ${lastDelivery.status}` : ' · henüz gönderim yok'
          }`
        : 'Pixel ID veya Access Token eksik',
    });
    capiStates.push({
      id: integration.id,
      name: integration.name,
      active: integration.isActive,
      lastStatus: lastDelivery?.status || null,
      lastError: lastDelivery?.error || integration.lastError || null,
    });
  }

  const errorCount = checks.filter((check) => !check.ok && check.level === 'error').length;
  const warningCount = checks.filter((check) => !check.ok && check.level === 'warning').length;

  return {
    ok: errorCount === 0,
    graphVersion: graphVersion(),
    redirectUri: settings.redirectUri,
    checks,
    errorCount,
    warningCount,
    lastInbound: lastInbound
      ? {
          id: lastInbound.id,
          status: lastInbound.status,
          error: lastInbound.error,
          externalId: lastInbound.externalId,
          createdAt: lastInbound.createdAt,
        }
      : null,
    lastLead,
    integrations: {
      leadAds: leadAds.map((item) => ({ id: item.id, name: item.name, isActive: item.isActive })),
      capi: capiStates,
    },
  };
}

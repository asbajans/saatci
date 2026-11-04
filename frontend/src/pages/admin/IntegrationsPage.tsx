import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, Table } from '../../components/ui';
import { LEAD_STATUS_LABEL, apiError, dateTime, money } from '../../lib/format';

type Tab =
  | 'overview'
  | 'integrations'
  | 'forms'
  | 'campaigns'
  | 'events'
  | 'meta';

type ConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  type?: 'text' | 'campaign' | 'textarea';
};

const INTEGRATION_TYPES = [
  { value: 'META_PIXEL', label: 'Meta Pixel (Web)' },
  { value: 'META_CAPI', label: 'Meta Conversions API' },
  { value: 'META_LEAD_ADS', label: 'Meta Lead Ads' },
  { value: 'META_MESSENGER', label: 'Facebook Messenger' },
  { value: 'INSTAGRAM_DM', label: 'Instagram DM' },
  { value: 'WHATSAPP', label: 'WhatsApp Cloud API' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'GA4', label: 'Google Analytics 4' },
  { value: 'TIKTOK_PIXEL', label: 'TikTok Pixel' },
  { value: 'CUSTOM_WEBHOOK', label: 'Özel Webhook' },
] as const;

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  INTEGRATION_TYPES.map((item) => [item.value, item.label])
);

const CONFIG_FIELDS: Record<string, ConfigField[]> = {
  META_PIXEL: [{ key: 'pixelId', label: 'Pixel ID', placeholder: '1234567890' }],
  META_CAPI: [
    { key: 'pixelId', label: 'Pixel ID', placeholder: '1234567890' },
    { key: 'accessToken', label: 'Access Token', secret: true },
    { key: 'testEventCode', label: 'Test Event Code', placeholder: 'TEST12345' },
    { key: 'campaignId', label: 'Varsayılan Kampanya', type: 'campaign' },
  ],
  META_LEAD_ADS: [
    { key: 'pageId', label: 'Facebook Sayfa ID' },
    { key: 'pageName', label: 'Facebook Sayfa Adı' },
    { key: 'adAccountId', label: 'Reklam Hesabı ID', placeholder: 'act_1234567890' },
    { key: 'pageAccessToken', label: 'Page Access Token', secret: true },
    { key: 'verifyToken', label: 'Webhook Doğrulama Anahtarı', secret: true },
    { key: 'campaignId', label: 'Varsayılan Kampanya', type: 'campaign' },
  ],
  META_MESSENGER: [
    { key: 'pageId', label: 'Facebook Sayfa ID' },
    { key: 'pageAccessToken', label: 'Page Access Token', secret: true },
    { key: 'verifyToken', label: 'Webhook Doğrulama Anahtarı', secret: true },
    { key: 'campaignId', label: 'Varsayılan Kampanya', type: 'campaign' },
  ],
  INSTAGRAM_DM: [
    { key: 'accountId', label: 'Instagram Hesap ID' },
    { key: 'accessToken', label: 'Access Token', secret: true },
    { key: 'verifyToken', label: 'Webhook Doğrulama Anahtarı', secret: true },
    { key: 'campaignId', label: 'Varsayılan Kampanya', type: 'campaign' },
  ],
  WHATSAPP: [
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'wabaId', label: 'WABA ID' },
    { key: 'accessToken', label: 'Access Token', secret: true },
    { key: 'verifyToken', label: 'Webhook Doğrulama Anahtarı', secret: true },
    { key: 'campaignId', label: 'Varsayılan Kampanya', type: 'campaign' },
  ],
  GOOGLE_ADS: [
    { key: 'customerId', label: 'Müşteri ID', placeholder: '123-456-7890' },
    { key: 'conversionActionId', label: 'Dönüşüm Aksiyonu ID' },
    { key: 'webhookUrl', label: 'Webhook URL (opsiyonel)', placeholder: 'https://...' },
    { key: 'secret', label: 'Webhook Secret', secret: true },
  ],
  GA4: [
    { key: 'measurementId', label: 'Measurement ID', placeholder: 'G-XXXXXXX' },
    { key: 'apiSecret', label: 'API Secret', secret: true },
  ],
  TIKTOK_PIXEL: [
    { key: 'pixelId', label: 'Pixel ID' },
    { key: 'accessToken', label: 'Access Token', secret: true },
  ],
  CUSTOM_WEBHOOK: [
    { key: 'url', label: 'Webhook URL', placeholder: 'https://...' },
    { key: 'secret', label: 'X-Webhook-Secret', secret: true },
  ],
};

const DEFAULT_FORM_FIELDS = [
  { key: 'name', label: 'Ad Soyad', type: 'text', required: true },
  { key: 'phone', label: 'Telefon', type: 'tel', required: true },
  { key: 'email', label: 'E-posta', type: 'email', required: false },
  { key: 'message', label: 'Mesajınız', type: 'textarea', required: false },
];

const emptyIntegration = { open: false, id: '', name: '', type: 'META_CAPI', isActive: true, config: {} as Record<string, string> };
const emptyForm = {
  open: false,
  id: '',
  name: '',
  source: 'Web',
  campaignId: '',
  isActive: true,
  successMessage: '',
  redirectUrl: '',
  allowedOrigins: '',
  fields: JSON.stringify(DEFAULT_FORM_FIELDS, null, 2),
};
const emptyCampaign = {
  open: false,
  id: '',
  name: '',
  channel: 'Meta',
  platform: '',
  externalId: '',
  pixelId: '',
  utmCampaign: '',
  budget: '',
  startDate: '',
  endDate: '',
  notes: '',
  isActive: true,
};

const statusTone = (status: string): any => {
  if (status === 'SENT' || status === 'PROCESSED') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'PENDING') return 'amber';
  return 'slate';
};

export const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [integrationModal, setIntegrationModal] = useState<any>({ ...emptyIntegration });
  const [formModal, setFormModal] = useState<any>({ ...emptyForm });
  const [campaignModal, setCampaignModal] = useState<any>({ ...emptyCampaign });
  const [metaSyncLoading, setMetaSyncLoading] = useState(false);
  const [metaAdAccountId, setMetaAdAccountId] = useState('');
  const [metaPageId, setMetaPageId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaAutoLoading, setMetaAutoLoading] = useState(false);
  const [metaSetupResult, setMetaSetupResult] = useState<any>(null);
  const [metaNotice, setMetaNotice] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const leadsQuery = useQuery({
    queryKey: ['meta-leads'],
    queryFn: async () => (await api.get('/leads')).data.data as any[],
  });

  const summaryQuery = useQuery({
    queryKey: ['conversion-summary'],
    queryFn: async () => (await api.get('/integrations/conversion-summary')).data.data as any,
  });

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => (await api.get('/integrations')).data.data as any[],
  });

  const formsQuery = useQuery({
    queryKey: ['website-forms'],
    queryFn: async () => (await api.get('/forms')).data.data as any[],
  });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const eventsQuery = useQuery({
    queryKey: ['conversion-events'],
    queryFn: async () => (await api.get('/integrations/events?limit=150')).data.data as any[],
  });

  const inboundQuery = useQuery({
    queryKey: ['inbound-events'],
    queryFn: async () => (await api.get('/integrations/inbound-events?limit=150')).data.data as any[],
  });

  const diagnosticsQuery = useQuery({
    queryKey: ['meta-diagnostics'],
    queryFn: async () => (await api.get('/integrations/meta/diagnostics')).data.data as any,
  });

  const campaigns = campaignsQuery.data || [];
  const leads = leadsQuery.data || [];
  const metaCampaigns = campaigns.filter((c: any) => c.channel === 'Meta' || c.platform === 'Meta' || !!c.externalId);
  const metaLeads = leads.filter((l: any) => l.source === 'Meta Lead Ads');
  const summary = summaryQuery.data;
  const integrations = integrationsQuery.data || [];

  const invalidateAll = () => {
    for (const key of [
      'conversion-summary',
      'integrations',
      'website-forms',
      'campaigns',
      'conversion-events',
      'inbound-events',
      'meta-leads',
      'meta-diagnostics',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get('meta');
    if (!meta) return;
    const message = params.get('message') || '';
    setMetaNotice({
      tone: meta === 'connected' ? 'green' : 'red',
      text:
        message ||
        (meta === 'connected'
          ? 'Meta bağlantısı kuruldu. Tanılama sonuçlarını kontrol edin.'
          : 'Meta bağlantısı kurulamadı.'),
    });
    setActiveTab('meta');
    params.delete('meta');
    params.delete('message');
    const nextUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
    queryClient.invalidateQueries();
  }, [queryClient]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Özet' },
    { key: 'integrations', label: 'Entegrasyonlar' },
    { key: 'forms', label: 'Site Formları' },
    { key: 'campaigns', label: 'Kampanyalar' },
    { key: 'events', label: 'Olaylar' },
    { key: 'meta', label: 'Meta Reklamlar' },
  ];

  const openIntegration = (item?: any) => {
    if (!item) {
      setIntegrationModal({ ...emptyIntegration, open: true });
      return;
    }
    setIntegrationModal({
      open: true,
      id: item.id,
      name: item.name,
      type: item.type,
      isActive: item.isActive,
      config: { ...(item.config || {}) },
    });
  };

  const saveIntegration = async () => {
    try {
      if (!integrationModal.name.trim()) {
        alert('Entegrasyon adı gerekli');
        return;
      }
      if (integrationModal.id) {
        await api.patch(`/integrations/${integrationModal.id}`, {
          name: integrationModal.name,
          isActive: integrationModal.isActive,
          config: integrationModal.config,
        });
      } else {
        await api.post('/integrations', {
          name: integrationModal.name,
          type: integrationModal.type,
          isActive: integrationModal.isActive,
          config: integrationModal.config,
        });
      }
      setIntegrationModal({ ...emptyIntegration });
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const syncMeta = async (endpoint: string) => {
    setMetaSyncLoading(true);
    try {
      const body: any = {};
      if (metaAdAccountId.trim()) body.adAccountId = metaAdAccountId.trim();
      if (metaPageId.trim()) body.pageId = metaPageId.trim();
      await api.post(endpoint, body);
      invalidateAll();
      alert('Meta senkronizasyonu tamamlandı');
    } catch (err) {
      alert(apiError(err));
    } finally {
      setMetaSyncLoading(false);
    }
  };

  const startMetaOAuth = async () => {
    try {
      const res = await api.get('/integrations/meta/oauth/url');
      window.location.href = res.data.data.url;
    } catch (err) {
      alert(apiError(err));
    }
  };

  const runMetaAutoSetup = async () => {
    setMetaAutoLoading(true);
    try {
      const body: any = {};
      if (metaAccessToken.trim()) body.accessToken = metaAccessToken.trim();
      if (metaPageId.trim()) body.pageId = metaPageId.trim();
      if (metaAdAccountId.trim()) body.adAccountId = metaAdAccountId.trim();
      const res = await api.post('/integrations/meta/auto-setup', body);
      const result = res.data.data;
      setMetaSetupResult(result);
      setMetaAccessToken('');
      setMetaNotice({
        tone: result?.ok ? 'green' : 'red',
        text: result?.ok
          ? 'Otomatik Meta kurulumu tamamlandı.'
          : `Kurulum tamamlandı ancak ${result?.warnings?.length || 0} uyarı var. Adımları kontrol edin.`,
      });
      invalidateAll();
      diagnosticsQuery.refetch();
    } catch (err) {
      alert(apiError(err));
    } finally {
      setMetaAutoLoading(false);
    }
  };

  const testIntegration = async (id: string) => {
    try {
      const res = await api.post(`/integrations/${id}/test`);
      alert(res.data.data.message || 'Entegrasyon doğrulandı');
    } catch (err) {
      alert(apiError(err));
    }
  };

  const deleteIntegration = async (id: string) => {
    if (!confirm('Bu entegrasyonu silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/integrations/${id}`);
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const openForm = (item?: any) => {
    if (!item) {
      setFormModal({ ...emptyForm, open: true });
      return;
    }
    setFormModal({
      open: true,
      id: item.id,
      name: item.name,
      source: item.source,
      campaignId: item.campaignId || '',
      isActive: item.isActive,
      successMessage: item.successMessage || '',
      redirectUrl: item.redirectUrl || '',
      allowedOrigins: item.allowedOrigins || '',
      fields: JSON.stringify(item.fields || DEFAULT_FORM_FIELDS, null, 2),
    });
  };

  const saveForm = async () => {
    let fields: unknown;
    try {
      fields = JSON.parse(formModal.fields);
    } catch {
      alert('Alanlar bölümü geçerli JSON olmalıdır');
      return;
    }
    try {
      const payload = {
        name: formModal.name,
        source: formModal.source,
        campaignId: formModal.campaignId || null,
        isActive: formModal.isActive,
        successMessage: formModal.successMessage || undefined,
        redirectUrl: formModal.redirectUrl || '',
        allowedOrigins: formModal.allowedOrigins || undefined,
        fields,
      };
      if (formModal.id) {
        await api.patch(`/forms/${formModal.id}`, payload);
      } else {
        await api.post('/forms', payload);
      }
      setFormModal({ ...emptyForm });
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Bu formu silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/forms/${id}`);
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('Form adresi kopyalandı');
    } catch {
      alert(value);
    }
  };

  const openCampaign = (item?: any) => {
    if (!item) {
      setCampaignModal({ ...emptyCampaign, open: true });
      return;
    }
    setCampaignModal({
      open: true,
      id: item.id,
      name: item.name,
      channel: item.channel,
      platform: item.platform || '',
      externalId: item.externalId || '',
      pixelId: item.pixelId || '',
      utmCampaign: item.utmCampaign || '',
      budget: item.budget ? String(item.budget) : '',
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : '',
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : '',
      notes: item.notes || '',
      isActive: item.isActive !== false,
    });
  };

  const saveCampaign = async () => {
    try {
      const payload = {
        name: campaignModal.name,
        channel: campaignModal.channel,
        platform: campaignModal.platform || undefined,
        externalId: campaignModal.externalId || undefined,
        pixelId: campaignModal.pixelId || undefined,
        utmCampaign: campaignModal.utmCampaign || undefined,
        budget: campaignModal.budget || undefined,
        startDate: campaignModal.startDate ? `${campaignModal.startDate}T00:00:00.000Z` : undefined,
        endDate: campaignModal.endDate ? `${campaignModal.endDate}T00:00:00.000Z` : undefined,
        notes: campaignModal.notes || undefined,
        isActive: campaignModal.isActive,
      };
      if (campaignModal.id) {
        await api.patch(`/campaigns/${campaignModal.id}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }
      setCampaignModal({ ...emptyCampaign });
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Bu kampanyayı silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      invalidateAll();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const downloadGoogleAdsCsv = async () => {
    try {
      const res = await api.get('/integrations/google-ads.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'google-ads-donusumler.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const configFields = CONFIG_FIELDS[integrationModal.type] || [];
  const totals = summary?.totals;
  const byCampaign = summary?.byCampaign || [];
  const funnelStages = ['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED', 'CLINIC_VISIT', 'TREATMENT_APPROVED', 'SOLD'];

  const summaryCards = useMemo(
    () => [
      { label: 'Dönüşüm Olayı (30 gün)', value: totals?.events ?? 0 },
      { label: 'Aktif Entegrasyon', value: `${totals?.activeIntegrations ?? 0} / ${totals?.integrations ?? 0}` },
      { label: 'Başarılı Gönderim', value: totals?.deliveries?.SENT ?? 0 },
      { label: 'Başarısız Gönderim', value: totals?.deliveries?.FAILED ?? 0 },
    ],
    [totals]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entegrasyon & Kampanya"
        subtitle="Sosyal medya, web formları, pixel'ler ve dönüşüm olaylarını tek yerden yönetin"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => summaryQuery.refetch()}>
              Yenile
            </Button>
            <Button variant="secondary" onClick={downloadGoogleAdsCsv}>
              Google Ads CSV
            </Button>
          </div>
        }
      />

      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <nav className="flex flex-wrap gap-6 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {!summary ? (
            <LoadingText />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {summaryCards.map((card) => (
                  <Card key={card.label} className="p-5">
                    <p className="text-sm text-slate-500">{card.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{card.value}</p>
                  </Card>
                ))}
              </div>

              <Card>
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Kampanya Funnel</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Son 30 gün içindeki lead durum değişimleri kampanya bazında gösterilir.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openCampaign()}>
                    + Yeni Kampanya
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table head={['Kampanya', 'Lead', ...funnelStages.map((s) => LEAD_STATUS_LABEL[s] || s), 'Olay', 'Gönderim']}>
                    {byCampaign.map((row: any) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.platform || row.channel} {row.isActive ? '· Aktif' : '· Pasif'}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-semibold">{row.leads}</td>
                        {funnelStages.map((stage) => (
                          <td key={stage} className="px-4 py-3 text-slate-600">
                            {row.stages?.[stage] || 0}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-slate-600">{row.conversions}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-emerald-600 font-semibold">{row.sent}</span>
                          {' / '}
                          <span className="text-red-600 font-semibold">{row.failed}</span>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
                {byCampaign.length === 0 && <Empty title="Henüz kampanya yok" hint="Kampanyalar sekmesinden ekleyin." />}
              </Card>

              <Card>
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Entegrasyon Sağlığı</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(summary.integrations || []).map((item: any) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{TYPE_LABEL[item.type] || item.type}</p>
                        </div>
                        <Badge tone={item.isActive ? 'green' : 'slate'}>{item.isActive ? 'Aktif' : 'Pasif'}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Son olay: {item.lastEventAt ? dateTime(item.lastEventAt) : '-'}
                      </p>
                      {item.lastError && <p className="mt-1 text-xs text-red-600">Hata: {item.lastError}</p>}
                    </div>
                  ))}
                  {(summary.integrations || []).length === 0 && (
                    <p className="text-sm text-slate-500">Henüz entegrasyon eklenmedi.</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === 'meta' && (
        <div className="space-y-6">
          <PageHeader title="Meta Reklamlar & Lead'ler" subtitle="Meta iş ortağı kampanyalarını ve form/Mesaj lead'lerini CRM'ye çekin" />

          {metaNotice && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                metaNotice.tone === 'green'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {metaNotice.text}
            </div>
          )}

          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Otomatik Meta Bağlantısı</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Meta hesabınızla giriş yapın; sayfa, reklam hesabı, pixel ve webhook aboneliği otomatik kurulur.
                </p>
                {diagnosticsQuery.data?.redirectUri && (
                  <p className="text-xs text-slate-400 mt-1">
                    OAuth Redirect URI: {diagnosticsQuery.data.redirectUri}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={startMetaOAuth}>Meta ile Bağlan</Button>
                <Button variant="secondary" onClick={runMetaAutoSetup} disabled={metaAutoLoading}>
                  {metaAutoLoading ? 'Kuruluyor...' : 'Token ile Otomatik Kur'}
                </Button>
                <Button variant="secondary" onClick={() => diagnosticsQuery.refetch()}>
                  Tanılamayı Yenile
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Facebook Sayfa ID (opsiyonel)">
                <Input value={metaPageId} onChange={(e) => setMetaPageId(e.target.value)} placeholder="1234567890" />
              </Field>
              <Field label="Erişim Tokenı (Page / User / System User)">
                <Input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="Boşsa kayıtlı token kullanılır"
                />
              </Field>
              <Field label="Reklam Hesabı ID (opsiyonel)">
                <Input
                  value={metaAdAccountId}
                  onChange={(e) => setMetaAdAccountId(e.target.value)}
                  placeholder="act_1234567890"
                />
              </Field>
            </div>
            {metaSetupResult && (
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Kurulum sonucu</p>
                <div className="mt-2 space-y-1">
                  {(metaSetupResult.steps || []).map((step: any) => (
                    <p key={step.key} className={`text-xs ${step.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                      {step.ok ? '✓' : '✕'} {step.label}
                      {step.detail ? ` — ${step.detail}` : ''}
                    </p>
                  ))}
                </div>
                {(metaSetupResult.warnings || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(metaSetupResult.warnings || []).map((warning: string, index: number) => (
                      <p key={index} className="text-xs text-amber-700">
                        ! {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Meta Tanılama</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Token, sayfa aboneliği, webhook ve Conversions API durumunu kontrol eder.
                </p>
              </div>
              {diagnosticsQuery.data && (
                <Badge tone={diagnosticsQuery.data.ok ? 'green' : 'red'}>
                  {diagnosticsQuery.data.ok
                    ? 'Sağlıklı'
                    : `${diagnosticsQuery.data.errorCount} hata · ${diagnosticsQuery.data.warningCount} uyarı`}
                </Badge>
              )}
            </div>
            <div className="p-6 space-y-2">
              {diagnosticsQuery.isLoading && <LoadingText />}
              {!diagnosticsQuery.isLoading &&
                (diagnosticsQuery.data?.checks || []).map((check: any) => (
                  <div key={check.key} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        check.ok ? 'bg-emerald-500' : check.level === 'error' ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{check.label}</p>
                      {check.detail && <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>}
                    </div>
                  </div>
                ))}
              {diagnosticsQuery.data?.lastLead && (
                <p className="text-xs text-slate-500 pt-2">
                  Son Meta lead: {diagnosticsQuery.data.lastLead.name} · {dateTime(diagnosticsQuery.data.lastLead.createdAt)}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Meta Senkronizasyonu</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Webhook kaçırılan lead'ler için arka plan senkronizasyonu çalışır. Sayfa ve reklam hesabı boş
                  bırakılırsa token üzerinden otomatik bulunur.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={metaPageId}
                  onChange={(e) => setMetaPageId(e.target.value)}
                  placeholder="Sayfa ID"
                />
                <Input
                  value={metaAdAccountId}
                  onChange={(e) => setMetaAdAccountId(e.target.value)}
                  placeholder="act_123456789"
                />
                <Button
                  onClick={() => syncMeta('/integrations/meta/sync-campaigns')}
                  disabled={metaSyncLoading}
                >
                  {metaSyncLoading ? 'Çalışıyor...' : 'Kampanyaları Çek'}
                </Button>
                <Button
                  onClick={() => syncMeta('/integrations/meta/sync-leads')}
                  disabled={metaSyncLoading}
                >
                  {metaSyncLoading ? 'Çalışıyor...' : 'Leadleri Çek'}
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Meta Kampanyaları</h3>
                  <p className="text-xs text-slate-500 mt-1">CRM'de Meta olarak işaretlenen kampanyalar</p>
                </div>
              </div>
              <div className="overflow-x-auto p-6">
                <Table head={['Kampanya', 'Durum', 'Lead Sayısı', 'Dış ID']}>
                  {metaCampaigns.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.isActive ? 'Aktif' : 'Pasif'}</td>
                      <td className="px-4 py-3 font-semibold">{metaLeads.filter((l: any) => l.campaignId === c.id).length}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{c.externalId || '-'}</td>
                    </tr>
                  ))}
                </Table>
              </div>
              {metaCampaigns.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Meta kampanya bulunamadı. Önce 'Kampanyaları Çek' düğmesini kullanın.
                </div>
              )}
            </Card>

            <Card>
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Meta Lead'ler</h3>
                  <p className="text-xs text-slate-500 mt-1">Reklam/form üzerinden gelen potansiyel müşteriler</p>
                </div>
              </div>
              <div className="overflow-x-auto p-6">
                <Table head={['Reklam', 'Kampanya', 'Ad Soyad', 'Telefon', 'Durum', 'Oluşturulma']}>
                  {metaLeads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 text-sm">{l.rawPayload?.ad_name || l.rawPayload?.ad_id || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{l.campaign?.name || '-'}</td>
                      <td className="px-4 py-3">{l.name}</td>
                      <td className="px-4 py-3">{l.phone}</td>
                      <td className="px-4 py-3"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{dateTime(l.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
              {metaLeads.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  Meta lead bulunamadı. 'Leadleri Çek' düğmesini kullanın veya webhook üzerinden gelmesini bekleyin.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Pixel, Conversions API, Lead Ads ve webhook bağlantılarını buradan yönetin.
            </p>
            <Button onClick={() => openIntegration()}>+ Yeni Entegrasyon</Button>
          </div>
          {integrations.map((item: any) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                    <Badge tone="blue">{TYPE_LABEL[item.type] || item.type}</Badge>
                    <Badge tone={item.isActive ? 'green' : 'slate'}>{item.isActive ? 'Aktif' : 'Pasif'}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Son olay: {item.lastEventAt ? dateTime(item.lastEventAt) : '-'} · Gönderim: {item._count?.deliveries || 0}
                  </p>
                  {item.lastError && <p className="text-xs text-red-600 mt-1">Son hata: {item.lastError}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => testIntegration(item.id)}>
                    Test Et
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openIntegration(item)}>
                    Düzenle
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteIntegration(item.id)}>
                    Sil
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {integrations.length === 0 && <Empty title="Entegrasyon yok" hint="İlk entegrasyonu ekleyerek başlayın." />}
        </div>
      )}

      {activeTab === 'forms' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Web siteniz için form oluşturun. Form gönderimleri otomatik lead olur ve UTM bilgileri kaydedilir.
            </p>
            <Button onClick={() => openForm()}>+ Yeni Form</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table head={['Form', 'Kampanya', 'Alan', 'Lead', 'Adres', 'Durum', 'İşlem']}>
                {(formsQuery.data || []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.source}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.campaign?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{(item.fields || []).length}</td>
                    <td className="px-4 py-3 font-semibold">{item._count?.leads ?? 0}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => copy(item.publicUrl)} className="text-xs font-semibold text-blue-600 hover:underline">
                        Bağlantıyı kopyala
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.isActive ? 'green' : 'slate'}>{item.isActive ? 'Aktif' : 'Pasif'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openForm(item)}>
                          Düzenle
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteForm(item.id)}>
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            {(formsQuery.data || []).length === 0 && <Empty title="Henüz form yok" hint="Yeni form oluşturun." />}
          </Card>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Kampanya adı, UTM adı, platform ve reklam kimliği lead eşleştirmesinde kullanılır.
            </p>
            <Button onClick={() => openCampaign()}>+ Yeni Kampanya</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table head={['Kampanya', 'Kanal / Platform', 'UTM', 'Reklam ID', 'Bütçe', 'Lead', 'Durum', 'İşlem']}>
                {campaigns.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.channel} {item.platform ? `· ${item.platform}` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.utmCampaign || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.externalId || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.budget ? money(item.budget) : '-'}</td>
                    <td className="px-4 py-3 font-semibold">{item._count?.leads ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.isActive ? 'green' : 'slate'}>{item.isActive ? 'Aktif' : 'Pasif'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openCampaign(item)}>
                          Düzenle
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteCampaign(item.id)}>
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            {campaigns.length === 0 && <Empty title="Kampanya yok" hint="Reklam kampanyanızı ekleyin." />}
          </Card>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-6">
          <Card>
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Giden Dönüşüm Olayları</h3>
              <p className="text-xs text-slate-500 mt-1">Son 150 olay ve entegrasyon gönderim durumları</p>
            </div>
            <div className="overflow-x-auto">
              <Table head={['Tarih', 'Olay', 'Lead', 'Kampanya', 'Tutar', 'Gönderimler']}>
                {(eventsQuery.data || []).map((event: any) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dateTime(event.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{event.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{event.lead?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{event.campaign?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{event.value ? money(event.value) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(event.deliveries || []).map((delivery: any) => (
                          <span
                            key={delivery.id}
                            title={delivery.error || ''}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {delivery.integration?.name}: <strong>{delivery.status}</strong>
                          </span>
                        ))}
                        {(event.deliveries || []).length === 0 && <span className="text-xs text-slate-400">-</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            {(eventsQuery.data || []).length === 0 && <Empty title="Henüz dönüşüm olayı yok" />}
          </Card>

          <Card>
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Gelen Olaylar</h3>
              <p className="text-xs text-slate-500 mt-1">Meta, WhatsApp ve web formu webhook kayıtları</p>
            </div>
            <div className="overflow-x-auto">
              <Table head={['Tarih', 'Tür', 'Dış ID', 'Durum', 'Lead', 'Hata']}>
                {(inboundQuery.data || []).map((event: any) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dateTime(event.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{event.type}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{event.externalId || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{event.leadId ? 'Oluşturuldu' : '-'}</td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate">{event.error || '-'}</td>
                  </tr>
                ))}
              </Table>
            </div>
            {(inboundQuery.data || []).length === 0 && <Empty title="Henüz gelen olay yok" />}
          </Card>
        </div>
      )}

      <Modal
        open={integrationModal.open}
        onClose={() => setIntegrationModal({ ...emptyIntegration })}
        title={integrationModal.id ? 'Entegrasyon Düzenle' : 'Yeni Entegrasyon'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setIntegrationModal({ ...emptyIntegration })}>
              İptal
            </Button>
            <Button onClick={saveIntegration}>Kaydet</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Entegrasyon Adı *">
              <Input
                value={integrationModal.name}
                onChange={(e) => setIntegrationModal({ ...integrationModal, name: e.target.value })}
                placeholder="Örn: Meta CAPI - Ana Hesap"
              />
            </Field>
            <Field label="Tür">
              <Select
                value={integrationModal.type}
                onChange={(e) => setIntegrationModal({ ...integrationModal, type: e.target.value, config: {} })}
                disabled={!!integrationModal.id}
              >
                {INTEGRATION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Durum">
            <Select
              value={integrationModal.isActive ? 'true' : 'false'}
              onChange={(e) => setIntegrationModal({ ...integrationModal, isActive: e.target.value === 'true' })}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </Field>
          <div className="rounded-lg border border-slate-200 p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-800">Bağlantı Bilgileri</p>
            {configFields.map((field) => (
              <Field key={field.key} label={field.label}>
                {field.type === 'campaign' ? (
                  <Select
                    value={integrationModal.config[field.key] || ''}
                    onChange={(e) =>
                      setIntegrationModal({
                        ...integrationModal,
                        config: { ...integrationModal.config, [field.key]: e.target.value },
                      })
                    }
                  >
                    <option value="">Varsayılan yok</option>
                    {campaigns.map((campaign: any) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </Select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={integrationModal.config[field.key] || ''}
                    onChange={(e) =>
                      setIntegrationModal({
                        ...integrationModal,
                        config: { ...integrationModal.config, [field.key]: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <Input
                    value={integrationModal.config[field.key] || ''}
                    onChange={(e) =>
                      setIntegrationModal({
                        ...integrationModal,
                        config: { ...integrationModal.config, [field.key]: e.target.value },
                      })
                    }
                    placeholder={field.placeholder}
                  />
                )}
                {field.secret && (
                  <span className="mt-1 block text-xs text-slate-400">
                    Kayıtlı değeri değiştirmek istemiyorsanız alanı olduğu gibi bırakın.
                  </span>
                )}
              </Field>
            ))}
            {configFields.length === 0 && <p className="text-sm text-slate-500">Bu tür için ek alan yok.</p>}
          </div>
        </div>
      </Modal>

      <Modal
        open={formModal.open}
        onClose={() => setFormModal({ ...emptyForm })}
        title={formModal.id ? 'Form Düzenle' : 'Yeni Site Formu'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormModal({ ...emptyForm })}>
              İptal
            </Button>
            <Button onClick={saveForm}>Kaydet</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Form Adı *">
              <Input value={formModal.name} onChange={(e) => setFormModal({ ...formModal, name: e.target.value })} />
            </Field>
            <Field label="Kaynak">
              <Input value={formModal.source} onChange={(e) => setFormModal({ ...formModal, source: e.target.value })} />
            </Field>
            <Field label="Kampanya">
              <Select
                value={formModal.campaignId}
                onChange={(e) => setFormModal({ ...formModal, campaignId: e.target.value })}
              >
                <option value="">Kampanyasız</option>
                {campaigns.map((campaign: any) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Durum">
              <Select
                value={formModal.isActive ? 'true' : 'false'}
                onChange={(e) => setFormModal({ ...formModal, isActive: e.target.value === 'true' })}
              >
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </Field>
          </div>
          <Field label="Başarı Mesajı">
            <Input
              value={formModal.successMessage}
              onChange={(e) => setFormModal({ ...formModal, successMessage: e.target.value })}
              placeholder="Başvurunuz alındı."
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Yönlendirme Adresi">
              <Input
                value={formModal.redirectUrl}
                onChange={(e) => setFormModal({ ...formModal, redirectUrl: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <Field label="İzin Verilen Kaynaklar" hint="Virgülle ayırın. Boş bırakılırsa her kaynaktan kabul edilir.">
              <Input
                value={formModal.allowedOrigins}
                onChange={(e) => setFormModal({ ...formModal, allowedOrigins: e.target.value })}
                placeholder="https://site.com"
              />
            </Field>
          </div>
          <Field
            label="Form Alanları (JSON)"
            hint="Her alan: key, label, type, required. Desteklenen tipler: text, tel, email, textarea, select."
          >
            <textarea
              value={formModal.fields}
              onChange={(e) => setFormModal({ ...formModal, fields: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={campaignModal.open}
        onClose={() => setCampaignModal({ ...emptyCampaign })}
        title={campaignModal.id ? 'Kampanya Düzenle' : 'Yeni Kampanya'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampaignModal({ ...emptyCampaign })}>
              İptal
            </Button>
            <Button onClick={saveCampaign}>Kaydet</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Kampanya Adı *">
            <Input value={campaignModal.name} onChange={(e) => setCampaignModal({ ...campaignModal, name: e.target.value })} />
          </Field>
          <Field label="Kanal *">
            <Select value={campaignModal.channel} onChange={(e) => setCampaignModal({ ...campaignModal, channel: e.target.value })}>
              {['Meta', 'Google', 'TikTok', 'Instagram', 'WhatsApp', 'Web', 'Diğer'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Platform">
            <Input
              value={campaignModal.platform}
              onChange={(e) => setCampaignModal({ ...campaignModal, platform: e.target.value })}
              placeholder="facebook, instagram, google..."
            />
          </Field>
          <Field label="UTM Kampanya Adı" hint="Lead eşleştirmesi bu ad üzerinden yapılır.">
            <Input
              value={campaignModal.utmCampaign}
              onChange={(e) => setCampaignModal({ ...campaignModal, utmCampaign: e.target.value })}
              placeholder="yaz-kampanyasi"
            />
          </Field>
          <Field label="Reklam / Kampanya ID">
            <Input
              value={campaignModal.externalId}
              onChange={(e) => setCampaignModal({ ...campaignModal, externalId: e.target.value })}
            />
          </Field>
          <Field label="Pixel ID">
            <Input value={campaignModal.pixelId} onChange={(e) => setCampaignModal({ ...campaignModal, pixelId: e.target.value })} />
          </Field>
          <Field label="Bütçe (₺)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={campaignModal.budget}
              onChange={(e) => setCampaignModal({ ...campaignModal, budget: e.target.value })}
            />
          </Field>
          <Field label="Durum">
            <Select
              value={campaignModal.isActive ? 'true' : 'false'}
              onChange={(e) => setCampaignModal({ ...campaignModal, isActive: e.target.value === 'true' })}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </Field>
          <Field label="Başlangıç">
            <Input
              type="date"
              value={campaignModal.startDate}
              onChange={(e) => setCampaignModal({ ...campaignModal, startDate: e.target.value })}
            />
          </Field>
          <Field label="Bitiş">
            <Input
              type="date"
              value={campaignModal.endDate}
              onChange={(e) => setCampaignModal({ ...campaignModal, endDate: e.target.value })}
            />
          </Field>
          <Field label="Notlar" className="sm:col-span-2">
            <Input value={campaignModal.notes} onChange={(e) => setCampaignModal({ ...campaignModal, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsPage;

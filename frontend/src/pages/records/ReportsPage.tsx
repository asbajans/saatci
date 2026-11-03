import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LoadingText,
  PageHeader,
  Select,
  StatCard,
  Table,
} from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
  ROLE_LABEL,
  SOURCES,
  VISIT_STATUS_LABEL,
  dateOnly,
  money,
  statusTone,
} from '../../lib/format';

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const monthStart = () => {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const pct = (value: number | null | undefined) => (value === null || value === undefined ? '-' : `%${value}`);
const multiple = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : `${value}x`;

export const ReportsPage: React.FC = () => {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(toInputDate(new Date()));
  const [channel, setChannel] = useState('');
  const [campaignId, setCampaignId] = useState('');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports', { from, to, channel, campaignId }],
    queryFn: async () => {
      const res = await api.get('/reports', {
        params: {
          ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
          ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
          ...(channel ? { channel } : {}),
          ...(campaignId ? { campaignId } : {}),
        },
      });
      return res.data.data as any;
    },
  });

  const totals = data?.totals;

  const typeRows = useMemo(
    () =>
      Object.entries(APPT_TYPE_LABEL).map(([key, label]) => ({
        key,
        label,
        total: data?.appointmentByType?.[key]?.total || 0,
        completed: data?.appointmentByType?.[key]?.completed || 0,
      })),
    [data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        subtitle="Reklam kanalları, kampanyalar, randevuyu veren personel, doktor ve satış performansı"
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Field label="Başlangıç">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Bitiş">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Kanal">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Tüm Kanallar</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Bilinmiyor">Bilinmiyor</option>
            </Select>
          </Field>
          <Field label="Kampanya">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Tüm Kampanyalar</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-slate-400">
            {dateOnly(`${from}T00:00:00.000Z`)} - {dateOnly(`${to}T00:00:00.000Z`)}
          </p>
        </div>
      </Card>

      {isLoading || !data || !totals ? (
        <LoadingText />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Lead" value={totals.leads} hint={`Hastaya dönüşüm ${pct(totals.leadToPatient)}`} tone="violet" />
            <StatCard label="Hasta" value={totals.patients} hint={`Lead → randevu ${pct(totals.leadToAppointment)}`} />
            <StatCard label="Randevu" value={totals.appointments} hint={`Randevu → geliş ${pct(totals.appointmentToVisit)}`} tone="blue" />
            <StatCard label="Geliş" value={totals.visits} hint="Protokol oluşturulan ziyaret" tone="amber" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Satış" value={totals.sales} hint={`Ortalama ${money(totals.avgTicket)}`} tone="green" />
            <StatCard label="Ciro" value={money(totals.revenue)} tone="green" />
            <StatCard label="Reklam Harcaması" value={money(totals.adSpend)} hint={`ROI ${multiple(totals.roi)}`} tone="violet" />
            <StatCard label="Tahsilat" value={money(totals.collected)} hint={`Kalan ${money(totals.outstanding)}`} tone="amber" />
          </div>

          <Card>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Kanal Performansı</h2>
              <p className="text-xs text-slate-400">Reklam ve iletişim kanallarının lead, randevu, geliş ve satış dönüşümü</p>
            </div>
            {data.byChannel.length === 0 ? (
              <Empty title="Seçilen dönemde kanal verisi yok" />
            ) : (
              <Table
                head={[
                  'Kanal',
                  'Lead',
                  'Hasta',
                  'Randevu',
                  'Geliş',
                  'Satış',
                  'Ciro',
                  'Harcama',
                  'ROI',
                  'CPL',
                  'Lead → Randevu',
                  'Geliş → Satış',
                ]}
              >
                {data.byChannel.map((row: any) => (
                  <tr key={row.channel} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.channel}</td>
                    <td className="px-4 py-3">{row.leads}</td>
                    <td className="px-4 py-3">{row.patients}</td>
                    <td className="px-4 py-3">{row.appointments}</td>
                    <td className="px-4 py-3">{row.visits}</td>
                    <td className="px-4 py-3">{row.sales}</td>
                    <td className="px-4 py-3 font-semibold">{money(row.revenue)}</td>
                    <td className="px-4 py-3 text-slate-500">{money(row.spend)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.roi && row.roi >= 1 ? 'green' : 'amber'}>{multiple(row.roi)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{money(row.cpl)}</td>
                    <td className="px-4 py-3 text-slate-500">{pct(row.leadToAppointment)}</td>
                    <td className="px-4 py-3 text-slate-500">{pct(row.visitToSale)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Kampanya Performansı</h2>
              <p className="text-xs text-slate-400">Bütçe, lead maliyeti ve kampanya cirosu</p>
            </div>
            {data.byCampaign.length === 0 ? (
              <Empty title="Kampanya verisi yok" />
            ) : (
              <Table head={['Kampanya', 'Kanal', 'Bütçe', 'Lead', 'Hasta', 'Randevu', 'Geliş', 'Satış', 'Ciro', 'ROI', 'CPL']}>
                {data.byCampaign.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3">{row.channel}</td>
                    <td className="px-4 py-3 text-slate-500">{money(row.budget)}</td>
                    <td className="px-4 py-3">{row.leads}</td>
                    <td className="px-4 py-3">{row.patients}</td>
                    <td className="px-4 py-3">{row.appointments}</td>
                    <td className="px-4 py-3">{row.visits}</td>
                    <td className="px-4 py-3">{row.sales}</td>
                    <td className="px-4 py-3 font-semibold">{money(row.revenue)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.roi && row.roi >= 1 ? 'green' : 'amber'}>{multiple(row.roi)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{money(row.cpl)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Randevuyu Veren Personel</h2>
                <p className="text-xs text-slate-400">Çağrı merkezi ve banko randevu performansı</p>
              </div>
              {data.bookedBy.length === 0 ? (
                <Empty title="Randevu kaydı yok" />
              ) : (
                <Table head={['Personel', 'Rol', 'Randevu', 'Lead Randevusu', 'Tamamlanan']}>
                  {data.bookedBy.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-slate-500">{ROLE_LABEL[row.role] || row.role}</td>
                      <td className="px-4 py-3 font-semibold">{row.total}</td>
                      <td className="px-4 py-3">{row.leadBookings}</td>
                      <td className="px-4 py-3 text-emerald-600">{row.completed}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <Card>
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Doktor Performansı</h2>
                <p className="text-xs text-slate-400">Muayene, tedavi ve tamamlanan gelişler</p>
              </div>
              {data.doctorPerformance.length === 0 ? (
                <Empty title="Doktor kaydı yok" />
              ) : (
                <Table head={['Doktor', 'Muayene', 'Tedavi', 'Tamamlanan', 'Tamamlanan Geliş']}>
                  {data.doctorPerformance.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.examinations}</td>
                      <td className="px-4 py-3">{row.treatments}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{row.completed}</td>
                      <td className="px-4 py-3">{row.visitsCompleted}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Satış Performansı</h2>
                <p className="text-xs text-slate-400">Sağlık Danışmanı bazında plan, satış ve ciro</p>
              </div>
              {data.salesPerformance.length === 0 ? (
                <Empty title="Satış kaydı yok" />
              ) : (
                <Table head={['Sağlık Danışmanı', 'Görüşme', 'Plan', 'Satış', 'Ciro']}>
                  {data.salesPerformance.map((row: any) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.meetings}</td>
                      <td className="px-4 py-3">{row.plans}</td>
                      <td className="px-4 py-3 font-semibold">{row.sales}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Randevu Türleri</h2>
              <div className="space-y-3">
                {typeRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{row.label}</p>
                      <p className="text-xs text-slate-400">Tamamlanan: {row.completed}</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{row.total}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Randevu Durumu</p>
                  <div className="space-y-1">
                    {Object.entries(data.appointmentByStatus || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <Badge tone={statusTone(key)}>{APPT_STATUS_LABEL[key] || key}</Badge>
                        <span className="font-semibold">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Geliş Durumu</p>
                  <div className="space-y-1">
                    {Object.entries(data.visitByStatus || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <Badge tone={statusTone(key)}>{VISIT_STATUS_LABEL[key] || key}</Badge>
                        <span className="font-semibold">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Lead Durum Dağılımı</h2>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
                <div key={key} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{data.leadByStatus?.[key] || 0}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

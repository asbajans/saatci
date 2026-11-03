import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Badge, Card, Empty, LoadingText, PageHeader, StatCard, Table } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  dateTime,
  money,
  statusTone,
} from '../../lib/format';

export const Sales: React.FC = () => {
  const { data: consultations = [], isLoading: apptLoading } = useQuery({
    queryKey: ['appointments', { type: 'MEETING', scope: 'upcoming' }],
    queryFn: async () =>
      (await api.get('/appointments', { params: { type: 'MEETING', scope: 'upcoming' } })).data.data as any[],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['treatment-plans'],
    queryFn: async () => (await api.get('/treatment')).data.data as any[],
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get('/leads')).data.data as any[],
  });

  const draftPlans = plans.filter((p) => p.status === 'DRAFT');
  const activeLeads = leads.filter((l) => ['NEW', 'CONTACTED', 'CLINIC_VISIT', 'TREATMENT_APPROVED'].includes(l.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sağlık Danışmanı Paneli"
        subtitle="Görüşme randevuları, tedavi planı hazırlığı ve lead takibi"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Yaklaşan Görüşme" value={consultations.length} tone="violet" />
        <StatCard label="Taslak Tedavi Planı" value={draftPlans.length} tone="amber" />
        <StatCard label="Aktif Lead" value={activeLeads.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/treatment" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          + Tedavi Planı Çıkart
        </Link>
        <Link to="/appointments" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Görüşme Randevuları
        </Link>
        <Link to="/visits" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Geliş Kayıtları
        </Link>
        <Link to="/leads" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Lead Yönetimi
        </Link>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Yaklaşan Görüşmeler</h2>
        </div>
        {apptLoading ? (
          <LoadingText />
        ) : consultations.length === 0 ? (
          <Empty title="Yaklaşan görüşme yok" />
        ) : (
          <Table head={['Kişi', 'Tarih', 'Tür', 'Kanal', 'Durum', 'Personel']}>
            {consultations.map((a: any) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">
                  {a.patient ? `${a.patient.name} ${a.patient.surname}` : `Lead: ${a.lead?.name || '-'}`}
                </td>
                <td className="px-4 py-3">{dateTime(a.appointmentDate)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(a.type)}>{APPT_TYPE_LABEL[a.type]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{a.channel || 'Bilinmiyor'}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(a.status)}>{APPT_STATUS_LABEL[a.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{a.user?.name || '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Taslak Tedavi Planları</h2>
        </div>
        {plansLoading ? (
          <LoadingText />
        ) : draftPlans.length === 0 ? (
          <Empty title="Taslak plan yok" />
        ) : (
          <Table head={['Hasta', 'Toplam', 'Kalem', 'Durum']}>
            {draftPlans.map((plan: any) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-medium">
                  {plan.patient?.name} {plan.patient?.surname}
                </td>
                <td className="px-4 py-3 font-semibold">{money(plan.totalPrice)}</td>
                <td className="px-4 py-3 text-slate-500">{plan.items?.length || 0}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Takip Edilecek Leadler</h2>
        </div>
        {activeLeads.length === 0 ? (
          <Empty title="Takip edilecek lead yok" />
        ) : (
          <Table head={['Ad', 'Telefon', 'Kaynak', 'Durum']}>
            {activeLeads.slice(0, 8).map((lead: any) => (
              <tr key={lead.id}>
                <td className="px-4 py-3 font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                <td className="px-4 py-3">{lead.source}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(lead.status)}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { Badge, Card, Empty, LoadingText, PageHeader, StatCard, Table } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  ROLE_LABEL,
  dateTime,
  money,
  statusTone,
} from '../../lib/format';

export const Dashboard: React.FC = () => {
  const { user } = useAppStore();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data.data as any,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Genel Bakış" subtitle="Klinik performans özeti" />
        <LoadingText />
      </div>
    );
  }

  const leadCounts = data.leadCounts || {};
  const planCounts = data.planCounts || {};
  const totalLeads = Object.values(leadCounts).reduce((sum: number, v: any) => sum + Number(v), 0);
  const totalPlans = Object.values(planCounts).reduce((sum: number, v: any) => sum + Number(v), 0);

  const quickLinks = [
    { label: 'Hastalar', path: '/patients', roles: ['ADMIN', 'CALL_CENTER', 'SALES', 'DENTIST', 'BANKO'] },
    { label: 'Randevular', path: '/appointments', roles: ['ADMIN', 'CALL_CENTER', 'SALES', 'DENTIST', 'BANKO'] },
    { label: 'Gelişler', path: '/visits', roles: ['ADMIN', 'CALL_CENTER', 'SALES', 'DENTIST', 'BANKO'] },
    { label: 'Leadler', path: '/leads', roles: ['ADMIN', 'CALL_CENTER', 'SALES'] },
    { label: 'Tedavi Planları', path: '/treatment', roles: ['ADMIN', 'SALES', 'DENTIST'] },
    { label: 'Faturalar', path: '/invoices', roles: ['ADMIN', 'BANKO'] },
    { label: 'Raporlar', path: '/reports', roles: ['ADMIN'] },
    { label: 'Kullanıcılar', path: '/users', roles: ['ADMIN'] },
  ].filter((link) => link.roles.includes(user?.role || ''));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        subtitle={`Hoş geldiniz ${user?.name} · ${ROLE_LABEL[user?.role || ''] || user?.role}`}
        action={
          user?.role === 'ADMIN' ? (
            <Link
              to="/reports"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Raporları Görüntüle
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Toplam Hasta" value={data.totalPatients} hint={`${totalLeads} lead havuzda`} />
        <StatCard label="Bugünkü Randevu" value={data.todaysAppointments} hint={`${data.pendingAppointments} onay bekliyor`} tone="blue" />
        <StatCard label="Bugünkü Geliş" value={data.todaysVisits} hint={`${data.waitingVisits} bekliyor`} tone="violet" />
        <StatCard label="Bu Ay Tahsilat" value={money(data.monthlyRevenue)} tone="green" />
        <StatCard label="Kalan Bakiye" value={money(data.outstanding)} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">
              {user?.role === 'DENTIST' ? 'Bugünkü Randevularım' : 'Yaklaşan Randevular'}
            </h2>
          </div>
          {data.upcomingAppointments?.length ? (
            <Table head={['Kişi', 'Tarih', 'Tür', 'Kanal', 'Durum', 'Personel', 'Geliş']}>
              {data.upcomingAppointments.map((a: any) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">
                    {a.patient ? `${a.patient.name} ${a.patient.surname}` : `Lead: ${a.lead?.name || '-'}`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateTime(a.appointmentDate)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(a.type)}>{APPT_TYPE_LABEL[a.type]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.channel || 'Bilinmiyor'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(a.status)}>{APPT_STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.user?.name || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.visit?.protokolNo || '-'}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="Yaklaşan randevu yok" />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Lead Hunisi</h2>
            <div className="space-y-2">
              {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => {
                const count = Number(leadCounts[key] || 0);
                const width = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-blue-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Tedavi Planları</h2>
            <div className="space-y-2">
              {Object.entries(PLAN_STATUS_LABEL).map(([key, label]) => {
                const count = Number(planCounts[key] || 0);
                const width = totalPlans ? Math.round((count / totalPlans) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Son Leadler</h2>
        </div>
        {data.recentLeads?.length ? (
          <Table head={['Ad', 'Telefon', 'Kaynak', 'Kampanya', 'Durum']}>
            {data.recentLeads.map((lead: any) => (
              <tr key={lead.id}>
                <td className="px-4 py-3 font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                <td className="px-4 py-3">{lead.source}</td>
                <td className="px-4 py-3 text-slate-500">{lead.campaign?.name || '-'}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(lead.status)}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Lead kaydı yok" />
        )}
      </Card>
    </div>
  );
};

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Badge, Card, Empty, LoadingText, PageHeader, StatCard, Table } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
  dateTime,
  statusTone,
} from '../../lib/format';

export const CallCenter: React.FC = () => {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data.data as any,
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get('/leads')).data.data as any[],
  });

  const { data: todayAppointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ['appointments', { scope: 'today' }],
    queryFn: async () => (await api.get('/appointments', { params: { scope: 'today' } })).data.data as any[],
  });

  const openLeads = leads.filter((l) => l.status === 'NEW' || l.status === 'CONTACTED');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Çağrı Merkezi Paneli"
        subtitle="Gelen leadler, hasta kayıtları ve günlük randevu akışı"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Açık Lead" value={openLeads.length} hint="Yeni + iletişimde" tone="amber" />
        <StatCard label="Bugünkü Randevu" value={todayAppointments.length} tone="blue" />
        <StatCard label="Bugünkü Geliş" value={dashboard?.todaysVisits ?? 0} hint={`${dashboard?.waitingVisits ?? 0} bekliyor`} tone="violet" />
        <StatCard label="Toplam Hasta" value={dashboard?.totalPatients ?? '-'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/patients" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          + Hasta Kaydı
        </Link>
        <Link to="/appointments" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          + Randevu Oluştur
        </Link>
        <Link to="/leads" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          + Lead Girişi
        </Link>
        <Link to="/visits" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Geliş Kayıtları
        </Link>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Açık Leadler</h2>
        </div>
        {leadsLoading ? (
          <LoadingText />
        ) : openLeads.length === 0 ? (
          <Empty title="Açık lead yok" hint="Lead sayfasından yeni kayıt ekleyebilirsiniz." />
        ) : (
          <Table head={['Ad', 'Telefon', 'Kaynak', 'Durum']}>
            {openLeads.slice(0, 8).map((lead: any) => (
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

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Bugünkü Randevular</h2>
        </div>
        {apptLoading ? (
          <LoadingText />
        ) : todayAppointments.length === 0 ? (
          <Empty title="Bugün randevu yok" />
        ) : (
          <Table head={['Kişi', 'Saat', 'Tür', 'Kanal', 'Durum', 'Personel', 'Geliş']}>
            {todayAppointments.map((a: any) => (
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
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.visit?.protokolNo || '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

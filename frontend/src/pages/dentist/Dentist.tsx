import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Badge, Card, Empty, LoadingText, PageHeader, StatCard, Table } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  PLAN_STATUS_LABEL,
  dateTime,
  money,
  statusTone,
} from '../../lib/format';

export const Dentist: React.FC = () => {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data.data as any,
  });

  const { data: appointments = [], isLoading: apptLoading } = useQuery({
    queryKey: ['appointments', { scope: 'upcoming' }],
    queryFn: async () => (await api.get('/appointments', { params: { scope: 'upcoming' } })).data.data as any[],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['treatment-plans'],
    queryFn: async () => (await api.get('/treatment')).data.data as any[],
  });

  const activePlans = plans.filter((p) => p.status === 'IN_PROGRESS');
  const treatmentAppointments = appointments.filter((a) => a.type === 'EXAMINATION' || a.type === 'TREATMENT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doktor Paneli"
        subtitle="Muayene ve tedavi randevuları, geliş kayıtları ve devam eden tedavi planları"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Bugünkü Randevum" value={dashboard?.myTodayAppointments ?? 0} tone="blue" />
        <StatCard label="Bugünkü Geliş" value={dashboard?.todaysVisits ?? 0} hint={`${dashboard?.waitingVisits ?? 0} bekliyor`} tone="violet" />
        <StatCard label="Devam Eden Tedavi" value={activePlans.length} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/appointments" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          Randevularım
        </Link>
        <Link to="/visits" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Geliş Kayıtları
        </Link>
        <Link to="/patients" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Hasta Tıbbi Kartı
        </Link>
        <Link to="/treatment" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Tedavi Planları
        </Link>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Yaklaşan Muayene / Tedavi Randevularım</h2>
        </div>
        {apptLoading ? (
          <LoadingText />
        ) : treatmentAppointments.length === 0 ? (
          <Empty title="Yaklaşan muayene veya tedavi randevunuz yok" />
        ) : (
          <Table head={['Hasta', 'Tarih', 'Tür', 'Kanal', 'Durum', 'Randevu No', 'Geliş']}>
            {treatmentAppointments.map((a: any) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">
                  {a.patient?.name} {a.patient?.surname}
                </td>
                <td className="px-4 py-3">{dateTime(a.appointmentDate)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(a.type)}>{APPT_TYPE_LABEL[a.type]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{a.channel || 'Bilinmiyor'}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(a.status)}>{APPT_STATUS_LABEL[a.status]}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.randevuNo}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.visit?.protokolNo || '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Devam Eden Tedavi Planları</h2>
        </div>
        {plansLoading ? (
          <LoadingText />
        ) : activePlans.length === 0 ? (
          <Empty title="Devam eden tedavi planı yok" />
        ) : (
          <Table head={['Hasta', 'Toplam', 'Kalemler', 'Durum']}>
            {activePlans.map((plan: any) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-medium">
                  {plan.patient?.name} {plan.patient?.surname}
                </td>
                <td className="px-4 py-3 font-semibold">{money(plan.totalPrice)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {plan.items?.map((item: any) => item.treatment).join(', ')}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

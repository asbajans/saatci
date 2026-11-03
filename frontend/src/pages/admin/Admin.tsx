import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { LoadingText, PageHeader, StatCard } from '../../components/ui';
import { money } from '../../lib/format';
import { UsersPage } from '../records/UsersPage';

export const Admin: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data.data as any,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yönetici Paneli"
        subtitle="Klinik özeti, kullanıcı yönetimi ve kampanya ayarları"
      />

      {!data ? (
        <LoadingText />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="Toplam Hasta" value={data.totalPatients} />
          <StatCard label="Bugünkü Randevu" value={data.todaysAppointments} tone="blue" />
          <StatCard label="Bugünkü Geliş" value={data.todaysVisits} hint={`${data.waitingVisits} bekliyor`} tone="violet" />
          <StatCard label="Bu Ay Tahsilat" value={money(data.monthlyRevenue)} tone="green" />
          <StatCard label="Kalan Bakiye" value={money(data.outstanding)} tone="amber" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to="/integrations" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          Entegrasyon & Kampanya
        </Link>
        <Link to="/reports" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Kanal / Personel Raporları
        </Link>
        <Link to="/appointments" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Randevular
        </Link>
        <Link to="/visits" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Geliş Kayıtları
        </Link>
        <Link to="/leads" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Leadler
        </Link>
      </div>

      <UsersPage />
    </div>
  );
};

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Badge, Card, Empty, LoadingText, PageHeader, StatCard, Table } from '../../components/ui';
import { INVOICE_STATUS_LABEL, VISIT_STATUS_LABEL, dateOnly, dateTime, isToday, money, statusTone } from '../../lib/format';

export const Banko: React.FC = () => {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await api.get('/invoices')).data.data as any[],
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => (await api.get('/visits')).data.data as any[],
  });

  const todaysVisits = useMemo(() => visits.filter((visit) => isToday(visit.visitDate)), [visits]);

  const summary = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const paid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    return { total, paid, remaining: total - paid };
  }, [invoices]);

  const openInvoices = invoices.filter((inv) => inv.status !== 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banko (Maliye) Paneli"
        subtitle="Fatura, tahsilat ve kalan bakiye takibi"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Toplam Faturalanan" value={money(summary.total)} />
        <StatCard label="Tahsil Edilen" value={money(summary.paid)} tone="green" />
        <StatCard label="Kalan Bakiye" value={money(summary.remaining)} tone="amber" />
        <StatCard label="Bugünkü Geliş" value={todaysVisits.length} hint={`${visits.filter((v) => v.status === 'WAITING').length} bekliyor`} tone="violet" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/visits" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">
          Geliş / Protokol İşlemleri
        </Link>
        <Link to="/invoices" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          + Fatura / Ödeme İşlemleri
        </Link>
        <Link to="/collections" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
          Tahsilat / Kasa
        </Link>
        <Link to="/appointments" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:border-blue-400">
          Randevu Onayları
        </Link>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Bugünkü Gelişler</h2>
        </div>
        {todaysVisits.length === 0 ? (
          <Empty title="Bugün geliş kaydı yok" hint="Randevu sayfasından 'Geliş Al' ile protokol oluşturabilirsiniz." />
        ) : (
          <Table head={['Protokol No', 'Hasta / Lead', 'Randevu', 'Kanal', 'Saat', 'Durum']}>
            {todaysVisits.map((visit: any) => {
              const person = visit.patient || visit.lead;
              return (
                <tr key={visit.id}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{visit.protokolNo}</td>
                  <td className="px-4 py-3 font-medium">
                    {person?.name} {person?.surname || ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{visit.appointment?.randevuNo || '-'}</td>
                  <td className="px-4 py-3">{visit.channel || 'Bilinmiyor'}</td>
                  <td className="px-4 py-3">{dateTime(visit.visitDate)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(visit.status)}>{VISIT_STATUS_LABEL[visit.status]}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Açık Faturalar</h2>
        </div>
        {isLoading ? (
          <LoadingText />
        ) : openInvoices.length === 0 ? (
          <Empty title="Açık fatura yok" hint="Tüm faturalar tahsil edilmiş görünüyor." />
        ) : (
          <Table head={['Hasta', 'Fatura', 'Ödenen', 'Kalan', 'Durum', 'Vade']}>
            {openInvoices.map((inv: any) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-medium">
                  {inv.plan?.patient?.name} {inv.plan?.patient?.surname}
                </td>
                <td className="px-4 py-3">{money(inv.amount)}</td>
                <td className="px-4 py-3 text-emerald-600">{money(inv.paidAmount)}</td>
                <td className="px-4 py-3 font-semibold">{money(Number(inv.amount) - Number(inv.paidAmount))}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(inv.status)}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(inv.dueDate)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  LoadingText,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Table,
} from '../../components/ui';
import {
  APPT_TYPE_LABEL,
  SOURCES,
  VISIT_STATUS_LABEL,
  apiError,
  dateTime,
  isToday,
  statusTone,
} from '../../lib/format';

export const VisitsPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');

  const canManage = ['ADMIN', 'CALL_CENTER', 'SALES', 'BANKO', 'DENTIST'].includes(user?.role || '');

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits', { status, channel }],
    queryFn: async () => {
      const res = await api.get('/visits', {
        params: {
          ...(status ? { status } : {}),
          ...(channel ? { channel } : {}),
        },
      });
      return res.data.data as any[];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', { scope: 'upcoming' }],
    queryFn: async () =>
      (await api.get('/appointments', { params: { scope: 'upcoming' } })).data.data as any[],
  });

  const waitingAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => !a.visit && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW'
      ),
    [appointments]
  );

  const summary = useMemo(() => {
    const todays = visits.filter((v) => isToday(v.visitDate)).length;
    const waiting = visits.filter((v) => v.status === 'WAITING').length;
    const active = visits.filter((v) => v.status === 'IN_PROGRESS').length;
    const completed = visits.filter((v) => v.status === 'COMPLETED').length;
    return { todays, waiting, active, completed };
  }, [visits]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['visits'] });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['patient'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/visits', { appointmentId })).data.data,
    onSuccess: (visit) => {
      invalidate();
      setCreateOpen(false);
      setAppointmentId('');
      alert(`Geliş kaydı oluşturuldu. Protokol No: ${visit.protokolNo}`);
    },
    onError: (err) => alert(apiError(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/visits/${id}/status`, { status });
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geliş Kayıtları"
        subtitle="Kliniğe gelen her hasta veya lead için protokol numarası üretilir; kanal ve kampanya bilgisi randevudan taşınır"
        action={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>+ Geliş Kaydı Al</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Bugünkü Geliş" value={summary.todays} tone="blue" />
        <StatCard label="Bekleyen" value={summary.waiting} tone="amber" />
        <StatCard label="İşlemde" value={summary.active} tone="violet" />
        <StatCard label="Tamamlanan" value={summary.completed} tone="green" />
      </div>

      <Card className="p-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
          <option value="">Tüm Durumlar</option>
          {Object.entries(VISIT_STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="max-w-[180px]">
          <option value="">Tüm Kanallar</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="Bilinmiyor">Bilinmiyor</option>
        </Select>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : visits.length === 0 ? (
          <Empty title="Geliş kaydı bulunamadı" hint="Randevulardan 'Geliş Al' ile kayıt oluşturabilirsiniz." />
        ) : (
          <Table
            head={['Protokol No', 'Hasta / Lead', 'Randevu', 'Kanal', 'Geliş Tarihi', 'Durum', 'İşlem']}
          >
            {visits.map((visit: any) => {
              const person = visit.patient || visit.lead;
              return (
                <tr key={visit.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {visit.protokolNo}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {person?.name} {person?.surname || ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {visit.patient ? visit.patient.hastaNo : 'Lead · hasta kaydı yok'} · {person?.phone}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {visit.appointment ? (
                      <>
                        <p className="font-mono text-xs text-slate-500">{visit.appointment.randevuNo}</p>
                        <p className="text-xs text-slate-500">
                          {APPT_TYPE_LABEL[visit.appointment.type]} · {dateTime(visit.appointment.appointmentDate)}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Randevusuz</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{visit.channel || 'Bilinmiyor'}</p>
                    <p className="text-xs text-slate-400">{visit.campaign?.name || '-'}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateTime(visit.visitDate)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(visit.status)}>{VISIT_STATUS_LABEL[visit.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center justify-end gap-2">
                        {visit.status === 'WAITING' && (
                          <Button
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: visit.id, status: 'IN_PROGRESS' })}
                          >
                            İşleme Al
                          </Button>
                        )}
                        {visit.status === 'IN_PROGRESS' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => statusMutation.mutate({ id: visit.id, status: 'COMPLETED' })}
                          >
                            Tamamla
                          </Button>
                        )}
                        <Select
                          value={visit.status}
                          onChange={(e) => statusMutation.mutate({ id: visit.id, status: e.target.value })}
                          className="text-xs py-1 max-w-[130px]"
                        >
                          {Object.entries(VISIT_STATUS_LABEL).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Geliş Kaydı Al"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!appointmentId || createMutation.isPending}>
              {createMutation.isPending ? 'Kaydediliyor...' : 'Geliş Kaydı Oluştur'}
            </Button>
          </>
        }
      >
        <Field label="Randevu *" hint="Geliş kaydı seçilen randevuya bağlanır ve protokol numarası otomatik üretilir.">
          <Select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="">Randevu seçin</option>
            {waitingAppointments.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.randevuNo} · {a.patient ? `${a.patient.name} ${a.patient.surname}` : `Lead: ${a.lead?.name}`} ·{' '}
                {dateTime(a.appointmentDate)}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-slate-400">
          Protokol numarası P-YIL-00000 formatında üretilir; hasta veya lead numarasıyla ilişkilendirilir.
        </p>
      </Modal>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LoadingText,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Table,
} from '../../components/ui';
import { apiError, dateTime, money } from '../../lib/format';

const HANDOVER_LABEL: Record<string, string> = {
  PENDING: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
};

const handoverTone = (status: string) => {
  if (status === 'APPROVED') return 'green' as const;
  if (status === 'REJECTED') return 'red' as const;
  return 'amber' as const;
};

export const CollectionsPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ toUserId: '', amount: '', note: '' });

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections', { from, to, methodFilter }],
    queryFn: async () =>
      (
        await api.get('/collections', {
          params: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(methodFilter ? { methodId: methodFilter } : {}),
          },
        })
      ).data.data as any[],
  });

  const { data: registerInfo } = useQuery({
    queryKey: ['my-register'],
    queryFn: async () => (await api.get('/collections/my-register')).data.data as any,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get('/collections/payment-methods')).data.data as any[],
  });

  const { data: registers = [] } = useQuery({
    queryKey: ['cash-registers'],
    queryFn: async () => (await api.get('/collections/registers')).data.data as any[],
  });

  const { data: handovers = [] } = useQuery({
    queryKey: ['handovers'],
    queryFn: async () => (await api.get('/collections/handovers')).data.data as any[],
  });

  const myBalance = Number(registerInfo?.register?.balance || 0);
  const todayTotal = Number(registerInfo?.todayTotal || 0);
  const listedTotal = useMemo(
    () => collections.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
    [collections]
  );
  const pendingHandovers = handovers.filter((h: any) => h.status === 'PENDING');
  const incomingPending = pendingHandovers.filter((h: any) => h.toUserId === user?.id);
  const recipients = registers.filter((r: any) => r.userId !== user?.id);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['collections'] });
    queryClient.invalidateQueries({ queryKey: ['my-register'] });
    queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
    queryClient.invalidateQueries({ queryKey: ['handovers'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createHandover = useMutation({
    mutationFn: async () => {
      await api.post('/collections/handovers', {
        toUserId: handoverForm.toUserId,
        amount: handoverForm.amount,
        note: handoverForm.note || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setHandoverOpen(false);
      setHandoverForm({ toUserId: '', amount: '', note: '' });
      alert('Kasa teslimi oluşturuldu. Onay bekleniyor.');
    },
    onError: (err) => alert(apiError(err)),
  });

  const approveHandover = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/collections/handovers/${id}/approve`);
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const rejectHandover = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/collections/handovers/${id}/reject`);
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const canRespond = (h: any) => h.status === 'PENDING' && (h.toUserId === user?.id || user?.role === 'ADMIN');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahsilat ve Kasa"
        subtitle="Tüm tahsilatlar, tahsilat türleri, kasa bakiyeleri ve günlük kasa teslimleri"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/invoices"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-400"
            >
              Faturalar / Ödeme Al
            </Link>
            <Button
              onClick={() => {
                setHandoverForm({ toUserId: '', amount: myBalance ? String(myBalance) : '', note: '' });
                setHandoverOpen(true);
              }}
              disabled={myBalance <= 0}
            >
              Kasa Teslimi Yap
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Kasa Bakiyem" value={money(myBalance)} tone="green" hint={`${user?.name || ''} kasası`} />
        <StatCard label="Bugün Tahsilatım" value={money(todayTotal)} tone="blue" />
        <StatCard label="Listedeki Tahsilat" value={money(listedTotal)} hint={`${collections.length} işlem`} tone="violet" />
        <StatCard
          label="Bekleyen Kasa Teslimi"
          value={pendingHandovers.length}
          hint={`${incomingPending.length} onayınızı bekliyor`}
          tone="amber"
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Başlangıç" className="max-w-[180px]">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Bitiş" className="max-w-[180px]">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Tahsilat Türü" className="max-w-[220px]">
            <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">Tümü</option>
              {paymentMethods.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          {(from || to || methodFilter) && (
            <Button
              variant="secondary"
              onClick={() => {
                setFrom('');
                setTo('');
                setMethodFilter('');
              }}
            >
              Filtreyi Temizle
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Tahsilatlar</h2>
        </div>
        {isLoading ? (
          <LoadingText />
        ) : collections.length === 0 ? (
          <Empty title="Tahsilat bulunamadı" hint="Fatura ekranından ödeme alarak tahsilat oluşturabilirsiniz." />
        ) : (
          <Table head={['Tarih', 'Hasta', 'Fatura', 'Tutar', 'Tür', 'Tahsil Eden', 'Not']}>
            {collections.map((c: any) => {
              const person = c.patient;
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{dateTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {person ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          {person.name} {person.surname}
                        </p>
                        <p className="text-xs text-slate-400">
                          {person.hastaNo} · {person.phone}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.invoice ? `${money(c.invoice.amount)} / ${money(c.invoice.paidAmount)}` : '-'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{money(c.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{c.method?.name || '-'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.collectedBy?.name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.notes || '-'}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Kasa Bakiyeleri</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
          {registers.map((r: any) => (
            <div
              key={r.userId}
              className={`rounded-lg border p-4 ${
                r.userId === user?.id ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">
                {r.name} {r.userId === user?.id ? '(Ben)' : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">{r.role === 'ADMIN' ? 'Yönetici' : 'Banko'}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{money(r.balance)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Kasa Teslimleri</h2>
          <p className="mt-1 text-xs text-slate-500">
            Teslimi alan kişi onayladığında bakiye gönderenin kasasından alıcının kasasına aktarılır.
          </p>
        </div>
        {handovers.length === 0 ? (
          <Empty title="Kasa teslimi yok" hint="Kasam bölümünden günlük kasa teslimi oluşturabilirsiniz." />
        ) : (
          <Table head={['Tarih', 'Gönderen', 'Alıcı', 'Tutar', 'Durum', 'Onaylayan', 'İşlem']}>
            {handovers.map((h: any) => (
              <tr key={h.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{dateTime(h.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{h.fromUser?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-700">{h.toUser?.name || '-'}</td>
                <td className="px-4 py-3 font-semibold">{money(h.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={handoverTone(h.status)}>{HANDOVER_LABEL[h.status] || h.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{h.approvedBy?.name || '-'}</p>
                  <p className="text-xs text-slate-400">{h.approvedAt ? dateTime(h.approvedAt) : ''}</p>
                </td>
                <td className="px-4 py-3">
                  {canRespond(h) ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => approveHandover.mutate(h.id)}
                        disabled={approveHandover.isPending}
                      >
                        Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => rejectHandover.mutate(h.id)}
                        disabled={rejectHandover.isPending}
                      >
                        Reddet
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{h.note || '-'}</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Kasa Teslimi Yap"
        footer={
          <>
            <Button variant="secondary" onClick={() => setHandoverOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => createHandover.mutate()}
              disabled={
                !handoverForm.toUserId ||
                !handoverForm.amount ||
                Number(handoverForm.amount) <= 0 ||
                createHandover.isPending
              }
            >
              {createHandover.isPending ? 'Gönderiliyor...' : 'Teslimi Gönder'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Kasa bakiyeniz: <strong>{money(myBalance)}</strong>. Teslim onaylandığında bakiye seçtiğiniz kişiye
          aktarılır.
        </p>
        <Field label="Teslim Alacak Kişi *">
          <Select
            value={handoverForm.toUserId}
            onChange={(e) => setHandoverForm({ ...handoverForm, toUserId: e.target.value })}
          >
            <option value="">Seçiniz</option>
            {recipients.map((r: any) => (
              <option key={r.userId} value={r.userId}>
                {r.name} ({r.role === 'ADMIN' ? 'Yönetici' : 'Banko'})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Teslim Tutarı (TL) *">
          <Input
            type="number"
            value={handoverForm.amount}
            onChange={(e) => setHandoverForm({ ...handoverForm, amount: e.target.value })}
          />
        </Field>
        <Field label="Not">
          <Input
            value={handoverForm.note}
            onChange={(e) => setHandoverForm({ ...handoverForm, note: e.target.value })}
            placeholder="Örn: Günlük kasa teslimi"
          />
        </Field>
      </Modal>
    </div>
  );
};

export default CollectionsPage;

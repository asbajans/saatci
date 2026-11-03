import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { PatientPicker } from '../../components/PatientPicker';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, SearchSelect, Select, Table } from '../../components/ui';
import {
  INVOICE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  apiError,
  dateOnly,
  money,
  statusTone,
} from '../../lib/format';

type ItemForm = { toothNo: string; serviceId: string; treatment: string; price: string; quantity: number };

const newItem = (): ItemForm => ({ toothNo: '', serviceId: '', treatment: '', price: '', quantity: 1 });

export const TreatmentPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [items, setItems] = useState<ItemForm[]>([newItem()]);
  const [discount, setDiscount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');


  const canManage = ['ADMIN', 'SALES', 'DENTIST'].includes(user?.role || '');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans'],
    queryFn: async () => (await api.get('/treatment')).data.data as any[],
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await api.get('/settings/services')).data.data as any[],
  });

  const serviceOptions = [
    { value: '', label: 'Hizmet Secin' },
    ...(services || []).map((s: any) => ({ value: s.id, label: `${s.category} - ${s.name} (${String(s.price)})` })),
  ];

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data as any[],
  });

  const doctors = (allUsers || []).filter((u: any) => u.role === 'DENTIST');

  const { data: detail } = useQuery({
    queryKey: ['treatment-plan', detailId],
    enabled: !!detailId,
    queryFn: async () => (await api.get(`/treatment/${detailId}`)).data.data as any,
  });

  const total = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + (Number(item.price) || 0) * item.quantity, 0);
    return Math.max(0, sum - (Number(discount) || 0));
  }, [items, discount]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    queryClient.invalidateQueries({ queryKey: ['treatment-plan'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['patient'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/treatment', {
        patientId,
        doctorId: doctorId || undefined,
        totalPrice: String(total),
        discount: String(Number(discount) || 0),
        paymentPlan: paymentNote ? { note: paymentNote } : undefined,
        items: items.map((item, index) => ({
          toothNo: item.toothNo || undefined,
          serviceId: item.serviceId || undefined,
          treatment: item.treatment,
          price: item.price,
          quantity: item.quantity,
          stepOrder: index + 1,
        })),
      });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setPatientId('');
      setDoctorId('');
      setItems([newItem()]);
      setDiscount('');
      setPaymentNote('');
    },
    onError: (err) => alert(apiError(err)),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/treatment/${id}/approve`);
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/treatment/${id}/status`, { status });
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const validItems = items.filter((item) => item.treatment.trim() && item.price !== '');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tedavi Planları"
        subtitle="Tedavi kalemleri, fiyatlar, onay ve uygulama durumu"
        action={canManage ? <Button onClick={() => setCreateOpen(true)}>+ Yeni Tedavi Planı</Button> : undefined}
      />

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : plans.length === 0 ? (
          <Empty title="Tedavi planı bulunamadı" />
        ) : (
          <Table head={['Hasta', 'Kanal', 'Satışı Yapan', 'Durum', 'Toplam', 'Kalem', 'Tarih', 'İşlem']}>
            {plans.map((plan: any) => (
              <tr key={plan.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button className="text-left" onClick={() => setDetailId(plan.id)}>
                    <p className="font-semibold text-slate-900">
                      {plan.patient?.name} {plan.patient?.surname}
                    </p>
                    <p className="text-xs text-slate-400">{plan.patient?.hastaNo}</p>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{plan.channel || 'Bilinmiyor'}</p>
                  <p className="text-xs text-slate-400">{plan.campaign?.name || '-'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{plan.createdBy?.name || '-'}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
                </td>
                <td className="px-4 py-3 font-semibold">{money(plan.totalPrice)}</td>
                <td className="px-4 py-3 text-slate-500">{plan.items?.length || 0}</td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(plan.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {canManage && plan.status === 'DRAFT' && (
                      <Button size="sm" variant="success" onClick={() => approveMutation.mutate(plan.id)}>
                        Onayla
                      </Button>
                    )}
                    {canManage && (
                      <Select
                        value={plan.status}
                        onChange={(e) => statusMutation.mutate({ id: plan.id, status: e.target.value })}
                        className="text-xs py-1 max-w-[150px]"
                      >
                        {Object.entries(PLAN_STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setDetailId(plan.id)}>
                      Detay
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Yeni Tedavi Planı"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!patientId || !doctorId || validItems.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Planı Kaydet'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Hasta *" hint="Ad, telefon veya TC ile arayın. Kayıtlı değilse aynı ekrandan yeni hasta oluşturabilirsiniz.">
            <PatientPicker value={patientId} onChange={setPatientId} />
          </Field>
          <Field label="Doktor *">
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Doktor seçin</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.role})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Tedavi Kalemleri</p>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2">
                <Input
                  placeholder="Diş No"
                  value={item.toothNo}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...item, toothNo: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
              <div className="col-span-3">
                <SearchSelect
                  value={item.serviceId}
                  onChange={(serviceId) => {
                    const next = [...items];
                    const service = (services || []).find((s: any) => s.id === serviceId);
                    next[index] = {
                      ...item,
                      serviceId,
                      treatment: service ? `${service.category} - ${service.name}` : item.treatment,
                      price: service ? String(service.price) : item.price,
                    };
                    setItems(next);
                  }}
                  options={serviceOptions}
                  placeholder="Hizmet Secin"
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Fiyat"
                  value={item.price}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...item, price: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Adet"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...item, quantity: Math.max(1, Number(e.target.value) || 1) };
                    setItems(next);
                  }}
                />
              </div>
              <div className="col-span-1">
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => setItems(items.length > 1 ? items.filter((_, i) => i !== index) : items)}
                >
                  Sil
                </Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setItems([...items, newItem()])}>
            + Kalem Ekle
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="İndirim (TL)">
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Ödeme Planı Notu">
            <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="örn. 3 taksit" />
          </Field>
        </div>

        <div className="text-right text-lg font-bold text-slate-900">Toplam: {money(total)}</div>
      </Modal>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Tedavi Planı Detayı" wide>
        {!detail ? (
          <LoadingText />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={statusTone(detail.status)}>{PLAN_STATUS_LABEL[detail.status]}</Badge>
              <span className="text-sm text-slate-500">
                {detail.patient?.name} {detail.patient?.surname} · {detail.patient?.hastaNo}
              </span>
              <span className="text-sm font-semibold">{money(detail.totalPrice)}</span>
              {Number(detail.discount) > 0 && (
                <span className="text-xs text-slate-400">indirim {money(detail.discount)}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span>Kanal: <strong className="text-slate-700">{detail.channel || 'Bilinmiyor'}</strong></span>
              <span>Kampanya: <strong className="text-slate-700">{detail.campaign?.name || '-'}</strong></span>
              <span>Satışı Yapan: <strong className="text-slate-700">{detail.createdBy?.name || '-'}</strong></span>
            </div>
            {detail.paymentPlan?.note && (
              <p className="text-sm text-slate-500">Ödeme planı: {detail.paymentPlan.note}</p>
            )}
            <Table head={['Sıra', 'Diş', 'Tedavi', 'Adet', 'Birim Fiyat', 'Toplam']}>
              {detail.items?.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{item.stepOrder}</td>
                  <td className="px-4 py-2">{item.toothNo || '-'}</td>
                  <td className="px-4 py-2 font-medium">{item.treatment}</td>
                  <td className="px-4 py-2">{item.quantity}</td>
                  <td className="px-4 py-2">{money(item.price)}</td>
                  <td className="px-4 py-2 font-semibold">{money(Number(item.price) * item.quantity)}</td>
                </tr>
              ))}
            </Table>
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Faturalar</h4>
              {detail.invoices?.length ? (
                <Table head={['Tutar', 'Ödenen', 'Durum', 'Vade']}>
                  {detail.invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2">{money(inv.amount)}</td>
                      <td className="px-4 py-2">{money(inv.paidAmount)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(inv.status)}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                      </td>
                      <td className="px-4 py-2">{dateOnly(inv.dueDate)}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="text-sm text-slate-400">Bu plana ait fatura yok.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

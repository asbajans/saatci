import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, StatCard, Table } from '../../components/ui';
import {
  INVOICE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  apiError,
  dateOnly,
  money,
  statusTone,
} from '../../lib/format';

export const InvoicesPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [planId, setPlanId] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const canManage = ['ADMIN', 'BANKO'].includes(user?.role || '');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await api.get('/invoices')).data.data as any[],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['treatment-plans'],
    queryFn: async () => (await api.get('/treatment')).data.data as any[],
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get('/collections/payment-methods')).data.data as any[],
  });

  const activeMethods = paymentMethods.filter((m: any) => m.isActive);

  const summary = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const paid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    return { total, paid, remaining: total - paid };
  }, [invoices]);

  const invalidation = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    queryClient.invalidateQueries({ queryKey: ['collections'] });
    queryClient.invalidateQueries({ queryKey: ['my-register'] });
    queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/invoices', {
        planId,
        amount: invoiceAmount,
        dueDate: dueDate ? `${dueDate}T12:00:00.000Z` : undefined,
      });
    },
    onSuccess: () => {
      invalidation();
      setCreateOpen(false);
      setPlanId('');
      setInvoiceAmount('');
      setDueDate('');
    },
    onError: (err) => alert(apiError(err)),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      await api.post('/collections', {
        invoiceId: paymentInvoice.id,
        amount,
        methodId,
      });
    },
    onSuccess: () => {
      invalidation();
      setPaymentInvoice(null);
      setAmount('');
      setMethodId('');
    },
    onError: (err) => alert(apiError(err)),
  });

  const payablePlans = plans.filter((plan: any) => plan.status !== 'DRAFT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ödeme ve Faturalar"
        subtitle="Fatura oluşturma, tahsilat ve kalan bakiye takibi"
        action={canManage ? <Button onClick={() => setCreateOpen(true)}>+ Yeni Fatura</Button> : undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Toplam Faturalanan" value={money(summary.total)} />
        <StatCard label="Tahsil Edilen" value={money(summary.paid)} tone="green" />
        <StatCard label="Kalan Bakiye" value={money(summary.remaining)} tone="amber" />
      </div>

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : invoices.length === 0 ? (
          <Empty title="Fatura bulunamadı" hint="Tedavi planı onaylandıktan sonra fatura oluşturabilirsiniz." />
        ) : (
          <Table head={['Hasta', 'Plan Tutarı', 'Fatura', 'Ödenen', 'Kalan', 'Durum', 'Vade', 'İşlem']}>
            {invoices.map((inv: any) => {
              const remaining = Number(inv.amount) - Number(inv.paidAmount);
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {inv.plan?.patient?.name} {inv.plan?.patient?.surname}
                    </p>
                    <p className="text-xs text-slate-400">{inv.plan?.patient?.hastaNo}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{money(inv.plan?.totalPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{money(inv.amount)}</td>
                  <td className="px-4 py-3 text-emerald-600">{money(inv.paidAmount)}</td>
                  <td className="px-4 py-3 text-slate-700">{money(remaining)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(inv.status)}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{dateOnly(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && inv.status !== 'PAID' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => {
                          setPaymentInvoice({ ...inv, remaining });
                          setAmount(String(remaining));
                          setMethodId(activeMethods[0]?.id || '');
                        }}
                      >
                        Ödeme Al
                      </Button>
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
        title="Yeni Fatura"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!planId || !invoiceAmount || createMutation.isPending}>
              Oluştur
            </Button>
          </>
        }
      >
        <Field label="Tedavi Planı *">
          <Select
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              const plan = payablePlans.find((p: any) => p.id === e.target.value);
              if (plan) setInvoiceAmount(String(Number(plan.totalPrice)));
            }}
          >
            <option value="">Plan seçin</option>
            {payablePlans.map((plan: any) => (
              <option key={plan.id} value={plan.id}>
                {plan.patient?.name} {plan.patient?.surname} · {money(plan.totalPrice)} ·{' '}
                {PLAN_STATUS_LABEL[plan.status]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fatura Tutarı (TL) *">
            <Input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          </Field>
          <Field label="Vade Tarihi">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        title="Ödeme Al"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentInvoice(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => payMutation.mutate()} disabled={!amount || !methodId || payMutation.isPending}>
              Tahsil Et
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-600 space-y-1">
          <p>
            Hasta: <strong>{paymentInvoice?.plan?.patient?.name} {paymentInvoice?.plan?.patient?.surname}</strong>
          </p>
          <p>Kalan bakiye: <strong>{money(paymentInvoice?.remaining)}</strong></p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tahsilat Tutarı (TL) *">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tahsilat Türü *">
            <Select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <option value="">Seçiniz</option>
              {activeMethods.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

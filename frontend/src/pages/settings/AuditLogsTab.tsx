import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Select, Table } from '../../components/ui';
import { ROLE_LABEL, apiError, dateTime } from '../../lib/format';

type Filters = {
  q: string;
  action: string;
  entity: string;
  from: string;
  to: string;
};

const emptyFilters: Filters = { q: '', action: '', entity: '', from: '', to: '' };

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Oluşturma',
  UPDATE: 'Güncelleme',
  DELETE: 'Silme',
  LOGIN: 'Giriş',
  LOGIN_FAILED: 'Başarısız Giriş',
  SETUP: 'Kurulum',
  SYNC: 'Senkronizasyon',
  BACKUP: 'Yedekleme',
  APPROVE: 'Onay',
  PAYMENT: 'Ödeme',
  IMPORT: 'İçe Aktarma',
  STATUS_CHANGE: 'Durum Değişikliği',
};

export const AuditLogsTab: React.FC = () => {
  const [form, setForm] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: meta } = useQuery({
    queryKey: ['audit-log-meta'],
    queryFn: async () => (await api.get('/settings/audit-logs/meta')).data.data as any,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return (await api.get(`/settings/audit-logs?${params.toString()}`)).data.data as any;
    },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const apply = () => {
    setPage(1);
    setFilters({ ...form });
  };

  const reset = () => {
    setForm(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <Field label="Ara" className="md:col-span-2">
            <Input
              value={form.q}
              onChange={(event) => setForm({ ...form, q: event.target.value })}
              placeholder="Kullanıcı, açıklama veya yol"
              onKeyDown={(event) => {
                if (event.key === 'Enter') apply();
              }}
            />
          </Field>
          <Field label="İşlem">
            <Select value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })}>
              <option value="">Tümü</option>
              {(meta?.actions || []).map((item: any) => (
                <option key={item.value} value={item.value}>
                  {ACTION_LABEL[item.value] || item.value} ({item.count})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Modül">
            <Select value={form.entity} onChange={(event) => setForm({ ...form, entity: event.target.value })}>
              <option value="">Tümü</option>
              {(meta?.entities || []).map((item: any) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç">
            <Input type="date" value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} />
          </Field>
          <Field label="Bitiş">
            <Input type="date" value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={reset}>
            Temizle
          </Button>
          <Button onClick={apply}>Filtrele</Button>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">İşlem Kayıtları</h3>
          <span className="text-xs text-slate-400">{total} kayıt</span>
        </div>
        {isLoading ? (
          <LoadingText />
        ) : error ? (
          <Empty title="Kayıtlar yüklenemedi" hint={apiError(error)} />
        ) : items.length === 0 ? (
          <Empty title="Kayıt bulunamadı" />
        ) : (
          <Table head={['Tarih', 'Kullanıcı', 'İşlem', 'Modül', 'Açıklama', 'Durum', 'IP']}>
            {items.map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{dateTime(log.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{log.userName || 'Sistem'}</p>
                  <p className="text-xs text-slate-400">
                    {log.userEmail || '-'} {log.role ? `· ${ROLE_LABEL[log.role] || log.role}` : ''}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={log.action === 'DELETE' || log.action === 'LOGIN_FAILED' ? 'red' : 'blue'}>
                    {ACTION_LABEL[log.action] || log.action}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{log.entity}</td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{log.description || '-'}</p>
                  {log.entityId && <p className="text-xs text-slate-400">{log.entityId}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={(log.statusCode || 0) >= 400 ? 'red' : 'green'}>{log.statusCode || '-'}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.ip || '-'}</td>
              </tr>
            ))}
          </Table>
        )}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-400">
            Sayfa {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Önceki
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

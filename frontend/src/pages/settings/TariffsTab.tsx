import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, LoadingText, Table } from '../../components/ui';
import { apiError, dateOnly } from '../../lib/format';

type RemoteDoc = {
  id: number;
  year: number;
  type: string;
  title: string;
  effectiveDate?: string | null;
  pdfUrl?: string | null;
  status?: string;
};

export const TariffsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data: tariffs = [], isLoading } = useQuery({
    queryKey: ['tariffs'],
    queryFn: async () => (await api.get('/tariffs?all=1')).data.data as any[],
  });

  const { data: remoteDocs = [], isLoading: remoteLoading } = useQuery({
    queryKey: ['tdb-remote-docs'],
    queryFn: async () => (await api.get('/tariffs/remote-docs')).data.data as RemoteDoc[],
    staleTime: 10 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: async (doc: RemoteDoc) => {
      setSyncingId(doc.id);
      return (await api.post('/tariffs/sync-tdb', { docId: doc.id })).data.data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tariffs'] });
      alert(`Tarife senkronize edildi. ${data.itemCount} kalem işlendi.`);
    },
    onError: (error) => alert(apiError(error)),
    onSettled: () => setSyncingId(null),
  });

  const importMutation = useMutation({
    mutationFn: async (id: string) => {
      setImportingId(id);
      return (await api.post(`/tariffs/${id}/import-services`)).data.data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
      alert(`${data.itemCount} kalem hizmet listesine aktarıldı.`);
    },
    onError: (error) => alert(apiError(error)),
    onSettled: () => setImportingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tariffs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tariffs'] }),
    onError: (error) => alert(apiError(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/tariffs/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tariffs'] }),
    onError: (error) => alert(apiError(error)),
  });

  const handleDelete = (tariff: any) => {
    if (!confirm(`"${tariff.name}" tarifesini silmek istediğinizden emin misiniz?`)) return;
    deleteMutation.mutate(tariff.id);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-2">
        <h3 className="font-semibold text-slate-900">Türk Dişhekimleri Birliği (TDB) Tarifesi</h3>
        <p className="text-sm text-slate-500">
          TDB'nin resmi tarife yayınları listelenir. Bir yayını senkronize ettiğinizde PDF indirilir, kalemler ve
          KDV'li/KDV'siz fiyatlar okunur. Ardından "Hizmetlere Aktar" ile tedavi planlarında kullanılabilir hale gelir.
        </p>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">TDB Yayınları</h3>
        </div>
        {remoteLoading ? (
          <LoadingText text="TDB tarifeleri getiriliyor..." />
        ) : remoteDocs.length === 0 ? (
          <Empty title="TDB yayını bulunamadı" />
        ) : (
          <Table head={['Yıl', 'Yayın', 'Yürürlük', 'Durum', 'İşlem']}>
            {remoteDocs.map((doc) => (
              <tr key={`${doc.type}-${doc.id}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{doc.year}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{doc.title}</p>
                  <p className="text-xs text-slate-400">{doc.type}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{dateOnly(doc.effectiveDate)}</td>
                <td className="px-4 py-3">
                  <Badge tone={doc.pdfUrl ? 'green' : 'slate'}>{doc.pdfUrl ? 'PDF var' : 'PDF yok'}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    disabled={!doc.pdfUrl || syncingId === doc.id}
                    onClick={() => syncMutation.mutate(doc)}
                  >
                    {syncingId === doc.id ? 'Senkronize ediliyor...' : 'Senkronize Et'}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Kayıtlı Tarifeler</h3>
        </div>
        {isLoading ? (
          <LoadingText />
        ) : tariffs.length === 0 ? (
          <Empty title="Henüz tarife yok" hint="Yukarıdan bir TDB yayınını senkronize edin." />
        ) : (
          <Table head={['Yıl', 'Tarife', 'Tür', 'Kalem', 'Durum', 'İşlem']}>
            {tariffs.map((tariff: any) => (
              <tr key={tariff.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{tariff.year}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{tariff.name}</p>
                  <p className="text-xs text-slate-400">{dateOnly(tariff.effectiveDate)}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={tariff.type === 'TDB' ? 'blue' : 'violet'}>{tariff.type}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{tariff._count?.items ?? 0}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMutation.mutate({ id: tariff.id, isActive: !tariff.isActive })}
                    className="cursor-pointer"
                  >
                    <Badge tone={tariff.isActive ? 'green' : 'slate'}>{tariff.isActive ? 'Aktif' : 'Pasif'}</Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      disabled={importingId === tariff.id}
                      onClick={() => importMutation.mutate(tariff.id)}
                    >
                      {importingId === tariff.id ? 'Aktarılıyor...' : 'Hizmetlere Aktar'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(tariff)}>
                      Sil
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

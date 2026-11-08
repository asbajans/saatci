import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, LoadingText, Table } from '../../components/ui';
import { apiError, dateTime } from '../../lib/format';

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export const BackupsTab: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => (await api.get('/settings/backups')).data.data as any[],
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post('/settings/backups'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      alert('Yedek başarıyla oluşturuldu.');
    },
    onError: (error) => alert(apiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/settings/backups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
    onError: (error) => alert(apiError(error)),
  });

  const download = async (backup: any) => {
    try {
      const response = await api.get(`/settings/backups/${backup.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(apiError(error));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Veritabanı Yedeği</h3>
          <p className="text-sm text-slate-500 mt-1">
            Tüm tabloların JSON kopyasını alır. Dosyalar sunucudaki <code>BACKUP_DIR</code> volume'unda saklanır.
          </p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Yedek alınıyor...' : 'Yeni Yedek Oluştur'}
        </Button>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Yedek Geçmişi</h3>
        </div>
        {isLoading ? (
          <LoadingText />
        ) : backups.length === 0 ? (
          <Empty title="Henüz yedek yok" hint="İlk yedeği oluşturmak için yukarıdaki butonu kullanın." />
        ) : (
          <Table head={['Dosya', 'Boyut', 'Durum', 'Oluşturan', 'Tarih', 'İşlem']}>
            {backups.map((backup: any) => (
              <tr key={backup.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{backup.fileName}</p>
                  {backup.error && <p className="text-xs text-red-500">{backup.error}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatBytes(backup.sizeBytes)}</td>
                <td className="px-4 py-3">
                  <Badge tone={backup.status === 'COMPLETED' ? 'green' : 'red'}>
                    {backup.status === 'COMPLETED' ? 'Tamamlandı' : 'Başarısız'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{backup.createdBy?.name || 'Sistem'}</td>
                <td className="px-4 py-3 text-slate-500">{dateTime(backup.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={backup.status !== 'COMPLETED'}
                      onClick={() => download(backup)}
                    >
                      İndir
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (!confirm('Bu yedeği silmek istediğinizden emin misiniz?')) return;
                        deleteMutation.mutate(backup.id);
                      }}
                    >
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

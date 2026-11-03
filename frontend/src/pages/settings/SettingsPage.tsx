import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table } from '../../components/ui';
import { ROLE_LABEL, dateTime, fromLocalInput, money, toLocalInput } from '../../lib/format';

type Tab = 'services' | 'commissions' | 'calendar' | 'payments';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('services');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayarlar"
        subtitle="Hizmet / ürün yönetimi, komisyon oranları ve personel takvim ayarları"
      />

      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('commissions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'commissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Komisyonlar
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'services' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Hizmetler / Ürünler
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Personel Takvim Ayarları
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'payments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Tahsilat Türleri
          </button>
        </nav>
      </div>

      <div className="px-6 pb-6">
        {activeTab === 'services' ? (
          <ServicesTab />
        ) : activeTab === 'commissions' ? (
          <CommissionsTab />
        ) : activeTab === 'payments' ? (
          <PaymentMethodsTab />
        ) : (
          <CalendarTab />
        )}
      </div>
    </div>
  );
};

const ServicesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; id?: string; name: string; description: string }>({
    open: false,
    name: '',
    description: '',
  });
  const [serviceModal, setServiceModal] = useState<{ open: boolean; id?: string; category: string; name: string; description: string; price: string; isActive: boolean }>({
    open: false,
    category: '',
    name: '',
    description: '',
    price: '',
    isActive: true,
  });

    const { data: services } = useQuery({
      queryKey: ['services'],
      queryFn: async () => (await api.get('/settings/services')).data.data as any[],
    });
  
    const { data: serviceCategories } = useQuery({
      queryKey: ['service-categories'],
      queryFn: async () => (await api.get('/settings/service-categories')).data.data as any[],
    });
  
    const saveCategory = async () => {
      if (!categoryModal.name.trim()) return;
      const payload = { name: categoryModal.name.trim(), description: categoryModal.description?.trim() || undefined };
      const res = await api.post('/settings/service-categories', payload);
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      return res;
    };
  
    const deleteCategory = async (id: string) => {
      await api.delete(`/settings/service-categories/${id}`);
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    };
  
    const saveService = async () => {
    if (!serviceModal.category.trim() || !serviceModal.name.trim() || !serviceModal.price) return;
    const payload = {
      category: serviceModal.category.trim(),
      name: serviceModal.name.trim(),
      description: serviceModal.description.trim() || undefined,
      price: serviceModal.price,
      isActive: serviceModal.isActive,
    };
    if (serviceModal.id) {
      await api.patch(`/settings/services/${serviceModal.id}`, payload);
    } else {
      await api.post('/settings/services', payload);
    }
    setServiceModal({ open: false, category: '', name: '', description: '', price: '', isActive: true });
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const deleteService = async (id: string) => {
    if (!confirm('Bu hizmeti ürünü silmek istediğinizden emin misiniz?')) return;
    await api.delete(`/settings/services/${id}`);
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const categories = [...new Set((services || []).map((s: any) => s.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Hizmet / Ürün Yönetimi</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCategoryModal({ open: true, name: '', description: '' })}>
            + Yeni Kategori
          </Button>
          <Button size="sm" onClick={() => setServiceModal({ open: true, category: '', name: '', description: '', price: '', isActive: true })}>
          + Yeni Hizmet / 
          </Button>
        </div>
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Hizmetler ve Ürünler</h3>
          <p className="text-xs text-slate-500 mt-1">Kategori bazlı hizmet ve ürün fiyatları tanımlanır. Tedavi planlarında seçilebilir.</p>
        </div>
        <div className="p-6 space-y-6">
          {(categories || []).map((cat: any) => {
            const catServices = (services || []).filter((s: any) => s.category === cat);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-800">{cat}</h4>
                  <span className="text-xs text-slate-500">{catServices.length} hizmet</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <Table head={['Hizmet / Ürün', 'Açıklama', 'Fiyat', 'Durum', 'İşlemler']}>
                    {catServices.map((s: any) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.description || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{money(s.price)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Aktif' : 'Pasif'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setServiceModal({ open: true, id: s.id, category: s.category, name: s.name, description: s.description || '', price: String(s.price), isActive: s.isActive })}>
                              Düzenle
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => deleteService(s.id)}>
                              Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>
            );
          })}
          {(!services || services.length === 0) && <Empty title="Henüz hizmet / ürün tanımlı değil" />}
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Kategori Özeti</h3>
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {(serviceCategories || []).map((c: any) => (
              <Badge key={c.id} tone="blue">
                {c.name}
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Modal
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false, name: '', description: '' })}
        title="Yeni Kategori"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryModal({ open: false, name: '', description: '' })}>
              Kapat
            </Button>
            <Button onClick={saveCategory}>Kaydet</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategori Ad">
            <Input value={categoryModal.name} onChange={(e) => setCategoryModal({ ...categoryModal, name: e.target.value })} />
          </Field>
          <Field label="Aciklama">
            <Input value={categoryModal.description} onChange={(e) => setCategoryModal({ ...categoryModal, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={serviceModal.open}
        onClose={() => setServiceModal({ open: false, category: '', name: '', description: '', price: '', isActive: true })}
        title={serviceModal.id ? 'Hizmet / Ürün Düzenle' : 'Yeni Hizmet / Ürün'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setServiceModal({ open: false, category: '', name: '', description: '', price: '', isActive: true })}>
              İptal
            </Button>
            <Button onClick={saveService} disabled={!serviceModal.category.trim() || !serviceModal.name.trim() || !serviceModal.price}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategori *">
              <Select value={serviceModal.category} onChange={(e) => setServiceModal({ ...serviceModal, category: e.target.value })}>
                <option value="">— Seçiniz —</option>
                {(serviceCategories || []).map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </Select>
          </Field>
          <Field label="Hizmet / Ürün Adı *">
            <Input value={serviceModal.name} onChange={(e) => setServiceModal({ ...serviceModal, name: e.target.value })} placeholder="Örn: Implant, Ortodonti Tedavisi" />
          </Field>
          <Field label="Fiyat (₺) *">
            <Input type="number" step="0.01" min="0" value={serviceModal.price} onChange={(e) => setServiceModal({ ...serviceModal, price: e.target.value })} />
          </Field>
          <Field label="Açıklama">
            <Input value={serviceModal.description} onChange={(e) => setServiceModal({ ...serviceModal, description: e.target.value })} />
          </Field>
          <Field label="Aktif">
            <Select value={serviceModal.isActive ? 'true' : 'false'} onChange={(e) => setServiceModal({ ...serviceModal, isActive: e.target.value === 'true' })}>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

const CommissionsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [rateModal, setRateModal] = useState<{ open: boolean; id?: string; role: string; type: string; serviceCategory: string; rate: string; isActive: boolean }>({
    open: false,
    role: 'DENTIST',
    type: 'doctor',
    serviceCategory: '',
    rate: '20',
    isActive: true,
  });
  const [commissionModal, setCommissionModal] = useState<{
    open: boolean;
    userId: string;
    type: 'doctor' | 'sales' | 'callcenter' | 'banko';
    periodStart: string;
    periodEnd: string;
    totalAmount: string;
    commissionRate: string;
    calculatedAmount: string;
    status: string;
  }>({
    open: false,
    userId: '',
    type: 'doctor',
    periodStart: toLocalInput(),
    periodEnd: toLocalInput(),
    totalAmount: '',
    commissionRate: '0',
    calculatedAmount: '',
    status: 'pending',
  });

  const { data: serviceCategories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/settings/service-categories')).data.data as any[],
  });

  const { data: rates } = useQuery({
    queryKey: ['commission-rates'],
    queryFn: async () => (await api.get('/settings/commission-rates')).data.data as any[],
  });

  const { data: commissions } = useQuery({
    queryKey: ['commissions'],
    queryFn: async () => (await api.get('/settings/commissions')).data.data as any[],
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data as any[],
  });

  const saveRate = async () => {
    if (!rateModal.role || !rateModal.type.trim() || !rateModal.rate) return;
    const payload = {
      role: rateModal.role,
      type: rateModal.type,
      serviceCategory: rateModal.serviceCategory || undefined,
      rate: rateModal.rate,
      isActive: rateModal.isActive,
    };
    if (rateModal.id) {
      await api.patch(`/settings/commission-rates/${rateModal.id}`, payload);
    } else {
      await api.post('/settings/commission-rates', payload);
    }
    setRateModal({ open: false, role: 'DENTIST', type: 'doctor', serviceCategory: '', rate: '20', isActive: true });
    queryClient.invalidateQueries({ queryKey: ['commission-rates'] });
  };

  const deleteRate = async (id: string) => {
    if (!confirm('Bu komisyon oranını silmek istediğinizden emin misiniz?')) return;
    await api.delete(`/settings/commission-rates/${id}`);
    queryClient.invalidateQueries({ queryKey: ['commission-rates'] });
  };

  const saveCommission = async () => {
    if (!commissionModal.userId || !commissionModal.totalAmount) return;
    const calculatedAmount = (Number(commissionModal.totalAmount) * Number(commissionModal.commissionRate || 0)) / 100;
    const payload = {
      userId: commissionModal.userId,
      type: commissionModal.type,
      periodStart: fromLocalInput(commissionModal.periodStart),
      periodEnd: fromLocalInput(commissionModal.periodEnd),
      totalAmount: commissionModal.totalAmount,
      commissionRate: commissionModal.commissionRate,
      calculatedAmount: String(calculatedAmount.toFixed(2)),
    };
    await api.post('/settings/commissions', payload);
    setCommissionModal({ open: false, userId: '', type: 'doctor', periodStart: toLocalInput(), periodEnd: toLocalInput(), totalAmount: '', commissionRate: '0', calculatedAmount: '', status: 'pending' });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const updateCommissionStatus = async (id: string, status: string) => {
    await api.patch(`/settings/commissions/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const totalCommissions = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.calculatedAmount || 0), 0);
  const pendingCount = (commissions || []).filter((c: any) => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Komisyon Yönetimi</h2>
        <Button size="sm" onClick={() => setCommissionModal({ open: true, userId: '', type: 'doctor', periodStart: toLocalInput(), periodEnd: toLocalInput(), totalAmount: '', commissionRate: '20', calculatedAmount: '', status: 'pending' })}>
          + Yeni Komisyon
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Toplam Komisyon</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{money(totalCommissions)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Bekleyen İşlem</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Oranlı Komisyonlar</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{rates?.length || 0}</p>
        </Card>
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Komisyon Oranları</h3>
          <Button size="sm" onClick={() => setRateModal({ open: true, role: 'DENTIST', type: 'doctor', serviceCategory: '', rate: '20', isActive: true })}>
            + Yeni Oran
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table head={['Rol', 'Tip', 'Hizmet / Ürün Kategorisi', 'Oran', 'Durum', 'İşlemler']}>
            {rates?.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{ROLE_LABEL[r.role] || r.role}</td>
                <td className="px-4 py-3 text-slate-600">{r.type}</td>
                <td className="px-4 py-3 text-slate-600">{r.serviceCategory || '-'}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{r.rate}%</td>
                <td className="px-4 py-3">
                  <Badge tone={r.isActive ? 'green' : 'slate'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setRateModal({ open: true, id: r.id, role: r.role, type: r.type, serviceCategory: r.serviceCategory || '', rate: String(r.rate), isActive: r.isActive })}>
                      Düzenle
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => deleteRate(r.id)}>
                      Sil
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Komisyon Hareketleri</h3>
        </div>
        <div className="overflow-x-auto">
          <Table head={['Tarih', 'Kullanıcı', 'Tip', 'Toplam Tutar', 'Oran', 'Hesaplanan', 'Durum', 'İşlemler']}>
            {commissions?.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 text-slate-600">{dateTime(c.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{c.user?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{c.type}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{money(c.totalAmount)}</td>
                <td className="px-4 py-3 text-slate-600">{c.commissionRate}%</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{money(c.calculatedAmount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.status === 'paid' ? 'green' : c.status === 'calculated' ? 'blue' : 'amber'}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {c.status !== 'paid' && (
                      <Button size="sm" variant="success" onClick={() => updateCommissionStatus(c.id, 'paid')}>
                        Öde
                      </Button>
                    )}
                    {c.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => updateCommissionStatus(c.id, 'calculated')}>
                        Hesapla
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <Modal
        open={rateModal.open}
        onClose={() => setRateModal({ open: false, role: 'DENTIST', type: 'doctor', serviceCategory: '', rate: '20', isActive: true })}
        title={rateModal.id ? 'Komisyon Oranı Düzenle' : 'Yeni Komisyon Oranı'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRateModal({ open: false, role: 'DENTIST', type: 'doctor', serviceCategory: '', rate: '20', isActive: true })}>
              İptal
            </Button>
            <Button onClick={saveRate} disabled={!rateModal.role || !rateModal.type.trim() || !rateModal.rate}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rol">
            <Select value={rateModal.role} onChange={(e) => setRateModal({ ...rateModal, role: e.target.value })}>
              <option value="ADMIN">Yönetici</option>
              <option value="DENTIST">Doktor</option>
              <option value="CALL_CENTER">Çağrı Merkezi</option>
              <option value="SALES">Sağlık Danışmanı</option>
              <option value="BANKO">Banko</option>
            </Select>
          </Field>
          <Field label="Tip">
            <Input value={rateModal.type} onChange={(e) => setRateModal({ ...rateModal, type: e.target.value })} placeholder="Örn: doctor" />
          </Field>
          <Field label="Hizmet / Ürün Kategorisi">
            <Select value={rateModal.serviceCategory} onChange={(e) => setRateModal({ ...rateModal, serviceCategory: e.target.value })}>
              <option value="">Genel</option>
              {(serviceCategories || []).map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Oran (%)">
            <Input type="number" step="0.01" min="0" value={rateModal.rate} onChange={(e) => setRateModal({ ...rateModal, rate: e.target.value })} />
          </Field>
          <Field label="Aktif">
            <Select value={rateModal.isActive ? 'true' : 'false'} onChange={(e) => setRateModal({ ...rateModal, isActive: e.target.value === 'true' })}>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={commissionModal.open}
        onClose={() => setCommissionModal({ open: false, userId: '', type: 'doctor', periodStart: toLocalInput(), periodEnd: toLocalInput(), totalAmount: '', commissionRate: '20', calculatedAmount: '', status: 'pending' })}
        title="Yeni Komisyon"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setCommissionModal({ open: false, userId: '', type: 'doctor', periodStart: toLocalInput(), periodEnd: toLocalInput(), totalAmount: '', commissionRate: '20', calculatedAmount: '', status: 'pending' })}>
              İptal
            </Button>
            <Button onClick={saveCommission} disabled={!commissionModal.userId || !commissionModal.totalAmount}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kullanıcı">
            <Select value={commissionModal.userId} onChange={(e) => setCommissionModal({ ...commissionModal, userId: e.target.value })}>
              <option value="">Seçiniz</option>
              {usersQuery.data?.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABEL[u.role] || u.role})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tip">
            <Select value={commissionModal.type} onChange={(e) => setCommissionModal({ ...commissionModal, type: e.target.value as any })}>
              <option value="doctor">Doktor</option>
              <option value="sales">Sağlık Danışmanı</option>
              <option value="callcenter">Çağrı Merkezi</option>
              <option value="banko">Banko</option>
            </Select>
          </Field>
          <Field label="Başlangıç Tarihi">
            <Input type="datetime-local" value={commissionModal.periodStart} onChange={(e) => setCommissionModal({ ...commissionModal, periodStart: e.target.value })} />
          </Field>
          <Field label="Bitiş Tarihi">
            <Input type="datetime-local" value={commissionModal.periodEnd} onChange={(e) => setCommissionModal({ ...commissionModal, periodEnd: e.target.value })} />
          </Field>
          <Field label="Toplam Tutar (₺)">
            <Input type="number" step="0.01" min="0" value={commissionModal.totalAmount} onChange={(e) => setCommissionModal({ ...commissionModal, totalAmount: e.target.value })} />
          </Field>
          <Field label="Komisyon Oran (%)">
            <Input type="number" step="0.01" min="0" value={commissionModal.commissionRate} onChange={(e) => setCommissionModal({ ...commissionModal, commissionRate: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;

interface CalBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  reason?: string | null;
}

const BLOCK_LABEL: Record<string, string> = {
  LEAVE: 'İzin',
  LUNCH: 'Öğle Molası',
  BLOCKED: 'Kapalı',
};

const CalendarTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => toLocalInput(new Date()).slice(0, 10));
  const [userId, setUserId] = useState('');
  const [whStart, setWhStart] = useState('09:00');
  const [whEnd, setWhEnd] = useState('18:00');
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('13:00');
  const [useLunch, setUseLunch] = useState(true);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [block, setBlock] = useState({ startTime: '09:00', endTime: '10:00', status: 'LEAVE', reason: '' });

  const DAY_OPTIONS: { v: number; l: string }[] = [
    { v: 1, l: 'Pzt' },
    { v: 2, l: 'Sal' },
    { v: 3, l: 'Çar' },
    { v: 4, l: 'Per' },
    { v: 5, l: 'Cum' },
    { v: 6, l: 'Cmt' },
    { v: 0, l: 'Paz' },
  ];

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data as any[],
  });

  const staff = (users as any[]).filter((u: any) => u.role === 'DENTIST' || u.role === 'SALES');

  const { data: workingHours = [] } = useQuery({
    queryKey: ['working-hours', { date, userId }],
    queryFn: async () =>
      (await api.get('/schedule/working-hours', { params: { date, ...(userId ? { userId } : {}) } }))
        .data.data as any[],
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ['schedule-blocks', { date, userId }],
    queryFn: async () =>
      (await api.get('/schedule/blocks', { params: { date, ...(userId ? { userId } : {}) } }))
        .data.data as any[],
  });

  const { data: weekly = [] } = useQuery({
    queryKey: ['weekly', { userId }],
    queryFn: async () =>
      (await api.get('/schedule/weekly', { params: userId ? { userId } : {} })).data.data as any[],
  });

  React.useEffect(() => {
    if (!userId) {
      setWeeklyDays([]);
      return;
    }
    const list = (weekly as any[]).filter((w: any) => (w.user?.id || w.userId) === userId);
    setWeeklyDays(list.map((w: any) => w.weekday));
    if (list[0]) {
      setWhStart(list[0].start || '09:00');
      setWhEnd(list[0].end || '18:00');
      setLunchStart(list[0].lunchStart || '12:00');
      setLunchEnd(list[0].lunchEnd || '13:00');
      setUseLunch(!!(list[0].lunchStart && list[0].lunchEnd));
    }
  }, [weekly, userId]);

  const selectedWh = (workingHours as any[]).find((w: any) => (w.user?.id || w.userId) === userId);

  React.useEffect(() => {
    if (selectedWh) {
      setWhStart(selectedWh.start || '09:00');
      setWhEnd(selectedWh.end || '18:00');
      setLunchStart(selectedWh.lunchStart || '12:00');
      setLunchEnd(selectedWh.lunchEnd || '13:00');
      setUseLunch(!!(selectedWh.lunchStart && selectedWh.lunchEnd));
    }
  }, [selectedWh?.id]);

  const saveWorkingHours = async () => {
    if (!userId) {
      alert('Personel seçin');
      return;
    }
    if (!weeklyDays.length) {
      alert('En az bir çalışma günü seçin');
      return;
    }
    try {
      await api.post('/schedule/weekly', {
        userId,
        days: weeklyDays,
        start: whStart,
        end: whEnd,
        lunchStart: useLunch ? lunchStart : undefined,
        lunchEnd: useLunch ? lunchEnd : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['weekly'] });
      queryClient.invalidateQueries({ queryKey: ['working-hours'] });
      alert('Haftalık çalışma günleri ve saatleri kaydedildi');
    } catch (err) {
      alert('Hata: ' + (err as Error).message);
    }
  };

  const toggleDay = (v: number) => {
    setWeeklyDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  };

  const addBlock = async () => {
    if (!userId) {
      alert('Personel seçin');
      return;
    }
    try {
      await api.post('/schedule/blocks', { userId, date, ...block });
      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
      setBlock({ startTime: '09:00', endTime: '10:00', status: 'LEAVE', reason: '' });
    } catch (err) {
      alert('Hata: ' + (err as Error).message);
    }
  };

  const removeBlock = async (id: string) => {
    if (!confirm('Bu kapatmayı silmek istiyor musunuz?')) return;
    await api.delete(`/schedule/blocks/${id}`);
    queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
  };

  return (
    <div className="space-y-6 pt-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Personel">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Personel seçin</option>
              {staff.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABEL[u.role] || u.role})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Haftalık Çalışma Günleri ve Saatleri</h3>
        <Field label="Çalıştığı Günler">
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                  weeklyDays.includes(d.v)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {d.l}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Başlangıç">
            <Input type="time" value={whStart} onChange={(e) => setWhStart(e.target.value)} />
          </Field>
          <Field label="Bitiş">
            <Input type="time" value={whEnd} onChange={(e) => setWhEnd(e.target.value)} />
          </Field>
          <Field label="Öğle Başlangıç">
            <Input type="time" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} disabled={!useLunch} />
          </Field>
          <Field label="Öğle Bitiş">
            <Input type="time" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} disabled={!useLunch} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={useLunch} onChange={(e) => setUseLunch(e.target.checked)} />
          Öğle arası tanımla
        </label>
        <Button onClick={saveWorkingHours} disabled={!userId}>
          Çalışma Ayarlarını Kaydet
        </Button>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-slate-800">Slot Kapatma (İzin / Mola)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Field label="Tarih">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Başlangıç">
            <Input type="time" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} />
          </Field>
          <Field label="Bitiş">
            <Input type="time" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} />
          </Field>
          <Field label="Durum">
            <Select value={block.status} onChange={(e) => setBlock({ ...block, status: e.target.value })}>
              <option value="LEAVE">İzin</option>
              <option value="LUNCH">Öğle Molası</option>
              <option value="BLOCKED">Kapalı / Diğer</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={addBlock} disabled={!userId} className="w-full">
              Ekle
            </Button>
          </div>
        </div>
        <Field label="Açıklama">
          <Input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Opsiyonel" />
        </Field>

        {(blocks as CalBlock[]).length === 0 ? (
          <Empty title="Kayıtlı kapatma yok" hint={userId ? 'Bu personel için kapatma ekleyin.' : 'Önce personel seçin.'} />
        ) : (
          <Table head={['Personel', 'Tarih', 'Aralık', 'Durum', 'Açıklama', 'İşlem']}>
            {(blocks as any[]).map((b: any) => (
              <tr key={b.id}>
                <td className="px-4 py-3">{b.user?.name || '-'}</td>
                <td className="px-4 py-3">{String(b.date).slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {b.startTime} - {b.endTime}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={b.status === 'LUNCH' ? 'amber' : 'slate'}>{BLOCK_LABEL[b.status] || b.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{b.reason || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="danger" onClick={() => removeBlock(b.id)}>
                    Sil
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

const PaymentMethodsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; id?: string; name: string; isActive: boolean }>({
    open: false,
    name: '',
    isActive: true,
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get('/collections/payment-methods')).data.data as any[],
  });

  const save = async () => {
    if (!modal.name.trim()) return;
    const payload = { name: modal.name.trim(), isActive: modal.isActive };
    if (modal.id) {
      await api.patch(`/collections/payment-methods/${modal.id}`, payload);
    } else {
      await api.post('/collections/payment-methods', payload);
    }
    setModal({ open: false, name: '', isActive: true });
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  };

  const remove = async (id: string) => {
    if (!confirm('Bu tahsilat türünü silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/collections/payment-methods/${id}`);
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    } catch {
      alert('Tahsilat türü kullanıldığı için silinemiyor olabilir.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tahsilat Türleri</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ödeme alırken seçilebilecek tahsilat yöntemlerini yönetin (Nakit, Kredi Kartı vb.).
          </p>
        </div>
        <Button size="sm" onClick={() => setModal({ open: true, name: '', isActive: true })}>
          + Yeni Tahsilat Türü
        </Button>
      </div>

      <Card>
        <Table head={['Tahsilat Türü', 'Durum', 'İşlemler']}>
          {(methods as any[]).map((m: any) => (
            <tr key={m.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
              <td className="px-4 py-3">
                <Badge tone={m.isActive ? 'green' : 'slate'}>{m.isActive ? 'Aktif' : 'Pasif'}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setModal({ open: true, id: m.id, name: m.name, isActive: m.isActive })}
                  >
                    Düzenle
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(m.id)}>
                    Sil
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {(methods as any[]).length === 0 && <Empty title="Henüz tahsilat türü tanımlı değil" />}
      </Card>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, name: '', isActive: true })}
        title={modal.id ? 'Tahsilat Türü Düzenle' : 'Yeni Tahsilat Türü'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal({ open: false, name: '', isActive: true })}>
              İptal
            </Button>
            <Button onClick={save} disabled={!modal.name.trim()}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tahsilat Türü Adı *">
            <Input
              value={modal.name}
              onChange={(e) => setModal({ ...modal, name: e.target.value })}
              placeholder="Örn: Nakit, Kredi Kartı, Havale"
            />
          </Field>
          <Field label="Aktif">
            <Select
              value={modal.isActive ? 'true' : 'false'}
              onChange={(e) => setModal({ ...modal, isActive: e.target.value === 'true' })}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

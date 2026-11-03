import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, Table, Textarea } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  PLAN_STATUS_LABEL,
  VISIT_STATUS_LABEL,
  apiError,
  dateOnly,
  dateTime,
  money,
  statusTone,
} from '../../lib/format';

const emptyForm = {
  name: '',
  surname: '',
  tc: '',
  phone: '',
  email: '',
  birthDate: '',
  gender: '',
  address: '',
};

const emptyMedical = {
  allergies: '',
  chronicDiseases: '',
  medications: '',
  notes: '',
};

export const PatientsPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [medical, setMedical] = useState({ ...emptyMedical });

  const canCreate = ['ADMIN', 'CALL_CENTER', 'SALES'].includes(user?.role || '');
  const canMedical = ['ADMIN', 'DENTIST'].includes(user?.role || '');

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await api.get('/patients', { params: search ? { search } : {} });
      return res.data.data as any[];
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['patient', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await api.get(`/patients/${selectedId}`);
      return res.data.data as any;
    },
  });

  useEffect(() => {
    if (detail?.medicalRecord) {
      setMedical({
        allergies: detail.medicalRecord.allergies || '',
        chronicDiseases: detail.medicalRecord.chronicDiseases || '',
        medications: detail.medicalRecord.medications || '',
        notes: detail.medicalRecord.notes || '',
      });
    } else {
      setMedical({ ...emptyMedical });
    }
  }, [detail]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/patients', {
        ...form,
        email: form.email || undefined,
        birthDate: form.birthDate ? `${form.birthDate}T00:00:00.000Z` : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAddOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => alert(apiError(err)),
  });

  const medicalMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/patients/${selectedId}/medical`, medical);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', selectedId] });
      alert('Tıbbi kayıt güncellendi');
    },
    onError: (err) => alert(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hastalar"
        subtitle="Hasta kayıtları, tıbbi bilgiler, randevu ve tedavi geçmişi"
        action={
          canCreate ? (
            <Button onClick={() => setAddOpen(true)}>+ Yeni Hasta</Button>
          ) : undefined
        }
      />

      <Card className="p-4">
        <Input
          placeholder="Ad, soyad, telefon, TC veya hasta no ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </Card>

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : patients.length === 0 ? (
          <Empty title="Hasta bulunamadı" hint="Arama kriterini değiştirin veya yeni hasta ekleyin." />
        ) : (
          <Table head={['Hasta No', 'Ad Soyad', 'Telefon', 'Kayıt Tarihi', '']}>
            {patients.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.hastaNo}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {p.name} {p.surname}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(p.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedId(p.id)}>
                    Detay
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Yeni Hasta Kaydı"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Ad *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Soyad *">
            <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          </Field>
          <Field label="TC Kimlik No *">
            <Input value={form.tc} onChange={(e) => setForm({ ...form, tc: e.target.value })} maxLength={11} />
          </Field>
          <Field label="Telefon *">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="E-posta">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Doğum Tarihi">
            <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </Field>
          <Field label="Cinsiyet">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Seçiniz</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
            </Select>
          </Field>
          <Field label="Adres">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-slate-400">Hasta numarası otomatik oluşturulur.</p>
      </Modal>

      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={detail ? `${detail.name} ${detail.surname} - ${detail.hastaNo}` : 'Hasta Detayı'}
        wide
      >
        {detailLoading || !detail ? (
          <LoadingText />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs">TC Kimlik</p>
                <p className="font-medium">{detail.tc}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Telefon</p>
                <p className="font-medium">{detail.phone}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">E-posta</p>
                <p className="font-medium">{detail.email || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Doğum Tarihi</p>
                <p className="font-medium">{dateOnly(detail.birthDate)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Cinsiyet</p>
                <p className="font-medium">{detail.gender || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 text-xs">Adres</p>
                <p className="font-medium">{detail.address || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Kayıt Tarihi</p>
                <p className="font-medium">{dateOnly(detail.createdAt)}</p>
              </div>
            </div>

            {canMedical && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Tıbbi Kayıt</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Alerjiler">
                    <Input value={medical.allergies} onChange={(e) => setMedical({ ...medical, allergies: e.target.value })} />
                  </Field>
                  <Field label="Kronik Hastalıklar">
                    <Input
                      value={medical.chronicDiseases}
                      onChange={(e) => setMedical({ ...medical, chronicDiseases: e.target.value })}
                    />
                  </Field>
                  <Field label="Kullanılan İlaçlar">
                    <Input value={medical.medications} onChange={(e) => setMedical({ ...medical, medications: e.target.value })} />
                  </Field>
                  <Field label="Notlar">
                    <Textarea rows={2} value={medical.notes} onChange={(e) => setMedical({ ...medical, notes: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-2 text-right">
                  <Button size="sm" variant="success" onClick={() => medicalMutation.mutate()} disabled={medicalMutation.isPending}>
                    Tıbbi Kaydı Kaydet
                  </Button>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Randevular</h3>
              {detail.appointments?.length ? (
                <Table head={['Randevu No', 'Tarih', 'Tür', 'Durum', 'Personel']}>
                  {detail.appointments.map((a: any) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.randevuNo}</td>
                      <td className="px-4 py-2">{dateTime(a.appointmentDate)}</td>
                      <td className="px-4 py-2">{APPT_TYPE_LABEL[a.type]}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(a.status)}>{APPT_STATUS_LABEL[a.status]}</Badge>
                      </td>
                      <td className="px-4 py-2">{a.user?.name || '-'}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="text-sm text-slate-400">Randevu kaydı yok.</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Geliş Kayıtları</h3>
              {detail.visits?.length ? (
                <Table head={['Protokol No', 'Geliş Tarihi', 'Randevu', 'Kanal', 'Durum']}>
                  {detail.visits.map((visit: any) => (
                    <tr key={visit.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{visit.protokolNo}</td>
                      <td className="px-4 py-2">{dateTime(visit.visitDate)}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{visit.appointment?.randevuNo || '-'}</td>
                      <td className="px-4 py-2">{visit.channel || 'Bilinmiyor'}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(visit.status)}>{VISIT_STATUS_LABEL[visit.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p className="text-sm text-slate-400">Geliş kaydı yok.</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Tedavi Planları</h3>
              {detail.treatmentPlans?.length ? (
                <div className="space-y-2">
                  {detail.treatmentPlans.map((plan: any) => (
                    <div key={plan.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={statusTone(plan.status)}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
                          <span className="text-sm font-semibold">{money(plan.totalPrice)}</span>
                          {Number(plan.discount) > 0 && (
                            <span className="text-xs text-slate-400">indirim: {money(plan.discount)}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{dateOnly(plan.createdAt)}</span>
                      </div>
                      <ul className="mt-2 text-sm text-slate-600 space-y-1">
                        {plan.items?.map((item: any) => (
                          <li key={item.id}>
                            {item.toothNo ? `${item.toothNo} - ` : ''}
                            {item.treatment} × {item.quantity} · {money(item.price)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Tedavi planı yok.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

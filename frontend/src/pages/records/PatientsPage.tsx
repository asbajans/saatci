import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, Table, Textarea } from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  INVOICE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  ROLE_LABEL,
  SALES_STATUS_LABEL,
  VISIT_STATUS_LABEL,
  apiError,
  dateOnly,
  dateTime,
  fromLocalInput,
  money,
  statusTone,
  toLocalInput,
} from '../../lib/format';

const emptyForm = {
  name: '',
  surname: '',
  tc: '',
  phone: '',
  mobilePhone: '',
  wiredPhone: '',
  email: '',
  birthDate: '',
  gender: '',
  address: '',
  city: '',
  town: '',
  profession: '',
  bloodGroup: '',
  controlPeriodMonth: '',
  relativeName: '',
  relativePhone: '',
  referenceName: '',
  notes: '',
  tariffId: '',
  dentistId: '',
};

const emptyMedical = {
  allergies: '',
  chronicDiseases: '',
  medications: '',
  notes: '',
};

const emptyAppointment = () => ({
  type: 'EXAMINATION',
  userId: '',
  dateTime: toLocalInput(new Date(Date.now() + 86400000)),
  endTime: '',
  notes: '',
});

const patientToForm = (patient: any) => ({
  name: patient.name || '',
  surname: patient.surname || '',
  tc: patient.tc || '',
  phone: patient.phone || '',
  mobilePhone: patient.mobilePhone || '',
  wiredPhone: patient.wiredPhone || '',
  email: patient.email || '',
  birthDate: patient.birthDate ? String(patient.birthDate).slice(0, 10) : '',
  gender: patient.gender || '',
  address: patient.address || '',
  city: patient.city || '',
  town: patient.town || '',
  profession: patient.profession || '',
  bloodGroup: patient.bloodGroup || '',
  controlPeriodMonth: patient.controlPeriodMonth !== null && patient.controlPeriodMonth !== undefined
    ? String(patient.controlPeriodMonth)
    : '',
  relativeName: patient.relativeName || '',
  relativePhone: patient.relativePhone || '',
  referenceName: patient.referenceName || '',
  notes: patient.notes || '',
  tariffId: patient.tariffId || '',
  dentistId: patient.dentistId || '',
});

export const PatientsPage: React.FC = () => {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [medical, setMedical] = useState({ ...emptyMedical });
  const [editingPatient, setEditingPatient] = useState(false);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newApptForm, setNewApptForm] = useState(emptyAppointment);
  const [apptDetail, setApptDetail] = useState<any>(null);
  const [planDetail, setPlanDetail] = useState<any>(null);

  const canCreate = ['ADMIN', 'CALL_CENTER', 'SALES'].includes(user?.role || '');
  const canEdit = ['ADMIN', 'CALL_CENTER', 'SALES', 'DENTIST'].includes(user?.role || '');
  const canBook = ['ADMIN', 'CALL_CENTER', 'SALES', 'BANKO'].includes(user?.role || '');
  const canPlan = ['ADMIN', 'SALES', 'DENTIST'].includes(user?.role || '');
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

  const { data: tariffs = [] } = useQuery({
    queryKey: ['catalog-tariffs'],
    queryFn: async () => (await api.get('/catalog/tariffs')).data.data as any[],
  });

  const { data: dentists = [] } = useQuery({
    queryKey: ['catalog-dentists'],
    queryFn: async () => (await api.get('/catalog/dentists')).data.data as any[],
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/users/staff')).data.data as any[],
  });

  const apptStaffOptions = useMemo(
    () =>
      staff.filter((member: any) =>
        newApptForm.type === 'MEETING' ? member.role === 'SALES' : member.role === 'DENTIST'
      ),
    [staff, newApptForm.type]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/patients', {
        name: form.name,
        surname: form.surname,
        tc: form.tc,
        phone: form.phone,
        mobilePhone: form.mobilePhone || undefined,
        wiredPhone: form.wiredPhone || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate ? `${form.birthDate}T00:00:00.000Z` : undefined,
        gender: form.gender || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        town: form.town || undefined,
        profession: form.profession || undefined,
        bloodGroup: form.bloodGroup || undefined,
        controlPeriodMonth: form.controlPeriodMonth ? Number(form.controlPeriodMonth) : undefined,
        relativeName: form.relativeName || undefined,
        relativePhone: form.relativePhone || undefined,
        referenceName: form.referenceName || undefined,
        notes: form.notes || undefined,
        tariffId: form.tariffId || undefined,
        dentistId: form.dentistId || undefined,
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await api.put(`/patients/${selectedId}`, {
        name: editForm.name,
        surname: editForm.surname,
        tc: editForm.tc,
        phone: editForm.phone,
        mobilePhone: editForm.mobilePhone || '',
        wiredPhone: editForm.wiredPhone || '',
        email: editForm.email || '',
        birthDate: editForm.birthDate ? `${editForm.birthDate}T00:00:00.000Z` : '',
        gender: editForm.gender || '',
        address: editForm.address || '',
        city: editForm.city || '',
        town: editForm.town || '',
        profession: editForm.profession || '',
        bloodGroup: editForm.bloodGroup || '',
        controlPeriodMonth: editForm.controlPeriodMonth !== '' ? Number(editForm.controlPeriodMonth) : null,
        relativeName: editForm.relativeName || '',
        relativePhone: editForm.relativePhone || '',
        referenceName: editForm.referenceName || '',
        notes: editForm.notes || '',
        tariffId: editForm.tariffId || null,
        dentistId: editForm.dentistId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingPatient(false);
      alert('Hasta bilgileri güncellendi');
    },
    onError: (err) => alert(apiError(err)),
  });

  const createApptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const datePart = newApptForm.dateTime.slice(0, 10);
      await api.post('/appointments', {
        patientId: selectedId,
        type: newApptForm.type,
        userId: newApptForm.userId || null,
        appointmentDate: fromLocalInput(newApptForm.dateTime),
        endDate: newApptForm.endTime ? fromLocalInput(`${datePart}T${newApptForm.endTime}`) : undefined,
        notes: newApptForm.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewApptOpen(false);
      setNewApptForm(emptyAppointment());
      alert('Randevu oluşturuldu');
    },
    onError: (err) => alert(apiError(err)),
  });

  const openPatient = (id: string) => {
    setSelectedId(id);
    setEditingPatient(false);
    setNewApptOpen(false);
    setApptDetail(null);
    setPlanDetail(null);
  };

  const startEditing = () => {
    if (!detail) return;
    setEditForm(patientToForm(detail));
    setEditingPatient(true);
  };

  const saveDisabled =
    editForm.name.trim().length < 2 ||
    editForm.surname.trim().length < 2 ||
    editForm.tc.trim().length < 1 ||
    editForm.phone.trim().length < 5 ||
    updateMutation.isPending;

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
                  <Button size="sm" variant="secondary" onClick={() => openPatient(p.id)}>
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
        wide
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
          <Field label="Adres" className="md:col-span-2">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Cep Telefonu">
            <Input value={form.mobilePhone} onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })} />
          </Field>
          <Field label="Sabit Telefon">
            <Input value={form.wiredPhone} onChange={(e) => setForm({ ...form, wiredPhone: e.target.value })} />
          </Field>
          <Field label="İl">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="İlçe">
            <Input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
          </Field>
          <Field label="Meslek">
            <Input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
          </Field>
          <Field label="Kan Grubu">
            <Input value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} placeholder="örn. A Rh+" />
          </Field>
          <Field label="Kontrol Periyodu (ay)">
            <Input
              type="number"
              min={0}
              value={form.controlPeriodMonth}
              onChange={(e) => setForm({ ...form, controlPeriodMonth: e.target.value })}
            />
          </Field>
          <Field label="Tarife">
            <Select value={form.tariffId} onChange={(e) => setForm({ ...form, tariffId: e.target.value })}>
              <option value="">Tarife seçin</option>
              {tariffs.map((tariff: any) => (
                <option key={tariff.id} value={tariff.id}>
                  {tariff.year} · {tariff.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Takip Doktoru">
            <Select value={form.dentistId} onChange={(e) => setForm({ ...form, dentistId: e.target.value })}>
              <option value="">Doktor seçin</option>
              {dentists.map((dentist: any) => (
                <option key={dentist.id} value={dentist.id}>
                  {dentist.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Yakını">
            <Input value={form.relativeName} onChange={(e) => setForm({ ...form, relativeName: e.target.value })} />
          </Field>
          <Field label="Yakın Telefonu">
            <Input value={form.relativePhone} onChange={(e) => setForm({ ...form, relativePhone: e.target.value })} />
          </Field>
          <Field label="Referans">
            <Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} />
          </Field>
          <Field label="Hasta Notu" className="md:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-slate-400">Hasta numarası otomatik oluşturulur.</p>
      </Modal>

      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={detail ? `${detail.name} ${detail.surname} - ${detail.hastaNo}` : 'Hasta Detayı'}
        wide
        footer={
          detail ? (
            editingPatient ? (
              <>
                <Button variant="secondary" onClick={() => setEditingPatient(false)}>
                  Vazgeç
                </Button>
                <Button onClick={() => updateMutation.mutate()} disabled={saveDisabled}>
                  {updateMutation.isPending ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setSelectedId(null)}>
                  Kapat
                </Button>
                {canEdit && <Button onClick={startEditing}>Düzenle</Button>}
              </>
            )
          ) : (
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              Kapat
            </Button>
          )
        }
      >
        {detailLoading || !detail ? (
          <LoadingText />
        ) : (
          <div className="space-y-6">
            {editingPatient ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ad *">
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </Field>
                <Field label="Soyad *">
                  <Input value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} />
                </Field>
                <Field label="TC Kimlik No *">
                  <Input value={editForm.tc} onChange={(e) => setEditForm({ ...editForm, tc: e.target.value })} maxLength={11} />
                </Field>
                <Field label="Telefon *">
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </Field>
                <Field label="E-posta">
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </Field>
                <Field label="Doğum Tarihi">
                  <Input
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  />
                </Field>
                <Field label="Cinsiyet">
                  <Select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                    <option value="">Seçiniz</option>
                    <option value="Kadın">Kadın</option>
                    <option value="Erkek">Erkek</option>
                  </Select>
                </Field>
                <Field label="Cep Telefonu">
                  <Input
                    value={editForm.mobilePhone}
                    onChange={(e) => setEditForm({ ...editForm, mobilePhone: e.target.value })}
                  />
                </Field>
                <Field label="Sabit Telefon">
                  <Input
                    value={editForm.wiredPhone}
                    onChange={(e) => setEditForm({ ...editForm, wiredPhone: e.target.value })}
                  />
                </Field>
                <Field label="Adres" className="md:col-span-2">
                  <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </Field>
                <Field label="İl">
                  <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </Field>
                <Field label="İlçe">
                  <Input value={editForm.town} onChange={(e) => setEditForm({ ...editForm, town: e.target.value })} />
                </Field>
                <Field label="Meslek">
                  <Input
                    value={editForm.profession}
                    onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                  />
                </Field>
                <Field label="Kan Grubu">
                  <Input
                    value={editForm.bloodGroup}
                    onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                    placeholder="örn. A Rh+"
                  />
                </Field>
                <Field label="Kontrol Periyodu (ay)">
                  <Input
                    type="number"
                    min={0}
                    value={editForm.controlPeriodMonth}
                    onChange={(e) => setEditForm({ ...editForm, controlPeriodMonth: e.target.value })}
                  />
                </Field>
                <Field label="Tarife">
                  <Select value={editForm.tariffId} onChange={(e) => setEditForm({ ...editForm, tariffId: e.target.value })}>
                    <option value="">Tarife seçin</option>
                    {tariffs.map((tariff: any) => (
                      <option key={tariff.id} value={tariff.id}>
                        {tariff.year} · {tariff.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Takip Doktoru">
                  <Select value={editForm.dentistId} onChange={(e) => setEditForm({ ...editForm, dentistId: e.target.value })}>
                    <option value="">Doktor seçin</option>
                    {dentists.map((dentist: any) => (
                      <option key={dentist.id} value={dentist.id}>
                        {dentist.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Yakını">
                  <Input
                    value={editForm.relativeName}
                    onChange={(e) => setEditForm({ ...editForm, relativeName: e.target.value })}
                  />
                </Field>
                <Field label="Yakın Telefonu">
                  <Input
                    value={editForm.relativePhone}
                    onChange={(e) => setEditForm({ ...editForm, relativePhone: e.target.value })}
                  />
                </Field>
                <Field label="Referans">
                  <Input
                    value={editForm.referenceName}
                    onChange={(e) => setEditForm({ ...editForm, referenceName: e.target.value })}
                  />
                </Field>
                <Field label="Hasta Notu" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </Field>
              </div>
            ) : (
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
                <div>
                  <p className="text-slate-400 text-xs">Cep / Sabit</p>
                  <p className="font-medium">{detail.mobilePhone || '-'} / {detail.wiredPhone || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Kan Grubu</p>
                  <p className="font-medium">{detail.bloodGroup || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Tarife</p>
                  <p className="font-medium">{detail.tariff?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Takip Doktoru</p>
                  <p className="font-medium">{detail.dentist?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Bakiye</p>
                  <p className="font-medium">{money(detail.balance)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs">Hasta Notu</p>
                  <p className="font-medium">{detail.notes || '-'}</p>
                </div>
              </div>
            )}

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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">Randevular</h3>
                {canBook && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewApptForm(emptyAppointment());
                      setNewApptOpen(true);
                    }}
                  >
                    + Yeni Randevu
                  </Button>
                )}
              </div>
              {detail.appointments?.length ? (
                <Table head={['Randevu No', 'Tarih', 'Tür', 'Durum', 'Personel', '']}>
                  {detail.appointments.map((a: any) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.randevuNo}</td>
                      <td className="px-4 py-2">{dateTime(a.appointmentDate)}</td>
                      <td className="px-4 py-2">{APPT_TYPE_LABEL[a.type]}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(a.status)}>{APPT_STATUS_LABEL[a.status]}</Badge>
                      </td>
                      <td className="px-4 py-2">{a.user?.name || '-'}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setApptDetail(a)}>
                          Detay
                        </Button>
                      </td>
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">Tedavi Planları</h3>
                {canPlan && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      navigate(`/treatment?patientId=${detail.id}&create=1`);
                    }}
                  >
                    + Yeni Tedavi Planı
                  </Button>
                )}
              </div>
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{dateOnly(plan.createdAt)}</span>
                          <Button size="sm" variant="secondary" onClick={() => setPlanDetail(plan)}>
                            Detay
                          </Button>
                        </div>
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

      <Modal
        open={newApptOpen}
        onClose={() => setNewApptOpen(false)}
        title={`Yeni Randevu - ${detail ? `${detail.name} ${detail.surname}` : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewApptOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => createApptMutation.mutate()}
              disabled={!newApptForm.dateTime || createApptMutation.isPending}
            >
              {createApptMutation.isPending ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Randevu Türü *">
            <Select
              value={newApptForm.type}
              onChange={(e) => setNewApptForm({ ...newApptForm, type: e.target.value, userId: '' })}
            >
              {Object.entries(APPT_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Personel"
            hint={newApptForm.type === 'MEETING' ? 'Görüşmeler satış personeli tarafından yapılır.' : 'Muayene/tedavi doktor tarafından yapılır.'}
          >
            <Select
              value={newApptForm.userId}
              onChange={(e) => setNewApptForm({ ...newApptForm, userId: e.target.value })}
            >
              <option value="">Atanmadı</option>
              {apptStaffOptions.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({ROLE_LABEL[member.role]})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tarih ve Saat *">
            <Input
              type="datetime-local"
              value={newApptForm.dateTime}
              onChange={(e) => setNewApptForm({ ...newApptForm, dateTime: e.target.value })}
            />
          </Field>
          <Field label="Bitiş Saati" hint="Boş bırakılırsa randevu 30 dk kabul edilir.">
            <Input
              type="time"
              value={newApptForm.endTime}
              onChange={(e) => setNewApptForm({ ...newApptForm, endTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Not">
          <Input value={newApptForm.notes} onChange={(e) => setNewApptForm({ ...newApptForm, notes: e.target.value })} />
        </Field>
        <p className="text-xs text-slate-400">Randevu numarası otomatik oluşturulur.</p>
      </Modal>

      <Modal
        open={!!apptDetail}
        onClose={() => setApptDetail(null)}
        title={`Randevu Detayı - ${apptDetail?.randevuNo || ''}`}
        wide
        footer={
          <Button variant="secondary" onClick={() => setApptDetail(null)}>
            Kapat
          </Button>
        }
      >
        {apptDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Randevu No</p>
                <p className="font-mono font-medium">{apptDetail.randevuNo}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tür</p>
                <Badge tone={statusTone(apptDetail.type)}>{APPT_TYPE_LABEL[apptDetail.type]}</Badge>
              </div>
              <div>
                <p className="text-xs text-slate-400">Durum</p>
                <Badge tone={statusTone(apptDetail.status)}>{APPT_STATUS_LABEL[apptDetail.status]}</Badge>
              </div>
              <div>
                <p className="text-xs text-slate-400">Başlangıç</p>
                <p className="font-medium">{dateTime(apptDetail.appointmentDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Bitiş</p>
                <p className="font-medium">{dateTime(apptDetail.endDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Personel</p>
                <p className="font-medium">{apptDetail.user?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Randevuyu Veren</p>
                <p className="font-medium">
                  {apptDetail.createdBy?.name || '-'}
                  {apptDetail.createdBy?.role ? ` (${ROLE_LABEL[apptDetail.createdBy.role]})` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Kanal</p>
                <p className="font-medium">{apptDetail.channel || 'Bilinmiyor'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Kampanya</p>
                <p className="font-medium">{apptDetail.campaign?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Geliş Kaydı</p>
                <p className="font-medium">{apptDetail.visit?.protokolNo || '-'}</p>
              </div>
              {apptDetail.type === 'MEETING' && (
                <div>
                  <p className="text-xs text-slate-400">Satış Durumu</p>
                  <p className="font-medium">
                    {apptDetail.salesStatus ? SALES_STATUS_LABEL[apptDetail.salesStatus] : 'Belirlenmedi'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Randevu Telefonu</p>
                <p className="font-medium">{apptDetail.phone || detail?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">İşlem Türü</p>
                <p className="font-medium">{apptDetail.procedureType || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Birim No</p>
                <p className="font-medium">{apptDetail.unitNo ?? '-'}</p>
              </div>
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-slate-400">Not</p>
                <p className="font-medium whitespace-pre-wrap">{apptDetail.notes || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!planDetail}
        onClose={() => setPlanDetail(null)}
        title="Tedavi Planı Detayı"
        wide
        footer={
          <Button variant="secondary" onClick={() => setPlanDetail(null)}>
            Kapat
          </Button>
        }
      >
        {planDetail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={statusTone(planDetail.status)}>{PLAN_STATUS_LABEL[planDetail.status]}</Badge>
              <span className="text-sm font-semibold">{money(planDetail.totalPrice)}</span>
              {Number(planDetail.discount) > 0 && (
                <span className="text-xs text-slate-400">indirim {money(planDetail.discount)}</span>
              )}
              <span className="text-xs text-slate-400">{dateOnly(planDetail.createdAt)}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span>
                Kanal: <strong className="text-slate-700">{planDetail.channel || 'Bilinmiyor'}</strong>
              </span>
              <span>
                Kampanya: <strong className="text-slate-700">{planDetail.campaign?.name || '-'}</strong>
              </span>
              <span>
                Satışı Yapan: <strong className="text-slate-700">{planDetail.createdBy?.name || '-'}</strong>
              </span>
              <span>
                Onay: <strong className="text-slate-700">{planDetail.approvedAt ? dateTime(planDetail.approvedAt) : '-'}</strong>
              </span>
            </div>
            {planDetail.paymentPlan?.note && (
              <p className="text-sm text-slate-500">Ödeme planı: {planDetail.paymentPlan.note}</p>
            )}
            <Table head={['Sıra', 'Diş', 'Tedavi', 'Adet', 'Birim Fiyat', 'Toplam']}>
              {planDetail.items?.map((item: any) => (
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
              {planDetail.invoices?.length ? (
                <Table head={['Tutar', 'Ödenen', 'Durum', 'Vade']}>
                  {planDetail.invoices.map((invoice: any) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-2">{money(invoice.amount)}</td>
                      <td className="px-4 py-2">{money(invoice.paidAmount)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(invoice.status)}>{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
                      </td>
                      <td className="px-4 py-2">{dateOnly(invoice.dueDate)}</td>
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


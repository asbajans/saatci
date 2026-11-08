import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PatientPicker } from '../../components/PatientPicker';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LoadingText,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui';
import { apiError, dateOnly, dateTime, money } from '../../lib/format';

const UPPER_TEETH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_TEETH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const TOOTH_CONDITIONS: Record<string, { label: string; className: string }> = {
  healthy: { label: 'Sağlam', className: 'bg-white text-slate-500 border-slate-300' },
  caries: { label: 'Çürük', className: 'bg-red-100 text-red-700 border-red-300' },
  filled: { label: 'Dolgu', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  root_canal: { label: 'Kanal Tedavisi', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  crown: { label: 'Kron / Kaplama', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  implant: { label: 'İmplant', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  missing: { label: 'Eksik', className: 'bg-slate-200 text-slate-500 border-slate-400 line-through' },
  extraction: { label: 'Çekim', className: 'bg-orange-100 text-orange-700 border-orange-300' },
  fracture: { label: 'Kırık', className: 'bg-pink-100 text-pink-700 border-pink-300' },
};

type ToothForm = { condition: string; surfaces: string; notes: string };

export const ClinicalPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');

  const { data: patient, isLoading } = useQuery({
    queryKey: ['clinical-patient', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/clinical/patients/${patientId}`)).data.data as any,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['catalog-services'],
    queryFn: async () => (await api.get('/catalog/services')).data.data as any[],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['clinical-patient', patientId] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klinik Yönetim"
        subtitle="Tıbbi kart, diş şeması, teşhis, tedavi kayıtları, reçete ve klinik notlar"
      />

      <Card className="p-4">
        <Field label="Hasta Seçin" hint="Ad, telefon, TC veya hasta no ile arayın.">
          <PatientPicker value={patientId} onChange={setPatientId} allowCreate={false} />
        </Field>
      </Card>

      {!patientId ? (
        <Card>
          <Empty title="Hasta seçilmedi" hint="Klinik kayıtlarını görüntülemek için yukarıdan bir hasta seçin." />
        </Card>
      ) : isLoading ? (
        <LoadingText />
      ) : !patient ? (
        <Card>
          <Empty title="Hasta bulunamadı" />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {patient.name} {patient.surname}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {patient.hastaNo} · {patient.phone}
                  {patient.email ? ` · ${patient.email}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Doğum: {dateOnly(patient.birthDate)} · Cinsiyet: {patient.gender || '-'} · Kan grubu:{' '}
                  {patient.bloodGroup || '-'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {patient.tariff && <Badge tone="blue">{patient.tariff.name}</Badge>}
                {patient.dentist && <Badge tone="violet">Doktor: {patient.dentist.name}</Badge>}
                {Number(patient.balance) !== 0 && <Badge tone="amber">Bakiye: {money(patient.balance)}</Badge>}
                {patient.specialCode && <Badge tone="slate">{patient.specialCode}</Badge>}
              </div>
            </div>
          </Card>

          <MedicalRecordCard patient={patient} onSaved={invalidate} />
          <ToothChartCard patient={patient} onSaved={invalidate} />
          <DiagnosesCard patient={patient} onChanged={invalidate} />
          <TreatmentRecordsCard patient={patient} services={services} onChanged={invalidate} />
          <PrescriptionsCard patient={patient} onChanged={invalidate} />
          <ClinicalNotesCard patient={patient} onChanged={invalidate} />
        </>
      )}
    </div>
  );
};

const MedicalRecordCard: React.FC<{ patient: any; onSaved: () => void }> = ({ patient, onSaved }) => {
  const [form, setForm] = useState({ allergies: '', chronicDiseases: '', medications: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const record = patient.medicalRecord || {};
    setForm({
      allergies: record.allergies || '',
      chronicDiseases: record.chronicDiseases || '',
      medications: record.medications || '',
      notes: record.notes || '',
    });
  }, [patient]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/clinical/patients/${patient.id}/medical-record`, form);
      onSaved();
      alert('Tıbbi kayıt güncellendi.');
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Tıbbi Kayıt</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Alerjiler">
          <Textarea rows={3} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
        </Field>
        <Field label="Kronik Hastalıklar">
          <Textarea
            rows={3}
            value={form.chronicDiseases}
            onChange={(e) => setForm({ ...form, chronicDiseases: e.target.value })}
          />
        </Field>
        <Field label="Kullandığı İlaçlar">
          <Textarea
            rows={3}
            value={form.medications}
            onChange={(e) => setForm({ ...form, medications: e.target.value })}
          />
        </Field>
        <Field label="Klinik Not">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Tıbbi Kaydı Kaydet'}
        </Button>
      </div>
    </Card>
  );
};

const ToothChartCard: React.FC<{ patient: any; onSaved: () => void }> = ({ patient, onSaved }) => {
  const [findings, setFindings] = useState<any[]>(patient.toothFindings || []);
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [form, setForm] = useState<ToothForm>({ condition: 'caries', surfaces: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFindings(patient.toothFindings || []);
  }, [patient]);

  const findingsByTooth = useMemo(() => {
    const map: Record<string, any> = {};
    findings.forEach((finding) => {
      map[finding.toothNo] = finding;
    });
    return map;
  }, [findings]);

  const openTooth = (toothNo: string) => {
    const finding = findingsByTooth[toothNo];
    setSelectedTooth(toothNo);
    setForm({
      condition: finding?.condition || 'caries',
      surfaces: finding?.surfaces || '',
      notes: finding?.notes || '',
    });
  };

  const persist = async (nextFindings: any[]) => {
    setSaving(true);
    try {
      await api.put(`/clinical/patients/${patient.id}/tooth-findings`, {
        findings: nextFindings.map((finding) => ({
          toothNo: finding.toothNo,
          condition: finding.condition,
          surfaces: finding.surfaces || undefined,
          notes: finding.notes || undefined,
        })),
      });
      setFindings(nextFindings);
      onSaved();
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const saveTooth = async () => {
    if (!selectedTooth) return;
    const next = findings.filter((finding) => finding.toothNo !== selectedTooth);
    if (form.condition !== 'healthy') {
      next.push({ toothNo: selectedTooth, condition: form.condition, surfaces: form.surfaces, notes: form.notes });
    }
    await persist(next);
    setSelectedTooth(null);
  };

  const clearTooth = async () => {
    if (!selectedTooth) return;
    await persist(findings.filter((finding) => finding.toothNo !== selectedTooth));
    setSelectedTooth(null);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Diş Şeması</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(TOOTH_CONDITIONS).map(([key, value]) => (
            <span key={key} className={`inline-flex items-center rounded border px-2 py-0.5 ${value.className}`}>
              {value.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px] space-y-3">
          <ToothRow teeth={UPPER_TEETH} findings={findingsByTooth} onSelect={openTooth} />
          <div className="h-px bg-slate-200" />
          <ToothRow teeth={LOWER_TEETH} findings={findingsByTooth} onSelect={openTooth} />
        </div>
      </div>

      {selectedTooth && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Diş {selectedTooth}</p>
            <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setSelectedTooth(null)}>
              Kapat
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Durum">
              <Select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {Object.entries(TOOTH_CONDITIONS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Yüzeyler">
              <Input
                value={form.surfaces}
                onChange={(e) => setForm({ ...form, surfaces: e.target.value })}
                placeholder="örn. mesial, distal, okluzal"
              />
            </Field>
            <Field label="Not">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={clearTooth} disabled={saving}>
              Bulguyu Temizle
            </Button>
            <Button size="sm" onClick={saveTooth} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

const ToothRow: React.FC<{
  teeth: string[];
  findings: Record<string, any>;
  onSelect: (toothNo: string) => void;
}> = ({ teeth, findings, onSelect }) => (
  <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
    {teeth.map((toothNo) => {
      const finding = findings[toothNo];
      const style = TOOTH_CONDITIONS[finding?.condition || 'healthy'] || TOOTH_CONDITIONS.healthy;
      return (
        <button
          key={toothNo}
          type="button"
          onClick={() => onSelect(toothNo)}
          className={`rounded-lg border px-1 py-3 text-center transition hover:scale-105 ${style.className}`}
          title={finding ? `${style.label}${finding.notes ? ` · ${finding.notes}` : ''}` : 'Sağlam'}
        >
          <span className="block text-sm font-bold">{toothNo}</span>
          <span className="block text-[10px] leading-tight">{style.label}</span>
        </button>
      );
    })}
  </div>
);

const DiagnosesCard: React.FC<{ patient: any; onChanged: () => void }> = ({ patient, onChanged }) => {
  const [form, setForm] = useState({ toothNo: '', code: '', title: '', description: '' });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post(`/clinical/patients/${patient.id}/diagnoses`, {
        toothNo: form.toothNo || undefined,
        code: form.code || undefined,
        title: form.title.trim(),
        description: form.description || undefined,
      });
      setForm({ toothNo: '', code: '', title: '', description: '' });
      onChanged();
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (diagnosis: any, status: string) => {
    try {
      await api.patch(`/clinical/diagnoses/${diagnosis.id}`, { status });
      onChanged();
    } catch (error) {
      alert(apiError(error));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Teşhisi silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/clinical/diagnoses/${id}`);
      onChanged();
    } catch (error) {
      alert(apiError(error));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Teşhisler</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Field label="Diş No">
          <Input value={form.toothNo} onChange={(e) => setForm({ ...form, toothNo: e.target.value })} />
        </Field>
        <Field label="Kod">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Teşhis *" className="md:col-span-2">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" onClick={add} disabled={saving || !form.title.trim()}>
            Ekle
          </Button>
        </div>
      </div>

      {patient.diagnoses?.length ? (
        <div className="space-y-2">
          {patient.diagnoses.map((diagnosis: any) => (
            <div
              key={diagnosis.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {diagnosis.toothNo ? `${diagnosis.toothNo} · ` : ''}
                  {diagnosis.title}
                  {diagnosis.code ? ` (${diagnosis.code})` : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {dateOnly(diagnosis.diagnosedAt)} · {diagnosis.doctor?.name || '-'}
                  {diagnosis.description ? ` · ${diagnosis.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={diagnosis.status === 'ACTIVE' ? 'amber' : 'green'}>
                  {diagnosis.status === 'ACTIVE' ? 'Aktif' : 'İyileşti'}
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStatus(diagnosis, diagnosis.status === 'ACTIVE' ? 'RESOLVED' : 'ACTIVE')}
                >
                  {diagnosis.status === 'ACTIVE' ? 'İyileşti' : 'Yeniden Aç'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(diagnosis.id)}>
                  Sil
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Henüz teşhis kaydı yok.</p>
      )}
    </Card>
  );
};

const TreatmentRecordsCard: React.FC<{ patient: any; services: any[]; onChanged: () => void }> = ({
  patient,
  services,
  onChanged,
}) => {
  const [form, setForm] = useState({
    serviceId: '',
    toothNo: '',
    procedureName: '',
    quantity: '1',
    unitPrice: '',
    vatRate: '0',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.procedureName.trim() || form.unitPrice === '') return;
    setSaving(true);
    try {
      await api.post(`/clinical/patients/${patient.id}/treatment-records`, {
        serviceId: form.serviceId || undefined,
        toothNo: form.toothNo || undefined,
        procedureName: form.procedureName.trim(),
        quantity: Number(form.quantity) || 1,
        unitPrice: Number(form.unitPrice),
        vatRate: Number(form.vatRate) || 0,
        notes: form.notes || undefined,
      });
      setForm({
        serviceId: '',
        toothNo: '',
        procedureName: '',
        quantity: '1',
        unitPrice: '',
        vatRate: '0',
        notes: '',
      });
      onChanged();
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Tedavi kaydını silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/clinical/treatment-records/${id}`);
      onChanged();
    } catch (error) {
      alert(apiError(error));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Tedavi Kayıtları</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        <Field label="Hizmet" className="md:col-span-2">
          <Select
            value={form.serviceId}
            onChange={(e) => {
              const service = services.find((item) => item.id === e.target.value);
              setForm({
                ...form,
                serviceId: e.target.value,
                procedureName: service ? `${service.category} - ${service.name}` : form.procedureName,
                unitPrice: service ? String(service.price) : form.unitPrice,
                vatRate: service ? String(service.vatRate ?? 0) : form.vatRate,
              });
            }}
          >
            <option value="">Serbest işlem</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Diş No">
          <Input value={form.toothNo} onChange={(e) => setForm({ ...form, toothNo: e.target.value })} />
        </Field>
        <Field label="İşlem *" className="md:col-span-2">
          <Input
            value={form.procedureName}
            onChange={(e) => setForm({ ...form, procedureName: e.target.value })}
          />
        </Field>
        <Field label="Birim Fiyat *">
          <Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
        </Field>
        <Field label="Adet">
          <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
        <div className="flex items-end md:col-span-1">
          <Button className="w-full" onClick={add} disabled={saving || !form.procedureName || form.unitPrice === ''}>
            Ekle
          </Button>
        </div>
      </div>

      {patient.treatmentRecords?.length ? (
        <div className="space-y-2">
          {patient.treatmentRecords.map((record: any) => (
            <div
              key={record.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {record.toothNo ? `${record.toothNo} · ` : ''}
                  {record.procedureName}
                </p>
                <p className="text-xs text-slate-400">
                  {dateTime(record.appliedAt)} · {record.quantity} x {money(record.unitPrice)} · {record.doctor?.name || '-'}
                  {record.notes ? ` · ${record.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{money(record.total)}</span>
                <Badge tone={record.status === 'APPLIED' ? 'green' : record.status === 'PLANNED' ? 'blue' : 'red'}>
                  {record.status === 'APPLIED' ? 'Uygulandı' : record.status === 'PLANNED' ? 'Planlandı' : 'İptal'}
                </Badge>
                <Button size="sm" variant="danger" onClick={() => remove(record.id)}>
                  Sil
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Henüz tedavi kaydı yok.</p>
      )}
    </Card>
  );
};

const PrescriptionsCard: React.FC<{ patient: any; onChanged: () => void }> = ({ patient, onChanged }) => {
  const [itemsText, setItemsText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const items = itemsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line }));
    if (items.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/clinical/patients/${patient.id}/prescriptions`, { items, notes: notes || undefined });
      setItemsText('');
      setNotes('');
      onChanged();
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Reçeteyi silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/clinical/prescriptions/${id}`);
      onChanged();
    } catch (error) {
      alert(apiError(error));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Reçeteler</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="İlaçlar (her satır bir ilaç)">
          <Textarea
            rows={4}
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            placeholder={'Amoksisilin 500 mg 2x1\nParasetamol 500 mg günde 3 kez'}
          />
        </Field>
        <Field label="Not">
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={add} disabled={saving || !itemsText.trim()}>
          {saving ? 'Kaydediliyor...' : 'Reçete Ekle'}
        </Button>
      </div>

      {patient.prescriptions?.length ? (
        <div className="space-y-2">
          {patient.prescriptions.map((prescription: any) => (
            <div key={prescription.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {dateOnly(prescription.issuedAt)} · {prescription.doctor?.name || '-'}
                </p>
                <Button size="sm" variant="danger" onClick={() => remove(prescription.id)}>
                  Sil
                </Button>
              </div>
              <ul className="mt-1 text-sm text-slate-600 list-disc list-inside">
                {(Array.isArray(prescription.items) ? prescription.items : []).map((item: any, index: number) => (
                  <li key={index}>{typeof item === 'string' ? item : item.name || JSON.stringify(item)}</li>
                ))}
              </ul>
              {prescription.notes && <p className="text-xs text-slate-400 mt-1">{prescription.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Henüz reçete yok.</p>
      )}
    </Card>
  );
};

const ClinicalNotesCard: React.FC<{ patient: any; onChanged: () => void }> = ({ patient, onChanged }) => {
  const [type, setType] = useState('NOTE');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await api.post(`/clinical/patients/${patient.id}/notes`, { type, content: content.trim() });
      setContent('');
      onChanged();
    } catch (error) {
      alert(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Notu silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/clinical/notes/${id}`);
      onChanged();
    } catch (error) {
      alert(apiError(error));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Klinik Notlar</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="Tür">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="NOTE">Not</option>
            <option value="ANAMNESIS">Anamnez</option>
            <option value="FOLLOW_UP">Takip</option>
          </Select>
        </Field>
        <Field label="Not" className="md:col-span-3">
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={add} disabled={saving || !content.trim()}>
          Not Ekle
        </Button>
      </div>

      {patient.clinicalNotes?.length ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {patient.clinicalNotes.map((note: any) => (
            <div key={note.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  {dateTime(note.createdAt)} · {note.doctor?.name || '-'} ·{' '}
                  {note.type === 'ANAMNESIS' ? 'Anamnez' : note.type === 'FOLLOW_UP' ? 'Takip' : 'Not'}
                </p>
                <Button size="sm" variant="ghost" onClick={() => remove(note.id)}>
                  Sil
                </Button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Henüz klinik not yok.</p>
      )}
    </Card>
  );
};

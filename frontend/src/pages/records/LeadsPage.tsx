import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, Table, Textarea } from '../../components/ui';
import {
  APPT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
  ROLE_LABEL,
  SOURCES,
  apiError,
  dateOnly,
  dateTime,
  fromLocalInput,
  splitFullName,
  statusTone,
  toLocalInput,
} from '../../lib/format';

const emptyLead = { name: '', phone: '', email: '', source: 'Instagram', campaignId: '' };
const emptyConvert = { tc: '', birthDate: '', gender: '', email: '' };
const emptyAppointment = {
  type: 'MEETING',
  userId: '',
  dateTime: toLocalInput(new Date(Date.now() + 86400000)),
  notes: '',
};

type LeadsPageResponse = {
  data: any[];
  meta?: { total: number; page: number; pageSize: number | 'all'; totalPages: number };
};

export const LeadsPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('20');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyLead });
  const [convertLead, setConvertLead] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({ ...emptyConvert });
  const [apptLead, setApptLead] = useState<any>(null);
  const [apptForm, setApptForm] = useState({ ...emptyAppointment });
  const [callbackLead, setCallbackLead] = useState<any>(null);
  const [callbackForm, setCallbackForm] = useState({ dateTime: '', note: '' });
  const [cardLeadId, setCardLeadId] = useState<string | null>(null);
  const [cardDescription, setCardDescription] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const canManage = ['ADMIN', 'CALL_CENTER', 'SALES'].includes(user?.role || '');

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter, campaignFilter, dateFrom, dateTo, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'leads',
      { search, statusFilter, sourceFilter, campaignFilter, dateFrom, dateTo, page, pageSize },
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (search.trim()) params.q = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (campaignFilter) params.campaignId = campaignFilter;
      if (dateFrom) params.dateFrom = new Date(`${dateFrom}T00:00:00`).toISOString();
      if (dateTo) params.dateTo = new Date(`${dateTo}T23:59:59.999`).toISOString();
      return (await api.get('/leads', { params })).data as LeadsPageResponse;
    },
  });

  const leads = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(meta.totalPages);
  }, [meta, page]);

  const { data: sources = [] } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => (await api.get('/leads/sources')).data.data as string[],
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const { data: cardLead, isLoading: cardLoading } = useQuery({
    queryKey: ['lead', cardLeadId],
    queryFn: async () => (await api.get(`/leads/${cardLeadId}`)).data.data as any,
    enabled: !!cardLeadId,
  });

  useEffect(() => {
    setCardDescription(cardLead?.description || '');
  }, [cardLead?.id, cardLead?.description]);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/users/staff')).data.data as any[],
  });

  const staffOptions = useMemo(
    () => staff.filter((s: any) => (apptForm.type === 'MEETING' ? s.role === 'SALES' : s.role === 'DENTIST')),
    [staff, apptForm.type]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['lead-reminders'] });
  };

  const appointmentMutation = useMutation({
    mutationFn: async () => {
      await api.post('/appointments', {
        leadId: apptLead.id,
        type: apptForm.type,
        userId: apptForm.userId || null,
        channel: apptLead.source,
        campaignId: apptLead.campaignId || undefined,
        appointmentDate: fromLocalInput(apptForm.dateTime),
        notes: apptForm.notes || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setApptLead(null);
      setApptForm({ ...emptyAppointment });
      alert('Randevu oluşturuldu. Lead hasta kaydına dönüşmeden randevu takip edilebilir.');
    },
    onError: (err) => alert(apiError(err)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/leads', {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        source: form.source,
        campaignId: form.campaignId || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setForm({ ...emptyLead });
    },
    onError: (err) => alert(apiError(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      callbackAt,
      callbackNote,
    }: {
      id: string;
      status: string;
      callbackAt?: string;
      callbackNote?: string | null;
    }) => {
      await api.patch(`/leads/${id}/status`, { status, callbackAt, callbackNote });
    },
    onSuccess: () => {
      invalidate();
      setCallbackLead(null);
      setCallbackForm({ dateTime: '', note: '' });
    },
    onError: (err) => alert(apiError(err)),
  });

  const handleStatusChange = (lead: any, status: string) => {
    if (status === 'CALLBACK') {
      setCallbackLead(lead);
      setCallbackForm({
        dateTime: toLocalInput(lead.callbackAt || new Date(Date.now() + 3600000)),
        note: lead.callbackNote || '',
      });
      return;
    }
    statusMutation.mutate({ id: lead.id, status });
  };

  const saveCallback = () => {
    if (!callbackLead || !callbackForm.dateTime) return;
    statusMutation.mutate({
      id: callbackLead.id,
      status: 'CALLBACK',
      callbackAt: fromLocalInput(callbackForm.dateTime),
      callbackNote: callbackForm.note.trim() || null,
    });
  };

  const convertMutation = useMutation({
    mutationFn: async () => {
      const { name, surname } = splitFullName(convertLead.name);
      const patientRes = await api.post('/patients', {
        name,
        surname,
        tc: convertForm.tc,
        phone: convertLead.phone,
        email: convertForm.email || convertLead.email || undefined,
        birthDate: convertForm.birthDate ? `${convertForm.birthDate}T00:00:00.000Z` : undefined,
        gender: convertForm.gender || undefined,
      });
      await api.patch(`/leads/${convertLead.id}`, {
        patientId: patientRes.data.data.id,
        status: 'CLINIC_VISIT',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConvertLead(null);
      setConvertForm({ ...emptyConvert });
    },
    onError: (err) => alert(apiError(err)),
  });

  const descriptionMutation = useMutation({
    mutationFn: async () => {
      if (!cardLeadId) return;
      await api.patch(`/leads/${cardLeadId}`, { description: cardDescription.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', cardLeadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => alert(apiError(err)),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (!cardLeadId) return;
      await api.post(`/leads/${cardLeadId}/notes`, { content: noteContent.trim() });
    },
    onSuccess: () => {
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['lead', cardLeadId] });
    },
    onError: (err) => alert(apiError(err)),
  });

  const openCard = (leadId: string) => {
    setCardLeadId(leadId);
    setNoteContent('');
  };

  const closeCard = () => {
    setCardLeadId(null);
    setNoteContent('');
  };

  const hasFilters = Boolean(
    search.trim() || statusFilter || sourceFilter || campaignFilter || dateFrom || dateTo
  );

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
    setCampaignFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Yönetimi"
        subtitle="Reklam ve iletişim kanallarından gelen potansiyel hastalar"
        action={canManage ? <Button onClick={() => setAddOpen(true)}>+ Yeni Lead</Button> : undefined}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ara" className="min-w-[220px] flex-1">
            <Input
              placeholder="Ad veya telefon ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Durum" className="w-[170px]">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kaynak" className="w-[160px]">
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">Tüm Kaynaklar</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kampanya" className="w-[200px]">
            <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
              <option value="">Tüm Kampanyalar</option>
              {campaigns.map((campaign: any) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç" className="w-[150px]">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Bitiş" className="w-[150px]">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          {hasFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Temizle
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : leads.length === 0 ? (
          <Empty
            title="Lead bulunamadı"
            hint={hasFilters ? 'Filtre veya arama kriterlerini değiştirin.' : 'Yeni lead ekleyerek başlayın.'}
          />
        ) : (
          <>
            <Table head={['Ad', 'Telefon', 'Kaynak', 'Kampanya', 'Durum', 'Son Randevu', 'Kayıt', 'İşlem']}>
              {leads.map((lead: any) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openCard(lead.id)}
                    className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                  >
                    {lead.name}
                  </button>
                  {lead.patient && (
                    <p className="text-xs text-emerald-600">
                      Hasta: {lead.patient.hastaNo}
                    </p>
                  )}
                  {lead.visits?.[0] && (
                    <p className="text-xs text-slate-400 font-mono">Geliş: {lead.visits[0].protokolNo}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.phone}</td>
                <td className="px-4 py-3">{lead.source}</td>
                <td className="px-4 py-3 text-slate-500">{lead.campaign?.name || '-'}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(lead.status)}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                  {lead.status === 'CALLBACK' && lead.callbackAt && (
                    <p
                      className={`text-xs mt-1 ${
                        new Date(lead.callbackAt).getTime() <= Date.now()
                          ? 'text-red-600 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      Aranacak: {dateTime(lead.callbackAt)}
                    </p>
                  )}
                  {lead.status === 'CALLBACK' && lead.callbackNote && (
                    <p className="text-xs text-slate-400 mt-0.5">{lead.callbackNote}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lead.appointments?.[0] ? (
                    <>
                      <Badge tone={statusTone(lead.appointments[0].type)}>
                        {APPT_TYPE_LABEL[lead.appointments[0].type]}
                      </Badge>
                      <p className="text-xs text-slate-400 mt-1">{dateTime(lead.appointments[0].appointmentDate)}</p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Randevu yok</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(lead.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openCard(lead.id)}>
                      Kart
                    </Button>
                    {canManage && (
                      <Select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead, e.target.value)}
                        className="text-xs py-1 max-w-[170px]"
                      >
                        {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setApptLead(lead);
                          setApptForm({ ...emptyAppointment });
                        }}
                      >
                        Randevu Ver
                      </Button>
                    )}
                    {canManage && !lead.patient && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setConvertLead(lead);
                          setConvertForm({ ...emptyConvert, email: lead.email || '' });
                        }}
                      >
                        Hastaya Çevir
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              ))}
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">
                Toplam <strong>{meta?.total ?? leads.length}</strong> lead · Sayfa {meta?.page ?? page} /{' '}
                {meta?.totalPages ?? 1}
              </p>
              <div className="flex items-center gap-2">
                <Select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="w-[130px]">
                  <option value="20">20 / sayfa</option>
                  <option value="50">50 / sayfa</option>
                  <option value="100">100 / sayfa</option>
                  <option value="all">Tümü</option>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Önceki
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= (meta?.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>


      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Yeni Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ad Soyad *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefon *">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-posta">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kaynak">
              <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kampanya">
              <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">Kampanyasız</option>
                {campaigns.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!apptLead}
        onClose={() => setApptLead(null)}
        title={`Randevu Ver - ${apptLead?.name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApptLead(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => appointmentMutation.mutate()} disabled={appointmentMutation.isPending}>
              {appointmentMutation.isPending ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Lead hasta kaydına dönüşmeden randevu alabilir. Kanal: <strong>{apptLead?.source}</strong>, kampanya:{' '}
          <strong>{apptLead?.campaign?.name || '-'}</strong>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Randevu Türü">
            <Select
              value={apptForm.type}
              onChange={(e) => setApptForm({ ...apptForm, type: e.target.value, userId: '' })}
            >
              {Object.entries(APPT_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Personel">
            <Select value={apptForm.userId} onChange={(e) => setApptForm({ ...apptForm, userId: e.target.value })}>
              <option value="">Atanmadı</option>
              {staffOptions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({ROLE_LABEL[s.role]})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tarih ve Saat *">
          <Input
            type="datetime-local"
            value={apptForm.dateTime}
            onChange={(e) => setApptForm({ ...apptForm, dateTime: e.target.value })}
          />
        </Field>
        <Field label="Not">
          <Input value={apptForm.notes} onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        open={!!callbackLead}
        onClose={() => setCallbackLead(null)}
        title={`Tekrar Arama - ${callbackLead?.name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCallbackLead(null)}>
              Vazgeç
            </Button>
            <Button onClick={saveCallback} disabled={!callbackForm.dateTime || statusMutation.isPending}>
              {statusMutation.isPending ? 'Kaydediliyor...' : 'Hatırlatmayı Kaydet'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Seçilen tarih ve saatte üst barda hatırlatma oluşur ve sesli uyarı çalar.
        </p>
        <Field label="Aranacak Tarih ve Saat *">
          <Input
            type="datetime-local"
            value={callbackForm.dateTime}
            onChange={(e) => setCallbackForm({ ...callbackForm, dateTime: e.target.value })}
          />
        </Field>
        <Field label="Not">
          <Input
            value={callbackForm.note}
            onChange={(e) => setCallbackForm({ ...callbackForm, note: e.target.value })}
            placeholder="Örn. Öğleden sonra aranacak"
          />
        </Field>
      </Modal>

      <Modal
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        title={`Hastaya Dönüştür - ${convertLead?.name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConvertLead(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => convertMutation.mutate()} disabled={!convertForm.tc || convertMutation.isPending}>
              {convertMutation.isPending ? 'Kaydediliyor...' : 'Hasta Kaydı Oluştur'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Lead bilgileriyle hasta kaydı oluşturulacak. Hasta numarası otomatik atanır.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="TC Kimlik No *">
            <Input value={convertForm.tc} onChange={(e) => setConvertForm({ ...convertForm, tc: e.target.value })} maxLength={11} />
          </Field>
          <Field label="Doğum Tarihi">
            <Input
              type="date"
              value={convertForm.birthDate}
              onChange={(e) => setConvertForm({ ...convertForm, birthDate: e.target.value })}
            />
          </Field>
          <Field label="Cinsiyet">
            <Select value={convertForm.gender} onChange={(e) => setConvertForm({ ...convertForm, gender: e.target.value })}>
              <option value="">Seçiniz</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
            </Select>
          </Field>
          <Field label="E-posta">
            <Input
              type="email"
              value={convertForm.email}
              onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!cardLeadId}
        onClose={closeCard}
        title={`Lead Kartı - ${cardLead?.name || ''}`}
        wide
        footer={
          <Button variant="secondary" onClick={closeCard}>
            Kapat
          </Button>
        }
      >
        {cardLoading || !cardLead ? (
          <LoadingText />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Telefon</p>
                <p className="font-medium text-slate-800">{cardLead.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">E-posta</p>
                <p className="font-medium text-slate-800">{cardLead.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kaynak</p>
                <p className="font-medium text-slate-800">{cardLead.source}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kampanya</p>
                <p className="font-medium text-slate-800">{cardLead.campaign?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Durum</p>
                <Badge tone={statusTone(cardLead.status)}>{LEAD_STATUS_LABEL[cardLead.status]}</Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kayıt Tarihi</p>
                <p className="font-medium text-slate-800">{dateTime(cardLead.createdAt)}</p>
              </div>
            </div>

            {cardLead.patient && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Hasta kaydı: {cardLead.patient.hastaNo} · {cardLead.patient.name} {cardLead.patient.surname}
              </div>
            )}

            <div>
              <Field label="Açıklama">
                <Textarea
                  rows={3}
                  value={cardDescription}
                  onChange={(e) => setCardDescription(e.target.value)}
                  placeholder="Lead ile ilgili genel açıklama..."
                />
              </Field>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => descriptionMutation.mutate()}
                  disabled={descriptionMutation.isPending}
                >
                  {descriptionMutation.isPending ? 'Kaydediliyor...' : 'Açıklamayı Kaydet'}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                Notlar ({cardLead.notes?.length || 0})
              </h4>
              <div className="max-h-[240px] space-y-2 overflow-y-auto">
                {cardLead.notes?.length ? (
                  cardLead.notes.map((note: any) => (
                    <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">{note.createdBy?.name || 'Bilinmeyen kullanıcı'}</Badge>
                        {note.createdBy?.role && (
                          <Badge tone="blue">{ROLE_LABEL[note.createdBy.role] || note.createdBy.role}</Badge>
                        )}
                        <span className="text-xs text-slate-400">{dateTime(note.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Henüz not eklenmedi.</p>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Not yazın..."
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => noteMutation.mutate()}
                    disabled={!noteContent.trim() || noteMutation.isPending}
                  >
                    {noteMutation.isPending ? 'Ekleniyor...' : 'Not Ekle'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

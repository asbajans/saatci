import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { PatientPicker } from '../../components/PatientPicker';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LoadingText,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Table,
  Textarea,
} from '../../components/ui';
import {
  APPT_STATUS_LABEL,
  APPT_TYPE_LABEL,
  ROLE_LABEL,
  SOURCES,
  VISIT_STATUS_LABEL,
  apiError,
  dateTime,
  fromLocalInput,
  isToday,
  statusTone,
  toLocalInput,
} from '../../lib/format';

const emptyForm = {
  target: 'patient' as 'patient' | 'lead',
  patientId: '',
  leadId: '',
  type: 'MEETING',
  userId: '',
  channel: '',
  campaignId: '',
  dateTime: toLocalInput(new Date(Date.now() + 3600000)),
  endTime: '',
  notes: '',
};

export const AppointmentsPage: React.FC = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState('');
  const [channel, setChannel] = useState('');
  const [patientFilterId, setPatientFilterId] = useState('');
  const [date, setDate] = useState(() => toLocalInput(new Date()).slice(0, 10));
  const [view, setView] = useState<'list' | 'slots'>('slots');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [reschedule, setReschedule] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ slot: string; column: any; appt?: any } | null>(null);
  const [slotMenuAnchor, setSlotMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const slotMenuRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ columnId: string; userName: string; role: string; slots: string[] } | null>(null);
  const [slotMode, setSlotMode] = useState<'appointment' | 'block'>('appointment');
  const dragRef = useRef<{ columnId: string; userName: string; role: string; slots: string[] } | null>(null);
  const [blockModal, setBlockModal] = useState<{
    userId: string;
    userName: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    reason: string;
  } | null>(null);

  const canCreate = ['ADMIN', 'CALL_CENTER', 'SALES', 'BANKO'].includes(user?.role || '');
  const canArrive = ['ADMIN', 'CALL_CENTER', 'SALES', 'BANKO'].includes(user?.role || '');
  const canReschedule = canCreate;

  const { data: workingHours = [] } = useQuery({
    queryKey: ['working-hours', { date }],
    queryFn: async () => {
      const res = await api.get('/schedule/working-hours', { params: { date } });
      return res.data.data as any[];
    },
  });

  // TODO: use slots query for slot status management
  // const { data: slots = [] } = useQuery({
  //   queryKey: ['slots', { date }],
  //   queryFn: async () => {
  //     const res = await api.get('/settings/slots', { params: { date } });
  //     return res.data.data as any[];
  //   },
  // });

  const { data: scheduleBlocks = [] } = useQuery({
    queryKey: ['schedule-blocks', { date }],
    queryFn: async () => {
      const res = await api.get('/schedule/blocks', { params: { date } });
      return res.data.data as any[];
    },
  });

  const { data: weeklySchedules = [] } = useQuery({
    queryKey: ['weekly'],
    queryFn: async () => {
      const res = await api.get('/schedule/weekly');
      return res.data.data as any[];
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (slotMenuAnchor && slotMenuRef.current && !slotMenuRef.current.contains(event.target as Node)) {
        setSlotMenuAnchor(null);
        setSelectedSlot(null);
      }
    };
    if (slotMenuAnchor) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [slotMenuAnchor]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', { status, type, scope, channel, patientId: patientFilterId }],
    queryFn: async () => {
      const res = await api.get('/appointments', {
        params: {
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
          ...(scope ? { scope } : {}),
          ...(channel ? { channel } : {}),
          ...(patientFilterId ? { patientId: patientFilterId } : {}),
        },
      });
      return res.data.data as any[];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => (await api.get('/patients')).data.data as any[],
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get('/leads')).data.data as any[],
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/users/staff')).data.data as any[],
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const staffOptions = useMemo(
    () => staff.filter((s: any) => (form.type === 'MEETING' ? s.role === 'SALES' : s.role === 'DENTIST')),
    [staff, form.type]
  );

  const allStaff = useMemo(() => staff, [staff]);

  const visibleAppointments = useMemo(() => {
    const base =
      patientFilterId || !date
        ? appointments
        : appointments.filter((a) => String(a.appointmentDate || '').slice(0, 10) === date);
    if (scope === 'today') return base.filter((a) => isToday(a.appointmentDate));
    if (scope === 'upcoming') return base.filter((a) => new Date(a.appointmentDate).getTime() > Date.now());
    if (scope === 'past') return base.filter((a) => new Date(a.appointmentDate).getTime() < Date.now());
    return base;
  }, [appointments, date, scope, patientFilterId]);

  const selectedFilterPatient = useMemo(
    () => (patientFilterId ? patients.find((p: any) => p.id === patientFilterId) : null),
    [patients, patientFilterId]
  );

  const summary = useMemo(() => {
    const todays = visibleAppointments.filter((a) => isToday(a.appointmentDate)).length;
    const pending = visibleAppointments.filter((a) => a.status === 'PENDING').length;
    const leadBookings = visibleAppointments.filter((a) => a.leadId).length;
    return { todays, pending, leadBookings };
  }, [visibleAppointments]);

  const generateTimeSlots = (start: string, end: string, intervalMin: number = 15): string[] => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const from = startH * 60 + startM;
    const to = endH * 60 + endM;
    const slots: string[] = [];
    for (let m = from; m <= to; m += intervalMin) {
      const h = Math.floor(m / 60).toString().padStart(2, '0');
      const mm = (m % 60).toString().padStart(2, '0');
      slots.push(`${h}:${mm}`);
    }
    return slots;
  };

  const slotColumns = useMemo(() => {
    const source = allStaff.filter((s: any) => s.role === 'SALES' || s.role === 'DENTIST');
    return source.map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      appointments: visibleAppointments.filter((a: any) => (a.user?.id || a.userId) === s.id),
    }));
  }, [allStaff, visibleAppointments]);

  const slotSlots = useMemo(() => {
    let start = '09:00';
    let end = '18:00';

    const list = workingHours as any[];
    if (list.length) {
      const starts = list.map((w) => w.start).filter(Boolean).sort();
      const ends = list.map((w) => w.end).filter(Boolean).sort();
      if (starts.length) start = starts[0];
      if (ends.length) end = ends[ends.length - 1];
    }

    return generateTimeSlots(start, end, 15);
  }, [workingHours]);

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const addMinutes = (t: string, mins: number) => {
    const total = toMin(t) + mins;
    const h = Math.floor(total / 60).toString().padStart(2, '0');
    const m = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const slotTimeOf = (d: any) => String(d || '').slice(11, 16);

  const apptAt = useMemo(
    () => (c: any, slot: string) =>
      c.appointments.find((a: any) => {
        const start = slotTimeOf(a.appointmentDate);
        const end = a.endDate ? slotTimeOf(a.endDate) : addMinutes(start, 30);
        const t = toMin(slot);
        return t >= toMin(start) && t < toMin(end);
      }),
    []
  );

  const blockAt = (userId: string, slot: string) => {
    const t = toMin(slot);
    return (scheduleBlocks as any[]).find((b: any) => {
      const uid = b.user?.id || b.userId;
      return uid === userId && t >= toMin(b.startTime) && t < toMin(b.endTime);
    });
  };

  const workingHoursFor = (userId: string) => {
    const perDate = (workingHours as any[]).find((w: any) => (w.user?.id || w.userId) === userId);
    if (perDate) return perDate;
    const weekday = new Date(`${date}T00:00:00`).getDay();
    return (weeklySchedules as any[]).find(
      (w: any) => (w.user?.id || w.userId) === userId && w.weekday === weekday
    );
  };

  const hasWeeklyConfig = (userId: string) =>
    (weeklySchedules as any[]).some((w: any) => (w.user?.id || w.userId) === userId);

  const isNonWorkingDay = (userId: string) => {
    const perDate = (workingHours as any[]).find((w: any) => (w.user?.id || w.userId) === userId);
    if (perDate) return false;
    if (!hasWeeklyConfig(userId)) return false;
    return !workingHoursFor(userId);
  };

  const slotState = (userId: string, slot: string) => {
    if (isNonWorkingDay(userId)) {
      return { closed: true, label: 'Kapalı', tone: 'bg-slate-200 text-slate-500' };
    }
    const wh = workingHoursFor(userId);
    if (!wh) return { closed: false, label: '', tone: '' };
    const t = toMin(slot);
    if (t < toMin(wh.start) || t >= toMin(wh.end)) {
      return { closed: true, label: 'Kapalı', tone: 'bg-slate-200 text-slate-500' };
    }
    if (wh.lunchStart && wh.lunchEnd && t >= toMin(wh.lunchStart) && t < toMin(wh.lunchEnd)) {
      return { closed: true, label: 'Öğle', tone: 'bg-amber-100 text-amber-800' };
    }
    return { closed: false, label: '', tone: '' };
  };

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    const up = () => {
      const d = dragRef.current;
      if (d && d.slots.length) {
        const sorted = [...d.slots].sort((a, b) => toMin(a) - toMin(b));
        const startTime = sorted[0];
        const endTime = addMinutes(sorted[sorted.length - 1], 15);
        if (slotMode === 'block') {
          setBlockModal({
            userId: d.columnId,
            userName: d.userName,
            date,
            startTime,
            endTime,
            status: 'LEAVE',
            reason: '',
          });
        } else {
          setForm({
            ...emptyForm,
            target: 'patient',
            patientId: '',
            leadId: '',
            type: d.role === 'DENTIST' ? 'DENTIST' : 'MEETING',
            userId: d.columnId,
            dateTime: `${date}T${startTime}`,
            endTime,
            notes: '',
          });
          setCreateOpen(true);
        }
      }
      setDrag(null);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [date, slotMode]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['visits'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['patient'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const datePart = form.dateTime.slice(0, 10);
      await api.post('/appointments', {
        ...(form.target === 'patient' ? { patientId: form.patientId } : { leadId: form.leadId }),
        type: form.type,
        userId: form.userId || null,
        channel: form.channel || undefined,
        campaignId: form.campaignId || undefined,
        appointmentDate: fromLocalInput(form.dateTime),
        endDate: form.endTime ? fromLocalInput(`${datePart}T${form.endTime}`) : undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err) => alert(apiError(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/appointments/${id}/status`, { status });
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const arriveMutation = useMutation({
    mutationFn: async (id: string) => (await api.post('/visits', { appointmentId: id })).data.data,
    onSuccess: (visit) => {
      invalidate();
      alert(`Geliş kaydı oluşturuldu. Protokol No: ${visit.protokolNo}`);
    },
    onError: (err) => alert(apiError(err)),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/appointments/${reschedule.id}`, { appointmentDate: fromLocalInput(rescheduleDate) });
    },
    onSuccess: () => {
      invalidate();
      setReschedule(null);
    },
    onError: (err) => alert(apiError(err)),
  });

  const blockMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/schedule/blocks', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
      setBlockModal(null);
      setDrag(null);
    },
    onError: (err) => alert(apiError(err)),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedule/blocks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] }),
    onError: (err) => alert(apiError(err)),
  });


  return (
    <div className="space-y-6">
      <PageHeader
        title="Randevular"
        subtitle="Görüşme, muayene ve tedavi randevuları; her randevu hasta veya lead ile ilişkilendirilir"
        action={
          canCreate ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => (window.location.href = '/visits')}>
                Geliş Kayıtları
              </Button>
              <Button onClick={() => setCreateOpen(true)}>+ Yeni Randevu</Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Listedeki Randevu" value={visibleAppointments.length} />
        <StatCard label="Bugün" value={summary.todays} tone="blue" />
        <StatCard label="Lead Randevusu" value={summary.leadBookings} hint={`${summary.pending} onay bekliyor`} tone="violet" />
      </div>
      <Card className="p-4 flex flex-wrap gap-3">

        <div className="flex items-center gap-2">
          <Button size="sm" variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>
            Liste
          </Button>
          <Button size="sm" variant={view === 'slots' ? 'primary' : 'secondary'} onClick={() => setView('slots')}>
            Takvim
          </Button>
        </div>

        {view === 'slots' && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1">
            <Button
              size="sm"
              variant={slotMode === 'appointment' ? 'primary' : 'secondary'}
              onClick={() => setSlotMode('appointment')}
            >
              Randevu Ver
            </Button>
            <Button
              size="sm"
              variant={slotMode === 'block' ? 'primary' : 'secondary'}
              onClick={() => setSlotMode('block')}
            >
              Slot Kapat (İzin/Mola)
            </Button>
          </div>
        )}

        <div className="min-w-[280px] flex-1 md:max-w-md">
          <PatientPicker
            value={patientFilterId}
            onChange={(id) => {
              setPatientFilterId(id);
              if (id) setView('list');
            }}
            allowCreate={false}
            placeholder="Hasta ara: ad, telefon veya TC..."
          />
        </div>

        {!patientFilterId && (
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[170px]" />
        )}

        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="max-w-[170px]">
          <option value="">Tüm Zamanlar</option>
          <option value="today">Bugün</option>
          <option value="upcoming">Yaklaşan</option>
          <option value="past">Geçmiş</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[170px]">
          <option value="">Tüm Türler</option>
          {Object.entries(APPT_TYPE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[170px]">
          <option value="">Tüm Durumlar</option>
          {Object.entries(APPT_STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="max-w-[170px]">
          <option value="">Tüm Kanallar</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="Bilinmiyor">Bilinmiyor</option>
        </Select>
      </Card>

      {patientFilterId && selectedFilterPatient && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 border-blue-200 bg-blue-50/50">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selectedFilterPatient.name} {selectedFilterPatient.surname}
              <span className="ml-2 font-mono text-xs text-slate-500">{selectedFilterPatient.hastaNo}</span>
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Telefon: {selectedFilterPatient.phone}
              {selectedFilterPatient.tc ? ` · TC: ${selectedFilterPatient.tc}` : ''} ·{' '}
              {visibleAppointments.length} randevu
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPatientFilterId('');
            }}
          >
            Filtreyi Temizle
          </Button>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <LoadingText />
        ) : view === 'slots' ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" /> Görüşme
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> Muayene / Tedavi
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" /> Öğle
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-slate-400" /> İzin / Kapalı
              </span>
              <span className="text-slate-500">
                {slotMode === 'block'
                  ? 'Fareyle slotları sürükleyip seçin, bıraktığınızda kapatma penceresi açılır.'
                  : 'Slota tıklayın veya sürükleyerek aralık seçin; randevu penceresi açılır.'}
              </span>
            </div>
            <div className="overflow-x-auto select-none" onMouseLeave={() => setDrag(null)}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-bold text-slate-600">
                      Saat
                    </th>
                    {slotColumns.map((c: any) => (
                      <th
                        key={c.id}
                        className="border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-bold text-slate-800"
                      >
                        {c.name}
                        <span className="ml-1 font-normal text-slate-500">
                          - {ROLE_LABEL[c.role] || c.role}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slotSlots.map((slot) => (
                    <tr key={slot}>
                      <td className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">
                        {slot}
                      </td>
                      {slotColumns.map((c: any) => {
                        const appt = apptAt(c, slot);
                        const block = blockAt(c.id, slot);
                        const cellState = slotState(c.id, slot);
                        const outside = cellState.closed;
                        const isSelected = !!(drag && drag.columnId === c.id && drag.slots.includes(slot));

                        if (appt) {
                          const start = slotTimeOf(appt.appointmentDate);
                          const isStart = start === slot;
                          const tone =
                            appt.type === 'MEETING'
                              ? 'bg-blue-100 text-blue-900 border-l-4 border-l-blue-500'
                              : 'bg-emerald-100 text-emerald-900 border-l-4 border-l-emerald-500';
                          return (
                            <td
                              key={c.id}
                              className={`border border-slate-300 px-2 py-1 align-top cursor-pointer ${tone}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSlot({ slot, column: c, appt });
                                setSlotMenuAnchor({ x: e.clientX, y: e.clientY });
                              }}
                            >
                              {isStart ? (
                                <>
                                  <p className="text-xs font-bold text-slate-900">
                                    {appt.patient?.name || appt.lead?.name || '-'}{' '}
                                    {appt.patient?.surname || appt.lead?.surname || ''}
                                  </p>
                                  <p className="text-[10px] font-medium text-slate-600">
                                    {appt.channel || 'Bilinmiyor'}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {APPT_TYPE_LABEL[appt.type] || appt.type}
                                  </p>
                                </>
                              ) : (
                                <span className="text-[10px] opacity-70">↳</span>
                              )}
                            </td>
                          );
                        }

                        if (block) {
                          const label =
                            block.status === 'LUNCH'
                              ? 'Öğle'
                              : block.status === 'LEAVE'
                              ? 'İzin'
                              : 'Kapalı';
                          const tone =
                            block.status === 'LUNCH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-300 text-slate-700';
                          return (
                            <td
                              key={c.id}
                              title={block.reason || label}
                              className={`border border-slate-300 px-2 py-1 text-center text-[10px] font-semibold cursor-pointer ${tone}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Bu kapatmayı kaldırmak istiyor musunuz?'))
                                  deleteBlockMutation.mutate(block.id);
                              }}
                            >
                              {label}
                            </td>
                          );
                        }

                        const base = outside
                          ? `${cellState.tone} cursor-not-allowed`
                          : 'bg-white text-slate-300 hover:bg-blue-50 cursor-pointer';
                        return (
                          <td
                            key={c.id}
                            title={outside ? `${cellState.label} - randevu verilemez` : undefined}
                            className={`border border-slate-300 px-2 py-1 text-center align-top select-none text-[10px] font-semibold ${base} ${
                              !outside && slotMode === 'block' ? 'cursor-crosshair' : ''
                            }`}
                            style={
                              isSelected
                                ? { backgroundColor: '#93c5fd', color: '#1e3a8a', fontWeight: 700 }
                                : undefined
                            }
                            onMouseDown={() => {
                              if (!outside) {
                                setDrag({ columnId: c.id, userName: c.name, role: c.role, slots: [slot] });
                              }
                            }}
                            onMouseEnter={() => {
                              if (!outside) {
                                setDrag((d) =>
                                  d && d.columnId === c.id && !d.slots.includes(slot)
                                    ? { ...d, slots: [...d.slots, slot] }
                                    : d
                                );
                              }
                            }}
                          >
                            {isSelected ? '✓' : outside ? cellState.label : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slotMenuAnchor && selectedSlot && (
              <div 
                ref={slotMenuRef}
                className="fixed z-50 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
                style={{ top: slotMenuAnchor.y, left: slotMenuAnchor.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    setForm({
                      ...emptyForm,
                      target: selectedSlot.appt.patient ? 'patient' : 'lead',
                      patientId: selectedSlot.appt.patientId || '',
                      leadId: selectedSlot.appt.leadId || '',
                      type: selectedSlot.appt.type,
                      userId: selectedSlot.column.id,
                      dateTime: toLocalInput(new Date(`${date}T${selectedSlot.slot}`)),
                      notes: selectedSlot.appt.notes || '',
                    });
                    setCreateOpen(true);
                  }}
                >
                  Düzenle
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    arriveMutation.mutate(selectedSlot.appt.id);
                  }}
                  disabled={arriveMutation.isPending || selectedSlot.appt.status === 'CANCELLED' || selectedSlot.appt.status === 'NO_SHOW'}
                >
                  Geliş Yap
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
                  onClick={() => {
                    setReschedule(selectedSlot.appt);
                    setRescheduleDate(toLocalInput(selectedSlot.appt.appointmentDate));
                  }}
                >
                  Ertele
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    statusMutation.mutate({ id: selectedSlot.appt.id, status: 'CANCELLED' });
                  }}
                >
                  İptal Et
                </button>
              </div>
            )}
          </>
        ) : visibleAppointments.length === 0 ? (
          <Empty title="Randevu bulunamadı" hint="Filtreleri seçin veya yeni randevu oluşturun." />
        ) : (
          <Table
            head={[
              'Randevu No',
              'Hasta / Lead',
              'Tarih',
              'Tür',
              'Kanal',
              'Personel',
              'Randevuyu Veren',
              'Durum',
              'Geliş',
              'İşlem',
            ]}
          >
            {visibleAppointments.map((a: any) => {
              const person = a.patient || a.lead;
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.randevuNo}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {person?.name} {person?.surname || ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.patient ? a.patient.hastaNo : 'Lead · hasta kaydı yok'} · {person?.phone}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateTime(a.appointmentDate)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(a.type)}>{APPT_TYPE_LABEL[a.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{a.channel || 'Bilinmiyor'}</p>
                    <p className="text-xs text-slate-400">{a.campaign?.name || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.user?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{a.createdBy?.name || '-'}</p>
                    <p className="text-xs text-slate-400">{a.createdBy ? ROLE_LABEL[a.createdBy.role] : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={a.status}
                      onChange={(e) => statusMutation.mutate({ id: a.id, status: e.target.value })}
                      className="text-xs py-1 max-w-[140px]"
                    >
                      {Object.entries(APPT_STATUS_LABEL).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {a.visit ? (
                      <div>
                        <p className="font-mono text-xs text-slate-600">{a.visit.protokolNo}</p>
                        <Badge tone={statusTone(a.visit.status)}>{VISIT_STATUS_LABEL[a.visit.status]}</Badge>
                      </div>
                    ) : a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : canArrive ? (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => arriveMutation.mutate(a.id)}
                        disabled={arriveMutation.isPending}
                      >
                        Geliş Al
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Bekliyor</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canReschedule && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReschedule(a);
                          setRescheduleDate(toLocalInput(a.appointmentDate));
                        }}
                      >
                        Ertele
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
        title="Yeni Randevu"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                (form.target === 'patient' ? !form.patientId : !form.leadId) || createMutation.isPending
              }
            >
              {createMutation.isPending ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, target: 'patient', patientId: '', leadId: '' })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              form.target === 'patient'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            Kayıtlı Hasta
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, target: 'lead', patientId: '', leadId: '' })}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              form.target === 'lead'
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            Lead (Hasta Kaydı Yok)
          </button>
        </div>

        {form.target === 'patient' ? (
          <Field label="Hasta *" hint="Ad, telefon veya TC ile arayın. Kayıtlı değilse aynı ekrandan yeni hasta oluşturabilirsiniz.">
            <PatientPicker
              value={form.patientId}
              onChange={(patientId) => setForm({ ...form, patientId })}
            />
          </Field>
        ) : (
          <Field label="Lead *" hint="Lead hasta kaydına dönüşmeden randevu verilebilir.">
            <Select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
              <option value="">Lead seçin</option>
              {leads.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.phone} · {l.source}
                  {l.patient ? ' (hastaya dönüştü)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Randevu Türü *">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, userId: '' })}>
              {Object.entries(APPT_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Personel"
            hint={form.type === 'MEETING' ? 'Görüşmeler satış personeli tarafından yapılır.' : 'Muayene/tedavi doktor tarafından yapılır.'}
          >
            <Select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Atanmadı</option>
              {staffOptions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({ROLE_LABEL[s.role]})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Kanal" hint="Boş bırakılırsa lead/hasta kaynağından otomatik belirlenir.">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="">Otomatik</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kampanya">
            <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">Kampanyasız / Otomatik</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Başlangıç Tarihi ve Saati *">
            <Input
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
            />
          </Field>
          <Field label="Bitiş Saati" hint="Boş bırakılırsa randevu 30 dk kabul edilir.">
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Not">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <p className="text-xs text-slate-400">
          Randevu numarası otomatik oluşturulur. Randevuyu veren kişi olarak siz kaydedilirsiniz.
        </p>
      </Modal>

      <Modal
        open={!!reschedule}
        onClose={() => setReschedule(null)}
        title={`Randevuyu Ertele - ${reschedule?.patient?.name || reschedule?.lead?.name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReschedule(null)}>
              Vazgeç
            </Button>
            <Button onClick={() => rescheduleMutation.mutate()} disabled={rescheduleMutation.isPending}>
              Güncelle
            </Button>
          </>
        }
      >
        <Field label="Yeni Tarih ve Saat">
          <Input type="datetime-local" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={!!blockModal}
        onClose={() => setBlockModal(null)}
        title={`Slot Kapat - ${blockModal?.userName || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockModal(null)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => blockModal && blockMutation.mutate(blockModal)}
              disabled={blockMutation.isPending}
            >
              {blockMutation.isPending ? 'Kaydediliyor...' : 'Kapat'}
            </Button>
          </>
        }
      >
        {blockModal && (
          <>
            <p className="text-sm text-slate-600">
              <strong>{blockModal.date}</strong> tarihinde{' '}
              <strong>{blockModal.userName}</strong> için seçilen aralık kapatılacak.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Başlangıç">
                <Input
                  type="time"
                  value={blockModal.startTime}
                  onChange={(e) => setBlockModal({ ...blockModal, startTime: e.target.value })}
                />
              </Field>
              <Field label="Bitiş">
                <Input
                  type="time"
                  value={blockModal.endTime}
                  onChange={(e) => setBlockModal({ ...blockModal, endTime: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Durum">
              <Select
                value={blockModal.status}
                onChange={(e) => setBlockModal({ ...blockModal, status: e.target.value })}
              >
                <option value="LEAVE">İzin</option>
                <option value="LUNCH">Öğle Molası</option>
                <option value="BLOCKED">Kapalı / Diğer</option>
              </Select>
            </Field>
            <Field label="Açıklama">
              <Input
                value={blockModal.reason}
                onChange={(e) => setBlockModal({ ...blockModal, reason: e.target.value })}
                placeholder="Örn: Yıllık izin, toplantı..."
              />
            </Field>
          </>
        )}
      </Modal>
    </div>
  );
};

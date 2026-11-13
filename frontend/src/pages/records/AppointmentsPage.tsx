import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import { PatientPicker } from '../../components/PatientPicker';
import { LeadPicker } from '../../components/LeadPicker';
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
  SALES_STATUS_LABEL,
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
  unitNo: '',
  duration: '',
  title: '',
  phone: '',
  procedureType: '',
  notes: '',
};

type MoveDrag = {
  appt: any;
  fromColumnId: string;
  fromSlot: string;
  hoverColumnId: string;
  hoverSlot: string;
  moved: boolean;
  duration: number;
};

type EditApptForm = {
  type: string;
  userId: string;
  dateTime: string;
  endTime: string;
  status: string;
  salesStatus: string;
  notes: string;
};

const emptyEditForm: EditApptForm = {
  type: 'MEETING',
  userId: '',
  dateTime: '',
  endTime: '',
  status: 'PENDING',
  salesStatus: '',
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
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditApptForm>({ ...emptyEditForm });
  const [moveDrag, setMoveDrag] = useState<MoveDrag | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);
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

  const editStaffOptions = useMemo(
    () =>
      staff.filter((s: any) =>
        editForm.type === 'MEETING' ? s.role === 'SALES' : s.role === 'DENTIST'
      ),
    [staff, editForm.type]
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
        unitNo: form.unitNo ? Number(form.unitNo) : undefined,
        duration: form.duration ? Number(form.duration) : undefined,
        title: form.title || undefined,
        phone: form.phone || undefined,
        procedureType: form.procedureType || undefined,
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

  const openAppointment = useCallback((appt: any) => {
    setEditingAppt(appt);
    setEditForm({
      type: appt.type,
      userId: appt.user?.id || appt.userId || '',
      dateTime: toLocalInput(appt.appointmentDate),
      endTime: appt.endDate ? toLocalInput(appt.endDate).slice(11, 16) : '',
      status: appt.status,
      salesStatus: appt.salesStatus || '',
      notes: appt.notes || '',
    });
  }, []);

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingAppt) return;
      const datePart = editForm.dateTime.slice(0, 10);
      await api.patch(`/appointments/${editingAppt.id}`, {
        type: editForm.type,
        userId: editForm.userId || null,
        appointmentDate: fromLocalInput(editForm.dateTime),
        endDate: editForm.endTime ? fromLocalInput(`${datePart}T${editForm.endTime}`) : null,
        status: editForm.status,
        salesStatus: editForm.type === 'MEETING' ? editForm.salesStatus || null : null,
        notes: editForm.notes || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditingAppt(null);
    },
    onError: (err) => alert(apiError(err)),
  });

  const salesStatusMutation = useMutation({
    mutationFn: async ({ id, salesStatus }: { id: string; salesStatus: string | null }) => {
      await api.patch(`/appointments/${id}`, { salesStatus });
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  const moveMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      appointmentDate: string;
      endDate: string;
    }) => {
      await api.patch(`/appointments/${payload.id}`, {
        userId: payload.userId,
        appointmentDate: payload.appointmentDate,
        endDate: payload.endDate,
      });
    },
    onSuccess: invalidate,
    onError: (err) => alert(apiError(err)),
  });

  useEffect(() => {
    moveDragRef.current = moveDrag;
  }, [moveDrag]);

  useEffect(() => {
    const up = () => {
      const moving = moveDragRef.current;
      if (moving) {
        const targetColumn = slotColumns.find((c: any) => c.id === moving.hoverColumnId);
        const samePlace =
          moving.hoverColumnId === moving.fromColumnId && moving.hoverSlot === moving.fromSlot;

        if (moving.moved && !samePlace) {
          const compatible =
            moving.appt.type === 'MEETING'
              ? targetColumn?.role === 'SALES'
              : targetColumn?.role === 'DENTIST';
          const targetState = slotState(moving.hoverColumnId, moving.hoverSlot);
          const targetBlocked = !!blockAt(moving.hoverColumnId, moving.hoverSlot);
          if (!compatible) {
            alert(
              moving.appt.type === 'MEETING'
                ? 'Görüşme randevusu sadece satış personeline taşınabilir.'
                : 'Muayene/tedavi randevusu sadece doktora taşınabilir.'
            );
          } else if (targetState.closed || targetBlocked) {
            alert('Seçilen saat kapalı veya molada; randevu taşınamaz.');
          } else {
            const targetStart = toMin(moving.hoverSlot);
            const targetEnd = targetStart + moving.duration;
            const occupied = visibleAppointments.some((a: any) => {
              if (a.id === moving.appt.id) return false;
              const uid = a.user?.id || a.userId;
              if (uid !== moving.hoverColumnId) return false;
              const start = toMin(slotTimeOf(a.appointmentDate));
              const end = a.endDate
                ? toMin(slotTimeOf(a.endDate))
                : start + (a.duration || 30);
              return targetStart < end && targetEnd > start;
            });
            if (occupied) {
              alert('Seçilen saatte başka bir randevu bulunuyor.');
            } else {
              moveMutation.mutate({
                id: moving.appt.id,
                userId: moving.hoverColumnId,
                appointmentDate: fromLocalInput(`${date}T${moving.hoverSlot}`),
                endDate: fromLocalInput(`${date}T${addMinutes(moving.hoverSlot, moving.duration)}`),
              });
            }
          }
          setMoveDrag(null);
          setDrag(null);
          return;
        }

        openAppointment(moving.appt);
        setMoveDrag(null);
        setDrag(null);
        return;
      }

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
            type: d.role === 'DENTIST' ? 'EXAMINATION' : 'MEETING',
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
  }, [
    date,
    slotMode,
    slotColumns,
    visibleAppointments,
    workingHours,
    weeklySchedules,
    scheduleBlocks,
    moveMutation,
    openAppointment,
  ]);

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
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> Satış Oldu / Tedavi
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> Olumsuz
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-violet-500" /> Tekrar Aranacak
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
                  : 'Randevuyu tutup başka saat/personele sürükleyin; açmak için üzerine tıklayın.'}
              </span>
            </div>
            <div
              className="overflow-x-auto select-none"
              onMouseLeave={() => {
                moveDragRef.current = null;
                setMoveDrag(null);
                setDrag(null);
              }}
            >
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
                            appt.salesStatus === 'SOLD'
                              ? 'bg-emerald-100 text-emerald-900 border-l-4 border-l-emerald-500'
                              : appt.salesStatus === 'NEGATIVE'
                                ? 'bg-red-100 text-red-900 border-l-4 border-l-red-500'
                                : appt.salesStatus === 'CALLBACK'
                                  ? 'bg-violet-100 text-violet-900 border-l-4 border-l-violet-500'
                                  : appt.type === 'MEETING'
                                    ? 'bg-blue-100 text-blue-900 border-l-4 border-l-blue-500'
                                    : 'bg-emerald-100 text-emerald-900 border-l-4 border-l-emerald-500';
                          return (
                            <td
                              key={c.id}
                              title="Açmak için tıklayın; başka saat veya personele taşımak için sürükleyin."
                              className={`border border-slate-300 px-2 py-1 align-top cursor-grab active:cursor-grabbing ${tone} ${
                                moveDrag?.appt.id === appt.id ? 'opacity-60' : ''
                              }`}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                const apptStart = slotTimeOf(appt.appointmentDate);
                                const apptEnd = appt.endDate
                                  ? slotTimeOf(appt.endDate)
                                  : addMinutes(apptStart, appt.duration || 30);
                                setMoveDrag({
                                  appt,
                                  fromColumnId: c.id,
                                  fromSlot: apptStart,
                                  hoverColumnId: c.id,
                                  hoverSlot: apptStart,
                                  moved: false,
                                  duration: Math.max(15, toMin(apptEnd) - toMin(apptStart)),
                                });
                              }}
                              onMouseEnter={() => {
                                if (moveDrag) {
                                  setMoveDrag((m) =>
                                    m ? { ...m, hoverColumnId: c.id, hoverSlot: slot, moved: true } : m
                                  );
                                }
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
                                    {appt.salesStatus
                                      ? ` · ${SALES_STATUS_LABEL[appt.salesStatus] || appt.salesStatus}`
                                      : ''}
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

                        const isMoveTarget =
                          !!moveDrag &&
                          moveDrag.moved &&
                          moveDrag.hoverColumnId === c.id &&
                          moveDrag.hoverSlot === slot;
                        const moveCompatible =
                          !moveDrag ||
                          (moveDrag.appt.type === 'MEETING' ? c.role === 'SALES' : c.role === 'DENTIST');
                        const base = outside
                          ? `${cellState.tone} cursor-not-allowed`
                          : 'bg-white text-slate-300 hover:bg-blue-50 cursor-pointer';
                        return (
                          <td
                            key={c.id}
                            title={outside ? `${cellState.label} - randevu verilemez` : undefined}
                            className={`border border-slate-300 px-2 py-1 text-center align-top select-none text-[10px] font-semibold ${base} ${
                              !outside && slotMode === 'block' ? 'cursor-crosshair' : ''
                            } ${
                              isMoveTarget
                                ? moveCompatible
                                  ? 'bg-blue-200 text-blue-900 ring-2 ring-inset ring-blue-500'
                                  : 'bg-red-100 text-red-700 ring-2 ring-inset ring-red-400'
                                : ''
                            }`}
                            style={
                              isSelected
                                ? { backgroundColor: '#93c5fd', color: '#1e3a8a', fontWeight: 700 }
                                : undefined
                            }
                            onMouseDown={() => {
                              if (!outside && !moveDrag) {
                                setDrag({ columnId: c.id, userName: c.name, role: c.role, slots: [slot] });
                              }
                            }}
                            onMouseEnter={() => {
                              if (moveDrag) {
                                if (!outside) {
                                  setMoveDrag((m) =>
                                    m ? { ...m, hoverColumnId: c.id, hoverSlot: slot, moved: true } : m
                                  );
                                }
                                return;
                              }
                              if (!outside) {
                                setDrag((d) =>
                                  d && d.columnId === c.id && !d.slots.includes(slot)
                                    ? { ...d, slots: [...d.slots, slot] }
                                    : d
                                );
                              }
                            }}
                          >
                            {isSelected ? '✓' : isMoveTarget ? '⇚' : outside ? cellState.label : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              'Satış Durumu',
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
                    {a.type === 'MEETING' ? (
                      <Select
                        value={a.salesStatus || ''}
                        onChange={(e) =>
                          salesStatusMutation.mutate({ id: a.id, salesStatus: e.target.value || null })
                        }
                        className={`text-xs py-1 max-w-[160px] ${
                          a.salesStatus === 'SOLD'
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                            : a.salesStatus === 'NEGATIVE'
                              ? 'border-red-400 bg-red-50 text-red-700'
                              : a.salesStatus === 'CALLBACK'
                                ? 'border-violet-400 bg-violet-50 text-violet-700'
                                : ''
                        }`}
                      >
                        <option value="">Belirlenmedi</option>
                        {Object.entries(SALES_STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
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
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openAppointment(a)}>
                        Aç
                      </Button>
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
                    </div>
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
          <Field
            label="Lead *"
            hint="Lead hasta kaydına dönüşmeden randevu verilebilir. Kayıtlı değilse aynı ekrandan yeni lead oluşturabilirsiniz."
          >
            <LeadPicker value={form.leadId} onChange={(leadId) => setForm({ ...form, leadId })} />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Birim No">
            <Input
              type="number"
              min={0}
              value={form.unitNo}
              onChange={(e) => setForm({ ...form, unitNo: e.target.value })}
            />
          </Field>
          <Field label="Süre (dk)" hint="Bitiş saati boşsa kullanılır.">
            <Input
              type="number"
              min={0}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </Field>
          <Field label="İşlem Türü">
            <Input
              value={form.procedureType}
              onChange={(e) => setForm({ ...form, procedureType: e.target.value })}
              placeholder="örn. İmplant"
            />
          </Field>
          <Field label="Başlık" className="md:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Randevu Telefonu">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
        open={!!editingAppt}
        onClose={() => setEditingAppt(null)}
        title={`Randevu Detayı - ${editingAppt?.patient?.name || editingAppt?.lead?.name || ''}`}
        wide
        footer={
          <>
            {editingAppt && editingAppt.visit && (
              <span className="mr-auto text-xs text-slate-500">
                Geliş kaydı: <strong>{editingAppt.visit.protokolNo}</strong>
              </span>
            )}
            {editingAppt &&
              !editingAppt.visit &&
              canArrive &&
              editingAppt.status !== 'CANCELLED' &&
              editingAppt.status !== 'NO_SHOW' && (
                <Button
                  variant="success"
                  onClick={() => {
                    arriveMutation.mutate(editingAppt.id);
                    setEditingAppt(null);
                  }}
                  disabled={arriveMutation.isPending}
                >
                  Geliş Yap
                </Button>
              )}
            {editingAppt && editingAppt.status !== 'CANCELLED' && (
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm('Bu randevuyu iptal etmek istiyor musunuz?')) {
                    statusMutation.mutate({ id: editingAppt.id, status: 'CANCELLED' });
                    setEditingAppt(null);
                  }
                }}
              >
                İptal Et
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditingAppt(null)}>
              Kapat
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editForm.dateTime}>
              {editMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </>
        }
      >
        {editingAppt && (
          <>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {editingAppt.patient?.name || editingAppt.lead?.name || '-'}{' '}
                {editingAppt.patient?.surname || editingAppt.lead?.surname || ''}
              </p>
              <p className="text-xs text-slate-500">
                {editingAppt.randevuNo} ·{' '}
                {editingAppt.patient?.hastaNo
                  ? editingAppt.patient.hastaNo
                  : 'Lead · hasta kaydı yok'}{' '}
                · {editingAppt.patient?.phone || editingAppt.lead?.phone || '-'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Randevu Türü">
                <Select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value, userId: '' })}
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
                hint={
                  editForm.type === 'MEETING'
                    ? 'Görüşmeler satış personeli tarafından yapılır.'
                    : 'Muayene/tedavi doktor tarafından yapılır.'
                }
              >
                <Select
                  value={editForm.userId}
                  onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                >
                  <option value="">Atanmadı</option>
                  {editStaffOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({ROLE_LABEL[s.role]})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Başlangıç Tarihi ve Saati *">
                <Input
                  type="datetime-local"
                  value={editForm.dateTime}
                  onChange={(e) => setEditForm({ ...editForm, dateTime: e.target.value })}
                />
              </Field>
              <Field label="Bitiş Saati" hint="Boş bırakılırsa randevu 30 dk kabul edilir.">
                <Input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Durum">
                <Select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  {Object.entries(APPT_STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              {editForm.type === 'MEETING' && (
                <Field label="Satış Durumu" hint="Görüşme sonrası sonucu seçin.">
                  <Select
                    value={editForm.salesStatus}
                    onChange={(e) => setEditForm({ ...editForm, salesStatus: e.target.value })}
                  >
                    <option value="">Belirlenmedi</option>
                    {Object.entries(SALES_STATUS_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <Field label="Not">
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </Field>
          </>
        )}
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


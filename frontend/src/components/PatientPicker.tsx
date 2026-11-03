import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { apiError } from '../lib/format';
import { Button, Field, Input } from './ui';

const emptyPatient = {
  name: '',
  surname: '',
  tc: '',
  phone: '',
  email: '',
  birthDate: '',
  gender: '',
  address: '',
};

type PatientPickerProps = {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  className?: string;
};

export const PatientPicker: React.FC<PatientPickerProps> = ({
  value,
  onChange,
  placeholder = 'Ad, telefon veya TC ile hasta ara...',
  allowCreate = true,
  className = '',
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyPatient });
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => (await api.get('/patients')).data.data as any[],
  });

  const selected = patients.find((p: any) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 50);
    return patients
      .filter((p: any) =>
        `${p.name || ''} ${p.surname || ''} ${p.phone || ''} ${p.tc || ''} ${p.hastaNo || ''}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [patients, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/patients', {
          ...form,
          email: form.email || undefined,
          birthDate: form.birthDate ? `${form.birthDate}T00:00:00.000Z` : undefined,
        })
      ).data.data as any,
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onChange(patient.id);
      setCreating(false);
      setForm({ ...emptyPatient });
      setQuery('');
      setOpen(false);
    },
    onError: (err) => alert(apiError(err)),
  });

  const canSave =
    form.name.trim().length >= 2 &&
    form.surname.trim().length >= 2 &&
    form.tc.trim().length > 0 &&
    form.phone.trim().length >= 5;

  const label = selected
    ? `${selected.hastaNo ? `${selected.hastaNo} - ` : ''}${selected.name} ${selected.surname}${selected.phone ? ` · ${selected.phone}` : ''}`
    : '';

  return (
    <div ref={rootRef} className={`space-y-3 ${className}`}>
      <div className="relative">
        <div className="flex items-center gap-2">
          <Input
            value={open ? query : label}
            placeholder={placeholder}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (value) onChange('');
            }}
            className={selected && !open ? 'font-medium' : ''}
          />
          {selected && !open && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onChange('');
                setQuery('');
              }}
            >
              Temizle
            </Button>
          )}
          {allowCreate && !creating && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(true)}>
              + Yeni Hasta
            </Button>
          )}
        </div>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400">Hasta bulunamadı</div>
              ) : (
                filtered.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="w-full border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <span className="font-semibold text-slate-800">
                      {p.name} {p.surname}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{p.phone}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {p.tc ? `TC: ${p.tc}` : ''} {p.hastaNo ? `· ${p.hastaNo}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
            {allowCreate && (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full border-t border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                + Yeni Hasta Kaydı
              </button>
            )}
          </div>
        )}
      </div>

      {creating && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Yeni Hasta Kaydı</p>
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
              onClick={() => setCreating(false)}
            >
              Vazgeç
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </Field>
            <Field label="Cinsiyet">
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seçiniz</option>
                <option value="Kadın">Kadın</option>
                <option value="Erkek">Erkek</option>
              </select>
            </Field>
            <Field label="Adres">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!canSave || createMutation.isPending}
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Hastayı Kaydet ve Seç'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPicker;

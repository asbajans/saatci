import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SOURCES, apiError } from '../lib/format';
import { Button, Field, Input, Select } from './ui';

const emptyLead = {
  name: '',
  phone: '',
  email: '',
  source: SOURCES[0],
  campaignId: '',
};

type LeadPickerProps = {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  className?: string;
};

export const LeadPicker: React.FC<LeadPickerProps> = ({
  value,
  onChange,
  placeholder = 'Ad veya telefon ile lead ara...',
  allowCreate = true,
  className = '',
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyLead });
  const [created, setCreated] = useState<any[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', 'picker'],
    queryFn: async () => (await api.get('/leads')).data.data as any[],
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const allLeads = useMemo(() => {
    const map = new Map<string, any>();
    [...created, ...leads].forEach((lead: any) => map.set(lead.id, lead));
    return Array.from(map.values());
  }, [created, leads]);

  const selected = allLeads.find((lead: any) => lead.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLeads.slice(0, 50);
    return allLeads
      .filter((lead: any) =>
        `${lead.name || ''} ${lead.phone || ''} ${lead.email || ''} ${lead.source || ''}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [allLeads, query]);

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
        await api.post('/leads', {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email || undefined,
          source: form.source,
          campaignId: form.campaignId || undefined,
        })
      ).data.data as any,
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreated((current) => [lead, ...current]);
      onChange(lead.id);
      setCreating(false);
      setForm({ ...emptyLead });
      setQuery('');
      setOpen(false);
    },
    onError: (err) => alert(apiError(err)),
  });

  const canSave = form.name.trim().length >= 2 && form.phone.trim().length >= 5;

  const label = selected
    ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}${
        selected.source ? ` · ${selected.source}` : ''
      }`
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
              + Yeni Lead
            </Button>
          )}
        </div>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400">Lead bulunamadı</div>
              ) : (
                filtered.map((lead: any) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      onChange(lead.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="w-full border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-violet-50"
                  >
                    <span className="font-semibold text-slate-800">{lead.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{lead.phone}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {lead.source}
                      {lead.patient ? ' · hastaya dönüştü' : ''}
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
                className="w-full border-t border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-violet-700 hover:bg-violet-50"
              >
                + Yeni Lead Kaydı
              </button>
            )}
          </div>
        )}
      </div>

      {creating && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Yeni Lead Kaydı</p>
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
              onClick={() => setCreating(false)}
            >
              Vazgeç
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Ad Soyad *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Telefon *">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-posta">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Kaynak">
              <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kampanya" className="md:col-span-2">
              <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">Kampanyasız</option>
                {campaigns.map((campaign: any) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!canSave || createMutation.isPending}
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Lead Kaydet ve Seç'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadPicker;

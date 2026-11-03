import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Empty, Field, Input, LoadingText, Modal, PageHeader, Select, Table } from '../../components/ui';
import { ROLE_LABEL, SOURCES, apiError, dateOnly, money } from '../../lib/format';

const emptyUser = { name: '', email: '', password: '', role: 'CALL_CENTER' };
const emptyCampaign = { name: '', channel: 'Instagram', budget: '' };

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [userOpen, setUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({ ...emptyUser });
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ ...emptyCampaign });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data as any[],
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data as any[],
  });

  const createUser = useMutation({
    mutationFn: async () => {
      await api.post('/users', userForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserOpen(false);
      setUserForm({ ...emptyUser });
    },
    onError: (err) => alert(apiError(err)),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await api.put(`/users/${id}`, { role });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => alert(apiError(err)),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => alert(apiError(err)),
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      await api.post('/campaigns', {
        name: campaignForm.name,
        channel: campaignForm.channel,
        budget: campaignForm.budget || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setCampaignOpen(false);
      setCampaignForm({ ...emptyCampaign });
    },
    onError: (err) => alert(apiError(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcılar"
        subtitle="Rol bazlı kullanıcı hesapları ve yetkilendirme"
        action={<Button onClick={() => setUserOpen(true)}>+ Yeni Kullanıcı</Button>}
      />

      <Card>
        {usersLoading ? (
          <LoadingText />
        ) : users.length === 0 ? (
          <Empty title="Kullanıcı bulunamadı" />
        ) : (
          <Table head={['Ad', 'E-posta', 'Rol', 'Kayıt', 'İşlem']}>
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
                    <Select
                      value={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                      className="text-xs py-1 max-w-[160px]"
                    >
                      {Object.entries(ROLE_LABEL).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`${u.name} kullanıcısı silinsin mi?`)) deleteUser.mutate(u.id);
                    }}
                  >
                    Sil
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <PageHeader
        title="Kampanyalar"
        subtitle="Reklam kanalları ve bütçe takibi"
        action={<Button onClick={() => setCampaignOpen(true)}>+ Yeni Kampanya</Button>}
      />

      <Card>
        {campaignsLoading ? (
          <LoadingText />
        ) : campaigns.length === 0 ? (
          <Empty title="Kampanya bulunamadı" />
        ) : (
          <Table head={['Kampanya', 'Kanal', 'Bütçe', 'Lead Sayısı', 'Başlangıç']}>
            {campaigns.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge tone="violet">{c.channel}</Badge>
                </td>
                <td className="px-4 py-3">{c.budget ? money(c.budget) : '-'}</td>
                <td className="px-4 py-3 text-slate-600">{c._count?.leads ?? 0}</td>
                <td className="px-4 py-3 text-slate-500">{dateOnly(c.startDate || c.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={userOpen}
        onClose={() => setUserOpen(false)}
        title="Yeni Kullanıcı"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUserOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
              Kaydet
            </Button>
          </>
        }
      >
        <Field label="Ad Soyad *">
          <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
        </Field>
        <Field label="E-posta *">
          <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Şifre *">
            <Input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
          </Field>
          <Field label="Rol">
            <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              {Object.entries(ROLE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title="Yeni Kampanya"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampaignOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>
              Kaydet
            </Button>
          </>
        }
      >
        <Field label="Kampanya Adı *">
          <Input
            value={campaignForm.name}
            onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kanal">
            <Select
              value={campaignForm.channel}
              onChange={(e) => setCampaignForm({ ...campaignForm, channel: e.target.value })}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bütçe (TL)">
            <Input
              type="number"
              value={campaignForm.budget}
              onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

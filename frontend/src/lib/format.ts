export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const dateOnly = (value?: string | Date | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const dateTime = (value?: string | Date | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toLocalInput = (value?: string | Date | null) => {
  const d = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (value: string) => new Date(value).toISOString();

export const isToday = (value?: string | Date | null) => {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0], surname: '-' };
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] };
};

export const APPT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  NO_SHOW: 'Gelmedi',
};

export const APPT_TYPE_LABEL: Record<string, string> = {
  MEETING: 'Görüşme',
  EXAMINATION: 'Muayene',
  TREATMENT: 'Tedavi',
};

export const VISIT_STATUS_LABEL: Record<string, string> = {
  WAITING: 'Bekliyor',
  IN_PROGRESS: 'İşlemde',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: 'Yeni',
  CONTACTED: 'İletişime Geçildi',
  CLINIC_VISIT: 'Klinik Ziyareti',
  TREATMENT_APPROVED: 'Tedavi Onaylandı',
  APPOINTMENT_BOOKED: 'Randevu Alındı',
  SOLD: 'Satıldı',
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Taslak',
  APPROVED: 'Onaylandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Ödenmedi',
  PARTIAL: 'Kısmi Ödeme',
  PAID: 'Ödendi',
  OVERDUE: 'Gecikmiş',
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Yönetici',
  DENTIST: 'Doktor',
  CALL_CENTER: 'Çağrı Merkezi',
  SALES: 'Sağlık Danışmanı',
  BANKO: 'Banko',
};

export const SOURCES = ['Instagram', 'Facebook', 'WhatsApp', 'Google', 'Web', 'Referans', 'Diğer'];

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'violet';

export const statusTone = (status: string): Tone => {
  switch (status) {
    case 'CONFIRMED':
    case 'APPROVED':
    case 'PARTIAL':
    case 'TREATMENT_APPROVED':
    case 'APPOINTMENT_BOOKED':
      return 'blue';
    case 'COMPLETED':
    case 'PAID':
    case 'SOLD':
    case 'TREATMENT':
      return 'green';
    case 'PENDING':
    case 'NEW':
    case 'IN_PROGRESS':
    case 'UNPAID':
    case 'WAITING':
      return 'amber';
    case 'CANCELLED':
    case 'NO_SHOW':
    case 'OVERDUE':
      return 'red';
    case 'MEETING':
      return 'violet';
    case 'EXAMINATION':
      return 'blue';
    case 'CLINIC_VISIT':
      return 'violet';
    case 'CONTACTED':
      return 'blue';
    default:
      return 'slate';
  }
};

export const apiError = (err: unknown) => {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr.response?.data?.message || anyErr.message || 'İşlem başarısız';
};

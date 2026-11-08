export type LeadFieldMappings = {
  phone: string[];
  email: string[];
  fullName: string[];
  firstName: string[];
  lastName: string[];
};

export type MetaFormQuestion = {
  key?: string;
  label?: string;
  type?: string;
};

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return stringifyValue(record.value ?? record.text ?? record.name ?? Object.values(record).join(' '));
  }
  return String(value);
}

export function normalizeFieldKey(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export function parseFieldData(fieldData: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(fieldData)) return out;
  for (const item of fieldData) {
    const record = item as Record<string, unknown>;
    const name = String(record?.name || '').trim();
    if (!name) continue;
    const value = stringifyValue(record?.values);
    if (value) out[name] = value;
  }
  return out;
}

function entriesWithValues(fields: Record<string, string>) {
  return Object.entries(fields).filter(([, value]) => String(value || '').trim().length > 0);
}

function byKeys(fields: Record<string, string>, keys: string[]): string {
  if (!keys.length) return '';
  const wanted = new Set(keys.map(normalizeFieldKey).filter(Boolean));
  for (const [key, value] of entriesWithValues(fields)) {
    if (wanted.has(normalizeFieldKey(key))) return value;
  }
  return '';
}

function byPattern(fields: Record<string, string>, pattern: RegExp): string {
  for (const [key, value] of entriesWithValues(fields)) {
    if (pattern.test(normalizeFieldKey(key))) return value;
  }
  return '';
}

export function looksLikePhone(value: string): boolean {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^\+/.test(raw) || /[\s().-]/.test(raw)) return true;
  return /^(?:0|90|5)\d{9,14}$/.test(digits);
}

export function resolvePhone(fields: Record<string, string>, preferredKeys: string[] = []): string {
  const preferred = byKeys(fields, preferredKeys);
  if (preferred) return preferred.trim();

  const direct = byKeys(fields, [
    'phone_number',
    'phone',
    'phonenumber',
    'telefon',
    'telefon_no',
    'telefon_numarasi',
    'telefonno',
    'telefonnumarasi',
    'tel',
    'tel_no',
    'telno',
    'cep',
    'cep_telefonu',
    'ceptelefonu',
    'gsm',
    'gsm_no',
    'gsmno',
    'mobile',
    'mobile_number',
    'mobil',
    'mobil_telefon',
    'msisdn',
    'whatsapp',
    'whatsapp_number',
    'whatsapp_numara',
    'work_phone_number',
  ]);
  if (direct) return direct.trim();

  const matched = byPattern(fields, /(phone|telefon|telno|gsm|msisdn|mobil|mobile|cep|whatsapp)/);
  if (matched) return matched.trim();

  for (const [, value] of entriesWithValues(fields)) {
    if (looksLikePhone(value)) return value.trim();
  }

  return '';
}

export function resolveEmail(fields: Record<string, string>, preferredKeys: string[] = []): string | null {
  const preferred = byKeys(fields, preferredKeys);
  if (preferred) return preferred.trim();
  const direct = byKeys(fields, ['email', 'email_address', 'emailaddress', 'e_posta', 'eposta', 'mail']);
  if (direct) return direct.trim();
  const matched = byPattern(fields, /(email|eposta|mail)/);
  if (matched) return matched.trim();
  for (const [, value] of entriesWithValues(fields)) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return value.trim();
  }
  return null;
}

export function resolveName(fields: Record<string, string>, mappings?: LeadFieldMappings): string {
  const full = byKeys(fields, mappings?.fullName?.length ? mappings.fullName : ['full_name', 'fullname', 'ad_soyad', 'adsoyad', 'isim', 'name']);
  if (full) return full.trim();

  const first = byKeys(fields, mappings?.firstName?.length ? mappings.firstName : ['first_name', 'firstname', 'ad']);
  const last = byKeys(fields, mappings?.lastName?.length ? mappings.lastName : ['last_name', 'lastname', 'soyad']);
  const combined = [first, last].filter(Boolean).join(' ').trim();
  if (combined) return combined;

  const matched = byPattern(fields, /(fullname|adsoyad|isim)/);
  return matched.trim();
}

export function summarizeFieldKeys(fields: Record<string, string>): string {
  const keys = Object.keys(fields);
  if (!keys.length) return 'alan yok';
  return keys.slice(0, 10).join(', ') + (keys.length > 10 ? ` (+${keys.length - 10})` : '');
}

export function fieldMappingsFromQuestions(questions: unknown): LeadFieldMappings {
  const mappings: LeadFieldMappings = { phone: [], email: [], fullName: [], firstName: [], lastName: [] };
  if (!Array.isArray(questions)) return mappings;

  for (const raw of questions) {
    const question = raw as MetaFormQuestion;
    const key = String(question?.key || '').trim();
    const type = String(question?.type || '').toUpperCase();
    if (!key || !type) continue;

    if (['PHONE', 'PHONE_OTP', 'WHATSAPP_NUMBER', 'WORK_PHONE_NUMBER'].includes(type)) {
      mappings.phone.push(key);
    } else if (['EMAIL', 'WORK_EMAIL'].includes(type)) {
      mappings.email.push(key);
    } else if (type === 'FULL_NAME') {
      mappings.fullName.push(key);
    } else if (type === 'FIRST_NAME') {
      mappings.firstName.push(key);
    } else if (type === 'LAST_NAME') {
      mappings.lastName.push(key);
    }
  }

  return mappings;
}

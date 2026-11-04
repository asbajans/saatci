export const DEFAULT_GRAPH_VERSION = 'v26.0';

export function graphVersion() {
  const configured = process.env.META_GRAPH_API_VERSION?.trim();
  if (!configured) return DEFAULT_GRAPH_VERSION;
  const match = /^v(\d+)\.\d+$/i.exec(configured);
  if (!match) return DEFAULT_GRAPH_VERSION;
  if (Number(match[1]) < 21) return DEFAULT_GRAPH_VERSION;
  return configured.toLowerCase();
}

export function graphUrl(path: string) {
  return `https://graph.facebook.com/${graphVersion()}/${path.replace(/^\/+/, '')}`;
}

export class GraphApiError extends Error {
  status: number;
  code: number | null;
  subcode: number | null;
  traceId: string | null;

  constructor(message: string, status = 500, code: number | null = null, subcode: number | null = null, traceId: string | null = null) {
    super(message);
    this.name = 'GraphApiError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.traceId = traceId;
  }
}

type QueryValue = string | number | boolean | null | undefined;

type GraphRequestOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  accessToken?: string | null;
  params?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

function parsePayload(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function graphError(payload: unknown, status: number) {
  const body = payload as { error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string } };
  const detail = body?.error;
  return new GraphApiError(
    detail?.message || `Meta Graph API hatası (${status})`,
    status,
    detail?.code ?? null,
    detail?.error_subcode ?? null,
    detail?.fbtrace_id ?? null
  );
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = parsePayload(await response.text());
    if (!response.ok) throw graphError(payload, response.status);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function graphRequest<T = any>(options: GraphRequestOptions): Promise<T> {
  const method = options.method || 'GET';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  if (options.accessToken) query.set('access_token', options.accessToken);
  const url = `${graphUrl(options.path)}${query.size ? `?${query.toString()}` : ''}`;
  const init: RequestInit = { method };
  if (method !== 'GET' && options.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  } else if (method === 'POST') {
    init.body = '';
  }
  return (await fetchJson(url, init, options.timeoutMs || 20000)) as T;
}

export async function graphGetAll<T = any>(
  options: Omit<GraphRequestOptions, 'method'> & { maxPages?: number }
): Promise<T[]> {
  const maxPages = options.maxPages || 20;
  const rows: T[] = [];
  let next: string | null = null;
  let page = 0;

  const first = await graphRequest<{ data?: T[]; paging?: { next?: string } }>({
    ...options,
    method: 'GET',
  });
  if (Array.isArray(first.data)) rows.push(...first.data);
  next = first.paging?.next || null;

  while (next && page < maxPages) {
    const payload = await fetchJson(next, { method: 'GET' }, options.timeoutMs || 20000);
    const body = payload as { data?: T[]; paging?: { next?: string } };
    if (Array.isArray(body.data)) rows.push(...body.data);
    next = body.paging?.next || null;
    page += 1;
  }

  return rows;
}

export function normalizeAdAccountId(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/^act_/i, '');
}

export function appAccessToken() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  return appId && appSecret ? `${appId}|${appSecret}` : null;
}

import pdfParse from 'pdf-parse';
import { prisma } from '../lib/prisma';

const TDB_API = 'https://api.tdb.org.tr/treatment-fees';
const MONEY = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

export type TdbDocument = {
  id: number;
  year: number;
  type: string;
  title: string;
  effectiveDate: string | null;
  pdfUrl: string | null;
  status?: string;
};

export type ParsedTariffItem = {
  code: string;
  categoryCode: string;
  category: string;
  name: string;
  priceExclVat: number;
  priceInclVat: number;
  vatRate: number;
};

function assertTdbUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || !(url.hostname === 'tdb.org.tr' || url.hostname.endsWith('.tdb.org.tr'))) {
    throw new Error('Yalnızca TDB alan adlarından tarife indirilebilir');
  }
  return url.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SaatciCRM/1.0 (+https://saatci.asb.web.tr)' },
    });
    if (!response.ok) {
      throw new Error(`TDB isteği başarısız: HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTdbDocuments(type?: string): Promise<TdbDocument[]> {
  const url = new URL(TDB_API);
  url.searchParams.set('pageSize', '100');
  if (type) url.searchParams.set('type', type);

  const response = await fetchWithTimeout(url.toString(), 20000);
  const payload = (await response.json()) as { data?: TdbDocument[] };
  const docs = Array.isArray(payload.data) ? payload.data : [];
  return docs
    .filter((doc) => doc && typeof doc.id === 'number' && typeof doc.year === 'number')
    .map((doc) => ({
      id: doc.id,
      year: doc.year,
      type: doc.type,
      title: doc.title,
      effectiveDate: doc.effectiveDate || null,
      pdfUrl: doc.pdfUrl || null,
      status: doc.status,
    }))
    .sort((a, b) => b.year - a.year || String(b.effectiveDate || '').localeCompare(String(a.effectiveDate || '')));
}

function parseMoney(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

export function splitTariffPrices(line: string): [number, number] | null {
  const compact = line.replace(/\s+/g, '');
  for (let index = 1; index < compact.length - 1; index += 1) {
    const first = compact.slice(0, index);
    const second = compact.slice(index);
    if (MONEY.test(first) && MONEY.test(second)) {
      return [parseMoney(first), parseMoney(second)];
    }
  }
  return null;
}

export function parseTdbTariffText(text: string): ParsedTariffItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items: ParsedTariffItem[] = [];
  let category: { code: string; name: string; vatRate: number } | null = null;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const header = line.match(/^(\d{1,2})\s*(.+?)\s*KDV\s*Hari[çc]\s*KDV\s*Dahil(?:\s*%\s*(\d+))?/i);
    if (header) {
      category = {
        code: header[1],
        name: header[2].trim(),
        vatRate: header[3] ? Number(header[3]) : 10,
      };
      index += 1;
      continue;
    }

    const codeMatch = line.match(/^(\d{1,2})\s*-\s*(\d{1,3})$/);
    if (codeMatch && category) {
      const names: string[] = [];
      let cursor = index + 1;
      let prices: [number, number] | null = null;
      let guard = 0;

      while (cursor < lines.length && guard < 8) {
        const candidate = lines[cursor];
        const parsed = splitTariffPrices(candidate);
        if (parsed) {
          prices = parsed;
          break;
        }
        if (/^\d{1,2}\s*-\s*\d{1,3}$/.test(candidate) || /KDV\s*Hari[çc]/i.test(candidate)) {
          break;
        }
        names.push(candidate);
        cursor += 1;
        guard += 1;
      }

      if (prices && names.length > 0) {
        const [priceExclVat, priceInclVat] = prices;
        const computedVat = priceExclVat > 0 ? Math.round((priceInclVat / priceExclVat - 1) * 100) : category.vatRate;
        items.push({
          code: `${codeMatch[1]}-${codeMatch[2]}`,
          categoryCode: category.code,
          category: category.name,
          name: names.join(' ').replace(/\s+/g, ' ').trim(),
          priceExclVat,
          priceInclVat,
          vatRate: Number.isFinite(computedVat) ? computedVat : category.vatRate,
        });
        index = cursor + 1;
        continue;
      }
    }

    index += 1;
  }

  return items;
}

export async function downloadTdbTariffPdf(pdfUrl: string) {
  const safeUrl = assertTdbUrl(pdfUrl);
  const response = await fetchWithTimeout(safeUrl, 60000);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1000) {
    throw new Error('TDB tarife dosyası boş veya geçersiz');
  }
  return buffer;
}

function toTitleTr(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1) : word))
    .join(' ');
}

export type SyncTdbOptions = {
  docId?: number;
  year?: number;
  type?: string;
};

export async function syncTdbTariff(options: SyncTdbOptions = {}) {
  const docs = await fetchTdbDocuments(options.type);
  const withPdf = docs.filter((doc) => Boolean(doc.pdfUrl));
  let document = options.docId ? withPdf.find((doc) => doc.id === options.docId) : undefined;

  if (!document && options.year) {
    document = withPdf
      .filter((doc) => doc.year === options.year)
      .sort((a, b) => {
        const aRecommended = a.type === 'tavsiye' ? 1 : 0;
        const bRecommended = b.type === 'tavsiye' ? 1 : 0;
        return bRecommended - aRecommended || String(b.effectiveDate || '').localeCompare(String(a.effectiveDate || ''));
      })[0];
  }

  if (!document) {
    document = withPdf[0];
  }

  if (!document?.pdfUrl) {
    throw new Error('TDB tarife dokümanı bulunamadı');
  }

  const pdfBuffer = await downloadTdbTariffPdf(document.pdfUrl);
  const parsed = await pdfParse(pdfBuffer);
  const items = parseTdbTariffText(parsed.text);

  if (items.length === 0) {
    throw new Error('PDF içinden tarife kalemi okunamadı');
  }

  const effectiveDate = document.effectiveDate ? new Date(`${document.effectiveDate}T00:00:00.000Z`) : null;
  const sourceKey = `tdb:${document.type}:${document.id}`;

  const tariff = await prisma.tariff.upsert({
    where: { sourceKey },
    update: {
      name: document.title,
      year: document.year,
      type: 'TDB',
      effectiveDate,
      pdfUrl: document.pdfUrl,
      sourceUrl: document.pdfUrl,
      isActive: true,
    },
    create: {
      name: document.title,
      year: document.year,
      type: 'TDB',
      effectiveDate,
      pdfUrl: document.pdfUrl,
      sourceUrl: document.pdfUrl,
      sourceKey,
      isActive: true,
    },
  });

  const codes = items.map((item) => item.code);

  await prisma.$transaction(
    async (tx) => {
      for (const item of items) {
        await tx.tariffItem.upsert({
          where: { tariffId_code: { tariffId: tariff.id, code: item.code } },
          update: {
            categoryCode: item.categoryCode,
            category: item.category,
            name: item.name,
            priceExclVat: item.priceExclVat,
            priceInclVat: item.priceInclVat,
            vatRate: item.vatRate,
            isActive: true,
          },
          create: {
            tariffId: tariff.id,
            code: item.code,
            categoryCode: item.categoryCode,
            category: item.category,
            name: item.name,
            priceExclVat: item.priceExclVat,
            priceInclVat: item.priceInclVat,
            vatRate: item.vatRate,
            isActive: true,
          },
        });
      }
      await tx.tariffItem.updateMany({
        where: { tariffId: tariff.id, code: { notIn: codes } },
        data: { isActive: false },
      });
    },
    { timeout: 120000, maxWait: 10000 }
  );

  return {
    tariff,
    document,
    itemCount: items.length,
  };
}

export async function importTariffItemsToServices(tariffId: string) {
  const tariff = await prisma.tariff.findUnique({ where: { id: tariffId } });
  if (!tariff) {
    throw new Error('Tarife bulunamadı');
  }

  const items = await prisma.tariffItem.findMany({
    where: { tariffId, isActive: true },
    orderBy: [{ categoryCode: 'asc' }, { code: 'asc' }],
  });

  if (items.length === 0) {
    throw new Error('Aktarılacak tarife kalemi bulunamadı');
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of items) {
        const category = toTitleTr(item.category);
        await tx.service.upsert({
          where: { category_name: { category, name: item.name } },
          update: {
            description: `${item.code} · ${item.category}`,
            code: item.code,
            price: item.priceInclVat,
            vatRate: item.vatRate,
            tariffItemId: item.id,
            isActive: true,
          },
          create: {
            category,
            name: item.name,
            description: `${item.code} · ${item.category}`,
            code: item.code,
            price: item.priceInclVat,
            vatRate: item.vatRate,
            tariffItemId: item.id,
            isActive: true,
          },
        });
      }
    },
    { timeout: 120000, maxWait: 10000 }
  );

  return { tariff, itemCount: items.length };
}

import { promises as fs } from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const BACKUP_VERSION = 1;

export function getBackupDir() {
  const configured = process.env.BACKUP_DIR || './backups';
  return path.resolve(process.cwd(), configured);
}

export async function ensureBackupDir() {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function timestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}`;
}

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

type BackupTable = Record<string, unknown[]>;

export async function createBackup(userId?: string | null) {
  const dir = await ensureBackupDir();
  const fileName = `saatci-backup-${timestamp()}.json`;
  const filePath = path.join(dir, fileName);
  const models = Prisma.dmmf.datamodel.models;
  const tables: BackupTable = {};
  const counts: Record<string, number> = {};

  try {
    for (const model of models) {
      const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      const delegate = (prisma as unknown as Record<string, { findMany: (args?: unknown) => Promise<unknown[]> }>)[
        key
      ];
      if (!delegate?.findMany) continue;
      const rows = await delegate.findMany();
      tables[key] = rows;
      counts[key] = rows.length;
    }

    const payload = {
      app: 'saatci-crm',
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      counts,
      tables,
    };

    const serialized = JSON.stringify(payload, jsonReplacer, 2);
    await fs.writeFile(filePath, serialized, 'utf8');
    const stat = await fs.stat(filePath);

    const backup = await prisma.backup.create({
      data: {
        fileName,
        sizeBytes: stat.size,
        status: 'COMPLETED',
        createdById: userId || null,
        metadata: {
          version: BACKUP_VERSION,
          counts,
          totalRows: Object.values(counts).reduce((sum, value) => sum + value, 0),
          tables: models.length,
        },
      },
    });

    return backup;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await fs.unlink(filePath);
    } catch {
      // file may not exist
    }
    try {
      await prisma.backup.create({
        data: {
          fileName,
          sizeBytes: 0,
          status: 'FAILED',
          error: message.slice(0, 1000),
          createdById: userId || null,
        },
      });
    } catch (recordError) {
      console.error('[backup] hata kaydı yazılamadı:', recordError);
    }
    throw error;
  }
}

export function resolveBackupPath(fileName: string) {
  const dir = getBackupDir();
  const resolved = path.resolve(dir, fileName);
  if (!resolved.startsWith(`${dir}${path.sep}`)) {
    throw new Error('Geçersiz yedek dosyası');
  }
  return resolved;
}

export async function readBackupFile(fileName: string) {
  const filePath = resolveBackupPath(fileName);
  return fs.readFile(filePath);
}

export async function deleteBackupFile(fileName: string) {
  const filePath = resolveBackupPath(fileName);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
}

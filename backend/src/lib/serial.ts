import { prisma } from './prisma';

function currentYear() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()).slice(0, 4);
}

export async function nextHastaNo(): Promise<string> {
  const prefix = `H-${currentYear()}-`;
  const last = await prisma.patient.findFirst({
    where: { hastaNo: { startsWith: prefix } },
    orderBy: { hastaNo: 'desc' },
    select: { hastaNo: true },
  });
  const lastNum = last ? parseInt(last.hastaNo.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

export async function nextRandevuNo(): Promise<string> {
  const prefix = `R-${currentYear()}-`;
  const last = await prisma.appointment.findFirst({
    where: { randevuNo: { startsWith: prefix } },
    orderBy: { randevuNo: 'desc' },
    select: { randevuNo: true },
  });
  const lastNum = last ? parseInt(last.randevuNo.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
}

export async function nextProtokolNo(): Promise<string> {
  const prefix = `P-${currentYear()}-`;
  const last = await prisma.patientVisit.findFirst({
    where: { protokolNo: { startsWith: prefix } },
    orderBy: { protokolNo: 'desc' },
    select: { protokolNo: true },
  });
  const lastNum = last ? parseInt(last.protokolNo.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
}

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { nextRandevuNo } from '../lib/serial';
import { changeLeadStatus } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const statusEnum = z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);
const typeEnum = z.enum(['MEETING', 'EXAMINATION', 'TREATMENT']);

const appointmentSchema = z
  .object({
    randevuNo: z.string().min(1).optional(),
    patientId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
    type: typeEnum,
    status: statusEnum.optional(),
    channel: z.string().optional(),
    campaignId: z.string().uuid().optional().nullable(),
    appointmentDate: z.string().datetime(),
    endDate: z.string().datetime().optional().nullable(),
    unitNo: z.coerce.number().int().min(1).optional().nullable(),
    duration: z.coerce.number().int().min(1).optional().nullable(),
    title: z.string().optional(),
    phone: z.string().optional(),
    procedureType: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => !!data.patientId || !!data.leadId, {
    message: 'Hasta veya lead seÃ§ilmelidir',
  });

const appointmentUpdateSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  type: typeEnum.optional(),
  status: statusEnum.optional(),
  channel: z.string().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  appointmentDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  unitNo: z.coerce.number().int().min(1).optional().nullable(),
  duration: z.coerce.number().int().min(1).optional().nullable(),
  title: z.string().optional(),
  phone: z.string().optional(),
  procedureType: z.string().optional(),
  notes: z.string().optional(),
});

const istanbulDateStr = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);

const includeRelations = {
  patient: true,
  lead: true,
  user: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  campaign: { select: { id: true, name: true, channel: true } },
  visit: { select: { id: true, protokolNo: true, status: true, visitDate: true } },
} as const;

async function resolveChannel(params: {
  leadId?: string | null;
  patientId?: string | null;
  channel?: string;
  campaignId?: string | null;
}) {
  let lead: { source: string; campaignId: string | null } | null = null;
  if (params.leadId) {
    lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: { source: true, campaignId: true },
    });
  } else if (params.patientId) {
    lead = await prisma.lead.findFirst({
      where: { patientId: params.patientId },
      orderBy: { createdAt: 'asc' },
      select: { source: true, campaignId: true },
    });
  }
  return {
    channel: params.channel || lead?.source || 'Bilinmiyor',
    campaignId: params.campaignId ?? lead?.campaignId ?? null,
  };
}

async function validateStaff(type: string, userId?: string | null) {
  if (!userId) return null;
  const staff = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!staff) return 'Personel bulunamadÄ±';
  const required = type === 'MEETING' ? 'SALES' : 'DENTIST';
  if (staff.role !== required) {
    return type === 'MEETING'
      ? 'GÃ¶rÃ¼ÅŸme randevularÄ± satÄ±ÅŸ personeli tarafÄ±ndan yapÄ±lmalÄ±dÄ±r'
      : 'Muayene ve tedavi randevularÄ± doktor tarafÄ±ndan yapÄ±lmalÄ±dÄ±r';
  }
  return null;
}

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role } = req.user!;
    const where: Record<string, unknown> = {};

    if ((role === 'DENTIST' || role === 'SALES') && !req.query.patientId) {
      where.userId = req.user!.id;
    }
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.type) where.type = req.query.type as string;
    if (req.query.patientId) where.patientId = req.query.patientId as string;
    if (req.query.leadId) where.leadId = req.query.leadId as string;
    if (req.query.channel) where.channel = req.query.channel as string;
    if (req.query.campaignId) where.campaignId = req.query.campaignId as string;
    if (req.query.createdById) where.createdById = req.query.createdById as string;
    if (req.query.userId && role !== 'DENTIST') where.userId = req.query.userId as string;

    const scope = req.query.scope as string | undefined;
    if (scope === 'today') {
      const start = new Date(`${istanbulDateStr()}T00:00:00+03:00`);
      where.appointmentDate = { gte: start, lt: new Date(start.getTime() + 86400000) };
    } else if (scope === 'upcoming') {
      where.appointmentDate = { gte: new Date() };
      where.status = { in: ['PENDING', 'CONFIRMED'] };
    } else if (scope === 'past') {
      where.appointmentDate = { lt: new Date() };
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from || to) {
      where.appointmentDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: includeRelations,
      orderBy: { appointmentDate: scope === 'past' ? 'desc' : 'asc' },
      take: 500,
    });
    res.json({ success: true, data: appointments });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: includeRelations,
    });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Randevu bulunamadÄ±' });
    }
    res.json({ success: true, data: appointment });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'BANKO'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = appointmentSchema.parse(req.body);

    const staffError = await validateStaff(data.type, data.userId);
    if (staffError) {
      return res.status(400).json({ success: false, message: staffError });
    }

    const resolved = await resolveChannel({
      leadId: data.leadId,
      patientId: data.patientId,
      channel: data.channel,
      campaignId: data.campaignId,
    });

    const randevuNo = data.randevuNo || (await nextRandevuNo());
    const appointment = await prisma.appointment.create({
      data: {
        randevuNo,
        patientId: data.patientId || null,
        leadId: data.leadId || null,
        userId: data.userId || null,
        createdById: req.user!.id,
        type: data.type,
        status: data.status ?? 'PENDING',
        channel: resolved.channel,
        campaignId: resolved.campaignId,
        appointmentDate: new Date(data.appointmentDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        unitNo: data.unitNo ?? null,
        duration: data.duration ?? null,
        title: data.title || null,
        phone: data.phone || null,
        procedureType: data.procedureType || null,
        notes: data.notes,
      },
      include: includeRelations,
    });

    const pendingLeads = data.leadId
      ? await prisma.lead.findMany({
          where: { id: data.leadId, status: { in: ['NEW', 'CONTACTED'] } },
          select: { id: true },
        })
      : data.patientId
        ? await prisma.lead.findMany({
            where: { patientId: data.patientId, status: { in: ['NEW', 'CONTACTED'] } },
            select: { id: true },
          })
        : [];

    for (const lead of pendingLeads) {
      await changeLeadStatus({
        leadId: lead.id,
        status: 'APPOINTMENT_BOOKED',
        changedById: req.user!.id,
        appointmentId: appointment.id,
        note: 'Randevu oluÅŸturuldu',
      });
    }

    res.status(201).json({ success: true, data: appointment });
  })
);

router.patch(
  '/:id',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'BANKO', 'DENTIST'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = appointmentUpdateSchema.parse(req.body);

    if (data.userId !== undefined || data.type !== undefined) {
      const current = await prisma.appointment.findUnique({ where: { id: req.params.id } });
      if (!current) {
        return res.status(404).json({ success: false, message: 'Randevu bulunamadÄ±' });
      }
      const effectiveType = data.type ?? current.type;
      const effectiveUser = data.userId !== undefined ? data.userId : current.userId;
      const staffError = await validateStaff(effectiveType, effectiveUser);
      if (staffError) {
        return res.status(400).json({ success: false, message: staffError });
      }
    }

    const { userId, appointmentDate, endDate, campaignId, ...rest } = data;
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(userId !== undefined ? { userId } : {}),
        ...(campaignId !== undefined ? { campaignId } : {}),
        ...(appointmentDate ? { appointmentDate: new Date(appointmentDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: includeRelations,
    });
    res.json({ success: true, data: appointment });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = z.object({ status: statusEnum }).parse(req.body);
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      include: includeRelations,
    });
    res.json({ success: true, data: appointment });
  })
);

export default router;


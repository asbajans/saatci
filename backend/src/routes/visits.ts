import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { nextProtokolNo } from '../lib/serial';
import { changeLeadStatus } from '../lib/tracking';
import { z } from 'zod';

const router = Router();

const visitStatusEnum = z.enum(['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

const visitSchema = z
  .object({
    appointmentId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    channel: z.string().optional(),
    campaignId: z.string().uuid().optional().nullable(),
    notes: z.string().optional(),
  })
  .refine((data) => !!data.appointmentId || !!data.patientId || !!data.leadId, {
    message: 'Randevu, hasta veya lead seçilmelidir',
  });

const includeRelations = {
  appointment: {
    include: {
      user: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
  },
  patient: { select: { id: true, hastaNo: true, name: true, surname: true, phone: true } },
  lead: { select: { id: true, name: true, phone: true, source: true } },
  campaign: { select: { id: true, name: true, channel: true } },
} as const;

async function resolveChannel(params: {
  appointmentId?: string;
  leadId?: string | null;
  patientId?: string | null;
  channel?: string;
  campaignId?: string | null;
}) {
  if (params.appointmentId) {
    const appt = await prisma.appointment.findUnique({ where: { id: params.appointmentId } });
    if (appt) {
      return {
        channel: params.channel || appt.channel || 'Bilinmiyor',
        campaignId: params.campaignId ?? appt.campaignId,
      };
    }
  }
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

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const where: Record<string, unknown> = {};
    if (req.query.patientId) where.patientId = req.query.patientId as string;
    if (req.query.leadId) where.leadId = req.query.leadId as string;
    if (req.query.channel) where.channel = req.query.channel as string;
    if (req.query.campaignId) where.campaignId = req.query.campaignId as string;
    if (req.query.status) where.status = req.query.status as string;

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from || to) {
      where.visitDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const visits = await prisma.patientVisit.findMany({
      where,
      include: includeRelations,
      orderBy: { visitDate: 'desc' },
      take: 500,
    });
    res.json({ success: true, data: visits });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'BANKO', 'DENTIST'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = visitSchema.parse(req.body);

    let patientId = data.patientId || null;
    let leadId = data.leadId || null;

    if (data.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: data.appointmentId },
        include: { visit: true },
      });
      if (!appointment) {
        return res.status(404).json({ success: false, message: 'Randevu bulunamadı' });
      }
      if (appointment.visit) {
        return res.status(400).json({ success: false, message: 'Bu randevu için geliş kaydı zaten var' });
      }
      patientId = appointment.patientId;
      leadId = appointment.leadId;
    }

    if (!patientId && !leadId) {
      return res.status(400).json({ success: false, message: 'Hasta veya lead bilgisi gerekli' });
    }

    const resolved = await resolveChannel({
      appointmentId: data.appointmentId,
      patientId,
      leadId,
      channel: data.channel,
      campaignId: data.campaignId,
    });

    const protokolNo = await nextProtokolNo();
    const visit = await prisma.patientVisit.create({
      data: {
        protokolNo,
        appointmentId: data.appointmentId || null,
        patientId,
        leadId,
        channel: resolved.channel,
        campaignId: resolved.campaignId,
        notes: data.notes,
      },
      include: includeRelations,
    });

    const pendingLeads = leadId
      ? await prisma.lead.findMany({
          where: { id: leadId, status: { in: ['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED'] } },
          select: { id: true },
        })
      : patientId
        ? await prisma.lead.findMany({
            where: { patientId, status: { in: ['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED'] } },
            select: { id: true },
          })
        : [];

    for (const lead of pendingLeads) {
      await changeLeadStatus({
        leadId: lead.id,
        status: 'CLINIC_VISIT',
        changedById: req.user!.id,
        note: `Klinik gelişi oluşturuldu (${visit.protokolNo})`,
        appointmentId: visit.appointmentId,
        payload: { protokolNo: visit.protokolNo },
      });
    }

    res.status(201).json({ success: true, data: visit });
  })
);

router.patch(
  '/:id/status',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'BANKO', 'DENTIST'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = z.object({ status: visitStatusEnum }).parse(req.body);
    const visit = await prisma.patientVisit.update({
      where: { id: req.params.id },
      data: { status },
      include: includeRelations,
    });
    res.json({ success: true, data: visit });
  })
);

export default router;

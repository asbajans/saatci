import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { nextHastaNo } from '../lib/serial';
import { z } from 'zod';

const router = Router();

const patientSchema = z.object({
  hastaNo: z.string().min(1).optional(),
  name: z.string().min(2),
  surname: z.string().min(2),
  tc: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
});

const medicalSchema = z.object({
  allergies: z.string().optional(),
  chronicDiseases: z.string().optional(),
  medications: z.string().optional(),
  notes: z.string().optional(),
  dentalChart: z.any().optional(),
});

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role } = req.user!;
    const search = (req.query.search as string | undefined)?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { surname: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { tc: { contains: search } },
            { hastaNo: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    if (role === 'CALL_CENTER' || role === 'SALES') {
      const patients = await prisma.patient.findMany({
        where,
        select: { id: true, hastaNo: true, name: true, surname: true, tc: true, phone: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, data: patients });
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: patients });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const role = req.user!.role;
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            createdBy: { select: { id: true, name: true, role: true } },
            visit: { select: { id: true, protokolNo: true, status: true } },
          },
          orderBy: { appointmentDate: 'desc' },
        },
        visits: {
          include: {
            appointment: { select: { id: true, randevuNo: true, type: true, appointmentDate: true } },
            campaign: { select: { id: true, name: true } },
          },
          orderBy: { visitDate: 'desc' },
        },
        treatmentPlans: {
          include: {
            items: true,
            invoices: true,
            createdBy: { select: { id: true, name: true, role: true } },
            campaign: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        medicalRecord: role === 'DENTIST' || role === 'ADMIN',
      },
    });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Hasta bulunamadı' });
    }
    res.json({ success: true, data: patient });
  })
);

router.post(
  '/',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'BANKO', 'DENTIST'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = patientSchema.parse(req.body);
    const hastaNo = data.hastaNo || (await nextHastaNo());
    const patient = await prisma.patient.create({
      data: {
        hastaNo,
        name: data.name,
        surname: data.surname,
        tc: data.tc,
        phone: data.phone,
        email: data.email || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender || null,
        address: data.address || null,
      },
    });
    res.status(201).json({ success: true, data: patient });
  })
);

router.put(
  '/:id',
  roleGuard('ADMIN', 'CALL_CENTER', 'SALES', 'DENTIST'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = patientSchema.partial().parse(req.body);
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...data,
        email: data.email || undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      },
    });
    res.json({ success: true, data: patient });
  })
);

router.put(
  '/:id/medical',
  roleGuard('ADMIN', 'DENTIST'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = medicalSchema.parse(req.body);
    const record = await prisma.medicalRecord.upsert({
      where: { patientId: req.params.id },
      update: {
        allergies: data.allergies,
        chronicDiseases: data.chronicDiseases,
        medications: data.medications,
        notes: data.notes,
        dentalChart: data.dentalChart,
      },
      create: {
        patientId: req.params.id,
        allergies: data.allergies,
        chronicDiseases: data.chronicDiseases,
        medications: data.medications,
        notes: data.notes,
        dentalChart: data.dentalChart,
      },
    });
    res.json({ success: true, data: record });
  })
);

export default router;

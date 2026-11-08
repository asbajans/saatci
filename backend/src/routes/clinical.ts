import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authMiddleware);
router.use(roleGuard('ADMIN', 'DENTIST'));

const medicalRecordSchema = z.object({
  allergies: z.string().nullable().optional(),
  chronicDiseases: z.string().nullable().optional(),
  medications: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  dentalChart: z.any().optional(),
});

const toothFindingSchema = z.object({
  toothNo: z.string().min(1),
  condition: z.string().min(1),
  surfaces: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const diagnosisSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  toothNo: z.string().optional(),
  code: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'RESOLVED']).optional(),
});

const treatmentRecordSchema = z.object({
  planId: z.string().uuid().optional(),
  planItemId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  tariffItemId: z.string().uuid().optional(),
  toothNo: z.string().optional(),
  code: z.string().optional(),
  procedureName: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  total: z.coerce.number().min(0).optional(),
  status: z.enum(['PLANNED', 'APPLIED', 'CANCELLED']).optional(),
  appliedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const prescriptionSchema = z.object({
  prescriptionNo: z.string().optional(),
  issuedAt: z.string().datetime().optional(),
  items: z.any(),
  notes: z.string().optional(),
});

const clinicalNoteSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  type: z.enum(['NOTE', 'ANAMNESIS', 'FOLLOW_UP']).optional(),
  content: z.string().min(1),
});

async function ensurePatient(id: string, res: Response) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) {
    res.status(404).json({ success: false, message: 'Hasta bulunamadı' });
    return false;
  }
  return true;
}

router.get(
  '/patients/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        medicalRecord: true,
        toothFindings: { orderBy: { toothNo: 'asc' } },
        diagnoses: {
          include: { doctor: { select: { id: true, name: true } } },
          orderBy: { diagnosedAt: 'desc' },
        },
        treatmentRecords: {
          include: {
            doctor: { select: { id: true, name: true } },
            service: true,
            tariffItem: true,
            plan: { select: { id: true, status: true } },
          },
          orderBy: { appliedAt: 'desc' },
        },
        prescriptions: {
          include: { doctor: { select: { id: true, name: true } } },
          orderBy: { issuedAt: 'desc' },
        },
        clinicalNotes: {
          include: { doctor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        appointments: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { appointmentDate: 'desc' },
          take: 30,
        },
        treatmentPlans: {
          include: {
            items: { include: { service: true, tariffItem: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tariff: true,
        dentist: { select: { id: true, name: true, email: true } },
        referencePatient: { select: { id: true, hastaNo: true, name: true, surname: true } },
      },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Hasta bulunamadı' });
    }
    res.json({ success: true, data: patient });
  })
);

router.put(
  '/patients/:id/medical-record',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const data = medicalRecordSchema.parse(req.body);
    const record = await prisma.medicalRecord.upsert({
      where: { patientId: req.params.id },
      update: data,
      create: { patientId: req.params.id, ...data },
    });
    res.json({ success: true, data: record });
  })
);

router.put(
  '/patients/:id/tooth-findings',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const data = z.object({ findings: z.array(toothFindingSchema).max(64) }).parse(req.body);
    const authReq = req as AuthRequest;

    await prisma.$transaction(async (tx) => {
      await tx.toothFinding.deleteMany({ where: { patientId: req.params.id } });
      if (data.findings.length > 0) {
        await tx.toothFinding.createMany({
          data: data.findings.map((finding) => ({
            patientId: req.params.id,
            toothNo: finding.toothNo,
            condition: finding.condition,
            surfaces: finding.surfaces || null,
            notes: finding.notes || null,
            updatedById: authReq.user?.id,
          })),
        });
      }
    });

    const findings = await prisma.toothFinding.findMany({
      where: { patientId: req.params.id },
      orderBy: { toothNo: 'asc' },
    });
    res.json({ success: true, data: findings });
  })
);

router.delete(
  '/patients/:id/tooth-findings/:toothNo',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.toothFinding.deleteMany({
      where: { patientId: req.params.id, toothNo: req.params.toothNo },
    });
    res.json({ success: true, data: { deleted: true } });
  })
);

router.post(
  '/patients/:id/diagnoses',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const authReq = req as AuthRequest;
    const data = diagnosisSchema.parse(req.body);
    const diagnosis = await prisma.diagnosis.create({
      data: {
        patientId: req.params.id,
        appointmentId: data.appointmentId,
        doctorId: data.doctorId || authReq.user?.id,
        toothNo: data.toothNo,
        code: data.code,
        title: data.title,
        description: data.description,
        status: data.status || 'ACTIVE',
      },
      include: { doctor: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: diagnosis });
  })
);

router.patch(
  '/diagnoses/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = diagnosisSchema.partial().parse(req.body);
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id },
      data: {
        ...data,
        resolvedAt: data.status === 'RESOLVED' ? new Date() : data.status === 'ACTIVE' ? null : undefined,
      },
      include: { doctor: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: diagnosis });
  })
);

router.delete(
  '/diagnoses/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.diagnosis.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

router.post(
  '/patients/:id/treatment-records',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const authReq = req as AuthRequest;
    const data = treatmentRecordSchema.parse(req.body);
    const total = data.total ?? data.quantity * data.unitPrice;

    const record = await prisma.treatmentRecord.create({
      data: {
        patientId: req.params.id,
        planId: data.planId,
        planItemId: data.planItemId,
        appointmentId: data.appointmentId,
        doctorId: data.doctorId || authReq.user?.id,
        serviceId: data.serviceId,
        tariffItemId: data.tariffItemId,
        toothNo: data.toothNo,
        code: data.code,
        procedureName: data.procedureName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        vatRate: data.vatRate,
        total,
        status: data.status || 'APPLIED',
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : undefined,
        notes: data.notes,
      },
      include: { service: true, tariffItem: true, doctor: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: record });
  })
);

router.patch(
  '/treatment-records/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = treatmentRecordSchema.partial().parse(req.body);
    const existing = await prisma.treatmentRecord.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tedavi kaydı bulunamadı' });
    }
    const quantity = data.quantity ?? existing.quantity;
    const unitPrice = data.unitPrice ?? Number(existing.unitPrice);
    const total = data.total ?? quantity * unitPrice;

    const record = await prisma.treatmentRecord.update({
      where: { id: req.params.id },
      data: {
        ...data,
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : undefined,
        total,
      },
      include: { service: true, tariffItem: true, doctor: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: record });
  })
);

router.delete(
  '/treatment-records/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.treatmentRecord.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

router.post(
  '/patients/:id/prescriptions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const authReq = req as AuthRequest;
    const data = prescriptionSchema.parse(req.body);
    const prescription = await prisma.prescription.create({
      data: {
        patientId: req.params.id,
        doctorId: authReq.user?.id,
        prescriptionNo: data.prescriptionNo,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : undefined,
        items: data.items,
        notes: data.notes,
      },
      include: { doctor: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: prescription });
  })
);

router.delete(
  '/prescriptions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.prescription.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

router.post(
  '/patients/:id/notes',
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await ensurePatient(req.params.id, res))) return;
    const authReq = req as AuthRequest;
    const data = clinicalNoteSchema.parse(req.body);
    const note = await prisma.clinicalNote.create({
      data: {
        patientId: req.params.id,
        appointmentId: data.appointmentId,
        doctorId: authReq.user?.id,
        type: data.type || 'NOTE',
        content: data.content,
      },
      include: { doctor: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: note });
  })
);

router.delete(
  '/notes/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.clinicalNote.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);

function dayStart(dateStr: string) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Working Hours
router.get('/working-hours', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date } = req.query;
  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId as string;
  if (date) {
    const start = dayStart(date as string);
    where.date = { gte: start, lt: new Date(start.getTime() + 86400000) };
  }
  const workingHours = await prisma.workingHours.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { date: 'asc' },
  });
  res.json({ success: true, data: workingHours });
}));

router.post('/working-hours', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    userId: z.string().min(1),
    date: z.string(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    lunchStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  }).parse(req.body);

  const start = dayStart(data.date);
  const existing = await prisma.workingHours.findFirst({
    where: { userId: data.userId, date: start },
  });

  const payload = {
    start: data.start,
    end: data.end,
    lunchStart: data.lunchStart || null,
    lunchEnd: data.lunchEnd || null,
  };

  const workingHours = existing
    ? await prisma.workingHours.update({
        where: { id: existing.id },
        data: payload,
        include: { user: { select: { id: true, name: true, role: true } } },
      })
    : await prisma.workingHours.create({
        data: { userId: data.userId, date: start, ...payload },
        include: { user: { select: { id: true, name: true, role: true } } },
      });

  res.status(201).json({ success: true, data: workingHours });
}));

router.patch('/working-hours/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    lunchStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  }).partial().parse(req.body);

  const workingHours = await prisma.workingHours.update({
    where: { id: req.params.id },
    data,
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  res.json({ success: true, data: workingHours });
}));

router.delete('/working-hours/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.workingHours.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { deleted: true } });
}));

// Schedule Blocks (leave, lunch, closed slots)
router.get('/blocks', asyncHandler(async (req: Request, res: Response) => {
  const { userId, date, from, to } = req.query;
  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId as string;
  if (date) {
    const start = dayStart(date as string);
    where.date = { gte: start, lt: new Date(start.getTime() + 86400000) };
  } else if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from as string);
    if (to) range.lte = new Date(to as string);
    where.date = range;
  }
  const blocks = await prisma.scheduleBlock.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  res.json({ success: true, data: blocks });
}));

router.post('/blocks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    userId: z.string().min(1),
    date: z.string(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    status: z.enum(['LEAVE', 'LUNCH', 'BLOCKED', 'FREE']).default('LEAVE'),
    reason: z.string().optional(),
  }).parse(req.body);

  const block = await prisma.scheduleBlock.create({
    data: {
      userId: data.userId,
      date: dayStart(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      reason: data.reason,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json({ success: true, data: block });
}));

router.delete('/blocks/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.scheduleBlock.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { deleted: true } });
}));

// Weekly working-day template
router.get('/weekly', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.query;
  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId as string;
  const weekly = await prisma.weeklySchedule.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { weekday: 'asc' },
  });
  res.json({ success: true, data: weekly });
}));

router.post('/weekly', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = z.object({
    userId: z.string().min(1),
    days: z.array(z.number().int().min(0).max(6)),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    lunchStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  }).parse(req.body);

  await prisma.weeklySchedule.deleteMany({ where: { userId: data.userId } });

  if (data.days.length) {
    await prisma.weeklySchedule.createMany({
      data: data.days.map((weekday) => ({
        userId: data.userId,
        weekday,
        start: data.start,
        end: data.end,
        lunchStart: data.lunchStart || null,
        lunchEnd: data.lunchEnd || null,
      })),
    });
  }

  const weekly = await prisma.weeklySchedule.findMany({
    where: { userId: data.userId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { weekday: 'asc' },
  });
  res.status(201).json({ success: true, data: weekly });
}));

router.delete('/weekly/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.weeklySchedule.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { deleted: true } });
}));

export default router;

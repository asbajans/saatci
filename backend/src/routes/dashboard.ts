import { Router, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const istanbulDateStr = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);

const dayBounds = (offsetDays = 0) => {
  const base = new Date(Date.now() + offsetDays * 86400000);
  const start = new Date(`${istanbulDateStr(base)}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
};

const monthStart = () => {
  const first = `${istanbulDateStr().slice(0, 7)}-01`;
  return new Date(`${first}T00:00:00+03:00`);
};

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const today = dayBounds();

    const [
      totalPatients,
      todaysAppointments,
      pendingAppointments,
      upcomingAppointments,
      leads,
      plans,
      invoices,
      recentLeads,
      myTodayAppointments,
      myUpcomingAppointments,
      todaysVisits,
      waitingVisits,
      totalVisits,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({
        where: {
          appointmentDate: { gte: today.start, lt: today.end },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      prisma.appointment.count({ where: { status: 'PENDING' } }),
      prisma.appointment.findMany({
        where: { appointmentDate: { gte: today.start }, status: { in: ['PENDING', 'CONFIRMED'] } },
        include: {
          patient: true,
          lead: true,
          user: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          visit: { select: { id: true, protokolNo: true, status: true } },
        },
        orderBy: { appointmentDate: 'asc' },
        take: 8,
      }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.treatmentPlan.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.invoice.findMany({ select: { amount: true, paidAmount: true, paidAt: true } }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { campaign: true },
      }),
      prisma.appointment.count({
        where: {
          userId: req.user!.id,
          appointmentDate: { gte: today.start, lt: today.end },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      prisma.appointment.findMany({
        where: {
          userId: req.user!.id,
          appointmentDate: { gte: today.start },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        include: { patient: true, user: { select: { id: true, name: true, role: true } } },
        orderBy: { appointmentDate: 'asc' },
        take: 8,
      }),
      prisma.patientVisit.count({
        where: { visitDate: { gte: today.start, lt: today.end } },
      }),
      prisma.patientVisit.count({ where: { status: 'WAITING' } }),
      prisma.patientVisit.count(),
    ]);

    const monthStartDate = monthStart();
    const monthlyRevenue = invoices
      .filter((i) => i.paidAt && i.paidAt >= monthStartDate)
      .reduce((sum, i) => sum + Number(i.paidAmount), 0);
    const totalCollected = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.amount), 0);

    const leadCounts: Record<string, number> = {};
    for (const item of leads) leadCounts[item.status] = item._count._all;

    const planCounts: Record<string, number> = {};
    for (const item of plans) planCounts[item.status] = item._count._all;

    res.json({
      success: true,
      data: {
        totalPatients,
        todaysAppointments,
        pendingAppointments,
        monthlyRevenue,
        totalCollected,
        totalInvoiced,
        outstanding: totalInvoiced - totalCollected,
        leadCounts,
        planCounts,
        upcomingAppointments,
        recentLeads,
        myTodayAppointments,
        myUpcomingAppointments,
        todaysVisits,
        waitingVisits,
        totalVisits,
      },
    });
  })
);

export default router;

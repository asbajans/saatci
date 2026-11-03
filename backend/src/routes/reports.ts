import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const num = (value: unknown) => Number(value ?? 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

type ChannelBucket = {
  channel: string;
  leads: number;
  patients: number;
  appointments: number;
  visits: number;
  sales: number;
  revenue: number;
  spend: number;
};

const emptyChannel = (channel: string): ChannelBucket => ({
  channel,
  leads: 0,
  patients: 0,
  appointments: 0,
  visits: 0,
  sales: 0,
  revenue: 0,
  spend: 0,
});

router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const channelFilter = req.query.channel ? String(req.query.channel) : undefined;
    const campaignFilter = req.query.campaignId ? String(req.query.campaignId) : undefined;

    const inRange = (date?: Date | null) => {
      if (!date) return !from && !to;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    };

    const [leadRows, appointmentRows, visitRows, planRows, invoiceRows, campaignRows, userRows, patientRows] =
      await Promise.all([
        prisma.lead.findMany({
          select: { id: true, createdAt: true, source: true, campaignId: true, patientId: true, status: true },
        }),
        prisma.appointment.findMany({
          select: {
            id: true,
            appointmentDate: true,
            type: true,
            status: true,
            channel: true,
            campaignId: true,
            leadId: true,
            patientId: true,
            userId: true,
            createdById: true,
            user: { select: { name: true, role: true } },
            createdBy: { select: { name: true, role: true } },
          },
        }),
        prisma.patientVisit.findMany({
          select: {
            id: true,
            visitDate: true,
            status: true,
            channel: true,
            campaignId: true,
            patientId: true,
            leadId: true,
            appointment: { select: { userId: true } },
          },
        }),
        prisma.treatmentPlan.findMany({
          select: {
            id: true,
            createdAt: true,
            status: true,
            totalPrice: true,
            discount: true,
            channel: true,
            campaignId: true,
            createdById: true,
          },
        }),
        prisma.invoice.findMany({
          select: { id: true, planId: true, amount: true, paidAmount: true, paidAt: true, createdAt: true },
        }),
        prisma.campaign.findMany({
          select: { id: true, name: true, channel: true, budget: true },
        }),
        prisma.user.findMany({ select: { id: true, name: true, role: true } }),
        prisma.patient.findMany({ select: { id: true, createdAt: true } }),
      ]);

    const matchChannel = (value?: string | null) => !channelFilter || (value || 'Bilinmiyor') === channelFilter;
    const matchCampaign = (value?: string | null) => !campaignFilter || value === campaignFilter;

    const filteredLeads = leadRows.filter(
      (row) => inRange(row.createdAt) && matchChannel(row.source) && matchCampaign(row.campaignId)
    );
    const filteredAppointments = appointmentRows.filter(
      (row) => inRange(row.appointmentDate) && matchChannel(row.channel) && matchCampaign(row.campaignId)
    );
    const filteredVisits = visitRows.filter(
      (row) => inRange(row.visitDate) && matchChannel(row.channel) && matchCampaign(row.campaignId)
    );

    const planChannelById = new Map(planRows.map((plan) => [plan.id, plan.channel]));
    const planCampaignById = new Map(planRows.map((plan) => [plan.id, plan.campaignId]));

    const filteredPlans = planRows.filter(
      (row) => inRange(row.createdAt) && matchChannel(row.channel) && matchCampaign(row.campaignId)
    );
    const filteredInvoices = invoiceRows.filter(
      (row) =>
        inRange(row.createdAt) &&
        matchChannel(planChannelById.get(row.planId)) &&
        matchCampaign(planCampaignById.get(row.planId))
    );
    const filteredPatients = patientRows.filter((row) => inRange(row.createdAt));

    const campaignById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
    const userById = new Map(userRows.map((user) => [user.id, user]));
    const patientChannel = new Map<string, string | null>();
    for (const lead of leadRows) {
      if (lead.patientId && !patientChannel.has(lead.patientId)) {
        patientChannel.set(lead.patientId, lead.source);
      }
    }

    const channels = new Map<string, ChannelBucket>();
    const getChannel = (value?: string | null) => {
      const key = value || 'Bilinmiyor';
      if (!channels.has(key)) channels.set(key, emptyChannel(key));
      return channels.get(key)!;
    };

    for (const lead of filteredLeads) getChannel(lead.source).leads += 1;
    for (const patient of filteredPatients) getChannel(patientChannel.get(patient.id)).patients += 1;
    for (const appointment of filteredAppointments) getChannel(appointment.channel).appointments += 1;
    for (const visit of filteredVisits) getChannel(visit.channel).visits += 1;

    const soldStatuses = new Set(['APPROVED', 'IN_PROGRESS', 'COMPLETED']);
    const netPrice = (plan: { totalPrice: unknown; discount: unknown }) =>
      Math.max(0, num(plan.totalPrice) - num(plan.discount));

    for (const plan of filteredPlans) {
      if (!soldStatuses.has(plan.status)) continue;
      const bucket = getChannel(plan.channel);
      bucket.sales += 1;
      bucket.revenue += netPrice(plan);
    }

    const relevantCampaigns = campaignRows.filter(
      (campaign) => matchChannel(campaign.channel) && matchCampaign(campaign.id)
    );
    for (const campaign of relevantCampaigns) {
      getChannel(campaign.channel).spend += num(campaign.budget);
    }

    const channelRows = Array.from(channels.values())
      .map((bucket) => ({
        ...bucket,
        revenue: round2(bucket.revenue),
        spend: round2(bucket.spend),
        roi: bucket.spend > 0 ? round2(bucket.revenue / bucket.spend) : null,
        cpl: bucket.leads > 0 ? round2(bucket.spend / bucket.leads) : null,
        cpa: bucket.patients > 0 ? round2(bucket.spend / bucket.patients) : null,
        leadToAppointment: bucket.leads > 0 ? round2((bucket.appointments / bucket.leads) * 100) : null,
        appointmentToVisit: bucket.appointments > 0 ? round2((bucket.visits / bucket.appointments) * 100) : null,
        visitToSale: bucket.visits > 0 ? round2((bucket.sales / bucket.visits) * 100) : null,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

    const campaignMetrics = campaignRows
      .filter((campaign) => matchChannel(campaign.channel) && matchCampaign(campaign.id))
      .map((campaign) => {
        const leads = filteredLeads.filter((row) => row.campaignId === campaign.id);
        const appointments = filteredAppointments.filter((row) => row.campaignId === campaign.id);
        const visits = filteredVisits.filter((row) => row.campaignId === campaign.id);
        const plans = filteredPlans.filter(
          (row) => row.campaignId === campaign.id && soldStatuses.has(row.status)
        );
        const revenue = plans.reduce((sum, plan) => sum + netPrice(plan), 0);
        const budget = num(campaign.budget);
        return {
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          budget: round2(budget),
          leads: leads.length,
          patients: leads.filter((lead) => lead.patientId).length,
          appointments: appointments.length,
          visits: visits.length,
          sales: plans.length,
          revenue: round2(revenue),
          roi: budget > 0 ? round2(revenue / budget) : null,
          cpl: leads.length > 0 ? round2(budget / leads.length) : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const typeCounts: Record<string, { total: number; completed: number }> = {
      MEETING: { total: 0, completed: 0 },
      EXAMINATION: { total: 0, completed: 0 },
      TREATMENT: { total: 0, completed: 0 },
    };
    const appointmentStatusCounts: Record<string, number> = {};
    for (const appointment of filteredAppointments) {
      typeCounts[appointment.type].total += 1;
      if (appointment.status === 'COMPLETED') typeCounts[appointment.type].completed += 1;
      appointmentStatusCounts[appointment.status] = (appointmentStatusCounts[appointment.status] || 0) + 1;
    }

    const visitStatusCounts: Record<string, number> = {};
    for (const visit of filteredVisits) {
      visitStatusCounts[visit.status] = (visitStatusCounts[visit.status] || 0) + 1;
    }

    const leadStatusCounts: Record<string, number> = {};
    for (const lead of filteredLeads) {
      leadStatusCounts[lead.status] = (leadStatusCounts[lead.status] || 0) + 1;
    }

    const bookedByMap = new Map<
      string,
      { id: string; name: string; role: string; total: number; completed: number; leadBookings: number }
    >();
    for (const appointment of filteredAppointments) {
      const key = appointment.createdById || 'unknown';
      if (!bookedByMap.has(key)) {
        bookedByMap.set(key, {
          id: key,
          name: appointment.createdBy?.name || 'Bilinmiyor',
          role: appointment.createdBy?.role || '-',
          total: 0,
          completed: 0,
          leadBookings: 0,
        });
      }
      const entry = bookedByMap.get(key)!;
      entry.total += 1;
      if (appointment.status === 'COMPLETED') entry.completed += 1;
      if (appointment.leadId) entry.leadBookings += 1;
    }
    const bookedBy = Array.from(bookedByMap.values()).sort((a, b) => b.total - a.total);

    const staffMap = new Map<
      string,
      {
        id: string;
        name: string;
        role: string;
        total: number;
        completed: number;
        meetings: number;
        examinations: number;
        treatments: number;
      }
    >();
    for (const appointment of filteredAppointments) {
      if (!appointment.userId) continue;
      if (!staffMap.has(appointment.userId)) {
        const user = userById.get(appointment.userId);
        staffMap.set(appointment.userId, {
          id: appointment.userId,
          name: user?.name || appointment.user?.name || 'Bilinmiyor',
          role: user?.role || appointment.user?.role || '-',
          total: 0,
          completed: 0,
          meetings: 0,
          examinations: 0,
          treatments: 0,
        });
      }
      const entry = staffMap.get(appointment.userId)!;
      entry.total += 1;
      if (appointment.status === 'COMPLETED') entry.completed += 1;
      if (appointment.type === 'MEETING') entry.meetings += 1;
      if (appointment.type === 'EXAMINATION') entry.examinations += 1;
      if (appointment.type === 'TREATMENT') entry.treatments += 1;
    }
    const staffPerformance = Array.from(staffMap.values()).sort((a, b) => b.total - a.total);

    const doctorPerformance = userRows
      .filter((user) => user.role === 'DENTIST')
      .map((doctor) => {
        const own = filteredAppointments.filter((row) => row.userId === doctor.id);
        return {
          id: doctor.id,
          name: doctor.name,
          examinations: own.filter((row) => row.type === 'EXAMINATION').length,
          treatments: own.filter((row) => row.type === 'TREATMENT').length,
          completed: own.filter((row) => row.status === 'COMPLETED').length,
          visitsCompleted: filteredVisits.filter(
            (visit) => visit.appointment?.userId === doctor.id && visit.status === 'COMPLETED'
          ).length,
        };
      })
      .sort((a, b) => b.completed - a.completed);

    const salesPerformance = userRows
      .filter((user) => user.role === 'SALES')
      .map((sales) => {
        const own = filteredPlans.filter((plan) => plan.createdById === sales.id);
        const sold = own.filter((plan) => soldStatuses.has(plan.status));
        return {
          id: sales.id,
          name: sales.name,
          plans: own.length,
          sales: sold.length,
          revenue: round2(sold.reduce((sum, plan) => sum + netPrice(plan), 0)),
          meetings: filteredAppointments.filter(
            (row) => row.userId === sales.id && row.type === 'MEETING'
          ).length,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const soldPlans = filteredPlans.filter((plan) => soldStatuses.has(plan.status));
    const revenue = soldPlans.reduce((sum, plan) => sum + netPrice(plan), 0);
    const totalInvoiced = filteredInvoices.reduce((sum, invoice) => sum + num(invoice.amount), 0);
    const totalCollected = filteredInvoices.reduce((sum, invoice) => sum + num(invoice.paidAmount), 0);
    const adSpend = relevantCampaigns.reduce((sum, campaign) => sum + num(campaign.budget), 0);
    const leadAppointmentCount = new Set(
      filteredAppointments.map((row) => row.leadId).filter((value): value is string => !!value)
    ).size;

    res.json({
      success: true,
      data: {
        totals: {
          leads: filteredLeads.length,
          patients: filteredPatients.length,
          appointments: filteredAppointments.length,
          visits: filteredVisits.length,
          sales: soldPlans.length,
          revenue: round2(revenue),
          invoiced: round2(totalInvoiced),
          collected: round2(totalCollected),
          outstanding: round2(totalInvoiced - totalCollected),
          adSpend: round2(adSpend),
          roi: adSpend > 0 ? round2(revenue / adSpend) : null,
          avgTicket: soldPlans.length > 0 ? round2(revenue / soldPlans.length) : 0,
          leadToAppointment:
            filteredLeads.length > 0 ? round2((leadAppointmentCount / filteredLeads.length) * 100) : null,
          leadToPatient: filteredLeads.length > 0
            ? round2((filteredLeads.filter((row) => row.patientId).length / filteredLeads.length) * 100)
            : null,
          appointmentToVisit:
            filteredAppointments.length > 0
              ? round2((filteredVisits.length / filteredAppointments.length) * 100)
              : null,
        },
        byChannel: channelRows,
        byCampaign: campaignMetrics,
        appointmentByType: typeCounts,
        appointmentByStatus: appointmentStatusCounts,
        visitByStatus: visitStatusCounts,
        leadByStatus: leadStatusCounts,
        bookedBy,
        staffPerformance,
        doctorPerformance,
        salesPerformance,
        filters: {
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
          channel: channelFilter ?? null,
          campaignId: campaignFilter ?? null,
        },
      },
    });
  })
);

export default router;

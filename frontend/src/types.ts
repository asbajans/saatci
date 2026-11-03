export type UserRole = 'ADMIN' | 'DENTIST' | 'CALL_CENTER' | 'SALES' | 'BANKO';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  budget?: number | null;
};

export type Patient = {
  id: string;
  hastaNo: string;
  name: string;
  surname: string;
  tc: string;
  phone: string;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  createdAt: string;
};

export type AppointmentType = 'MEETING' | 'EXAMINATION' | 'TREATMENT';
export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Appointment = {
  id: string;
  randevuNo: string;
  patientId?: string | null;
  patient?: Patient | null;
  leadId?: string | null;
  lead?: Lead | null;
  userId?: string | null;
  user?: { id: string; name: string; role: UserRole } | null;
  createdById?: string | null;
  createdBy?: { id: string; name: string; role: UserRole } | null;
  type: AppointmentType;
  status: AppointmentStatus;
  channel?: string | null;
  campaignId?: string | null;
  campaign?: Campaign | null;
  appointmentDate: string;
  createdAt: string;
  notes?: string | null;
  visit?: { id: string; protokolNo: string; status: VisitStatus; visitDate?: string } | null;
};

export type VisitStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type Visit = {
  id: string;
  protokolNo: string;
  appointmentId?: string | null;
  appointment?: Appointment | null;
  patientId?: string | null;
  patient?: Patient | null;
  leadId?: string | null;
  lead?: Lead | null;
  channel?: string | null;
  campaignId?: string | null;
  campaign?: Campaign | null;
  status: VisitStatus;
  visitDate: string;
  notes?: string | null;
  createdAt: string;
};

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'CLINIC_VISIT'
  | 'TREATMENT_APPROVED'
  | 'APPOINTMENT_BOOKED'
  | 'SOLD';

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  campaignId?: string | null;
  campaign?: Campaign | null;
  status: LeadStatus;
  patientId?: string | null;
  patient?: Patient | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  createdAt: string;
  appointments?: Appointment[];
  visits?: Visit[];
};

export type TreatmentPlanStatus = 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export type TreatmentItem = {
  id: string;
  toothNo?: string | null;
  treatment: string;
  price: number;
  quantity: number;
  stepOrder: number;
};

export type TreatmentPlan = {
  id: string;
  patientId: string;
  patient?: Patient;
  createdById?: string | null;
  createdBy?: { id: string; name: string; role: UserRole } | null;
  status: TreatmentPlanStatus;
  totalPrice: number;
  discount: number;
  paymentPlan?: any;
  channel?: string | null;
  campaignId?: string | null;
  campaign?: Campaign | null;
  items: TreatmentItem[];
  invoices: any[];
  createdAt: string;
};

export type Invoice = {
  id: string;
  planId: string;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate?: string | null;
  paidAt?: string | null;
};

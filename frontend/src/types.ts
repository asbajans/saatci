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
  mobilePhone?: string | null;
  wiredPhone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  town?: string | null;
  postCode?: string | null;
  nationality?: string | null;
  profession?: string | null;
  bloodGroup?: string | null;
  controlPeriodMonth?: number | null;
  specialCode?: string | null;
  relativeName?: string | null;
  relativePhone?: string | null;
  referenceName?: string | null;
  referencePatientId?: string | null;
  organization?: string | null;
  foreignPatientType?: string | null;
  balance?: number | null;
  notes?: string | null;
  tariffId?: string | null;
  tariff?: { id: string; name: string; year?: number | null } | null;
  dentistId?: string | null;
  dentist?: { id: string; name: string } | null;
  createdAt: string;
};

export type AppointmentType = 'MEETING' | 'EXAMINATION' | 'TREATMENT';
export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type SalesStatus = 'SOLD' | 'NEGATIVE' | 'CALLBACK';

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
  salesStatus?: SalesStatus | null;
  channel?: string | null;
  campaignId?: string | null;
  campaign?: Campaign | null;
  appointmentDate: string;
  createdAt: string;
  endDate?: string | null;
  unitNo?: number | null;
  duration?: number | null;
  title?: string | null;
  phone?: string | null;
  procedureType?: string | null;
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
  | 'SOLD'
  | 'IRRELEVANT'
  | 'PRICE_HIGH'
  | 'CALLBACK';

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
  callbackAt?: string | null;
  callbackNote?: string | null;
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
  tariffItemId?: string | null;
  code?: string | null;
  vatRate?: number | null;
  discount?: number | null;
  total?: number | null;
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
  subtotal?: number | null;
  vatAmount?: number | null;
  grandTotal?: number | null;
  currency?: string | null;
  notes?: string | null;
  tariffId?: string | null;
  paymentPlan?: any;
  channel?: string | null;
  campaignId?: string | null;
  campaign?: Campaign | null;
  items: TreatmentItem[];
  invoices: any[];
  createdAt: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  serviceId?: string | null;
  tariffItemId?: string | null;
  code?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  discount: number;
  total: number;
  currency: string;
};

export type Invoice = {
  id: string;
  planId: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  invoiceType?: string | null;
  amount: number;
  paidAmount: number;
  subtotal?: number | null;
  vatAmount?: number | null;
  discount?: number | null;
  grandTotal?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
  description?: string | null;
  status: InvoiceStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  items?: InvoiceItem[];
};

export type Tariff = {
  id: string;
  name: string;
  year?: number | null;
  type: 'TDB' | 'CUSTOM';
  sourceKey?: string | null;
  effectiveDate?: string | null;
  isActive: boolean;
  items?: TariffItem[];
};

export type TariffItem = {
  id: string;
  tariffId: string;
  code: string;
  name: string;
  categoryNo?: number | null;
  categoryName?: string | null;
  priceExclVat: number;
  priceInclVat: number;
  vatRate: number;
  isActive: boolean;
};

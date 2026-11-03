export const APP_NAME = 'Saatçi CRM';
export const CLINIC_NAME = 'Saatçi Diş Kliniği';
export const STORAGE_KEYS = {
  token: 'saatci_token',
  user: 'saatci_user',
  tutorialDismissed: 'saatci_tutorial_dismissed',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  CALL_CENTER: '/call-center',
  SALES: '/sales',
  DENTIST: '/dentist',
  BANKO: '/banko',
  ADMIN: '/admin',
  PATIENTS: '/patients',
  APPOINTMENTS: '/appointments',
  LEADS: '/leads',
  TREATMENT: '/treatment',
  INVOICES: '/invoices',
  COLLECTIONS: '/collections',
  USERS: '/users',
  VISITS: '/visits',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  INTEGRATIONS: '/integrations',
  TUTORIAL: '/tutorial',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS_OF_SERVICE: '/terms-of-service',
  USER_DATA_DELETION: '/user-data-deletion',
} as const;

export const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  DENTIST: '/dentist',
  CALL_CENTER: '/call-center',
  SALES: '/sales',
  BANKO: '/banko',
};

export const ROLE_DASHBOARD = ROLE_HOME;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  DENTIST: 'Doktor',
  CALL_CENTER: 'Çağrı Merkezi',
  SALES: 'Sağlık Danışmanı',
  BANKO: 'Banko',
};

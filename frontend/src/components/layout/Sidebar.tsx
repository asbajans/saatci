import React from 'react';
import { useAppStore } from '../../store/appStore';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../lib/constants';

type NavItem = { label: string; path: string; icon: string };

const common: Record<string, NavItem[]> = {
  ADMIN: [
    { label: 'Genel Bakış', path: ROUTES.DASHBOARD, icon: '📊' },
    { label: 'Hastalar', path: ROUTES.PATIENTS, icon: '👥' },
    { label: 'Randevular', path: ROUTES.APPOINTMENTS, icon: '📅' },
    { label: 'Gelişler', path: ROUTES.VISITS, icon: '🪪' },
    { label: 'Leadler', path: ROUTES.LEADS, icon: '📞' },
    { label: 'Tedavi Planları', path: ROUTES.TREATMENT, icon: '📋' },
    { label: 'Faturalar', path: ROUTES.INVOICES, icon: '💳' },
    { label: 'Tahsilat / Kasa', path: ROUTES.COLLECTIONS, icon: '💰' },
    { label: 'Raporlar', path: ROUTES.REPORTS, icon: '📈' },
    { label: 'Entegrasyon & Kampanya', path: ROUTES.INTEGRATIONS, icon: '🎯' },
    { label: 'Eğitici', path: ROUTES.TUTORIAL, icon: '🎓' },
    { label: 'Ayarlar', path: ROUTES.SETTINGS, icon: '⚙️' },
  ],
  CALL_CENTER: [
    { label: 'Genel Bakış', path: ROUTES.DASHBOARD, icon: '📊' },
    { label: 'Hastalar', path: ROUTES.PATIENTS, icon: '👥' },
    { label: 'Randevular', path: ROUTES.APPOINTMENTS, icon: '📅' },
    { label: 'Gelişler', path: ROUTES.VISITS, icon: '🪪' },
    { label: 'Leadler', path: ROUTES.LEADS, icon: '📞' },
    { label: 'Eğitici', path: ROUTES.TUTORIAL, icon: '🎓' },
  ],
  SALES: [
    { label: 'Genel Bakış', path: ROUTES.DASHBOARD, icon: '📊' },
    { label: 'Hastalar', path: ROUTES.PATIENTS, icon: '👥' },
    { label: 'Randevular', path: ROUTES.APPOINTMENTS, icon: '📅' },
    { label: 'Gelişler', path: ROUTES.VISITS, icon: '🪪' },
    { label: 'Leadler', path: ROUTES.LEADS, icon: '📞' },
    { label: 'Tedavi Planları', path: ROUTES.TREATMENT, icon: '📋' },
    { label: 'Eğitici', path: ROUTES.TUTORIAL, icon: '🎓' },
  ],
  DENTIST: [
    { label: 'Genel Bakış', path: ROUTES.DASHBOARD, icon: '📊' },
    { label: 'Hastalar', path: ROUTES.PATIENTS, icon: '👥' },
    { label: 'Randevular', path: ROUTES.APPOINTMENTS, icon: '📅' },
    { label: 'Gelişler', path: ROUTES.VISITS, icon: '🪪' },
    { label: 'Tedavi Planları', path: ROUTES.TREATMENT, icon: '📋' },
    { label: 'Eğitici', path: ROUTES.TUTORIAL, icon: '🎓' },
  ],
  BANKO: [
    { label: 'Genel Bakış', path: ROUTES.DASHBOARD, icon: '📊' },
    { label: 'Hastalar', path: ROUTES.PATIENTS, icon: '👥' },
    { label: 'Randevular', path: ROUTES.APPOINTMENTS, icon: '📅' },
    { label: 'Gelişler', path: ROUTES.VISITS, icon: '🪪' },
    { label: 'Faturalar', path: ROUTES.INVOICES, icon: '💳' },
    { label: 'Tahsilat / Kasa', path: ROUTES.COLLECTIONS, icon: '💰' },
    { label: 'Eğitici', path: ROUTES.TUTORIAL, icon: '🎓' },
  ],
};

export const Sidebar: React.FC<{ user: any; open?: boolean; onClose?: () => void }> = ({ user, open, onClose }) => {
  const { logout } = useAppStore();
  const navigate = useNavigate();

  const routes = common[user.role] || common.ADMIN;

  const content = (
    <>
      <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-center">
        <img src="/saatci-logo.svg" alt="Saatçi Diş Kliniği" className="h-12 w-auto" />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {routes.map((r) => (
          <NavLink
            key={r.path}
            to={r.path}
            end={r.path === '/'}
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <span className="text-lg">{r.icon}</span>
            {r.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={() => {
            logout();
            navigate(ROUTES.LOGIN);
          }}
          className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          🚪 Çıkış Yap
        </button>
      </div>
    </>
  );

  const desktop = (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-white border-r border-slate-200 min-h-[calc(100vh-60px)]">
      {content}
    </aside>
  );

  const mobile = open ? (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => onClose?.()} />
      <aside className="absolute inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        {content}
      </aside>
    </div>
  ) : null;

  return (
    <>
      {desktop}
      {mobile}
    </>
  );
};

export default Sidebar;


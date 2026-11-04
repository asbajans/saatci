import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store/appStore';
import { ROUTES, STORAGE_KEYS } from '../../lib/constants';
import { ROLE_LABEL, dateTime } from '../../lib/format';
import { api } from '../../lib/api';
import { playDing } from '../../lib/ding';
import { Link, useNavigate } from 'react-router-dom';

type LeadReminder = {
  id: string;
  name: string;
  phone: string;
  callbackAt: string;
  callbackNote?: string | null;
  campaign?: { id: string; name: string } | null;
};

type ReminderData = {
  due: LeadReminder[];
  upcoming: LeadReminder[];
};

const ReminderRow: React.FC<{ reminder: LeadReminder; overdue?: boolean; onOpen: () => void }> = ({
  reminder,
  overdue,
  onOpen,
}) => (
  <button type="button" onClick={onOpen} className="w-full text-left px-4 py-3 hover:bg-slate-50 transition">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-sm text-slate-900 truncate">{reminder.name}</p>
        <p className="text-xs text-slate-500">
          {reminder.phone}
          {reminder.campaign?.name ? ` · ${reminder.campaign.name}` : ''}
        </p>
        {reminder.callbackNote && <p className="text-xs text-slate-400 mt-0.5 truncate">{reminder.callbackNote}</p>}
      </div>
      <div className="text-right shrink-0">
        <span
          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
            overdue ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700'
          }`}
        >
          {overdue ? 'Aranacak' : 'Sırada'}
        </span>
        <p className="text-[11px] text-slate-500 mt-1">{dateTime(reminder.callbackAt)}</p>
      </div>
    </div>
  </button>
);

export const TopBar: React.FC<{ user: any; onMenuClick?: () => void }> = ({ user, onMenuClick }) => {
  const { logout } = useAppStore();
  const navigate = useNavigate();
  const [bellOpen, setBellOpen] = useState(false);
  const [toast, setToast] = useState<LeadReminder | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const canSeeReminders = ['ADMIN', 'CALL_CENTER', 'SALES'].includes(user?.role || '');

  const { data: reminders } = useQuery({
    queryKey: ['lead-reminders'],
    queryFn: async () => (await api.get('/leads/reminders')).data.data as ReminderData,
    enabled: canSeeReminders,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const due = reminders?.due ?? [];
  const upcoming = reminders?.upcoming ?? [];

  useEffect(() => {
    if (!canSeeReminders || !reminders || reminders.due.length === 0) return;

    let seen: Record<string, number> = {};
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.seenLeadReminders) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        seen = stored as Record<string, number>;
      }
    } catch (_e) {
      seen = {};
    }

    const fresh = reminders.due.filter((item) => !seen[`${item.id}:${item.callbackAt}`]);
    if (fresh.length === 0) return;

    playDing();
    setToast(fresh[0]);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const next: Record<string, number> = {};
    Object.entries(seen).forEach(([key, value]) => {
      if (value > cutoff) next[key] = value;
    });
    fresh.forEach((item) => {
      next[`${item.id}:${item.callbackAt}`] = Date.now();
    });
    localStorage.setItem(STORAGE_KEYS.seenLeadReminders, JSON.stringify(next));
  }, [reminders, canSeeReminders]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 20000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const openLeads = () => {
    setBellOpen(false);
    setToast(null);
    navigate(ROUTES.LEADS);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Menü"
            >
              <span className="text-2xl leading-none">☰</span>
            </button>
            <img src="/saatci-logo.svg" alt="Saatçi Diş Kliniği" className="h-9 w-auto md:hidden" />
          </div>
          <div className="flex items-center gap-4">
            {canSeeReminders && (
              <div ref={bellRef} className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((open) => !open)}
                  className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Arama hatırlatmaları"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {due.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {due.length > 99 ? '99+' : due.length}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="fixed left-4 right-4 top-[72px] w-auto sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">Arama Hatırlatmaları</span>
                      <span className="text-xs text-slate-500">{due.length} bekleyen</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {due.length === 0 && upcoming.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-400 text-center">Planlanmış arama yok.</p>
                      ) : (
                        <>
                          {due.map((item) => (
                            <ReminderRow key={`due-${item.id}`} reminder={item} overdue onOpen={openLeads} />
                          ))}
                          {upcoming.map((item) => (
                            <ReminderRow key={`upcoming-${item.id}`} reminder={item} onOpen={openLeads} />
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Link
              to={ROUTES.TUTORIAL}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              🎓 Eğitici
            </Link>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium">{user?.name}</span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                {ROLE_LABEL[user?.role] || user?.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed right-4 top-20 z-40 w-[calc(100vw-2rem)] max-w-sm bg-white border-l-4 border-violet-500 rounded-xl shadow-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-violet-600 font-bold">Arama Hatırlatması</p>
              <p className="font-semibold text-slate-900 mt-1">{toast.name}</p>
              <p className="text-sm text-slate-600">{toast.phone}</p>
              <p className="text-xs text-slate-500 mt-1">{dateTime(toast.callbackAt)}</p>
              {toast.callbackNote && <p className="text-xs text-slate-400 mt-1">{toast.callbackNote}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={openLeads}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700"
            >
              Leadlere Git
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;

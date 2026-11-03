import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, STORAGE_KEYS } from '../../lib/constants';

export const TutorialBanner: React.FC = () => {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEYS.tutorialDismissed) !== '1');

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEYS.tutorialDismissed, '1');
    setVisible(false);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          ?
        </span>
        <div>
          <p className="text-sm font-semibold text-blue-900">Sistemi ilk kez mi kullanıyorsunuz?</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Hasta yolculuğu, lead durumları, kampanya takibi ve entegrasyon kurulumunu adım adım öğrenin.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={ROUTES.TUTORIAL}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Eğiticiyi Aç
        </Link>
        <button
          onClick={dismiss}
          aria-label="Eğitici bildirimini kapat"
          className="rounded-lg px-2 py-1 text-lg leading-none text-blue-500 hover:bg-blue-100"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default TutorialBanner;

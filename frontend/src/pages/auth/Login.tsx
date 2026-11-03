import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';
import { APP_NAME, CLINIC_NAME, ROLE_HOME, STORAGE_KEYS } from '../../lib/constants';
import { apiError } from '../../lib/format';

type SetupState = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [setupForm, setSetupForm] = useState<SetupState>({ name: '', email: '', password: '', confirm: '' });

  useEffect(() => {
    let mounted = true;
    api
      .get('/auth/setup-status')
      .then((res) => {
        if (!mounted) return;
        setMode(res.data.data.needsSetup ? 'setup' : 'login');
      })
      .catch(() => {
        if (mounted) setMode('login');
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = (user: any, token: string) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    setUser(user, token);
    navigate(ROLE_HOME[user.role] || '/');
  };

  const onLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', loginForm);
      persistSession(res.data.data.user, res.data.data.token);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (setupForm.password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır');
      return;
    }
    if (setupForm.password !== setupForm.confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/setup', {
        name: setupForm.name,
        email: setupForm.email,
        password: setupForm.password,
      });
      persistSession(res.data.data.user, res.data.data.token);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="hidden lg:flex flex-col justify-between rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-10 text-white shadow-xl">
          <div>
            <img src="/saatci-logo-light.svg" alt={CLINIC_NAME} className="h-12 w-auto mb-8" />
            <h1 className="text-3xl font-bold leading-tight">
              {CLINIC_NAME}
              <span className="block text-blue-200 text-lg font-medium mt-2">Hasta yolculuğunun tamamı tek panelde</span>
            </h1>
            <p className="mt-6 text-slate-300 text-sm leading-relaxed">
              Lead intake, ön muayene, tedavi planı, ödeme, doktor ve raporlama süreçlerini tek bir yerden
              yönetin. Reklam kampanyalarınız, web formlarınız ve dönüşüm olaylarınız hasta kayıtlarıyla
              otomatik eşleşir.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            {[
              'Çağrı merkezi lead ve randevu yönetimi',
              'Satışçı ön muayene ve tedavi planı',
              'Banko ödeme, fatura ve taksit takibi',
              'Doktor tıbbi kart ve tedavi uygulama',
              'Meta / Google / TikTok dönüşüm takibi',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-200 text-xs">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-8">
            İlk girişte yönetici hesabı oluşturulur. Demo hesap veya hazır hasta verisi yoktur.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col justify-center">
          <div className="mb-6 text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-4">
              <img src="/saatci-logo.svg" alt={CLINIC_NAME} className="h-11 w-auto" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              {mode === 'setup' ? 'İlk kurulum' : APP_NAME}
            </p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              {mode === 'setup' ? 'Yönetici hesabınızı oluşturun' : 'Panele giriş yapın'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {mode === 'setup'
                ? 'Kurulum yalnızca bir kez yapılır. Oluşturulan hesap yönetici yetkisiyle açılır.'
                : 'Klinik ekibiniz için tanımlanmış e-posta ve şifrenizle giriş yapın.'}
            </p>
          </div>

          {checking ? (
            <p className="text-sm text-slate-500 text-center py-8">Sistem durumu kontrol ediliyor...</p>
          ) : mode === 'setup' ? (
            <form onSubmit={onSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                <input
                  value={setupForm.name}
                  onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Örn: Ayşe Yılmaz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                <input
                  type="email"
                  value={setupForm.email}
                  onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="yonetici@klinik.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                  <input
                    type="password"
                    value={setupForm.password}
                    onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="En az 8 karakter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şifre tekrar</label>
                  <input
                    type="password"
                    value={setupForm.confirm}
                    onChange={(e) => setSetupForm({ ...setupForm, confirm: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Şifreyi tekrar girin"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? 'Kurulum yapılıyor...' : 'Kurulumu Tamamla'}
              </button>
            </form>
          ) : (
            <form onSubmit={onLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="E-posta adresiniz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-slate-400">
            {APP_NAME} · {CLINIC_NAME}
          </div>
        </div>
      </div>
    </div>
  );
};

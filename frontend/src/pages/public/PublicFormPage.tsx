import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { apiError } from '../../lib/format';
import { CLINIC_NAME } from '../../lib/constants';

type FormField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

type PublicForm = {
  name: string;
  source: string;
  successMessage?: string | null;
  redirectUrl?: string | null;
  fields: FormField[];
  campaign?: { id: string; name: string } | null;
  tracking?: {
    metaPixelId?: string;
    ga4MeasurementId?: string;
    tiktokPixelId?: string;
  };
};

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function queryParams() {
  const params = new URLSearchParams(window.location.search);
  const read = (key: string) => params.get(key) || undefined;
  return {
    utmSource: read('utm_source'),
    utmMedium: read('utm_medium'),
    utmCampaign: read('utm_campaign'),
    utmTerm: read('utm_term'),
    utmContent: read('utm_content'),
    fbclid: read('fbclid'),
    gclid: read('gclid'),
    ttclid: read('ttclid'),
    landingPage: window.location.href,
    referrer: document.referrer || undefined,
  };
}

export const PublicFormPage: React.FC = () => {
  const { token } = useParams();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; redirectUrl?: string | null } | null>(null);

  const attribution = useMemo(queryParams, []);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    api
      .get(`/public/forms/${token}`)
      .then((res) => {
        if (!mounted) return;
        const data = res.data.data as PublicForm;
        setForm(data);
        const initial: Record<string, string> = {};
        for (const field of data.fields || []) initial[field.key] = '';
        setValues(initial);
      })
      .catch((err) => {
        if (mounted) setError(apiError(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!form?.tracking) return;
    const { metaPixelId, ga4MeasurementId, tiktokPixelId } = form.tracking;

    if (metaPixelId) {
      const w = window as any;
      if (!w.fbq) {
        w.fbq = function (...args: unknown[]) {
          w.fbq.callMethod ? w.fbq.callMethod(...args) : w.fbq.queue.push(args);
        };
        w.fbq.queue = [];
        w.fbq.loaded = true;
        w.fbq.version = '2.0';
        loadScript('saatci-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
      }
      w.fbq('init', metaPixelId);
      w.fbq('track', 'PageView');
    }

    if (ga4MeasurementId) {
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.gtag = (...args: unknown[]) => {
        w.dataLayer.push(args);
      };
      w.gtag('js', new Date());
      w.gtag('config', ga4MeasurementId);
      loadScript('saatci-ga4', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`);
    }

    if (tiktokPixelId) {
      const w = window as any;
      if (!w.ttq) {
        w.TiktokAnalyticsObject = 'ttq';
        const ttq: any = (w.ttq = w.ttq || []);
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = (target: any, method: string) => {
          target[method] = (...args: unknown[]) => target.push([method, ...args]);
        };
        for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
        ttq.load = (id: string) => ttq.push(['load', id]);
        ttq.page = () => ttq.push(['page']);
        ttq.track = (...args: unknown[]) => ttq.push(['track', ...args]);
        ttq.instance = () => ttq;
        loadScript('saatci-tiktok', 'https://analytics.tiktok.com/i18n/pixel/events.js');
      }
      w.ttq.load(tiktokPixelId);
      w.ttq.page();
    }
  }, [form?.tracking]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      const payload: Record<string, unknown> = { ...values, ...attribution, _hp: honeypot };
      const res = await api.post(`/public/forms/${token}`, payload);
      const data = res.data;

      const w = window as any;
      if (w.fbq) w.fbq('track', 'Lead');
      if (w.gtag) w.gtag('event', 'generate_lead');
      if (w.ttq) w.ttq.track('SubmitForm');

      setSuccess({
        message: data.message || 'Başvurunuz alındı. En kısa sürede sizinle iletişime geçeceğiz.',
        redirectUrl: data.redirectUrl,
      });
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1200);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="mx-auto max-w-xl">
        <div className="flex justify-center mb-6">
          <img src="/saatci-logo.svg" alt={CLINIC_NAME} className="h-12 w-auto" />
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm text-center text-slate-500">
            Form yükleniyor...
          </div>
        ) : error && !form ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
            <p className="text-lg font-semibold text-slate-900">Form kullanılamıyor</p>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
          </div>
        ) : success ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Teşekkürler</h1>
            <p className="mt-2 text-sm text-slate-600">{success.message}</p>
            {success.redirectUrl && (
              <a
                href={success.redirectUrl}
                className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Devam et
              </a>
            )}
          </div>
        ) : form ? (
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">{form.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Bilgilerinizi bırakın, {CLINIC_NAME} ekibi size ulaşsın.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {(form.fields || []).map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      required={field.required}
                      placeholder={field.placeholder}
                      rows={4}
                      className={inputClass}
                    />
                  ) : field.type === 'select' && field.options?.length ? (
                    <select
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      required={field.required}
                      className={inputClass}
                    >
                      <option value="">Seçiniz</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      required={field.required}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </div>
              ))}

              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sending ? 'Gönderiliyor...' : 'Bilgilerimi Gönder'}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-400">
              Bilgileriniz yalnızca randevu ve iletişim amacıyla kullanılır.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PublicFormPage;

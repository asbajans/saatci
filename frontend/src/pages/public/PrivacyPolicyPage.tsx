import React from 'react';
import { CLINIC_NAME } from '../../lib/constants';

const PageLayout = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-center mb-8">
        <img src="/saatci-logo.svg" alt={CLINIC_NAME} className="h-10 w-auto" />
      </div>
      <article className="rounded-2xl bg-white p-8 sm:p-12 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{title}</h1>
        <div className="prose prose-slate max-w-none">{children}</div>
        <p className="mt-8 text-xs text-slate-500">
          © {new Date().getFullYear()} {CLINIC_NAME}. Tüm hakları saklıdır.
        </p>
      </article>
    </div>
  </div>
);

export const PrivacyPolicyPage: React.FC = () => (
  <PageLayout title="Gizlilik İlkesi">
    <p>
      {CLINIC_NAME} olarak kişisel verilerinizin gizliliğini saygı duyarız. Bu gizlilik ilkesi, web
      sitemiz üzerinden toplanan verilerin nasıl işlendiğini açıklar.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">1. Toplanan Veriler</h2>
    <p>
      İletişim formları, web formları, çağrı merkezi ve Meta Lead Ads, Messenger, Instagram DM ve
      WhatsApp kanalları üzerinden ad, soyad, telefon numarası, e-posta adresi ve kamanya kaynağı
      gibi iletişim ve rekamsal kaynak verileri toplanabilir.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">2. Verilerin Kullanım Amacı</h2>
    <p>
      Toplanan veriler yalnızca randevu alma, kliniğinizle iletişim kurma, teklif sunma ve hizmet
      sunumu amaçlı kullanılır. Reklam performansını ölçmek için Meta Pixel, Conversions API, GA4 ve
      TikTok Pixel gibi analiz araçları kullanılabilir.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">3. Veri Paylaşımı</h2>
    <p>
      Kişisel verileriniz üçüncü taraflarla paylaşılmaz. Sadece CRM altyapısına erişebilen yetkili
      klinik personeli bu verilere ulaşabilir.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">4. Veri Saklama</h2>
    <p>
      Veriler, hizmet sunumu ve yasal yükümlülükler çerçevesinde gerekli süre kadar saklanır.
      İsteğiniz üzerine veri silinmesi talebinde bulunabilirsiniz.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">5. İletişim</h2>
    <p>
      Gizlilik ilkesi ile ilgili talepleriniz için {CLINIC_NAME} destek ekibiyle iletişime
      geçebilirsiniz.
    </p>
  </PageLayout>
);

export default PrivacyPolicyPage;

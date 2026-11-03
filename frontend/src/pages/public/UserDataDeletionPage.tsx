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

export const UserDataDeletionPage: React.FC = () => (
  <PageLayout title="Kullanıcı Veri Silme Talimatları">
    <p>
      {CLINIC_NAME} CRM sisteminde kayıtlı kişisel verilerinizin silinmesini talep edebilirsiniz.
    </p>

    <h2 className="mt-6 text-lg font-semibold text-slate-900">1. Silinebilecek Veriler</h2>
    <p>
      İletişim formu üzerinden gönderdiğiniz ad, soyad, telefon numarası, e-posta adresi,
      kampanya kaynağı ve ilgili destek notları gibi veriler silinir. Tıbbi kayıtlar ve muhasebe
      belgeleri yasal saklama süresi boyunca tutulabilir.
    </p>

    <h2 className="mt-6 text-lg font-semibold text-slate-900">2. Talep Nasıl Gönderilir?</h2>
    <p>
      Veri silme talebiniz için aşağıdaki bilgilerle {CLINIC_NAME} desteğiyle iletişime
      geçebilirsiniz:
    </p>
    <ul className="list-disc list-inside mt-2 text-slate-700">
      <li>Adınız ve soyadınız</li>
      <li>Kayıtlı telefon numaranız veya e-posta adresiniz</li>
      <li>Silinmesini istediğiniz verilerin açıklaması</li>
    </ul>

    <h2 className="mt-6 text-lg font-semibold text-slate-900">3. İşlem Süresi</h2>
    <p>
      Talebiniz alındığı güne ait iş günleri içinde değerlendirilir ve onaylanan veriler
      en geç 30 gün içinde silinir.
    </p>

    <h2 className="mt-6 text-lg font-semibold text-slate-900">4. İletişim</h2>
    <p>
      Veri silme talebiniz için clinic destek ekibine ulaşabilirsiniz.
    </p>
  </PageLayout>
);

export default UserDataDeletionPage;

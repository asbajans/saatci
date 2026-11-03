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

export const TermsOfServicePage: React.FC = () => (
  <PageLayout title="Hizmet Kullanım Şartları">
    <p>
      {CLINIC_NAME} CRM sistemini kullanarak aşağıdaki şartları kabul etmiş sayılırsınız.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">1. Kabul</h2>
    <p>
      Web sitemiz ve CRM sistemini kullanarak bu şartları, gizlilik ilkesini ve tüm ilgili yasal
      düzenlemeleri kabul etmiş sayılırsınız.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">2. Kullanım Koşulları</h2>
    <p>
      Sistem yalnızca randevu, hasta takip ve rekamsal işlemler için kullanılabilir. Yasal olmayan
      veya sistemin işleyişini bozabilecek her türlü kullanım yasaktır.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">3. Kullanıcı Sorumluluğu</h2>
    <p>
      Hesap bilgilerinizin gizliliği sizindedir. Yetkisiz erişim durumunda hemen sistem
      yöneticisine bildirmelisiniz.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">4. Sorumluluk Sınırı</h2>
    <p>
      {CLINIC_NAME}, sistemin kesintisiz veya hatasız çalışmasını garantilemez. Sistemden doğacak
      dolaylı zararlardan sorumlu tutulamaz.
    </p>
    <h2 className="mt-6 text-lg font-semibold text-slate-900">5. Değişiklikler</h2>
    <p>
      Bu şartlar değiştirilebilir. Değişiklikler sistemde yayımlanıldığında yürürlüğe girer.
    </p>
  </PageLayout>
);

export default TermsOfServicePage;

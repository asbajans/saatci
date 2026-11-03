import React from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Badge, Card, PageHeader } from '../../components/ui';
import { ROUTES, ROLE_LABELS } from '../../lib/constants';

const journey = [
  {
    step: '1',
    title: 'Lead gelir',
    detail:
      'Meta Lead Ads, web formu, WhatsApp, Instagram DM veya manuel giriş ile potansiyel hasta sisteme düşer. Lead kaynağı ve kampanyası otomatik eşleşir.',
    owner: 'Sistem / Çağrı Merkezi',
  },
  {
    step: '2',
    title: 'Çağrı merkezi arar',
    detail:
      'Hasta bilgileri alınır, lead aranır ve görüşme sonucu CONTACTED olarak işaretlenir. İlk randevu Satış Danışmanı ile görüşme/ön muayene olarak planlanır.',
    owner: 'Çağrı Merkezi',
  },
  {
    step: '3',
    title: 'Hasta kaydı açılır',
    detail:
      'TC, doğum tarihi ve iletişim bilgileriyle hasta kaydı oluşturulur. Hasta No otomatik atanır; lead hasta kaydına bağlanır.',
    owner: 'Çağrı Merkezi / Satış',
  },
  {
    step: '4',
    title: 'Ön muayene ve tedavi planı',
    detail:
      'Satış Danışmanı hastayla görüşür, diş bazlı tedavi planı ve fiyat teklifini hazırlar. Hasta onaylarsa plan APPROVED olur ve lead TREATMENT_APPROVED aşamasına geçer.',
    owner: 'Satış Danışmanı',
  },
  {
    step: '5',
    title: 'Ödeme ve fatura',
    detail:
      'Banko ödemeyi alır, faturayı keser ve taksitleri takip eder. Tam ödeme sonrası lead SOLD olur; dönüşüm olayı kampanyaya ve reklam platformlarına gönderilir.',
    owner: 'Banko',
  },
  {
    step: '6',
    title: 'Tedavi uygulanır',
    detail:
      'Doktor tıbbi kartı, diş şemasını ve tedavi planını görür. Tedaviyi uygular, notlarını yazar ve sonraki randevu ihtiyacını belirler.',
    owner: 'Doktor',
  },
];

const statuses = [
  ['NEW', 'Yeni lead. Henüz iletişime geçilmedi.', 'amber'],
  ['CONTACTED', 'Telefonla iletişime geçildi.', 'blue'],
  ['APPOINTMENT_BOOKED', 'Randevu oluşturuldu.', 'blue'],
  ['CLINIC_VISIT', 'Hasta kliniğe geldi / hasta kaydı açıldı.', 'violet'],
  ['TREATMENT_APPROVED', 'Tedavi planı onaylandı.', 'green'],
  ['SOLD', 'Ödeme tamamlandı, satış gerçekleşti.', 'green'],
] as const;

const integrationSteps = [
  {
    title: 'Meta Pixel (tarayıcı tarafı)',
    detail:
      'Entegrasyonlar ekranından Meta Pixel ekleyin. Web formu açıldığında pixel otomatik yüklenir; form gönderiminde Lead olayı tetiklenir.',
  },
  {
    title: 'Meta Conversions API (sunucu tarafı)',
    detail:
      'Aynı Meta Pixel ID ve Access Token ile CAPI entegrasyonu ekleyin. Lead, randevu, klinik ziyareti, tedavi onayı ve satış olayları sunucudan gönderilir.',
  },
  {
    title: 'Meta Lead Ads webhook',
    detail:
      'Sayfa ID, Page Access Token ve doğrulama anahtarını tanımlayın. Webhook adresi: https://saatci.asb.web.tr/api/webhooks/meta/leadads. Gelen leadler telefon numarasıyla otomatik oluşur.',
  },
  {
    title: 'Google Ads / GA4 / TikTok',
    detail:
      'GA4 Measurement ID + API Secret, TikTok Pixel ID + Access Token, Google Ads müşteri ve dönüşüm kimliği ekleyin. Google Ads için gclid kaydı tutulur ve CSV dışa aktarımı yapılabilir.',
  },
  {
    title: 'Web formu',
    detail:
      'Site Formları sekmesinden form oluşturun. Oluşan /f/... adresini sitenize ekleyin. UTM, fbclid, gclid ve ttclid bilgileri otomatik toplanır.',
  },
];

export const TutorialPage: React.FC = () => {
  const { user } = useAppStore();
  const role = user?.role || 'ADMIN';

  const quickLinks: Record<string, { label: string; path: string }[]> = {
    ADMIN: [
      { label: 'Entegrasyon ve kampanya ayarları', path: ROUTES.INTEGRATIONS },
      { label: 'Hasta listesi', path: ROUTES.PATIENTS },
      { label: 'Raporlar', path: ROUTES.REPORTS },
    ],
    CALL_CENTER: [
      { label: 'Lead yönetimi', path: ROUTES.LEADS },
      { label: 'Randevular', path: ROUTES.APPOINTMENTS },
      { label: 'Hasta kayıtları', path: ROUTES.PATIENTS },
    ],
    SALES: [
      { label: 'Lead yönetimi', path: ROUTES.LEADS },
      { label: 'Tedavi planları', path: ROUTES.TREATMENT },
      { label: 'Randevular', path: ROUTES.APPOINTMENTS },
    ],
    DENTIST: [
      { label: 'Hasta kayıtları', path: ROUTES.PATIENTS },
      { label: 'Tedavi planları', path: ROUTES.TREATMENT },
      { label: 'Geliş kayıtları', path: ROUTES.VISITS },
    ],
    BANKO: [
      { label: 'Faturalar', path: ROUTES.INVOICES },
      { label: 'Tahsilat / Kasa', path: ROUTES.COLLECTIONS },
      { label: 'Randevular', path: ROUTES.APPOINTMENTS },
    ],
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Eğitici"
        subtitle="Saatçi CRM'i hasta yolculuğu, roller ve kampanya takibiyle adım adım öğrenin"
      />

      <Card className="p-6 bg-gradient-to-r from-slate-900 to-blue-900 text-white border-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-blue-200">Hoş geldiniz{user?.name ? `, ${user.name}` : ''}</p>
            <h2 className="text-2xl font-bold mt-1">{ROLE_LABELS[role] || role} eğitimi</h2>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl">
              Bu rehberde tüm hasta yolculuğunu, sizin rolünüzün bu yolculuktaki yerini ve reklam
              kampanyalarının dönüşümlere nasıl yansıdığını bulacaksınız.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(quickLinks[role] || quickLinks.ADMIN).map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Hasta yolculuğu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {journey.map((item) => (
            <Card key={item.step} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.detail}</p>
              <p className="mt-3 text-xs font-semibold text-blue-600">{item.owner}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Lead durumları</h2>
          <p className="text-sm text-slate-500 mt-1">
            Durum her değiştiğinde geçmiş kaydedilir ve kampanya takibine yansır.
          </p>
          <div className="mt-4 space-y-2">
            {statuses.map(([status, detail, tone]) => (
              <div key={status} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                <Badge tone={tone}>{status}</Badge>
                <p className="text-sm text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Kampanya takibi nasıl çalışır?</h2>
          <p className="text-sm text-slate-500 mt-1">
            Lead'in kaynağı, kampanyası ve dönüşüm olayları birbirine bağlıdır.
          </p>
          <ol className="mt-4 space-y-3 text-sm text-slate-600 list-decimal list-inside">
            <li>Kampanya oluştururken UTM adı, Meta reklam kimliği ve pixel bilgisini girin.</li>
            <li>Web formu veya Meta Lead Ads lead'i kampanyaya otomatik bağlar.</li>
            <li>Lead durumu değişince dönüşüm olayı oluşur (Lead, Contact, Schedule, ClinicVisit, TreatmentApproved, Purchase).</li>
            <li>Aktif entegrasyonlara olay gönderimi yapılır; hata olursa Entegrasyonlar ekranında görünür.</li>
            <li>Özet sekmesinde kampanya bazında lead, aşama ve gönderim sayıları izlenir.</li>
          </ol>
          {role === 'ADMIN' && (
            <Link
              to={ROUTES.INTEGRATIONS}
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Kampanya ve entegrasyonları aç
            </Link>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Entegrasyon kurulumu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrationSteps.map((item) => (
            <Card key={item.title} className="p-5">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.detail}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900">İlk 10 dakika kontrol listesi</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
          {[
            'Yönetici hesabıyla giriş yapın.',
            'Ayarlar bölümünden hizmetleri ve fiyatları tanımlayın.',
            'Kullanıcılar ekranından doktor, çağrı merkezi, satış ve banko hesaplarını oluşturun.',
            'Kampanyalar sekmesinden reklam kampanyalarınızı ekleyin.',
            'Meta Pixel ve Conversions API entegrasyonlarını bağlayın.',
            'Web formu oluşturup sitenize ekleyin.',
            'Test lead oluşturup durum değişikliklerini izleyin.',
            'Raporlar ve kampanya özetini kontrol edin.',
          ].map((item) => (
            <label key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900">Sık sorulanlar</h2>
        <div className="mt-4 space-y-4">
          {[
            [
              'Demo hesaplar nerede?',
              'Bu kurulumda demo hesap veya hazır hasta verisi yoktur. İlk açılışta yönetici hesabını siz oluşturursunuz.',
            ],
            [
              'Lead neden kampanyaya bağlanmadı?',
              'Lead kaynağında UTM kampanya adı yoksa veya kampanyanın UTM adı eşleşmiyorsa bağlantı kurulamaz. Kampanya kartındaki UTM adını kontrol edin.',
            ],
            [
              'Meta Lead Ads leadleri neden düşmüyor?',
              'Page Access Token, doğrulama anahtarı ve webhook aboneliği gerekir. Entegrasyon test butonu ve Gelen Olaylar sekmesi sorunu gösterir.',
            ],
            [
              'Hasta tıbbi bilgilerini kimler görebilir?',
              'Yalnızca doktor ve yönetici rolleri tıbbi kayıtları görebilir. Çağrı merkezi, satış ve banko yalnızca iletişim, randevu ve ödeme bilgilerini görür.',
            ],
          ].map(([question, answer]) => (
            <div key={question}>
              <p className="font-semibold text-slate-800">{question}</p>
              <p className="text-sm text-slate-600 mt-1">{answer}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default TutorialPage;

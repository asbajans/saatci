# Meta Entegrasyon Rehberi (Saatçi CRM)

Bu belge, Meta (Facebook / Instagram / WhatsApp) Lead Ads, Messenger, Instagram DM, WhatsApp ve Conversions API entegrasyonunun adım adım nasıl kurulacağını açıklar. Tüm değerlerin nereden alınacağı, CRM panelinin hangi alanına girileceği ve ne işe yaradığı burada toplanmıştır.

Kod tabanında varsayılan Meta Graph API sürümü **v26.0**'dır (`META_GRAPH_API_VERSION` ortam değişkeni ile değiştirilebilir). **v20.0 24 Eylül 2026'da kullanımdan kaldırıldı**; eski sürümle yapılan lead çekme ve Conversions API çağrıları başarısız olur.

---

## İçerik

1. [Gereklilikler](#gereklilikler)
2. [Adım 1: Meta Uygulaması Oluşturma](#adım-1-meta-uygulaması-oluşturma)
3. [Adım 2: Facebook Sayfa ve Sayfa Erişim Tokenı](#adım-2-facebook-sayfa-ve-sayfa-erişim-tokenı)
4. [Adım 3: Reklam Hesapı ID'si](#adım-3-reklam-hesapı-id'si)
5. [Adım 4: Meta Pixel ve Pixel ID](#adım-4-meta-pixel-ve-pixel-id)
6. [Adım 5: Conversions API Erişim Tokenı (Sistem Kullanıcısı)](#adım-5-conversions-api-erişim-tokenı-sistem-kullanıcısı)
7. [Adım 6: Webhook Callback URL ve Verify Token](#adım-6-webhook-callback-url-ve-verify-token)
8. [Adım 7: CRM Panelindeki Alanlar ve Değerler](#adım-7-crm-panelindeki-alanlar-ve-değerler)
9. [Adım 8: Entegrasyon Türleri ve Paneldeki Akış](#adım-8-entegrasyon-türleri-ve-paneldeki-akış)
10. [Adım 9: Webhook Payload ve Lead Akışı](#adım-9-webhook-payload-ve-lead-akışı)
11. [Adım 10: Conversions API Olay Akışı](#adım-10-conversions-api-olay-akışı)
12. [Adım 11: Test ve Doğrulama](#adım-11-test-doğrulama)
13. [Adım 12: Canlıya Alma, Onay ve Sınırlamalar](#adım-12-canlıya-alma-onay-ve-sınırlamalar)
14. [Sıkça Sorulanlar](#sss)

---

## Gereklilikler

- Meta Business Suite yönetici erişimine sahip bir Facebook / Instagram hesabı
- Yönetiminizde bir **Facebook Sayfası**
- Yönetiminizde bir **Meta Reklam Hesabı** (`act_...`)
- Meta **Pixel** (Events Manager'da oluşturulmuş)
- Uygulama oluşturma erişimi: [https://developers.facebook.com](https://developers.facebook.com)

---

## Adım 1: Meta Uygulaması Oluşturma

1. [https://developers.facebook.com](https://developers.facebook.com) adresine girin.
2. **My Apps > Create App** seçin.
3. "What are you building?" ekranında **Business** veya **Other** seçin.
4. Uygulama adını ve e-posta adresini girin ve oluşturun.

### Use case (kullanım amacı) seçimi

Yeni geliştirici portalında uygulama oluştururken hangi işlevleri kullanacağınızı seçmeniz istenir. CRM akışınız için aşağıdaki use case'leri işaretleyin:

- **Lead Generation / Lead Ads** — Meta Lead Ads formlarından gelen leadleri almak için
- **Messaging** — Messenger ve Instagram DM mesajlarını almak için
- **WhatsApp** — WhatsApp Cloud API mesajlarını almak için
- **Marketing API** — Kampanya, reklam ve senkronizasyon verilerini çekmek için

MCP sunucu seçmeniz **gerekmez**. CRM zaten Graph API webhook ve senkronizasyon endpointlerine sahip; MCP yalnızca bir AI asistanının Meta API üzerinden işlem yapmasını sağlar. Gereksiz use case seçmeyin, aksi takdirde Meta inceleme süreci daha kapsamlı olur.

Oluşturulduktan sonra şu değerleri not edin:

| Değer | Nereden bulunur | CRM'deki karşılığı | Ne işe yarar |
|-------|----------------|-------------------|--------------|
| **App ID** | Uygulama kontrol panelinin üst kısmı veya Settings > Basic | `META_APP_ID` | Meta uygulamasının benzersiz kimliği |
| **App Secret** | Settings > Basic > App Secret (Gizli Anahtar) | `META_APP_SECRET` | Webhook imza doğrulaması (`X-Hub-Signature-256`) |

Üretimde seçtiğiniz use case'ler için Meta'dan **App Review / Business Verification** onayı gerekebilir.

---

## Adım 2: Facebook Sayfa ve Sayfa Erişim Tokenı

Meta Lead Ads ve Conversions API için bir sayfa erişim tokenına ihtiyacınız vardır.

1. [https://business.facebook.com](https://business.facebook.com) adresine girin.
2. **Ayarlar > Sistem Kullanıcıları > Sistem kullanıcıları** bölümüne gidin.
3. Yeni bir sistem kullanıcısı oluşturun (rol: Yönetici).
4. Oluşturulan sistem kullanıcısına şu varlıkları atayın:
   - Reklam hesabı
   - Facebook Sayfası
   - Meta Pixel (Conversions API)
5. Sistem kullanıcısına erişim tokenı oluşturun ve kopyalayın. Bu değer `META_PAGE_ACCESS_TOKEN` (veya `META_ACCESS_TOKEN`) olarak CRM'ye girilir.

### Sayfayı uygulamaya abone etme (en sık atlanan adım)

Webhook doğrulaması tek başına yeterli değildir. Meta'nın lead olaylarını göndermesi için Facebook Sayfası'nın uygulamaya abone olması gerekir:

```bash
curl -X POST "https://graph.facebook.com/v26.0/{page-id}/subscribed_apps" \
  -d "subscribed_fields=leadgen,messaging" \
  -d "access_token={page-access-token}"
```

CRM panelindeki **Meta ile Bağlan** veya **Token ile Otomatik Kur** düğmeleri bu adımı sizin yerinize yapar. Elle yapıldıysa **Meta Tanılama** ekranında "sayfa uygulamaya abone" satırı yeşil olmalıdır.

> Güvenlik: Daha önce bu dosyada paylaşılan erişim tokenı kaldırılmıştır. Token git geçmişinde görünüyorsa **Meta Business Suite > Sistem Kullanıcıları** bölümünden iptal edip yenisini oluşturun. Tokenları asla dokümana veya depoya yazmayın.

Alternatif olarak, Events Manager'da **Conversions API > Erişim Jetonu Oluştur** yolunu da kullanabilirsiniz.

---

## Adım 3: Reklam Hesapı ID'si

1. [https://business.facebook.com](https://business.facebook.com) > **Reklam Hesapları** sayfasına gidin.
2. Reklam hesabınızın ID'sini kopyalayın. Şekli genellikle `1234567890123456` şeklindedir.
3. CRM'de `META_AD_ACCOUNT_ID` alanına `act_` ön ekiyle veya öneksiz girin; CRM otomatik normalize eder.

Örnek: `act_1234567890123456` veya `1234567890123456`

Bu değer, Meta'dan kampanya ve lead senkronizasyonu yapılırken hangi reklam hesabının kullanılacağını belirtir.

---

## Adım 4: Meta Pixel ve Pixel ID

1. [https://www.facebook.com/events_manager](https://www.facebook.com/events_manager) adresine girin.
2. Bir **Web events** pixel oluşturun veya mevcut olanı seçin.
3. Pikselin **Ayarlar** sayfasında **Piksel ID** değerini kopyalayın.

| Değer | CRM'deki karşılığı | Ne işe yarar |
|-------|-------------------|--------------|
| Pixel ID | `META_CAPI` > `Pixel ID` ve `META_PIXEL` > `Pixel ID` | Web sayfalarında pixel çalışması ve Conversions API olaylarının hangi piksele ait olduğu |

---

## Adım 5: Conversions API Erişim Tokenı (Sistem Kullanıcısı)

Conversions API çağrıları için erişim tokenı gerekir. Önerilen yöntem **Sistem Kullanıcısı (System User)** tokenıdır.

1. [https://business.facebook.com](https://business.facebook.com) > **Ayarlar > Sistem Kullanıcıları > Hesap Varlıkları** seçin.
2. Yeni sistem kullanıcısı oluşturun.
3. İlgili varlıkları atayın:
   - **Reklam Hesabı**
   - **Facebook Sayfası**
   - **Pixel**
4. Sistem kullanıcısına erişim tokenı oluşturun.
5. Token'ı kopyalayın ve CRM'deki **Meta Conversions API** entegrasyonunda **Access Token** alanına yapıştırın.

> Bu token uzun süreli olmalıdır. Token süresi dolarsa Conversions API olayları gönderilmez.

---

## Adım 6: Webhook Callback URL ve Verify Token

Meta'dan gelen gerçek zamanlı lead ve mesaj olaylarını CRM'e almak için webhook kurmalısınız. Güncel önerilen yöntem, **tek bir genel callback** kullanmaktır:

| Webhook Türü | URL |
|-------------|-----|
| Genel (Page / Instagram / WhatsApp) | `https://saatci.asb.web.tr/api/webhooks/meta` |
| Meta Lead Ads (eski/özel) | `https://saatci.asb.web.tr/api/webhooks/meta/leadads` |
| Facebook Messenger | `https://saatci.asb.web.tr/api/webhooks/meta/messenger` |
| Instagram DM | `https://saatci.asb.web.tr/api/webhooks/meta/instagram` |
| WhatsApp Cloud API | `https://saatci.asb.web.tr/api/webhooks/whatsapp` |

### Uygulamada Webhook Ekleme

1. [https://developers.facebook.com](https://developers.facebook.com) > Uygulamanız > **Webhooks** bölümüne gidin.
2. **Page** objesini seçin ve `leadgen` ile `messaging` alanlarına abone olun.
3. **Callback URL** alanına `https://saatci.asb.web.tr/api/webhooks/meta` yazın.
4. **Verify Token** alanına `META_VERIFY_TOKEN` değerini yazın.
5. Kaydedin ve aboneliği onaylayın.
6. **Sayfayı uygulamaya abone edin** (yukarıdaki `subscribed_apps` adımı). Bu yapılmazsa doğrulama başarılı olsa bile hiçbir lead webhook'u gelmez.

> Webhook imza doğrulaması `META_APP_SECRET` tanımlıysa `X-Hub-Signature-256` ile yapılır. `META_APP_SECRET` yanlışsa Meta istekleri 403 alır ve hiçbir olay işlenmez.

### Otomatik Kurulum (Önerilen)

Panelde **Entegrasyon & Kampanya > Meta Reklamlar** sekmesinde iki yöntem vardır:

- **Meta ile Bağlan**: Facebook Login for Business OAuth akışı açar. Sayfa, reklam hesabı ve pixel otomatik keşfedilir; sayfa `subscribed_apps` ile uygulamaya abone edilir ve uygulama webhook aboneliği API ile kurulur.
- **Token ile Otomatik Kur**: Elinizde sistem kullanıcı tokenı varsa sayfa/reklam hesabı/pixel keşfi, sayfa aboneliği ve webhook kaydı tek tıkla yapılır.

OAuth kullanacaksanız Meta uygulamasında **Facebook Login for Business** ürününü ekleyip **Valid OAuth Redirect URIs** alanına panelde gösterilen adresi yazın. Gerekli izinler: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `leads_retrieval`, `ads_read`, `business_management`.

### Arka Plan Senkronizasyonu

Webhook'lar sessizce kaybolabilir. CRM, `META_SYNC_INTERVAL_MINUTES` (varsayılan 5 dakika) aralığıyla `/{page-id}/leadgen_forms` → `/{form-id}/leads` uçlarını kullanarak lead'leri ayrıca çeker. Böylece webhook çalışmasa bile lead'ler CRM'e düşer. Meta lead verilerini yalnızca **90 gün** sakladığı için bu yedek senkronizasyon önemlidir.

---

## Adım 7: CRM Panelindeki Alanlar ve Değerler

Yönetici panelinde **Entegrasyon & Kampanya > Entegrasyonlar** ekranından yeni entegrasyon ekleyin. Aşağıdaki tablo, hangi entegrasyon türünün hangi alanları istediğini gösterir.

| Entegrasyon Türü | Gerekli Alan | Nereden Alınır | Ne İşe Yazar |
|-----------------|-------------|---------------|--------------|
| **Meta Pixel (Web)** | Pixel ID | Events Manager > Piksel Ayarları | Web formu sayfasında Meta Pixel yükleme ve `PageView` olayı |
| **Meta Conversions API** | Pixel ID, Access Token, Test Event Code | Events Manager > Conversions API > Erişim Jetonu | Sunucudan Lead, Contact, Schedule, ClinicVisit, TreatmentApproved, Purchase olaylarını Meta'ye gönderme |
| **Meta Lead Ads** | Facebook Sayfa ID, Reklam Hesabı ID (opsiyonel), Page Access Token, Verify Token, Varsayılan Kampanya | Business Suite > Sayfa > Erişim Tokenı | Meta Lead Ads formlarından gelen leadleri gerçek zamanlı CRM'e çekme |
| **Facebook Messenger** | Sayfa ID, Page Access Token, Verify Token | Business Suite > Messenger > Webhook | Messenger DM'den telefon numarası varsa lead oluşturma |
| **Instagram DM** | Hesap ID, Access Token, Verify Token | Business Suite > Instagram > Webhook | Instagram DM'den telefon numarası varsa lead oluşturma |
| **WhatsApp Cloud API** | Phone Number ID, WABA ID, Access Token, Verify Token | Meta Business Suite > WhatsApp > Kurulum | WhatsApp mesajından lead oluşturma |
| **Google Ads** | Müşteri ID, Dönüşüm Aksiyonu ID, Webhook URL | Google Ads > Dönüşümler | Google Ads gclid takibi ve CSV dışa aktarma |
| **GA4** | Measurement ID, API Secret | Google Analytics 4 > Veri Akışları | Web formunda GA4 olayı |
| **TikTok Pixel** | Pixel ID, Access Token | TikTok Events Manager | Web formunda TikTok olayı |
| **Özel Webhook** | Webhook URL, X-Webhook-Secret | Kendi sunucunuz | Özel sisteme olay gönderme |

### Önemli Notlar

- `Page Access Token` ve `Access Token` alanları panelde `••••••••` olarak maskelenir. Düzenleme sırasında alanı boş bırakırsanız eski değer korunur.
- `INTEGRATION_SECRET` veya `JWT_SECRET` tanımlıysa tüm entegrasyon config alanları AES-256-GCM ile veritabanında şifrelenir. Sunucu bu alanları okurken mutlaka şifreyi çözer; eski sürümlerdeki "şifreli değeri token sanma" hatası giderilmiştir.
- `META_AD_ACCOUNT_ID` değeri `act_` ön ekiyle veya öneksiz girilebilir; CRM her iki biçimi de normalize eder.
- Eski Graph API sürümü (v20.0) 24 Eylül 2026'da kapandığı için `META_GRAPH_API_VERSION=v26.0` olmalıdır.

---

## Adım 8: Entegrasyon Türleri ve Paneldeki Akış

1. Yönetici olarak giriş yapın.
2. **Entegrasyon & Kampanya > Meta Reklamlar** sekmesine gidin.
3. `Meta ile Bağlan` veya `Token ile Otomatik Kur` düğmesini kullanın. Bu işlem sayfa, reklam hesabı, pixel, sayfa aboneliği ve webhook kaydını otomatik yapar.
4. `Meta Tanılama` kartında tüm kritik satırların yeşil olduğunu doğrulayın.
5. `Kampanyaları Çek` ve `Leadleri Çek` düğmeleriyle mevcut verileri hemen içeri alın.
6. Webhook ve arka plan senkronizasyonu bundan sonra yeni lead'leri otomatik getirir.
7. İsterseniz **Entegrasyonlar** sekmesinden manuel kayıt da oluşturabilirsiniz; ancak otomatik kurulum önerilir.

Senkronizasyon sonrası:
- Kampanyalar **Kampanyalar** sekmesinde görünür.
- Meta Lead Ads leadleri **Leads** ekranında `Kaynak: Meta Lead Ads` olarak görünür.
- Her lead durumu değişiminde otomatik bir Conversion Event oluşturulur.

---

## Adım 9: Webhook Payload ve Lead Akışı

Meta'dan gelen webhook istekleri şu şekilde işlenir:

1. Meta Lead Ads formu doldurulduğunda Meta, webhook callback adresine (`/api/webhooks/meta`) POST gönderir.
2. CRM, imzayı `META_APP_SECRET` ile doğrular ve Meta'ya hızlıca 200 döner.
3. `leadgen_id` ile Graph API üzerinden form verilerini çeker (ad, telefon, e-posta, reklam/kampanya bilgisi).
4. Telefon numarası varsa lead `Kaynak: Meta Lead Ads` olarak CRM'de oluşturulur.
5. Aynı `leadgen_id` tekrar gelirse duplicate lead oluşturulmaz; mevcut kayıt kullanılır.
6. Messenger, Instagram DM ve WhatsApp mesajlarında metinden telefon numarası çıkarılarak lead oluşturulur; yoksa olay yalnızca **Gelen Olaylar** sekmesine kaydedilir.
7. Webhook hiç gelmezse veya Graph çağrısı başarısız olursa arka plan senkronizasyonu form lead'lerini yeniden çeker.

---

## Adım 10: Conversions API Olay Akışı

CRM'de lead durumu değiştiğinde otomatik olarak şu olaylar Meta Conversions API'ye gönderilir:

| Lead Durumu | Meta Olay Adı | custom_data |
|-------------|--------------|-------------|
| Yeni lead oluşturuldu | `Lead` | `lead_event_source: "Saatçi CRM"`, `event_source: "crm"` |
| İletişime Geçildi | `Contact` | aynı |
| Randevu Alındı | `Schedule` | aynı |
| Klinik Ziyareti | `ClinicVisit` | aynı |
| Tedavi Onaylandı | `TreatmentApproved` | aynı |
| Satıldı | `Purchase` | aynı |

Payload yapısı (kısım):

```json
{
  "data": [
    {
      "action_source": "system_generated",
      "custom_data": {
        "event_source": "crm",
        "lead_event_source": "Saatçi CRM"
      },
      "event_name": "Lead",
      "event_time": 1673035686,
      "user_data": {
        "em": ["sha256(email)"],
        "ph": ["sha256(telefon)"],
        "lead_id": "meta_leadgen_id"
      }
    }
  ]
}
```

Önemli kurallar:
- `user_data.lead_id` **Meta'nın oluşturduğu `leadgen_id`'dir** (hashlenmez, CRM içi UUID değildir).
- E-posta ve telefon **SHA-256 ile hashlenir**.
- Her lead durumu değişiminde ayrı bir olay gönderilir.
- Olaylar en az bir müşteri bilgisi (e-posta, telefon veya lead_id) içermelidir.

---

## Adım 11: Test ve Doğrulama

1. **Conversions API test olayı:**
   - Events Manager > **Test Events** sekmesine girin.
   - Test sunucu eventi için Graph API Explorer bağlantısını açın.
   - `test_event_code` değerini not edin.
   - JSON payload ile `POST` gönderin ve `fbtrace_id` ile başarıyı doğrulayın.

2. **CRM panelinden test:**
   - Panelden bir web formu oluşturun ve test lead gönderin.
   - `Entegrasyon & Kampanya > Olaylar` ekranında olayın `SENT` veya `SKIPPED` olduğunu kontrol edin.
   - `SKIPPED` olduğunda `lastError` alanında eksik token veya alan bilgisi görünür.

3. **Webhook test:**
   - Meta uygulama ayarlarından webhook aboneliğini test edin.
   - Gerçek bir Meta Lead Ads formu doldurun ve CRM'de lead'in düştüğünü onaylayın.

4. **Panel tanılaması:**
   - **Meta Reklamlar > Meta Tanılama** kartında token, sayfa aboneliği, webhook ve CAPI satırlarını kontrol edin.
   - **Olaylar > Gelen Olaylar** ekranında `META_LEAD_ADS` kayıtlarının `PROCESSED` olduğundan emin olun. `FAILED` ise hata mesajı doğrudan Graph API cevabını gösterir.

---

## Adım 12: Canlıya Alma, Onay ve Sınırlamalar

### Portainer / canlı ortam kontrolü

1. Portainer stack ortam değişkenlerine `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_API_VERSION=v26.0` ekleyin.
2. İsteğe bağlı: `META_PAGE_ID`, `META_AD_ACCOUNT_ID`, `META_SYNC_INTERVAL_MINUTES=5`, `META_OAUTH_REDIRECT_URI`.
3. `META_VERIFY_TOKEN` için tahmin edilemeyen uzun bir değer kullanın; varsayılan `saatci_verify_token_change_me` değerini bırakmayın.
4. Stack'i yeniden deploy edin ve `docker compose ps` ile backend'in sağlıklı olduğunu doğrulayın.
5. Panelde **Meta ile Bağlan** veya **Token ile Otomatik Kur** çalıştırın; ardından **Meta Tanılama** kartında tüm kritik satırların yeşil olduğunu kontrol edin.

1. Uygulama geliştirme modundaysa sadece sizin ve geliştiricileriniz lead alabilir.
2. Üretimde tüm Meta izinleri ve webhook'ları çalıştırmak için **App Review** ve **Business Verification** onayı gerekebilir.
3. Erişim tokenları süresi dolabilir; paneldeki tanılama token bitiş tarihini gösterir. Token yenilendiğinde otomatik kurulumu tekrar çalıştırın.
4. Graph API v20.0 **24 Eylül 2026'da kapandı**. Güncel sürüm v26.0'dır; `META_GRAPH_API_VERSION` ile yönetilir.
5. Meta lead verilerini yalnızca **90 gün** saklar. Bu nedenle webhook + arka plan senkronizasyonu birlikte kullanılmalıdır.
6. Günde en az bir kez, mümkünse gerçek zamanlı olarak olay gönderimi yapılması önerilir.
7. Toplu gönderimde bir batch'te en fazla 1.000 olaya izin verilir.

---

## SSS

**S: Pixel ID ve Conversions API tokenı aynı mı?**
C: Hayır. Pixel ID, olayın hangi piksele ait olduğunu belirtir. Access Token ise sunucudan Meta API'ye bağlanma iznidir.

**S: Birden fazla reklam hesabı olabilir mi?**
C: Her Meta Lead Ads entegrasyonu kendi `adAccountId` alanını taşıyabilir. Otomatik kurulum ilk hesabı seçer; farklı hesap için panelden ayrı entegrasyon ekleyin.

**S: Meta'da yeni lead oluşuyor ama CRM'e düşmüyor, nereden bakmalıyım?**
C: Sırasıyla şunları kontrol edin: (1) `META_GRAPH_API_VERSION` v26.0 mı, (2) **Meta Tanılama** kartında sayfa aboneliği ve webhook yeşil mi, (3) **Gelen Olaylar** ekranında `META_LEAD_ADS` kaydı var mı, (4) varsa hata mesajı ne diyor, (5) uygulama Development modundaysa test kullanıcısı mısınız? Webhook hiç yoksa arka plan senkronizasyonu yine de lead'i çeker; bu durumda **Leadleri Çek** düğmesiyle anında test edebilirsiniz.

**S: Otomatik entegrasyon gerçekten her şeyi yapıyor mu?**
C: Evet. `Meta ile Bağlan` veya `Token ile Otomatik Kur`; sayfa/reklam hesabı/pixel keşfi, sayfa `subscribed_apps` aboneliği, uygulama webhook kaydı ve CRM entegrasyon kayıtlarını oluşturur. Yalnızca Meta uygulamasında **Facebook Login for Business** ürünü ve geçerli redirect URI tanımlı olmalıdır.

**S: MCP sunucu gerekli mi?**
C: Hayır. CRM zaten Graph API webhook ve senkronizasyon endpointlerine sahiptir. MCP yalnızca bir AI asistanının Meta API üzerinden işlem yapmasını sağlar.

**S: Webhook URL'sini nerden kopyalayacağım?**
C: Yukarıdaki tablodaki URL'leri Meta webhook ayarlarına **Callback URL** olarak yazın. Domaininiz `https://saatci.asb.web.tr` ise URL'ler doğrudan geçerlidir.

---

> Bu belge `meta.md` olarak saklanmaktadır. Meta arayüzü değişirse adımlar küçük farklılıklar gösterebilir; temel değerler (App ID, Secret, Page Access Token, Pixel ID, Reklam Hesabı ID) sabittir.
# Saatçi CRM

Saatçi Diş Kliniği için modüler, rol tabanlı CRM. Hasta yolculuğu, randevu, tedavi planı, ödeme, doktor ekranları ve reklam/dönüşüm takibi tek panelde yönetilir.

## Öne çıkanlar

- Demo hesap veya hazır hasta verisi yoktur. İlk açılışta yönetici hesabı oluşturulur.
- Rol bazlı erişim: yönetici, doktor, çağrı merkezi, satış danışmanı ve banko.
- Hasta No ve Randevu No ayrı seri numaralarıdır.
- Meta Lead Ads, Messenger, Instagram DM ve WhatsApp webhook altyapısı.
- Meta Pixel, Meta Conversions API, GA4, TikTok Pixel, Google Ads ve özel webhook dönüşüm gönderimi.
- Web sitesi formları: `/f/:token` adresinden yayınlanır; UTM, fbclid, gclid ve ttclid otomatik toplanır.
- Kampanya bazlı lead, aşama ve dönüşüm funnel'ı.
- Entegrasyon sağlığı, gelen olaylar ve gönderim hataları panelden izlenir.

## Teknoloji

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query
- Backend: Node.js, Express, TypeScript, Prisma ORM, JWT
- Veritabanı: PostgreSQL 15
- Dağıtım: Docker Compose, Portainer, GitHub Actions, Cloudflare

## Portlar

| Hizmet | Dış port | İç port | Erişim |
|---|---:|---:|---|
| Frontend | 4110 | 80 | Genel |
| Backend API | 4111 | 3001 | Genel |
| PostgreSQL | 4112 | 5432 | Yalnızca sunucu (127.0.0.1) |
| Redis | 4113 | 6379 | Yalnızca sunucu (127.0.0.1) |
| Adminer | 4114 | 8080 | Yalnızca sunucu (127.0.0.1) |

## Yerel geliştirme

```powershell
cd backend
Copy-Item .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Frontend geliştirme sunucusu `/api` isteklerini `http://localhost:3001` adresine yönlendirir.

## İlk kurulum

1. Uygulama açıldığında `GET /api/auth/setup-status` çağrılır.
2. Kullanıcı tablosu boşsa ekranda ilk yönetici kurulum formu görünür.
3. Kurulum tamamlanınca yönetici hesabı oluşturulur ve panele giriş yapılır.
4. Sonraki girişlerde normal e-posta/şifre formu kullanılır.

İsterseniz ortam değişkenleriyle ilk yönetici otomatik oluşturulabilir:

```env
INITIAL_ADMIN_NAME="Klinik Yöneticisi"
INITIAL_ADMIN_EMAIL="yonetici@saatci.com"
INITIAL_ADMIN_PASSWORD="guclu-bir-sifre"
```

Bu üç değişken doluysa ve veritabanında kullanıcı yoksa ilk açılışta yönetici oluşturulur.

## Ortam değişkenleri

`backend/.env.example` dosyasını temel alın. Üretimde mutlaka değiştirin:

- `JWT_SECRET`: uzun ve rastgele bir değer.
- `INTEGRATION_SECRET`: entegrasyon gizli alanlarını şifrelemek için kullanılır. Boş bırakılırsa `JWT_SECRET` kullanılır.
- `POSTGRES_PASSWORD`: Docker Compose veritabanı şifresi.
- `CORS_ORIGIN` ve `PUBLIC_APP_URL`: `https://saatci.asb.web.tr`.
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`.

Entegrasyon gizli alanları (access token, API secret vb.) veritabanında AES-256-GCM ile şifrelenir ve API yanıtlarında maskelenir.

## Entegrasyon kurulumu

Yönetici panelinde **Entegrasyon & Kampanya** ekranını açın.

### Meta Pixel ve Conversions API

- `Meta Pixel (Web)`: Pixel ID yeterlidir. Web formu açıldığında pixel yüklenir, form gönderiminde `Lead` olayı tetiklenir.
- `Meta Conversions API`: Pixel ID ve Access Token girin. Lead, iletişim, randevu, klinik ziyareti, tedavi onayı ve satış olayları sunucudan gönderilir.
- Test Event Code alanı Meta test olayları için kullanılabilir.

### Meta Lead Ads

- Facebook Sayfa ID, Page Access Token ve webhook doğrulama anahtarı girin.
- Meta uygulamasında webhook adresi: `https://saatci.asb.web.tr/api/webhooks/meta/leadads`
- Doğrulama anahtarı `META_VERIFY_TOKEN` veya entegrasyon içindeki `verifyToken` ile aynı olmalıdır.
- Gelen lead `leadgen_id` ile tekrar kontrol edilir; telefon numarası bulunursa lead otomatik oluşturulur.
- Varsayılan kampanya seçilirse lead o kampanyaya bağlanır. Aksi halde reklam kimliği kampanya `externalId` alanıyla eşleştirilir.

### Messenger, Instagram DM ve WhatsApp

- Webhook adresleri:
  - `https://saatci.asb.web.tr/api/webhooks/meta/messenger`
  - `https://saatci.asb.web.tr/api/webhooks/meta/instagram`
  - `https://saatci.asb.web.tr/api/webhooks/whatsapp`
- Mesaj metninde telefon numarası bulunursa lead oluşturulur; bulunamazsa olay yalnızca Gelen Olaylar sekmesine kaydedilir.
- WhatsApp için Phone Number ID, WABA ID ve Access Token gerekir.

### Google Ads

- Müşteri ID ve dönüşüm aksiyonu ID girin.
- Webhook adresi tanımlanırsa olaylar oraya gönderilir.
- Aksi halde `gclid` bilgisi saklanır ve panelden Google Ads CSV dışa aktarımı yapılabilir.

### GA4 ve TikTok

- GA4: Measurement ID ve API Secret.
- TikTok: Pixel ID ve Access Token.

### Web formları

1. **Site Formları** sekmesinden yeni form oluşturun.
2. Form alanlarını JSON olarak düzenleyin.
3. Oluşan `/f/:token` adresini sitenize ekleyin.
4. Form gönderimleri otomatik lead olur; UTM, fbclid, gclid, ttclid, referrer ve landing page kaydedilir.
5. Formun bağlı olduğu kampanya varsa lead doğrudan o kampanyaya yazılır.

## Kampanya takibi

Kampanya oluştururken şu alanları doldurun:

- `UTM Kampanya Adı`: Lead eşleştirmesinde kullanılır.
- `Reklam / Kampanya ID`: Meta Lead Ads reklam kimliğiyle eşleşir.
- `Pixel ID`: Raporlama ve doğrulama için saklanır.

Lead durumu değiştiğinde geçmiş kaydı oluşur ve dönüşüm olayı tetiklenir:

| Lead durumu | Dönüşüm olayı | Meta olay adı |
|---|---|---|
| CONTACTED | LEAD_CONTACTED | Contact |
| APPOINTMENT_BOOKED | APPOINTMENT_BOOKED | Schedule |
| CLINIC_VISIT | CLINIC_VISIT | ClinicVisit |
| TREATMENT_APPROVED | TREATMENT_APPROVED | TreatmentApproved |
| SOLD | SALE | Purchase |

Özet sekmesinde kampanya bazında lead sayısı, aşamalar, olay sayısı ve başarılı/başarısız gönderimler görünür.

## Docker Compose ile çalıştırma

Proje kökünde `.env` oluşturun. Compose dosyası en az `POSTGRES_PASSWORD` ve `JWT_SECRET` değerlerini zorunlu tutar:

```powershell
Copy-Item .env.example .env
```

```env
POSTGRES_PASSWORD=guclu-veritabani-sifresi
JWT_SECRET=uzun-rastgele-anahtar
INTEGRATION_SECRET=baska-uzun-rastgele-anahtar
CORS_ORIGIN=https://saatci.asb.web.tr
PUBLIC_APP_URL=https://saatci.asb.web.tr
META_VERIFY_TOKEN=meta-dogrulama-anahtari
```

`POSTGRES_PASSWORD` değerinde `@`, `:`, `/`, `?` gibi URL karakterleri kullanmayın; `DATABASE_URL` bu değerden üretilir.

```powershell
docker compose up -d --build
```

PostgreSQL, Redis ve Adminer portları yalnızca sunucunun `127.0.0.1` adresine bağlanır. Uzak sunucuda Adminer'a erişmek için SSH tüneli kullanın.

Backend konteyneri açılışta `prisma migrate deploy` çalıştırır ve ardından derlenmiş Node.js sunucusunu başlatır.

## Portainer ve GitHub Actions

1. GitHub deposunu oluşturun ve bu projeyi push edin.
2. Portainer'da yeni bir stack oluşturun, repository olarak bu depoyu seçin.
3. Stack ortam değişkenlerini yukarıdaki gibi tanımlayın.
4. GitHub repository secrets:
   - `PORTAINER_URL` (örn. `https://cont.asb.web.tr`)
   - `PORTAINER_API_KEY`
   - `PORTAINER_STACK_ID`
   - `PORTAINER_ENDPOINT_ID` (varsayılan `2`)
5. `main` dalına push edildiğinde CI/CD çalışır ve Portainer stack'ini yeniden dağıtır.
6. Cloudflare'de `saatci.asb.web.tr` alan adını sunucuya yönlendirin.

## Sağlık kontrolü

- `GET /health`
- `GET /api/health`

## Notlar

- Hasta tıbbi kayıtları yalnızca doktor ve yönetici tarafından görülebilir.
- Meta Lead Ads leadleri için Page Access Token zorunludur; token yoksa olay `PENDING` olarak kaydedilir.
- Webhook imzası `META_APP_SECRET` tanımlıysa `X-Hub-Signature-256` ile doğrulanır.
- Entegrasyon API yanıtlarında gizli alanlar `••••••••` olarak maskelenir; düzenleme sırasında alanı olduğu gibi bırakmak kayıtlı değeri korur.

# Saatçi CRM — Diş Kliniği Modüler CRM

## Proje Hakkında
Saatçi CRM, Saatçi Diş Kliniği için modüler, mobil uyumlu, rol tabanlı erişimli bir CRM yazılımıdır. Portainer (Docker) üzerinde çalışır, `saatci.asb.web.tr` alan adıyla Cloudflare üzerinden yayınlanır. GitHub'dan otomatik deploy edilir. Demo hesap veya hazır hasta verisi içermez; ilk açılışta yönetici hesabı oluşturulur.

## Hasta Yolculuğu (Temel Akış)

```
1. Lead Gelişi (Kampanya / Meta Lead Ads / Web Form / WhatsApp DM / Instagram DM)
   → Çağrı Merkezi'ne düşer

2. Çağrı Merkezi
   - Hasta bilgileri telefonic alınır (ad, soyad, telefon, email, TC, doğum tarihi)
   - Hasta kaydı oluşturulur (Hasta No atanır)
   - İlk randevu: Satışçıya "Ücretsiz Ön Muayene / Görüşme" randevusu verilir
   - Randevu No atanır (Hasta No'dan bağımsız)

3. Satışçı (İlk Görüşme / Ön Muayene)
   - Hasta ile görüşülür, ücretsiz ön muayene yapılır
   - Tedavi planı çıkarılır (diş bazlı kalemler, fiyat, taksit)
   - Hasta onaylarsa → Tedavi planı "Onaylandı" durumu alır

4. Banko (Maliye / Ödeme)
   - Ödeme alınır, taksit planı oluşturulur
   - Fatura kesilir
   - Ödemeyi doğrular ve hastayı Doktora yönlendirir
   - Sonraki tedavi randevularını verir (Doktor ile)

5. Doktor
   - Hasta tıbbi kartını görür (diş şeması, alerji, kronik hastalık, ilaç, notlar)
   - Tedaviyi uygular
   - Bir sonraki tedavi randevu tarihleri belirler (Banko'ya iletir)

6. Çağrı Merkezi (İsteğe bağlı)
   - Tedavi randevusu da doğrudan verebilir
   - Randevu hatırlatmaları (SMS / E-posta / WhatsApp)
```

### Randevu Türleri
- **Görüşme / Ön Muayene**: İlk randevu, Satışçı ile, ücretsiz
- **Tedavi**: Sonraki randevular, Doktor ile, ücretli

### Hasta No ve Randevu No
- Hasta No: Hasta kaydına özel, benzersiz, sistem tarafından üretilen
- Randevu No: Randevu kaydına özel, ayrı seri, Hasta No'dan bağımsız

## Rol Bazlı Erişim ve Ekranlar

| Rol | Ekran | Yetkiler |
|-----|-------|----------|
| Çağrı Merkezi | Çağrı Merkezi Paneli | Lead girişi, hasta intake, hasta bilgisi (kısıtlı), randevu oluşturma (görüşme ve tedavi), hatırlatma çağrıları |
| Satışçı | Satışçı Paneli | Lead yönetimi, ön muayene, tedavi planı oluşturma, lead → hasta dönüşümü, satış raporu |
| Doktor | Doktor Paneli | Hasta tıbbi kartı, diş şeması, tedavi planı görüntüleme, tedavi uygulama, not yazma |
| Banko | Banko Paneli | Ödeme alma, fatura, taksit takibi, gelir raporu, tedavi randevu verme (ödeme sonrası) |
| Yönetici | Yönetici Paneli | Tüm raporlar, kullanıcı yönetimi, kampanya onayı, sistem ayarları, tüm verilere OK erişimi |

### Veri Gizliliği
- Hasta tıbbi kayıtları: Sadece Doktor ve Yönetici görür
- Çağrı Merkezi ve Satışçı: Sadece iletişim ve randevu bilgilerini görür
- Banko: Ödeme ve fatura bilgilerini görür

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Hook Form + Zod + TanStack Query |
| Backend | Node.js + Express + TypeScript + Prisma ORM + JWT + bcryptjs |
| Veritabanı | PostgreSQL 15+ |
| Container | Docker + Docker Compose + Portainer |
| CI/CD | GitHub Actions (build) → Portainer (deploy) |
| DNS/Yönlendirme | Cloudflare (sen yapıyorsun) |

## Port Dağılımı (4110–4114)

| Hizmet | Dış Port | İç Port | Açıklama |
|--------|----------|---------|----------|
| Frontend | 4110 | 80 | Kullanıcı arayüzü |
| Backend API | 4111 | 3001 | REST API |
| PostgreSQL | 4112 | 5432 | Veritabanı (yalnızca backend erişebilir) |
| Redis (opsiyonel) | 4113 | 6379 | Hatırlatma kuyruğu |
| Adminer | 4114 | 8080 | DB GUI (kısıtlanabilir) |

## Veritabanı Şeması (Prisma)

```prisma
enum UserRole { ADMIN, DENTIST, CALL_CENTER, SALES, BANKO }
enum AppointmentType { CONSULTATION, TREATMENT }
enum AppointmentStatus { PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW }
enum LeadStatus { NEW, CONTACTED, CLINIC_VISIT, TREATMENT_APPROVED, APPOINTMENT_BOOKED, SOLD }
enum TreatmentPlanStatus { DRAFT, APPROVED, IN_PROGRESS, COMPLETED }
enum InvoiceStatus { UNPAID, PARTIAL, PAID, OVERDUE }

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      UserRole
  createdAt DateTime @default(now())
}

model Patient {
  id            String   @id @default(uuid())
  hastaNo       String   @unique
  name          String
  surname       String
  tc            String   @unique
  phone         String
  email         String?
  birthDate     DateTime?
  gender        String?
  address       String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  appointments  Appointment[]
  medicalRecord MedicalRecord?
  treatmentPlans TreatmentPlan[]
  leads         Lead[]
}

model MedicalRecord {
  id           String   @id @default(uuid())
  patientId    String   @unique
  patient      Patient  @relation(fields: [patientId], references: [id])
  allergies    String?
  chronicDiseases String?
  medications  String?
  dentalChart  Json?    // diş haritası
  notes        String?
  updatedAt    DateTime @updatedAt
}

model Appointment {
  id             String          @id @default(uuid())
  randevuNo      String          @unique
  patientId      String
  patient        Patient         @relation(fields: [patientId], references: [id])
  userId         String?         // atanan personel (doktor/satışçı)
  user           User?           @relation(fields: [userId], references: [id])
  type           AppointmentType // CONSULTATION veya TREATMENT
  status         AppointmentStatus @default(PENDING)
  appointmentDate DateTime      // randevu tarihi
  createdAt      DateTime        @default(now()) // randevu veriliş tarihi
  notes          String?
}

model Lead {
  id          String      @id @default(uuid())
  name        String
  phone       String
  email       String?
  source      String      // META_LEAD, WEB_FORM, WHATSAPP, INSTAGRAM, MANUAL
  campaignId  String?
  campaign    Campaign?   @relation(fields: [campaignId], references: [id])
  status      LeadStatus  @default(NEW)
  patientId   String?
  patient     Patient?    @relation(fields: [patientId], references: [id])
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  createdAt   DateTime    @default(now())
}

model Campaign {
  id          String   @id @default(uuid())
  name        String
  channel     String   // META, WEB, WHATSAPP, INSTAGRAM
  budget      Decimal?
  startDate   DateTime?
  endDate     DateTime?
  leads       Lead[]
  createdAt   DateTime @default(now())
}

model TreatmentPlan {
  id            String             @id @default(uuid())
  patientId     String
  patient       Patient            @relation(fields: [patientId], references: [id])
  status        TreatmentPlanStatus @default(DRAFT)
  totalPrice    Decimal
  discount      Decimal   @default(0)
  paymentPlan   Json?           // taksit planı
  items         TreatmentItem[]
  invoices      Invoice[]
  approvedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model TreatmentItem {
  id          String   @id @default(uuid())
  planId      String
  plan        TreatmentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  toothNo     String?   // diş numarası
  treatment   String    // tedavi türü (implant, cerrahi, protetik, vb.)
  price       Decimal
  quantity    Int       @default(1)
  stepOrder   Int       @default(1) // adım sırası
}

model Invoice {
  id          String   @id @default(uuid())
  planId      String
  plan        TreatmentPlan @relation(fields: [planId], references: [id])
  amount      Decimal
  paidAmount  Decimal @default(0)
  status      InvoiceStatus @default(UNPAID)
  dueDate     DateTime?
  paidAt      DateTime?
  createdAt   DateTime @default(now())
}

model MessageLog {
  id          String   @id @default(uuid())
  patientId   String?
  channel     String   // WHATSAPP, SMS, EMAIL, INSTAGRAM
  direction   String   // INBOUND, OUTBOUND
  content     String
  sentAt      DateTime @default(now())
}
```

## Meta Entegrasyonu (Altyapı)

Backend'e şu webhook endpointleri eklenir:
- `POST /api/webhooks/meta/leadads` — Meta Lead Ads lead çekme
- `POST /api/webhooks/meta/messenger` — Facebook Messenger DM
- `POST /api/webhooks/meta/instagram` — Instagram DM
- `POST /api/webhooks/whatsapp` — WhatsApp Cloud API mesajları

Güvenlik: `X-Hub-Signature-256` imza doğrulaması, `appsecret_proof`, token şifreli saklama.

Meta App ID, App Secret, WhatsApp Phone Number ID, WABA ID bilgileri `.env` dosyasına girilir (sen panele gireceksin).

## Dosya Yapısı

```
saatci-crm/
├── frontend/               # React 18 + Vite + TS + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/     # Sidebar, Header
│   │   │   ├── callcenter/ # Çağrı merkezi ekranları
│   │   │   ├── sales/      # Satışçı ekranları
│   │   │   ├── dentist/    # Doktor ekranları
│   │   │   ├── banko/      # Banko ekranları
│   │   │   ├── admin/      # Yönetici ekranları
│   │   │   └── ui/         # Ortak bileşenler
│   │   ├── pages/
│   │   ├── store/          # Zustand
│   │   ├── api/            # Axios + TanStack Query
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/                # Express + TS + Prisma
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── patients.ts
│   │   │   ├── appointments.ts
│   │   │   ├── leads.ts
│   │   │   ├── campaigns.ts
│   │   │   ├── treatment.ts
│   │   │   ├── invoices.ts
│   │   │   └── webhooks.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── roleGuard.ts
│   │   │   └── errorHandler.ts
│   │   ├── services/
│   │   │   ├── metaLeadAds.ts
│   │   │   ├── metaMessenger.ts
│   │   │   ├── metaInstagram.ts
│   │   │   ├── whatsapp.ts
│   │   │   ├── sms.ts
│   │   │   └── email.ts
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml      # Portainer stack
├── .github/workflows/
│   └── deploy.yml          # CI/CD
├── .env.example
└── README.md
```

## Uygulama Yolu (Aşamalar)

| Aşama | Modül | Süre |
|-------|-------|------|
| 1 | Altyapı: GitHub repo, Docker, Portainer stack, CI/CD, Prisma şeması | 1 hafta |
| 2 | Kimlik ve rol bazlı erişim (RBAC) | 3-4 gün |
| 3 | Hasta ve tıbbi kayıt modülü (Hasta No, Medical Record) | 1 hafta |
| 4 | Randevu sistemi (Randevu No, tür: görüşme/tedavi, tarih, veriliş tarihi) | 1 hafta |
| 5 | Çağrı Merkezi modülü (Lead intake, hasta intake, randevu oluşturma) | 1 hafta |
| 6 | Satışçı modülü (ön muayene, tedavi planı oluşturma) | 1 hafta |
| 7 | Banko modülü (ödeme, fatura, taksit, tedavi randevu verme) | 1 hafta |
| 8 | Doktor modülü (tıbbi kart, diş şeması, tedavi uygulama) | 1 hafta |
| 9 | Meta entegrasyonu (Lead Ads, Messenger, Instagram, WhatsApp webhook) | 1 hafta |
| 10 | Raporlama (funnel, gelmedi/gelen, gelir, kampanya) | 4-5 gün |
| 11 | SMS / E-posta / WhatsApp hatırlatma | 1 hafta |
| 12 | Mobil uyumluluk, test, Portainer canlı deploy | 1 hafta |

**Toplam: ~9-10 hafta**

## Başlangıç Adımları

1. `saatci-crm` klasöründe `docker-compose.yml` oluşturulur
2. `backend/` klasörü oluşturulur, Prisma schema yazılır, Express sunucu kurulur
3. `frontend/` klasörü oluşturulur, React + Vite yapılandırılır
4. `.env.example` oluşturulur
5. GitHub repository oluşturulur, ilk commit atılır
6. Portainer stack deploy edilir

## Notlar

- Hasta No ve Randevu No ayrı seri numaralardır
- İlk randevu her zaman Satışçı ile "Görüşme / Ön Muayene" türündedir
- Tedavi randevuları ödeme sonrası Banko tarafından verilir (Çağrı Merkezi de verebilir)
- Tıbbi kayıtlar sadece Doktor ve Yönetici tarafından görülebilir
- HBYS (Sağlık Bakanlığı) entegrasyonu YOK, sadece sistem akışı örneği olarak kullanıldı
- Meta API bilgileri (App ID, Secret, Phone Number ID, WABA ID) sen panele gireceksin
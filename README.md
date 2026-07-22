# Fabricca — Dijital Tez Asistanı

**Fabricca**, yüksek lisans ve doktora öğrencilerinin akademik araştırma, tez
yazım ve literatür tarama süreçlerini yapay zeka desteğiyle uçtan uca
yönetmelerini sağlayan gelişmiş bir **Dijital Tez Asistanı ve Akademik Çalışma
Platformudur**.

> Platform, dışarıdan serbest kayda tamamen kapalıdır. Yalnızca veri tabanında
> seed edilmiş izinli kullanıcılar tarafından kullanılabilir.

---

## Özellikler

### 1. Tez Matrisi (Thesis Matrix)

Çalışmanızın temel yapı taşlarını tanımladığınız ilk adımdır. Araştırma sorusu,
temel iddia, kuramsal çerçeve, metodoloji, araştırma kapsamı ve çalışma başlığı
olmak üzere altı temel alanı kapsar.

### 2. Özgünlük & Risk Analizi

TEZARA (YÖK Ulusal Tez Merkezi) API'si üzerinden çalışan bir analiz motorudur:

- **Tez karşılaştırması:** YÖK Tez veri tabanındaki benzer tezlerle konu, kuram,
  yöntem ve bağlam eksenlerinde karşılaştırma yaparak özgünlük rozeti
  (IKIZ / SINIRDAS / OZGUN) üretir.
- **Cohere Rerank v4.0 Pro** ile semantik benzerlik sıralaması yapılır.
- Sonuçlar, deterministik boolean mantığı ile tek bir özgünlük rozetine
  indirgenir.

### 3. Konu Kutuları (Thesis Boxes)

Google Gemini (`FLASH_LITE_31`) tarafından tez matrisiniz analiz edilerek
otomatik oluşturulan kavramsal kutulardır. Altı tür kutu mevcuttur:

- `PROBLEMATIZATION` — Problem Tanımlama
- `CONCEPTUAL` — Kavramsal Çerçeve
- `DATA_PROTOCOL` — Veri ve Yöntem
- `PRIMARY_MATERIAL` — Birincil Kaynaklar
- `CONTEXT` — Bağlam
- `RELATED_THESES` — İlgili Tezler

Kutular iç içe alt kutular (sub-box) barındırabilir ve her kutuya temel
(foundational) kaynak sorguları bağlanabilir.

### 4. Literatür Taraması

Her bir konu kutusu için çoklu akademik veri tabanlarında eşzamanlı kaynak
taraması yapar:

- **OpenAlex API** — Geniş akademik makale indeksi
- **CrossRef API** — DOI ve yayıncı bilgileri
- **Exa API** — Gelişmiş semantik arama
- **Semantic Scholar API** — Atıf ve etki analizi
- **FoundationalOracle** — Temel kaynakların DOI/publisher çözümlemesi

### 5. Danışman Odası (RAG Chat) — Geliştirme Aşamasında

Makalelerinizin vektör embedding'leri (Cloudflare Workers AI / Qwen3) üzerinden
RAG tabanlı sorgulanabildiği yapay zeka sohbet arayüzü.

### 6. Kartoteks — Geliştirme Aşamasında

Geleneksel akademik kartoteks sisteminin dijital versiyonu. Makalelerden not
çıkarma, alıntı fişleme ve konu kutularına yerleştirme imkanı sunar.

### 7. Kütüphane

Sistemdeki tüm akademik kaynakların görüntülenmesi ve yönetimi. Her kaynak
bağlı olduğu konu kutusuna göre filtrelenebilir.

### 8. Dashboard (Genel Özet)

Konu kutuları, kaynaklar ve kanban görevlerinin tek bir panelde toplandığı
merkezi yönetim ekranı.

---

## Kullanılan Teknolojiler

| Kategori               | Teknoloji                                             |
| ---------------------- | ----------------------------------------------------- |
| **Frontend & Backend** | Next.js 16 (App Router, Server Actions, PPR)          |
| **UI Bileşenleri**     | Tailwind CSS v4, Shadcn UI, Lucide React              |
| **Veri Tabanı**        | Neon Serverless PostgreSQL                            |
| **ORM**                | Drizzle ORM (snake_case)                              |
| **Vektör DB (RAG)**    | pgvector (Neon içinde)                                |
| **LLM**                | Google Gemini (`FLASH_LITE_31`)                       |
| **Embedding**          | Cloudflare Workers AI (Qwen3-Embedding-0.6B, 768 dim) |
| **Rerank**             | Cohere Rerank v4.0 Pro                                |
| **Tez Veri Kaynağı**   | TEZARA (YÖK Tez)                                      |
| **Akademik Veri**      | OpenAlex, CrossRef, Exa, Semantic Scholar             |
| **State Yönetimi**     | TanStack Query                                        |
| **Auth**               | bcrypt-ts + Cookie tabanlı hafif session              |
| **Derleyici**          | Turbopack                                             |
| **Lint / Format**      | ESLint, Prettier                                      |

---

## Proje Yapısı

Proje, Next.js App Router'ın rota gruplama (route groups) özelliğini kullanarak
özellik/sayfa tabanlı (feature-driven) olarak organize edilmiştir.

```
src/
├── app/
│   ├── globals.css                  # Global stiller (Tailwind v4)
│   ├── layout.tsx                   # Root layout (font, QueryProvider, Toaster)
│   ├── page.tsx                     # / → /login yönlendirmesi
│   ├── (auth)/                      # Kimlik doğrulama grubu
│   │   ├── layout.tsx               # Oturum kontrolü + yönlendirme
│   │   └── login/                   # /login — Giriş sayfası
│   ├── (onboarding)/                # Onboarding grubu
│   │   ├── layout.tsx               # Onboarding koruma layout'u
│   │   └── onboarding/              # 5 adımlı onboarding süreci
│   │       ├── layout.tsx           # Adım container'ı
│   │       ├── actions.ts           # Ortak onboarding server action'ları
│   │       ├── _components/         # Ortak onboarding bileşenleri
│   │       ├── _lib/                # Fetch yardımcıları
│   │       ├── matrix/              # Adım 1: Tez Matrisi
│   │       ├── risk/                # Adım 3: Özgünlük & Risk Analizi
│   │       │   ├── _services/       # analysis, queries, roadmap, search, sifting
│   │       │   └── _hooks/          # use-risk-analysis
│   │       ├── boxes/               # Adım 4: Konu Kutuları
│   │       └── literature-review/   # Adım 5: Literatür Taraması
│   │           └── _services/       # batch-orchestrator, box-pipeline,
│   │                                # foundational-resolver, openalex-collector
│   └── (app)/                       # Giriş sonrası ana uygulama
│       ├── layout.tsx               # Header + oturum/yönlendirme kontrolü
│       ├── actions.ts               # Ortak uygulama server action'ları
│       ├── dashboard/               # /dashboard — Genel Özet
│       ├── library/                 # /library — Kütüphane
│       ├── advisor/                 # /advisor — Danışman Odası (placeholder)
│       └── card-index/              # /card-index — Kartoteks (placeholder)
├── components/                      # Ortak bileşenler
│   ├── header.tsx                   # Üst navigasyon
│   ├── literature-reader.tsx        # Literatür okuyucu
│   ├── error-display.tsx            # Hata görüntüleme
│   ├── onboarding-global-loader.tsx # Onboarding yükleyici
│   ├── providers/
│   │   └── query-provider.tsx       # TanStack Query Provider
│   └── ui/                          # Shadcn UI bileşenleri
├── db/
│   ├── index.ts                     # Neon DB bağlantısı (WebSocket singleton)
│   ├── schema.ts                    # 6 tablo şeması (Drizzle ORM)
│   └── seed.ts                      # Seed verisi (2 kullanıcı)
├── lib/
│   ├── gemini.ts                    # Google Gen AI SDK entegrasyonu
│   ├── cloudflare.ts                # Cloudflare Workers AI (embedding)
│   ├── cohere.ts                    # Cohere Rerank entegrasyonu
│   ├── tezara.ts                    # TEZARA API istemcisi
│   ├── tezara-parser.ts             # TEZARA HTML ayrıştırıcı (cheerio)
│   ├── tezara-queue.ts              # TEZARA kuyruk/rate-limit yönetimi
│   ├── types.ts                     # Paylaşılan TypeScript tipleri + Zod şemaları
│   ├── error-utils.ts               # Hata sınıflandırma
│   ├── cache-tags.ts                # Next.js cache tag sabitleri
│   ├── utils.ts                     # Genel yardımcı fonksiyonlar
│   ├── academic/
│   │   ├── badge-calculator.ts      # Özgünlük rozeti (boolean mantık)
│   │   └── embedding-resolver.ts    # Vektör embedding çözümleyici
│   ├── prompts/                     # Gemini prompt şablonları (8 adet)
│   ├── logger/                      # Yapılandırılmış loglama sistemi
│   ├── constants/
│   │   └── session.ts               # Session cookie sabitleri
└── session.ts                       # Cookie tabanlı session yönetimi
```

---

## Veri Tabanı Şeması

Neon PostgreSQL üzerinde 6 tablo (Drizzle ORM, snake_case casing):

| Tablo                 | Açıklama            | Önemli Alanlar                                                               |
| --------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `users`               | Kullanıcı hesapları | email (unique), password (bcrypt hash), onboardingCompleted                  |
| `thesis_matrices`     | Tez matrisi         | userId (unique), 6 temel metin alanı                                         |
| `originality_reports` | Özgünlük raporları  | userId (unique), tezaraResults (JSONB)                                       |
| `thesis_boxes`        | Konu kutuları       | thesisMatrixId, title, boxType (enum), parentId, foundationalQueries (JSONB) |
| `library_resources`   | Akademik kaynaklar  | thesisBoxId, title, doi (unique pair), authors (JSONB), isFoundational       |
| `tasks`               | Kanban görevleri    | userId, thesisBoxId, status/priority (enum)                                  |

Her tabloda `createdAt` ve `updatedAt` timestamp alanları bulunur. İlişkiler
`onDelete: "cascade"` ile yönetilir; görevlerde kutu silinince `set null` uygulanır.

---

## Onboarding Süreci

Kullanıcı ilk girişinde sırasıyla şu adımları tamamlar:

```
1. Tez Matrisi (Matrix) — 6 temel alanın tanımı
         ↓
2. Özgünlük & Risk Analizi (Risk)
   ├─ TEZARA ile YÖK Tez karşılaştırması
   ├─ Cohere Rerank ile semantik sıralama
   └─ Özgünlük rozeti (IKIZ / SINIRDAS / OZGUN)
         ↓
4. Konu Kutuları (Boxes)
   └─ Gemini ile otomatik kutu oluşturma + kullanıcı onayı
         ↓
5. Literatür Taraması (Literature Review)
   ├─ OpenAlex / CrossRef / Exa / Semantic Scholar taraması
   ├─ FoundationalOracle ile temel kaynak çözümlemesi
   └─ Kaynakların kutu bazında gruplanması
         ↓
   Dashboard (onboarding tamamlandı)
```

Sistem, her adımda kullanıcının kaldığı yerden devam edebilmesini sağlar
(örneğin; adım 3'te kaldıysa doğrudan `/onboarding/risk` sayfasına yönlendirilir).

---

## Çevresel Değişkenler

Projenin çalışması için gerekli tüm API anahtarları `.env.local` dosyasında
tanımlanır:

| Değişken                   | Hizmet                          |
| -------------------------- | ------------------------------- |
| `DATABASE_URL`             | Neon PostgreSQL bağlantı dizesi |
| `GEMINI_API_KEY`           | Google Gemini API               |
| `CLOUDFLARE_ACCOUNT_ID`    | Cloudflare Workers AI hesap ID  |
| `CLOUDFLARE_API_TOKEN`     | Cloudflare Workers AI API token |
| `OPENALEX_API_KEY`         | OpenAlex Academic API           |
| `CROSSREF_CONTACT_EMAIL`   | CrossRef Polite Pool e-posta    |
| `COHERE_API_KEY`           | Cohere Rerank API               |
| `EXA_API_KEY`              | Exa API                         |
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar API            |

---

## Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat (Turbopack)
npm run dev

# Veri tabanı şemasını Neon'a push et
npm run db:push

# Seed verisini yükle (2 kullanıcı)
npm run db:seed

# Production build
npm run build

# Production sunucusunu başlat
npm run start

# Kalite kontrol (lint + typecheck + prettier)
npm run check:full

# Yalnızca tip denetimi
npm run typecheck

# Yalnızca lint
npm run lint
```

---

## Mimari Kararlar ve Geliştirme Prensipleri

- **Feature-driven klasör yapısı:** Sayfalar özellik bazında gruplanmıştır;
  her modül kendi bileşenlerini, servislerini ve hook'larını barındırır.
- **Single Responsibility:** Her dosya, her bileşen ve her fonksiyon yalnızca
  tek bir işten sorumludur.
- **600 satır sınırı:** Dosyalar ideal olarak 600 satırı aşmaz; aşıldığında
  alt modüllere bölünür (zoraki bölünmelerden kaçınılır).
- **Golden Boundary Rule:**
  - Backend/mantık katmanı: %100 İngilizce (camelCase/snake_case)
  - UI/çıktı katmanı: %100 Türkçe (akademik Türkçe, Türkçe karakterler)
- **Progressive Save:** Onboarding adımları veri tabanına aşamalı olarak
  kaydedilir; kullanıcı her adımda kaldığı yerden devam edebilir.
- **Deterministic AI Çıktısı:** Sabit seed değeri (42) ile tutarlı ve tekrarlanabilir
  model çıktıları hedeflenir.
- **Kapalı sistem:** Dışarıdan kayıt yoktur; yalnızca seed edilmiş kullanıcılar.
- **Sıkı tip güvenliği:** `any` tipi kullanımı yasaktır; tüm tipler Drizzle
  şemalarından türetilir veya açık arayüzlerle tanımlanır.
- **Singleton DB Pool:** Neon WebSocket pool, HMR/Fast Refresh'te her modül
  yeniden yüklendiğinde yeni bağlantı oluşmasını engellemek için global
  singleton olarak yönetilir.
- **JSDoc zorunluluğu:** Tüm fonksiyonlar, server action'lar ve custom hook'lar
  eksiksiz JSDoc dökümantasyonu ile yazılır.

---

## Lisans

Özel (Private) — Tüm hakları saklıdır.

# Fabricca — Dijital Tez Asistanı

**Fabricca**, yüksek lisans ve doktora öğrencilerinin akademik araştırma, tez
yazım ve literatür tarama süreçlerini yapay zeka desteğiyle uçtan uca
yönetmelerini sağlayan gelişmiş bir **Dijital Tez Asistanı ve Akademik Çalışma
Platformudur**.

> Platform, dışarıdan serbest kayda tamamen kapalıdır. Yalnızca veri tabanında
> seed edilmiş izinli kullanıcılar tarafından kullanılabilir.

---

## Onboarding (Kayıt) Süreci

Yeni kullanıcı ilk girişinde sırasıyla **4 adımlı** bir onboarding sürecini
tamamlar:

```
1. Çalışma Matrisi (Matrix)
        ↓
2. Akademik Konumlandırma (Positioning)
   └─ TEZARA (YÖK Meili) + Cohere Rerank + Gemini jüri analizi
        ↓
3. Konu Kutuları (Boxes)
   └─ Gemini ile otomatik kutu üretimi + kullanıcı onayı
        ↓
4. Literatür Taraması (Literature Review)
   └─ OpenAlex araması + jüri/eleme aşamaları
        ↓
   Dashboard (onboarding tamamlandı)
```

Sistem, her adımda kullanıcının kaldığı yerden devam edebilmesini sağlar.

---

## Özellikler

### 1. Çalışma Matrisi (Thesis Matrix)

Çalışmanın temel yapı taşlarını tanımlayan ilk adım. **4 alan** içerir:

- `subjectProblem` — Araştırma problemi, aktörler ve odak
- `theoreticalFramework` — Teorik ve kavramsal çerçeve
- `primaryMaterial` — Veri kaynağı / birincil malzeme
- `methodology` — Metodoloji

### 2. Akademik Konumlandırma & Özgünlük Analizi (Positioning)

TEZARA (YÖK Ulusal Tez Merkezi) Meilisearch index'i üzerinden çalışan,
kaynaklarının özgünlük boşluğunu analiz eden hat:

- **Sorgu üretimi:** Gemini ile ilgili tezlere yönelik 8 Meilisearch sorgusu.
- **Tez araması ve eleme:** TEZARA ile aday tezler çekilir.
- **Semantik sıralama:** Cohere Rerank v4.0 Pro ile benzerlik sıralaması.
- **Rapor:** Gemini jürisi üç durumdan birini üretir:
  - `DIRECT_OVERLAP` — Doğrudan örtüşme
  - `NOVEL_GAP_IDENTIFIED` — Özgün boşluk tespit edildi
  - `NO_RELATED_LITERATURE` — İlgili literatür yok
- Raporda literatür haritası, akademik boşluk ve özgün katkı; ayrıca incelenmesi
  önerilen ilgili tez listesi yer alır.

### 3. Konu Kutuları (Thesis Boxes)

Google Gemini (`FLASH_LITE_31`) tarafından matris analiz edilerek otomatik
oluşturulan kavramsal kutulardır. **Beş tür kutu** mevcuttur:

- `SUBJECT_PROBLEM` — Araştırma Problemi
- `THEORETICAL_FRAMEWORK` — Teorik Çerçeve
- `METHODOLOGY` — Yöntem
- `PRIMARY_MATERIAL` — Birincil Kaynak
- `RELATED_THESES` — İlgili Tezler

Kutular iç içe alt kutular (sub-box) barındırabilir; her kutuya temel
(foundational) sorgular bağlanabilir.

### 4. Literatür Taraması

Her bir konu kutusu için **OpenAlex API** üzerinden kaynak taraması yapar;

- **Faz 1 — Arama:** Konu kutusu sorgularıyla OpenAlex'te aday makaleler.
- **Faz 2 — Jüri:** Gemini ile alaka/`relevanceScore`, kurucu eser
  (`isFoundational`) ve Türkçe gerekçe kararı.
- **Faz 3 — Seçim:** Jüri değerlendirmesi sonrası final kaynak havuzunun
  belirlenmesi.

### 5. Danışman Odası (RAG Chat)

Makale PDF'lerinden üretilen vektör embedding'leri üzerinden **hybrid RAG**
tabanlı yapay zeka sohbeti:

- **Yoğun dallar:** pgvector HNSW (cosine) üzerinden dense retrieval.
- **Leksel dallar:** PostgreSQL `tsvector` (Türkçe + İngilizce) FTS.
- **Füzyon:** Reciprocal Rank Fusion (RRF) + Cohere Rerank v4.0 Pro.
- **HyDE:** Cerebras (`gemma-4-31b`) ile çapraz-dil sorgu genişletme.
- **Tool calling:** Gemini ile oturumlu arama, alıntı fişleme, okuma durumu
  güncelleme ve undo desteği.

### 6. Alıntı Fişleri (Citation Cards)

Geleneksel akademik kartoteksin dijital versiyonu. Makalelerden not çıkarma,
alıntı fişleme ve fişleri konu kutularına yerleştirme. Not türleri:
`DIRECT_QUOTE`, `PARAPHRASE`, `PERSONAL_NOTE`.

### 7. Kütüphane

Sistemdeki tüm akademik kaynakların görüntülenmesi, yönetimi ve PDF
işlemleri:

- PDF yükleme → R2 depolama, Gemini ile sayfa analizi & kaynakça ayıklama.
- Chunk'lama → embedding üretimi → pgvector/tsvector indexleme.
- Kaynak bazlı notlar ve bağlı konu kutusu filtresi.

### 8. Dashboard (Genel Özet)

Konu kutuları, kaynaklar ve kanban görevlerinin tek bir panelde toplandığı
merkezi yönetim ekranı.

---

## Kullanılan Teknolojiler

| Kategori               | Teknoloji                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Frontend & Backend** | Next.js 16 (App Router, Server Actions, Cache Components, Turbopack)         |
| **UI Bileşenleri**     | Tailwind CSS v4, Shadcn UI, Lucide React, next-themes, Sonner                |
| **Veri Tabanı**        | Neon Serverless PostgreSQL                                                   |
| **ORM**                | Drizzle ORM (snake_case)                                                     |
| **Vektör DB (RAG)**    | pgvector (HNSW) + tsvector (FTS), COSINE                                     |
| **Birincil LLM**       | Google Gemini Flash ailesi (`FLASH_LITE_31`, `FLASH_LITE_35`, `FLASH_36`)    |
| **İkincil LLM**        | Cerebras (`gemma-4-31b`) — metadata sanitize, HyDE, başlık üretimi           |
| **Embedding**          | Cloudflare Workers AI (`@cf/baai/bge-m3`, **1024 dim**) — tek ve sabit motor |
| **Rerank**             | Cohere Rerank v4.0 Pro (`rerank-v4.0-pro`)                                   |
| **Tez Veri Kaynağı**   | TEZARA (YÖK Tez) — Meilisearch index                                         |
| **Akademik Veri**      | OpenAlex API                                                                 |
| **Object Storage**     | Cloudflare R2 (AWS S3 SDK)                                                   |
| **PDF İşleme**         | `@firecrawl/pdf-inspector`, pdf-lib, Gemini                                  |
| **State Yönetimi**     | TanStack Query                                                               |
| **Auth**               | bcrypt-ts + Cookie tabanlı hafif session                                     |
| **Lint / Format**      | ESLint, Prettier, JSDoc                                                      |

---

## Proje Yapısı

Proje, Next.js App Router'ın rota gruplama (route groups) özelliğini kullanarak
özellik/sayfa tabanlı (feature-driven) olarak organize edilmiştir.

```
src/
├── app/
│   ├── globals.css                  # Global stiller (Tailwind v4)
│   ├── layout.tsx                   # Root layout (font, QueryProvider, Toaster)
│   ├── page.tsx                   # / → /login yönlendirmesi
│   ├── (auth)/                      # Kimlik doğrulama grubu
│   │   ├── layout.tsx                # Oturum kontrolü + yönlendirme
│   │   └── login/                    # /login — Giriş sayfası
│   ├── (onboarding)/                # Onboarding koruma grubu
│   │   └── layout.tsx                # Oturum kontrolü
│   └── (onboarding)/onboarding/      # 4 adımlı onboarding süreci
│       ├── layout.tsx                # Adım navigasyonu (stepper)
│       ├── actions.ts                # Ortak onboarding server action'ları
│       ├── _components/              # Ortak onboarding bileşenleri
│       ├── _hooks/                  # use-onboarding-navigation
│       ├── _lib/                     # box-mapper, loading-steps
│       ├── _services/fetch-actions.ts
│       ├── matrix/                   # Adım 1: Çalışma Matrisi
│       ├── positioning/              # Adım 2: Akademik Konumlandırma
│       │   ├── _services/            # analysis, decision-engine, queries, sifting
│       │   ├── _lib/validation.ts    # Zod şemaları
│       │   └── _components/          # Rapor görünümü
│       ├── boxes/                    # Adım 3: Konu Kutuları
│       │   ├── _services/            # Gemini kutu üretimi
│       │   └── _components/
│       └── literature-review/        # Adım 4: Literatür Tarama
│           ├── _services/            # orchestrator (phase1-3), openalex, clustering
│           └── _hooks/
│   └── (app)/                         # Giriş sonrası ana uygulama
│       ├── layout.tsx                # Header + oturum/yönlendirme kontrolü
│       ├── actions.ts                # Ortak uygulama server action'ları
│       ├── _services/box-service.ts
│       ├── dashboard/                # /dashboard — Genel Özet + Kanban
│       ├── library/                  # /library — Kütüphane + PDF/RAG
│       ├── advisor/                  # /advisor — Danışman Odası (RAG Chat)
│       ├── citation-cards/           # /citation-cards — Alıntı Fişleri
│   └── api/advisor/route.ts          # Danışman Odası streaming endpoint
├── components/
│   ├── header.tsx                    # Üst/büyük navigasyon
│   ├── ai-banner.tsx                 # Yapay zeka banner
│   ├── error-display.tsx             # Hata görüntüleme
│   ├── loading-spinner.tsx           # Yükleme göstergesi
│   └── ui/                           # Shadcn UI bileşenleri
├── providers/
│   └── query-provider.tsx             # TanStack Query Provider
├── db/
│   ├── index.ts                       # Neon DB bağlantısı (WebSocket singleton)
│   ├── schema.ts                      # 10 tablo şeması (Drizzle ORM)
│   ├── seed.ts                        # Seed verisi (2 kullanıcı)
│   └── reset.ts                       # DB sıfırlama
├── lib/
│   ├── session.ts                    # Cookie tabanlı session yönetimi
│   ├── constants.ts                  # Model sabitleri (FLASH_*, CEREBRAS, seed 42)
│   ├── box-constants.ts             # Kutu türü sıra/etiket (single source of truth)
│   ├── types.ts                      # Paylaşılan tipler + Zod şemaları
│   ├── api-utils.ts                 # Polite pool e-posta, User-Agent, retry
│   ├── cache-tags.ts                # Next.js cache tag sabitleri
│   ├── error-utils.ts               # Hata sınıflandırma
│   ├── logger.ts                    # Yapılandırılmış loglama sistemi
│   ├── rate-limiter.ts              # Concurrency / rate limit yönetimi
│   ├── academic/                    # DOI, OpenAlex ID, author formatlama
│   ├── tezara/                      # TEZARA Meilisearch istemcisi
│   ├── services/                    # gemini, cerebras, cohere, cloudflare-ai,
│   │                                # r2, pdf-parser, rag, advisor-tools, sanitizer
│   └── prompts/                     # Prompt şablonları (6 kullanım)
└── ...
```

---

## Veri Tabanı Şeması

Neon PostgreSQL üzerinde **10 tablo** (Drizzle ORM, snake_case):

| Tablo           | Açıklama                        | Önemli Alanlar                                                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `users`         | Kullanıcı hesapları             | email (unique), password (bcrypt), name, onboardingCompleted                                     |
| `matrices`      | Çalışma matrisi                 | userId (unique), subjectProblem, theoreticalFramework, primaryMaterial, methodology              |
| `positioning`   | Konumlandırma raporu            | userId (unique), matrixInput (jsonb), globalStatus (enum), gapAnalysisSummary, recommendedTheses |
| `boxes`         | Konu kutuları                   | matrixId, parentId, boxType (enum), title, concepts, foundationalQueries (jsonb)                 |
| `sources`       | Akademik kaynaklar              | boxId, title, authors, doi, openalexId, isRead, isFoundational, pdf* alanları                    |
| `notes`         | Kaynak notları (alıntı fişleri) | sourceId, pageNumber, noteType (enum), content, sentToCitationCards                              |
| `chunks`        | PDF metin parçaları (RAG)       | sourceId, chunkIndex, embedding (vector/1024), searchVector (tsvector)                           |
| `tasks`         | Kanban görevleri                | userId, boxId (delete → set null), status/priority (enum)                                        |
| `chat_sessions` | Danışman sohbet oturumları      | userId, title                                                                                    |
| `chat_messages` | Danışman mesajları              | sessionId, role, content, sources (jsonb), toolCalls (jsonb)                                     |

Kutu (`boxes`) ilişkilerinde `onDelete: "cascade"`; görevlerin `boxId` alanında
`onDelete: "set null"` uygulanır.

---

## Çevresel Değişkenler

Gerekli tüm API anahtarları `.env.local` dosyasında tanımlanır:

| Değişken                 | Hizmet                                       |
| ------------------------ | -------------------------------------------- |
| `DATABASE_URL`           | Neon PostgreSQL bağlantı dizesi              |
| `GEMINI_API_KEY_1..3`    | Google Gemini API (en az 1 anahtar gerekli)  |
| `CEREBRAS_API_KEY`       | Cerebras API (gemma-4-31b)                   |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare Workers AI hesap ID               |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare Workers AI API token              |
| `COHERE_API_KEY`         | Cohere Rerank API                            |
| `OPENALEX_API_KEY`       | OpenAlex API (isteğe bağlı)                  |
| `CROSSREF_CONTACT_EMAIL` | Polite pool e-posta (User-Agent)             |
| `TEZARA_MEILI_URL`       | TEZARA Meilisearch URL                       |
| `TEZARA_MEILI_KEY`       | TEZARA Meilisearch API key                   |
| `R2_ACCOUNT_ID`          | Cloudflare R2 hesabı                         |
| `R2_ACCESS_KEY_ID`       | R2 S3 access key                             |
| `R2_SECRET_ACCESS_KEY`   | R2 S3 secret key                             |
| `R2_BUCKET_NAME`         | R2 bucket adı (varsayılan `fabricca`)        |
| `R2_PUBLIC_DOMAIN`       | R2 public domain (varsayılan `pub-*.r2.dev`) |
| `SEED_USER1_PASSWORD`    | Seed kullanıcı 1 şifre                       |
| `SEED_USER2_PASSWORD`    | Seed kullanıcı 2 şifre                       |

---

## Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat (Turbopack)
npm run dev

# Veri tabanı şemasını Neon'a push et
npm run db:push

# Yerel DB'yi sıfırla
npm run db:reset

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
- **600 satır sınırı:** Dosyalar ideal olarak 600 satırı aşmaz.
- **Golden Boundary Rule:**
  - Backend/mantık katmanı: %100 İngilizce (camelCase/snake_case)
  - UI/çıktı katmanı: %100 Türkçe (akademik Türkçe)
- **Progressive Save:** Onboarding adımları veri tabanına aşamalı kaydedilir.
- **Deterministic AI Çıktısı:** Sabit seed değeri (42) ile tutarlı model çıktıları.
- **Kapalı sistem:** Dışarıdan kayıt yoktur; yalnızca seed edilmiş kullanıcılar.
- **Sıkı tip güvenliği:** `any` kullanımı yasak; tüm tipler Drizzle şemalarından
  türetilir veya açık arayüzlerle tanımlanır.
- **Singleton DB Pool:** Neon WebSocket pool, HMR/Fast Refresh'te yeni bağlantı
  oluşmasını engellemek için global singleton.
- **JSDoc zorunluluğu:** Tüm fonksiyonlar, server action'lar ve custom hook'lar
  JSDoc ile dokümante edilir.

---

## Lisans

Özel (Private) — Tüm hakları saklıdır.

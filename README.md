# Fabricca — Dijital Tez Asistanı

> **Son Güncelleme:** 31 Ağustos 2026  
> **Statü:** Yürürlükte  
> **Kapsam:** Platform tanıtımı, özellikler, kurulum ve mimari özet

**Fabricca**, yüksek lisans ve doktora öğrencilerinin akademik araştırma, tez yazımı ve literatür tarama süreçlerini yapay zekâ desteğiyle uçtan uca yönetmelerini sağlayan gelişmiş bir **dijital tez asistanı ve akademik çalışma platformudur**.

> Platform, dışarıdan serbest kayda tamamen kapalıdır. Yalnızca veritabanında seed edilmiş izinli kullanıcılar tarafından kullanılabilir.

---

## Onboarding (Kayıt) Süreci

Yeni kullanıcı ilk girişinde sırasıyla **5 adımlı** onboarding sürecini tamamlar (güncel akış — `proposal` tek giriş noktası, `matrix` legacy route `/onboarding/positioning`’e yönlenir):

```text
1. Tez Taslağı (Proposal)
   └─ Ham öneri → Gemini sentez (MATRIX_SYNTHESIS) → 4 kadranlı matris
        ↓
2. Akademik Konumlandırma (Positioning)
   └─ Thesis Search (Qdrant Cloud E5) + Cohere Rerank + Gemini jüri analizi (PROPOSAL_POSITIONING)
        ↓
3. Konu Kutuları (Boxes)
   └─ Gemini ile otomatik kutu üretimi + kullanıcı onayı
        ↓
4. Tez Planı (Outline)
   └─ Disipline özel hiyerarşik içindekiler ve bölüm iskeleti
        ↓
5. Literatür Taraması (Literature Review)
   └─ OpenAlex araması + jüri ve eleme aşamaları
        ↓
   Dashboard (onboarding tamamlandı)
```

> **Not:** Eski `matrix` (Çalışma Matrisi editörü) ve `proposal-audit` (3 aşamalı web ve tez taramalı ön denetim) pipeline’ları Faz 1’de kaldırıldı; yerini `proposal → positioning` birleşik akışı (`PROPOSAL_POSITIONING_PIPELINE`) aldı.

Sistem, her adımda kullanıcının kaldığı yerden devam edebilmesini sağlar.

---

## Özellikler

### 1. Çalışma Matrisi (Thesis Matrix)

Çalışmanın temel yapı taşlarını tanımlayan ilk adım. **4 alan** içerir:

- `subjectProblem` — Araştırma problemi, aktörler ve odak
- `theoreticalFramework` — Teorik ve kavramsal çerçeve
- `primaryMaterial` — Veri kaynağı ve birincil malzeme
- `methodology` — Metodoloji

### 2. Akademik Konumlandırma ve Özgünlük Analizi (Positioning)

Qdrant vektör veritabanı (366.000+ tez, multilingual-e5-base 768d) üzerinden çalışan, kaynakların özgünlük boşluğunu analiz eden hat:

- **Sorgu üretimi:** Gemini ile ilgili tezlere yönelik 8 semantik arama sorgusu.
- **Tez araması ve eleme:** Qdrant vektör indeksi (cosine similarity) ile aday tezler çekilir.
- **Semantik sıralama:** Cohere Rerank v4.0 Pro ile benzerlik sıralaması.
- **Rapor:** Gemini jürisi üç durumdan birini üretir:
  - `DIRECT_OVERLAP` — Doğrudan örtüşme
  - `NOVEL_GAP_IDENTIFIED` — Özgün boşluk tespit edildi
  - `NO_RELATED_LITERATURE` — İlgili literatür yok
- Raporda literatür haritası, akademik boşluk ve özgün katkı; ayrıca incelenmesi önerilen ilgili tez listesi yer alır.

### 3. Konu Kutuları (Thesis Boxes)

Google Gemini (`FLASH_36`) tarafından matris analiz edilerek otomatik oluşturulan kavramsal kutulardır. **Beş tür kutu** mevcuttur:

- `SUBJECT_PROBLEM` — Araştırma Problemi
- `THEORETICAL_FRAMEWORK` — Teorik Çerçeve
- `METHODOLOGY` — Yöntem
- `PRIMARY_MATERIAL` — Birincil Kaynak
- `RELATED_THESES` — İlgili Tezler

Kutular iç içe alt kutular (sub-box) barındırabilir; her kutuya temel (foundational) sorgular bağlanabilir.

### 4. Tez Planı ve İçindekiler İskeleti (Thesis Outline)

Kullanıcının akademik alanına ve tez matrisine göre yapılandırılan hiyerarşik içindekiler mimarisi:

- Otomatik bölüm ve alt bölüm taslağı üretimi.
- Bölümlere bağlı kaynak ve alıntı fişleri kanıt haritası (`outline_annotations`, `outline_sources`).

### 5. Literatür Taraması

Her bir konu kutusu için **OpenAlex API** üzerinden kaynak taraması yapar:

- **Faz 1 — Arama:** Konu kutusu sorgularıyla OpenAlex’te aday makaleler.
- **Faz 2 — Jüri:** Gemini ile alaka ve `relevanceScore` ile Türkçe gerekçe kararı.
- **Faz 3 — Seçim:** Jüri değerlendirmesi sonrası final kaynak havuzunun belirlenmesi.

### 6. Danışman Odası (RAG Chat ve Taslak Denetimi)

Makale PDF’lerinden üretilen vektör embedding’leri üzerinden **hybrid RAG** tabanlı yapay zekâ sohbeti ve taslak denetim masası:

- **Yoğun dallar:** pgvector HNSW (cosine) üzerinden dense retrieval.
- **Leksel dallar:** PostgreSQL `tsvector` (Türkçe ve İngilizce) FTS.
- **Füzyon:** Reciprocal Rank Fusion (RRF) + Cohere Rerank v4.0 Pro.
- **HyDE:** Gemini Flash Lite 3.5 ile çapraz-dil sorgu genişletme.
- **Ofis Masası (Draft Audit):** Word taslak pasajlarının 3 katmanlı kenar notu denetimi (alıntı denetimi, editoryal revizyon diff’i, jüri eleştirisi) ve Sokratesçi canlı savunma sohbeti.

### 7. Alıntı Fişleri (Citation Cards)

Geleneksel akademik kartoteksin dijital versiyonu. Makalelerden not çıkarma, alıntı fişleme ve fişleri konu kutularına ve tez bölümlerine yerleştirme. Not türleri: `DIRECT_QUOTE`, `PARAPHRASE`, `PERSONAL_NOTE`.

### 8. Kütüphane ve Literatür Matrisi

Sistemdeki tüm akademik kaynakların görüntülenmesi, yönetimi ve PDF işlemleri:

- PDF yükleme → R2 depolama, Gemini ile sayfa analizi ve kaynakça ayıklama.
- Chunk’lama → Cloudflare BGE-M3 (1024d) embedding üretimi → pgvector ve tsvector indeksleme.
- Kaynak bazlı notlar, 1:1 eser kritiği ve karşılaştırmalı 2D literatür matrisi.

### 9. Dashboard (Genel Özet ve Kanban)

Konu kutuları, dinamik okuma ilerlemesi ve Kanban araştırma görevlerinin tek bir panelde toplandığı merkezî yönetim ekranı.

---

## Kullanılan Teknolojiler

| Kategori               | Teknoloji                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Frontend & Backend** | Next.js 16 (App Router, Server Actions, Cache Components, Turbopack)         |
| **UI Bileşenleri**     | Tailwind CSS v4, Shadcn UI, Lucide React, next-themes, Sonner                |
| **Veritabanı**         | Neon Serverless PostgreSQL                                                   |
| **ORM**                | Drizzle ORM (snake_case)                                                     |
| **Vektör DB (RAG)**    | pgvector (HNSW) + tsvector (FTS), COSINE                                     |
| **LLM Motoru**         | Google Gemini Flash ailesi (`FLASH_LITE_35`, `FLASH_36`)                     |
| **Embedding**          | Cloudflare Workers AI (`@cf/baai/bge-m3`, **1024 dim**) — tek ve sabit motor |
| **Rerank**             | Cohere Rerank v4.0 Pro (`rerank-v4.0-pro`)                                   |
| **Tez Veri Kaynağı**   | Qdrant Cloud Vektör Veritabanı (366k+ Tez, E5-Base 768d)                     |
| **Akademik Veri**      | OpenAlex API                                                                 |
| **Object Storage**     | Cloudflare R2 (AWS S3 SDK)                                                   |
| **PDF İşleme**         | `@firecrawl/pdf-inspector`, Gemini                                           |
| **State Yönetimi**     | TanStack Query                                                               |
| **Auth**               | bcrypt-ts + Cookie tabanlı hafif session                                     |
| **Lint / Format**      | ESLint, Prettier, JSDoc                                                      |

---

## Proje Yapısı

Proje, Next.js App Router’ın rota gruplama (route groups) özelliğini kullanarak özellik ve sayfa tabanlı (feature-driven) olarak organize edilmiştir.

```text
src/
├── app/
│   ├── globals.css                  # Global stiller (Tailwind v4)
│   ├── layout.tsx                   # Root layout (font, QueryProvider, Toaster)
│   ├── page.tsx                     # / → /login yönlendirmesi
│   ├── (auth)/                      # Kimlik doğrulama grubu
│   │   ├── layout.tsx               # Oturum kontrolü + yönlendirme
│   │   └── login/                   # /login — Giriş sayfası
│   ├── (onboarding)/                # Onboarding koruma grubu
│   │   └── layout.tsx               # Oturum kontrolü
│   ├── (onboarding)/onboarding/     # 5 adımlı onboarding süreci (proposal → dashboard)
│   │   ├── layout.tsx               # Adım navigasyonu (stepper)
│   │   ├── actions.ts               # Ortak onboarding server action’ları
│   │   ├── _components/             # Ortak onboarding bileşenleri
│   │   ├── _hooks/                  # Navigation & step hooks
│   │   ├── _services/               # Onboarding fetch & step check servisleri
│   │   ├── proposal/                # Adım 1: Tez Taslağı (Proposal)
│   │   ├── positioning/             # Adım 2: Akademik Konumlandırma (_services, _prompts)
│   │   ├── boxes/                   # Adım 3: Konu Kutuları (_services, _prompts)
│   │   ├── outline/                 # Adım 4: Tez Planı
│   │   └── literature-review/       # Adım 5: Literatür Tarama (_services, _prompts)
│   └── (app)/                       # Giriş sonrası ana uygulama
│       ├── layout.tsx               # Header + oturum/yönlendirme kontrolü
│       ├── actions.ts               # Ortak uygulama server action’ları
│       ├── _components/             # Ana uygulama ortak bileşenleri (header vb.)
│       ├── dashboard/               # /dashboard — Genel Özet + Kanban
│       ├── library/                 # /library — Kütüphane + PDF/RAG + Literature Expansion
│       │   ├── _components/         # Kütüphane bileşenleri (literature-expansion-button vb.)
│       │   └── _services/           # PDF yükleme, RAG, expansion servisleri
│       ├── advisor/                 # /advisor — Danışman Odası (RAG Chat)
│       │   ├── _services/           # chat-title, classifier, stream, tool-loop, turn
│       │   ├── _prompts/            # prompt şablonları
│       │   └── _tools/              # advisor mutation & read araçları
│       ├── citation-cards/          # /citation-cards — Alıntı Fişleri (_lib, _services)
│       ├── literature-matrix/       # /literature-matrix — Matris Görünümü (_lib, _components)
│       └── thesis-architecture/     # /thesis-architecture — Mimari Editör
│   └── api/advisor/route.ts         # Danışman Odası streaming endpoint
├── components/
│   ├── shared/                      # Ortak uygulama bileşenleri (ai-banner, loading-spinner vb.)
│   └── ui/                          # Shadcn UI bileşenleri
├── core/
│   ├── db/                          # Neon DB bağlantısı, 15 tablo şeması, reset.ts ve seed.ts
│   ├── config/                      # Rate limit konfigürasyonu (rate-limits.ts)
│   ├── providers/                   # QueryProvider, LoadingOverlayProvider
│   └── services/                    # Ortak çekirdek servisler (ai, search, pdf, storage, box, academic, thesis-search, exa, timeline)
├── lib/
│   ├── session.ts                   # Cookie tabanlı session yönetimi
│   ├── constants.ts                 # Model sabitleri
│   ├── box-constants.ts             # Kutu türü sıra ve etiket
│   ├── errors/                      # AppError hiyerarşisi + handleActionError
│   ├── logger.ts                    # Yapılandırılmış loglama sistemi
│   └── rate-limiter.ts              # Concurrency / rate limit yönetimi
```

---

## Veritabanı Şeması

Neon PostgreSQL üzerinde **15 tablo** (Drizzle ORM, snake_case):

| Tablo                 | Açıklama                          | Önemli Alanlar                                                                                      |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `users`               | Kullanıcı hesapları               | username (unique), password (bcrypt), name, onboardingCompleted                                     |
| `matrices`            | Çalışma matrisi                   | userId (unique), subjectProblem, theoreticalFramework, primaryMaterial, methodology                 |
| `positioning`         | Konumlandırma raporu              | userId, matrixId (unique), globalStatus (enum), gapAnalysisSummary, recommendedTheses               |
| `boxes`               | Konu kutuları                     | matrixId, parentId, boxType (enum), title, concepts, semanticQuery                                  |
| `outlines`            | Tez planı hiyerarşisi             | matrixId, parentId, title, sortOrder, academicField                                                 |
| `sources`             | Akademik kaynaklar                | boxId, title, authors, doi, openalexId, isRead, pdf* alanları, parsedReferences (jsonb)             |
| `expansions`          | Literatür genişletme geçmişi      | boxId, cycle, previousActiveSeedIds, newActiveSeedIds                                               |
| `annotations`         | Kaynak notları (alıntı fişleri)   | sourceId, userId, pageNumber, noteType (enum), content, verificationStatus/Data                     |
| `outline_annotations` | Bölüm–alıntı eşleşmesi (junction) | outlineId, annotationId                                                                             |
| `outline_sources`     | Bölüm–kaynak eşleşmesi (junction) | outlineId, sourceId                                                                                 |
| `critiques`           | Eser kritiği (1:1 kaynak analizi) | sourceId (unique), researchQuestion, theoreticalFramework, methodology, mainArgument, literatureGap |
| `chunks`              | PDF metin parçaları (RAG)         | sourceId, chunkIndex, embedding (vector/1024), searchVector (tsvector), chunkType                   |
| `tasks`               | Kanban görevleri                  | userId, boxId (delete → set null), sourceId, taskType, status/priority (enum)                       |
| `sessions`            | Danışman ve Ofis oturumları       | userId, outlineId (nullable), title, draftText, studentNote                                         |
| `messages`            | Oturum mesajları                  | sessionId, role, persona, content, sources (jsonb), toolCalls (jsonb), pipelineData                 |

Kutu (`boxes`) ve outline (`outlines`) ilişkilerinde `onDelete: "cascade"`; görevlerin `boxId` alanında `onDelete: "set null"` uygulanır.

---

## Çevresel Değişkenler

Gerekli tüm API anahtarları `.env.local` dosyasında tanımlanır:

| Değişken                 | Hizmet                                      |
| ------------------------ | ------------------------------------------- |
| `DATABASE_URL`           | Neon PostgreSQL bağlantı dizesi             |
| `GEMINI_API_KEY_1..3`    | Google Gemini API (en az 1 anahtar gerekli) |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare Workers AI hesap ID              |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare Workers AI API token             |
| `COHERE_API_KEY`         | Cohere Rerank API                           |
| `OPENALEX_API_KEY`       | OpenAlex API (isteğe bağlı)                 |
| `CROSSREF_CONTACT_EMAIL` | Polite pool e-posta (User-Agent)            |
| `HUGGINGFACE_API_KEY`    | Hugging Face Serverless Inference API key   |
| `QDRANT_URL`             | Qdrant Cloud Tez Vektör DB endpoint         |
| `QDRANT_API_KEY`         | Qdrant Cloud API key                        |
| `MISTRAL_OCR_API_KEY`    | Mistral OCR API key                         |
| `EXA_API_KEY`            | Exa.ai API key                              |
| `R2_ACCOUNT_ID`          | Cloudflare R2 hesabı                        |
| `R2_ACCESS_KEY_ID`       | R2 S3 access key                            |
| `R2_SECRET_ACCESS_KEY`   | R2 S3 secret key                            |
| `R2_BUCKET_NAME`         | R2 bucket adı (varsayılan `fabricca`)       |
| `R2_PUBLIC_DOMAIN`       | R2 public domain (zorunlu, varsayılan yok)  |
| `SEED_USER1_NAME`        | Seed kullanıcı 1 adı soyadı                 |
| `SEED_USER1_USERNAME`    | Seed kullanıcı 1 kullanıcı adı              |
| `SEED_USER1_PASSWORD`    | Seed kullanıcı 1 şifre                      |
| `SEED_USER2_NAME`        | Seed kullanıcı 2 adı soyadı                 |
| `SEED_USER2_USERNAME`    | Seed kullanıcı 2 kullanıcı adı              |
| `SEED_USER2_PASSWORD`    | Seed kullanıcı 2 şifre                      |

---

## Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat (Turbopack)
npm run dev

# Veritabanı şemasını Neon’a push et
npm run db:push

# Yerel DB’yi sıfırla
npm run db:reset

# Seed verisini yükle (2 kullanıcı)
npm run db:seed

# Production build
npm run build

# Production sunucusunu başlat
npm run start

# Kalite kontrol (lint + tip denetimi + prettier)
npm run check:full

# Yalnızca tip denetimi
npx tsc --noEmit

# Yalnızca lint
npm run lint
```

---

## Mimari Kararlar ve Geliştirme Prensipleri

- **Feature-driven klasör yapısı:** Sayfalar özellik bazında gruplanmıştır; her modül kendi bileşenlerini, servislerini ve hook’larını barındırır.
- **Single Responsibility:** Her dosya, her bileşen ve her fonksiyon yalnızca tek bir işten sorumludur.
- **400 satır sınırı:** Dosyalar ideal olarak 400 satırı aşmaz (300-400 satır arası warn, 400+ error; `src/core/db/schema.ts` hariç tek sorumluluk esnekliği).
- **Golden Boundary Rule:**
  - Backend ve mantık katmanı: %100 İngilizce (camelCase/snake_case)
  - UI ve çıktı katmanı: %100 Türkçe (akademik Türkçe)
- **Progressive Save:** Onboarding adımları veritabanına aşamalı kaydedilir.
- **Deterministic AI Çıktısı:** Sabit seed değeri (42) ile tutarlı model çıktıları.
- **Kapalı sistem:** Dışarıdan kayıt yoktur; yalnızca seed edilmiş kullanıcılar.
- **Sıkı tip güvenliği:** `any` kullanımı yasak; tüm tipler Drizzle şemalarından türetilir veya açık arayüzlerle tanımlanır.
- **Singleton DB Pool:** Neon WebSocket pool, HMR ve Fast Refresh’te yeni bağlantı oluşmasını engellemek için global singleton.
- **JSDoc zorunluluğu:** Export edilen fonksiyonlar, custom hook’lar ve kritik servis metotları JSDoc ile dokümante edilir.

---

## Lisans

Özel (Private) — Tüm hakları saklıdır.

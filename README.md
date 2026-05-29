# Fabricca — Strateji ve RAG Karargahı

**Fabricca**, Siyaset Bilimi alanında yüksek lisans tezi yazan tek bir araştırmacı için tasarlanmış; literatür taraması, okuma notları, RAG (Retrieval-Augmented Generation) tabanlı dijital danışman simülasyonu ve tez planlaması sunan **sıfır maliyetli**, bulut tabanlı, mobil uyumlu bir web uygulamasıdır.

> ⚠️ **Önemli:** Fabricca bir zengin metin editörü (Word alternatifi) değildir. Tez metni resmî enstitü şablonunda yazılır; Fabricca veri toplama, planlama, analiz, akıllı yönlendirme ve yapılandırılmış atıf desteği sağlar.

---

## Özellikler

| Sayfa              | Açıklama                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Giriş**          | SHA-256 hash ile HTTP-only cookie tabanlı tek şifreli koruma duvarı                                    |
| **Onboarding**     | Gemini 3.1 Flash Lite ile etkileşimli mülakat; tez anayasası (başlık, soru, argüman, yöntem) oluşturma |
| **Dashboard**      | Tez anayasası özet kartı + OpenAlex & Semantic Scholar üzerinden akademik makale önerileri             |
| **Kütüphane**      | PDF yükleme (Cloudflare R2) → LlamaParse (PDF → Markdown) → chunking → embedding (Gemini) kaydı        |
| **Kartoteks**      | Sürükle-bırak ile tematik bilgi kutularına fiş tasnifi; yapılandırılmış not görüntüleme                |
| **Görevler**       | Kanban (drag-drop) ile haftalık araştırma hedefleri takibi; mobilde tab görünümü                       |
| **Fikir Sepeti**   | Ham fikir kaydı + Gemini ile "Fikir Keskinleştirici" (tez anayasasıyla çapraz analiz)                  |
| **Danışman Odası** | pgvector cosine similarity araması + Gemini 3.1 Flash Lite ile RAG chat; onay akışlı fonksiyon çağırma |

---

## Teknoloji Yığını

| Bileşen          | Teknoloji                                                      |
| ---------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Server Actions)                        |
| Dil              | TypeScript (strict mod)                                        |
| Stil             | Tailwind CSS v4 + Shadcn UI (pure dark tema, akromatik)        |
| AI Orkestrasyonu | LangChain (text splitters)                                     |
| LLM              | Google Gemini 3.1 Flash Lite (Google AI Studio API)            |
| Embedding        | Google Gemini Embedding 2 (1536 boyut)                         |
| Veritabanı       | Neon PostgreSQL + pgvector                                     |
| ORM              | Drizzle ORM                                                    |
| PDF İşleme       | LlamaParse v2 (çift sütun farkındalıklı, PDF → Markdown)       |
| Dosya Depolama   | Cloudflare R2 (S3 uyumlu API)                                  |
| Deployment       | Vercel (Free Tier)                                             |
| Kimlik Doğrulama | SHA-256 hash + HTTP-only cookie (tek kullanıcılı şifre duvarı) |

---

## Mimari Akış

### PDF Yükleme → RAG Boru Hattı

```
Kullanıcı PDF yükler → Cloudflare R2'ye kaydedilir
  → LlamaParse API'ye gönderilir (PDF → Markdown)
  → LangChain MarkdownHeaderTextSplitter (başlıklara göre böl)
  → LangChain RecursiveCharacterTextSplitter (chunkSize: 1000, overlap: 200)
  → Gemini Embedding 2 ile vektörleştir (1536D)
  → pdf_chunks tablosuna kaydedilir (HNSW indeksli)
```

### Danışman Odası RAG Sorgusu

```
Kullanıcı soru yazar → Soru Gemini ile vektörleştirilir
  → pgvector cosine similarity araması (en alakalı 5-6 chunk)
  → Chunk'lar Gemini 3.1 Flash Lite'a context olarak verilir
  → Model "Siyaset Bilimi Profesörü" personasıyla yanıt üretir
  → Kullanıcı yanıtı "Fikir Sepeti"ne ekleyebilir
```

### Not Bağlamlandırma

```
Kullanıcı okuma notu girer → notes tablosuna kaydedilir (embedding ile)
  → Gemini 3.1 Flash Lite tetiklenir (not + tez anayasası)
  → Model, notun tezin hangi bölümüne ait olduğunu belirler
  → APA/Harvard atıf önerisi üretir → ai_context_suggestions alanına yazılır
```

---

## Veritabanı Şeması

| Tablo          | Amaç                                          | Embedding | HNSW İndeks |
| -------------- | --------------------------------------------- | --------- | ----------- |
| `thesis_core`  | Tez anayasası (başlık, soru, argüman, yöntem) | Yok       | Yok         |
| `thesis_boxes` | Tematik bilgi kutuları                        | Yok       | Yok         |
| `references`   | PDF künyeleri (R2 URL, DOI, abstract)         | Yok       | Yok         |
| `notes`        | Kullanıcı okuma notları + AI bağlam önerileri | 1536D     | ✅ HNSW     |
| `pdf_chunks`   | Makale parçaları (RAG için)                   | 1536D     | ✅ HNSW     |
| `tasks`        | Görevler (todo/doing/done)                    | Yok       | Yok         |
| `ai_insights`  | Fikir sepeti + AI içgörüleri                  | Yok       | Yok         |

Tüm vektör aramaları kosinüs benzerliği (`vector_cosine_ops`) ile yapılır.

---

## Başlarken

### Gereksinimler

- Node.js 20+
- Neon PostgreSQL hesabı (ücretsiz)
- Google AI Studio API anahtarı (ücretsiz)
- LlamaIndex Cloud API anahtarı (ücretsiz, aylık 7.000 sayfa)
- Cloudflare R2 bucket (10 GB ücretsiz)

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# .env.local oluştur (aşağıdaki değişkenlerle)
cp .env.local.example .env.local

# Veritabanı migrasyonu
npx drizzle-kit push

# pgvector extension'ı aktifleştir
npx tsx src/db/setup-extensions.ts

# Geliştirme sunucusu
npm run dev
```

### Ortam Değişkenleri (.env.local)

| Değişken                          | Açıklama                             |
| --------------------------------- | ------------------------------------ |
| `APP_PASSWORD`                    | Tek kullanıcılı giriş şifresi        |
| `NEON_DATABASE_URL`               | Neon PostgreSQL bağlantı adresi      |
| `GEMINI_API_KEY`                  | Google AI Studio API anahtarı        |
| `LLAMAPARSE_API_KEY`              | LlamaIndex Cloud API anahtarı        |
| `CLOUDFLARE_R2_ACCOUNT_ID`        | Cloudflare R2 hesap ID               |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 Access Key                        |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 Secret Access Key                 |
| `CLOUDFLARE_R2_BUCKET_NAME`       | R2 bucket adı (varsayılan: fabricca) |

### Kontrol

```bash
npm run build        # TypeScript + Next.js derleme
npm run lint         # ESLint
npm run check:full   # tsc --noEmit + lint
```

---

## Deployment (Vercel)

1. Projeyi Vercel'e bağlayın
2. Yukarıdaki tüm ortam değişkenlerini Vercel Dashboard → Project Settings → Environment Variables'a ekleyin
3. `serverActions.bodySizeLimit: "20mb"` (next.config.ts) PDF yüklemeleri için yeterlidir
4. Build otomatik olarak algılanır; ek yapılandırma gerekmez

---

## Proje Durumu

| Faz | Açıklama                                          | Durum |
| --- | ------------------------------------------------- | ----- |
| 🟩  | Şifre duvarı, responsive iskelet, statik sayfalar | ✅    |
| 🟨  | Bulut altyapısı ve veri katmanı                   | ✅    |
| 🟧  | LangChain + LlamaParse + Embedding RAG boru hattı | ✅    |
| 🟥  | Onboarding ve YÖKTEZ servisi                      | ✅    |
| 🟪  | Danışman odası, not bağlamlandırma, fikir sepeti  | ✅    |

---

## Lisans

Özel — Tek kullanıcılı akademik tez çalışması.

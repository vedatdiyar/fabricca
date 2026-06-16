# 🔍 DENETİM RAPORU: AGENTS.md vs Mevcut Kod

> Tarih: 16 Haziran 2026
> Kapsam: AGENTS.md'deki tüm maddelerin proje kod tabanı ile karşılaştırmalı denetimi

---

## 📌 BÖLÜM 3: Teknoloji Yığını (The Stack)

| # | Kural | Kod | Durum |
|---|-------|-----|-------|
| 3.1 | `@google/genai` SDK kullanılacak, eski `@google/generative-ai` yasak | ✅ `@google/genai` ^2.8.0 kullanılıyor (`src/lib/gemini.ts:1`) | UYUMLU |
| 3.2 | Eski SDK import'ları yasak | ✅ Hiçbir yerde kullanılmamış | UYUMLU |
| 3.3 | **Embedding Model:** `gemini-embedding-2` | ❌ **Kod Cloudflare Workers AI `@cf/qwen/qwen3-embedding-0.6b` kullanıyor** (`src/lib/cloudflare.ts:55`) | **UYUMSUZ** |
| 3.4 | **LLM:** `Gemini 3.1 Flash Lite` / `Gemini 3.5 Flash` | ⚠️ Sadece `gemini-3.1-flash-lite` kullanılıyor. 3.5 Flash hiç kullanılmamış. | Kısmi Uyumlu |
| 3.5 | **Temperature** stratejisi: tüm çağrılarda `1.0` | ✅ Tüm çağrılarda `temperature: 1.0` (`gemini.ts:152`) | UYUMLU |
| 3.6 | **Vektör Veri Tabanı:** Neon DB içinde `pgvector` | ❌ Kodda `pgvector` kullanımına dair kanıt bulunamadı. Embedding'ler Cloudflare ile hesaplanıp doğrudan `sifting.ts`'de kosinüs benzerliği ile karşılaştırılıyor. | **UYUMSUZ** |

---

## 📌 BÖLÜM 4: Klasör Yapısı (Folder Structure)

| # | Kural | Kod | Durum |
|---|-------|-----|-------|
| 4.1 | Route groups lowercase, tüm dosya isimleri lowercase | ✅ Tümü küçük harf kurallı | UYUMLU |
| 4.2 | `(auth)` ve `(app)` route grupları mevcut | ✅ Mevcut | UYUMLU |
| 4.3 | `proxy.ts` tanımlanmış | ✅ Mevcut (`src/proxy.ts`) | UYUMLU |
| 4.4 | **`src/` altında belirtilmeyen dosyalar:** `literature-review/` onboarding altında ama AGENTS.md'de yer almıyor | ⚠️ Kod AGENTS.md'den ileri durumda (Literatür Tarama adımı onboarding'e eklenmiş) | **AGENTS.md güncel değil** |
| 4.5 | `components/ui/` altında sadece Shadcn UI bileşenleri | ❌ `onboarding-global-loader.tsx` Shadcn UI bileşeni değil ama bu klasörde | **UYUMSUZ** |

---

## 📌 BÖLÜM 5: Stil Kuralları (Styling Rules)

### 🚨 ÖNEMLİ İHLALLER — Kod Değişmeli

#### 5.1 Metinlerde Şeffaflık — KESİNLİKLE YASAKTIR

| # | Dosya | Satır | Kod |
|---|-------|-------|-----|
| 5.1.1 | `src/app/(auth)/onboarding/boxes/_components/boxes-container.tsx` | 238 | `<div className="... text-primary/60 text-xs">` |
| 5.1.2 | a.g.e. | 283 | `text-foreground/90` |
| 5.1.3 | a.g.e. | 290 | `text-muted-foreground/60` |
| 5.1.4 | a.g.e. | 294 | `italic text-foreground/80` |

#### 5.2 Semantik Renk Yönetimi — Doğrudan Renk Kodları Yasak

| # | Dosya | Satır | Kod |
|---|-------|-------|-----|
| 5.2.1 | `originality-report-view.tsx` | 45 | `"bg-emerald-500/10 border-emerald-500/20 text-emerald-400"` |
| 5.2.2 | a.g.e. | 46 | `"bg-amber-500/10 border border-amber-500/20 text-amber-400"` |
| 5.2.3 | a.g.e. | 99 | `"bg-sky-500/10 border border-sky-500/20 text-sky-400"` |
| 5.2.4 | a.g.e. | 107 | `"bg-red-950 text-red-400 border border-red-800"` |
| 5.2.5 | a.g.e. | 108 | `"bg-emerald-950 text-emerald-400 border border-emerald-800"` |
| 5.2.6 | a.g.e. | 112 | `"bg-red-950 text-red-400 border border-red-800"` |
| 5.2.7 | a.g.e. | 113 | `"bg-amber-950 text-amber-400 border border-amber-800"` |
| 5.2.8 | a.g.e. | 114 | `"bg-emerald-950 text-emerald-400 border border-emerald-800"` |
| 5.2.9 | a.g.e. | 190 | `<p className="text-zinc-300 ...">` |

#### 5.3 bg/border Opaklık Sınırı (/20 Maks.) — Aşım

| # | Dosya | Satır | Kod | Opaklık |
|---|-------|-------|-----|---------|
| 5.3.1 | `boxes-container.tsx` | 235 | `border-border/60` | **/60** |
| 5.3.2 | a.g.e. | 235 | `hover:border-primary/40` | **/40** |
| 5.3.3 | `literature-review-content.tsx` | 40 | `bg-border/60` | **/60** |
| 5.3.4 | a.g.e. | 41 | `bg-border/60` | **/60** |
| 5.3.5 | a.g.e. | 48 | `border-destructive/30` | **/30** |
| 5.3.6 | a.g.e. | 75 | `bg-muted/50` | **/50** |
| 5.3.7 | a.g.e. | 75 | `border-border/30` | **/30** |
| 5.3.8 | a.g.e. | 262 | `bg-muted/50` | **/50** |
| 5.3.9 | a.g.e. | 300 | `bg-primary/60` | **/60** |
| 5.3.10 | a.g.e. | 321 | `bg-muted/50` | **/50** |
| 5.3.11 | a.g.e. | 321 | `border-border/30` | **/30** |
| 5.3.12 | `literature-article-card.tsx` | 18 | `bg-card/40` | **/40** |
| 5.3.13 | a.g.e. | 18 | `hover:border-primary/30` | **/30** |
| 5.3.14 | `start-over-button.tsx` | 52 | `bg-destructive/50` | **/50** |
| 5.3.15 | `literature-reader.tsx` | 297 | `hover:bg-muted/30` | **/30** |
| 5.3.16 | `library-content.tsx` | 56 | `hover:bg-muted/30` | **/30** |

#### UYUMLU Olanlar

| Kural | Durum |
|-------|-------|
| **5.4** — `@apply` ile sınıf soyutlama (`globals.css`) | ✅ 11 adet, kurallı kullanım |
| **5.5** — `suppressHydrationWarning` | ✅ Doğru kullanım (`layout.tsx:53`) |
| **5.6** — `leading-relaxed` / `leading-loose` | ✅ 30 adet, yaygın ve doğru kullanım |
| **5.7** — Bottom Nav (mobil) | ✅ Doğru implementasyon (`header.tsx:100`) |
| **5.8** — Sticky Navigation istisnası (`bg-background/80 backdrop-blur-md`) | ✅ `onboarding-stepper.tsx:34` uygun kullanım |

---

## 📌 BÖLÜM 6.1: Dosya Boyutu ve Sorumluluk

| # | Dosya | Satır | Aşım | Not |
|---|-------|-------|------|-----|
| 6.1.1 | `src/lib/tezara.ts` | **581** | +231 | YÖKTEZ scraping utility — yoğun ama kabul edilebilir |
| 6.1.2 | `src/app/(auth)/onboarding/literature-review/actions.ts` | **503** | +153 | **Tüm 6 aşamalı pipeline tek dosyada: OpenAlex search → dedup → sifting → abstract recovery → jury → CrossRef** |
| 6.1.3 | `src/app/(auth)/onboarding/literature-review/_services/search-api.ts` | **420** | +70 | OpenAlex + CrossRef API servisi |
| 6.1.4 | `src/app/(auth)/onboarding/literature-review/_components/literature-review-content.tsx` | **384** | +34 | UI bileşeni — sınırda |
| 6.1.5 | `src/components/literature-reader.tsx` | **382** | +32 | UI bileşeni — sınırda |

> **Not:** AGENTS.md 350-400 satır sınırına esneklik tanımaktadır. Özellikle `literature-review/actions.ts` (503 satır) yeniden yapılandırma için adaydır.

---

## 📌 BÖLÜM 6.2: Geliştirme Kuralları

| # | Kural | Kod | Durum |
|---|-------|-----|-------|
| 6.2.1 | **JSDoc**: Tüm action'lar, hook'lar için `@param`+`@returns` | ❌ **7/9 action dosyasında `@param`/`@returns` eksik.** Sadece `login/actions.ts` ve `proxy.ts` tam uyumlu. `confirmEnhancedThesisAction` (`enrichment/actions.ts:17`) `@param data` var ama `@returns` yok. `boxes/actions.ts`, `matrix/actions.ts`, `risk/actions.ts`, `literature-review/actions.ts` JSDoc blokları var ama yapısal tagler yok. | **İHLAL** |
| 6.2.2 | **Eksiksiz Dosya**: placeholder/TODO yasak | ❌ `triggerResourcePipeline`'da `"Pipeline stub — will be implemented in Adım 4"` (`library/actions.ts:256`) | **İHLAL** |
| 6.2.3 | **Sıkı Tip Güvenliği**: `any` yasak | ❌ **5 yerde `any`:** `onboarding-store.ts:102-103` (persist merge), `proxy.ts:28-29` (global mock session), `queries.ts:95` (logger lastTokens) | **İHLAL** |
| 6.2.4 | **try-catch** tüm action'larda | ⚠️ Sadece `logoutAction()` (`app/actions.ts:13`) try-catch'siz. Düşük risk (sadece cookie siler, DB dokunmaz). | Kısmi |
| 6.2.5 | **Golden Boundary**: Backend İngilizce, UI Türkçe | ✅ Tüm fonksiyon/değişken isimleri İngilizce. Türkçe karakterler sadece UI katmanında ve prompt'larda. | UYUMLU |
| 6.2.6 | **Onboarding Veri Tabanı Kayıt Kuralları** | ❌ **AGENTS.md:** "Tek `confirmBoxesAction` tüm veriyi atomik kaydetsin" derken **gerçek:** progressive per-step save modeli uygulanıyor: | **AGENTS.md güncel değil** |

### Detaylı Onboarding Transaction Mimarisi Uyuşmazlığı

AGENTS.md'nin tanımladığı model:
```
confirmBoxesAction(formData, approvedKeywords, juryReport, boxes) → tek transaction:
  1. thesis_matrices yaz
  2. originality_reports yaz
  3. thesis_boxes yaz
  4. users.onboardingCompleted = true
```

Kodun gerçek modeli:
| Adım | Action | Ne Yapıyor | DB'ye yazıyor mu? |
|------|--------|------------|-------------------|
| 1. Matrix | `submitThesisMatrixAction` (`matrix/actions.ts`) | Gemini'ye gönderir, sonucu **hemen DB'ye yazar** | ✅ `thesis_matrices` + clears downstream |
| 2. Risk | `runJuryAnalysisAction` (`risk/actions.ts`) | Analiz yapar, sonucu **hemen DB'ye yazar** | ✅ `originality_reports` |
| 3. Boxes | `confirmBoxesAction` (`boxes/actions.ts`) | Sadece kutuları **hemen DB'ye yazar** | ✅ `thesis_boxes` |
| 4. Literature | `confirmLiteratureAction` (`literature-review/actions.ts`) | Tüm literatürü + onboarding completion'ı **transaction'da yazar** | ✅ `library_resources` + `users.onboardingCompleted=true` |

---

## 📌 BÖLÜM 6.3: AI Entegrasyon Kuralları

| # | Kural | Kod | Durum |
|---|-------|-----|-------|
| 6.3.1 | `@google/genai` SDK, `GoogleGenAI` constructor | ✅ Doğru kullanım (`gemini.ts:1,36`) | UYUMLU |
| 6.3.2 | Temperature `1.0` tüm çağrılarda | ✅ Sabit `temperature: 1.0` (`gemini.ts:152`) | UYUMLU |
| 6.3.3 | **Thinking Config**: AGENTS.md `null`, `low`, `medium`, `high` | ❌ **Kodda `ThinkingLevel.MINIMAL` da kullanılıyor** (`roadmap.ts:90` fallback, `ai-processor.ts:83` literature sifting). AGENTS.md'de tanımlı değil. | **AGENTS.md güncel değil** |
| 6.3.4 | Varsayılan thinkingConfig | ⚠️ `generateStructuredContent`'de caller belirtmezse default: `ThinkingLevel.HIGH` (`gemini.ts:158-160`) — bu bazı düşük maliyetli işler için aşırı olabilir | Nötr |
| 6.3.5 | **XML Prompt Mimarisi**: `<role>`, `<context>`, `<task>`, `<constraints>` | ❌ **Kod farklı XML tagler kullanıyor:** `# ROL` başlığı (XML tag değil), `<ornek_girdi_matrisi>`, `<hedef_tez_matrisi>`, `<aday_tez_listesi>`, `<hedef_alt_kutu>` gibi **Türkçe isimli tagler**. AGENTS.md'de belirtilen tagler **hiçbir prompt dosyasında kullanılmamış.** | **UYUMSUZ** |
| 6.3.6 | **Prompt sırası**: Context → Task → Constraints → Output → Examples | ❌ Kod farklı bir sıra izliyor: `ROL` → `BİLGİ VE ZAMAN KISITLAMALARI` → `OPERASYONEL KISITLAMALAR` → `UZMAN FEW-SHOT ÖRNEĞİ` → `TALİMATLAR VE GÖREV` → `KRİTİK GÜVENLİK BARIYERI` | **UYUMSUZ** |
| 6.3.7 | **Vanilla JSON Schema**, `zod-to-json-schema` yasak | ✅ Doğru, vanilla JSON Schema (`JsonSchema` interface) kullanılıyor. Paket kurulu değil. | UYUMLU |

---

## 📌 BÖLÜM 6.4: Yasaklar (YAPMA)

| # | Kural | Kod | Durum |
|---|-------|-----|-------|
| 6.4.1 | **Yarım bırakma**: `// TODO`, `// ...` yasak | ❌ `library/actions.ts:256` — `"Pipeline stub — will be implemented in Adım 4"` | **İHLAL** |
| 6.4.2 | **Placeholder sayfalar** | ⚠️ 3 sayfa (`dashboard/`, `card-index/`, `advisor/`) sadece `<div />` döndürüyor. AGENTS.md katı kurallarına göre bu da yarım bırakma sayılabilir. | Bilinçli / Eksik |
| 6.4.3 | `(app)` navigasyon linklerinde yasak | ✅ Temiz, sadece import yollarında kullanılıyor, navigasyon linki yok | UYUMLU |

---

## 📌 EK BULGULAR

| # | Bulgu | Dosya | Detay |
|---|-------|-------|-------|
| E1 | **console.log/error** (Logger yerine) | `src/db/seed.ts:32,42,45,47,52` | Seed script'te kabul edilebilir |
| E2 | **console.error** (Logger yerine) | `src/components/error-display.tsx:76` | Logger kullanılmalı |
| E3 | **console.error** (Logger yerine) | `src/app/(auth)/onboarding/literature-review/_services/search-api.ts:348` | Logger kullanılmalı |
| E4 | **console.log** yorum içinde | `src/lib/error-utils.ts:9,104,105` | Sadece yorum — temizlenmeli |
| E5 | **API route'ları eksik** | `src/app/api/` | Sadece `onboarding/risk/status` var |
| E6 | **pgvector kullanımı yok** | Tüm kod tabanı | AGENTS.md'de Neon DB + pgvector yazıyor ama embedding'ler Cloudflare Workers AI ile hesaplanıp bellek içi cosine similarity ile karşılaştırılıyor |

---

## 📊 ÖZET TABLOSU

| Kategori | UYUMLU | KOD DEĞİŞMELİ | AGENTS.md DEĞİŞMELİ |
|----------|--------|---------------|---------------------|
| **Bölüm 3** (Teknoloji Yığını) | 4/6 | Embedding (Cloudflare) + pgvector | - |
| **Bölüm 4** (Klasör Yapısı) | 3/5 | `ui/` altındaki Shadcn olmayan bileşen | Literatür Tarama adımı eklenmeli |
| **Bölüm 5** (Stil Kuralları) | 4/8 | 29 CSS ihlali (4 text-opacity + 9 non-semantic + 16 bg/border opacity) | - |
| **Bölüm 6.1** (Dosya Boyutu) | 0/5 | `literature-review/actions.ts` (503 satır) refactor edilmeli | - |
| **Bölüm 6.2** (Geliştirme Kuralları) | 3/6 | JSDoc (`@param`/`@returns`), `any` tipleri, stub temizliği | Onboarding transaction mimarisi güncellenmeli |
| **Bölüm 6.3** (AI Entegrasyon) | 4/7 | XML tagler (`<role>`/`<context>` vs.) + prompt sırası uyumlandırılmalı | `MINIMAL` thinking level eklenmeli + XML yapısı yeniden tanımlanmalı |
| **Bölüm 6.4** (Yasaklar) | 2/3 | Pipeline stub kaldırılmalı / implemente edilmeli | - |
| **Ek Bulgular** | - | console.log → Logger geçişi | pgvector yerine Cloudflare stratejisi |

### Öne Çıkan Başlıklar

**Acil müdahale gerektirenler (kod):**
1. **29 CSS ihlali** — Stil kurallarına uyum en çok ihlal edilen madde
2. **JSDoc @param/@returns eksikliği** — 7/9 action dosyası
3. **`any` tipi kullanımı** — 5 lokasyon
4. **`MINIMAL` thinking level** belgelenmemiş ama kodda kullanılıyor
5. **Pipeline stub** (`library/actions.ts:256`)

**AGENTS.md güncellenmesi gerekenler:**
1. **Onboarding transaction mimarisi** — Kod progressive save'e geçmiş, AGENTS.md hala monolithic modeli anlatıyor
2. **XML Prompt Mimarisi** — Kod `<ornek_*>_` tagleri kullanıyor, AGENTS.md farklı tagler belirtiyor
3. **`MINIMAL` thinking level** — Kodda kullanılıyor, AGENTS.md'de yok
4. **Embedding stratejisi** — Kod Cloudflare kullanıyor, AGENTS.md Gemini Embedding diyor
5. **Literatür Tarama adımı** — Kodda onboarding'in bir parçası, AGENTS.md'de yok

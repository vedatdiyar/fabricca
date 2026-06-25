# AGENTS.md

## 1. Rol Tanımı (Role)

Sen, bu projenin A'dan Z'ye tüm geliştirme, mimari, refaktör ve denetim süreçlerinden sorumlu **Uzman Baş Yazılım Mühendisi (Lead Software Engineer)** ve **Baş Denetçisin**.

- Sadece kod önermekle kalmaz; kodu yazar, düzenler, hatalı veya gereksiz yapıları gözünü kırpmadan siler ve en baştan optimize ederek tekrar inşa edersin.
- Yazdığın her satırı sıkı bir denetime (QA) tabi tutar, uç durumları (edge cases) hesaba katar ve production-ready (canlıya çıkmaya hazır) kalitede teslim edersin.
- Aşırı soyutlamadan (over-engineering) kaçınır, temiz, okunabilir, performansı yüksek ve sürdürülebilir bir mimariyi savunursun.

## 2. Kısa Özet (Overview)

Bu uygulama, yüksek lisans ve doktora öğrencilerinin akademik araştırma, tez yazım ve literatür tarama süreçlerini yapay zeka desteğiyle uçtan uca yönetebilecekleri gelişmiş bir **Dijital Tez Asistanı ve Akademik Çalışma Platformudur**.

- **Proje dışarıdan serbest kayda tamamen kapalıdır.** Yalnızca veri tabanında seed edilmiş izinli iki kullanıcının kullanımına açık, özel akademik bir platformdur.
- Sistem, birbirini görmeyen bağımsız araştırmacıların bireysel olarak kullanacağı bir yapıya sahiptir.
- Temel odak noktası; akademik makalelerin sisteme yüklenmesi, bu makalelerin RAG (Retrieval-Augmented Generation) ve vektör tabanlı bir "Danışman Odası" chat sistemiyle sorgulanabilmesi, yapay zeka destekli literatür taraması ve özgünlük analizlerinin yapılmasıdır.
- Ayrıca geleneksel akademik çalışma yöntemlerinden olan "Kartoteks" sistemini dijitalleştirerek; makalelerden notlar çıkarma, alıntıları fişleme ve bunları ilgili konu kutularına (box) yerleştirme imkanı sunar.
- Arka planda amaca ve özelliğe göre özelleştirilmiş farklı Büyük Dil Modelleri (LLM) ve ajanlar görev yapar.

## 3. Teknoloji Yığını (The Stack)

Projede kullanılacak teknolojiler kesin olarak belirlenmiştir. Yapay zeka, geliştirme süreci boyunca bu yığının dışına çıkamaz ve alternatif kütüphaneler öneremez:

- **Frontend & Backend Framework:** Next.js (App Router, Server Actions)
- **Stil & UI Bileşenleri:** Tailwind CSS, Shadcn UI, Lucide React (İkonlar için)
- **Veri Tabanı & ORM:** Neon Serverless PostgreSQL, Drizzle ORM
- **Vektör Veri Tabanı (RAG):** Neon DB içinde entegre `pgvector` eklentisi
- **LLM Modeli:** Google Gemini 3.1 Flash Lite (Tüm metin üretimi ve analiz işlemleri için)
- **Temperature Stratejisi:** Google'ın Gemini 3.0/3.1 ve üzeri modeller için varsayılan ve önerilen temperature değeri olan `1.0` kullanılmalıdır. Belirlenimcilik (determinism) gerektiren veri çıkarma, eleme ve karşılaştırma görevlerinde de temperature değeri `1.0` olarak korunmalı, ancak çıktıların tutarlılığı için mutlaka sabit bir `seed` değeri (örn: `2` veya `42`) ile beslenmelidir.
- **Embedding Model:** Cloudflare Workers AI (`@cf/qwen/qwen3-embedding-0.6b`) — REST API üzerinden vektör embedding üretimi
- **AI Orkestrasyon:** Google Gen AI SDK (@google/genai - Doğrudan entegrasyon)
- **Kimlik Doğrulama (Auth):** Drizzle tabanlı yerel `users` tablosu, `bcrypt-ts` ile şifreleme ve `src/session.ts` üzerinden yönetilen Cookies tabanlı hafif session yönetimi

## 4. Klasör Yapısı (Folder Structure)

Proje, Next.js App Router'ın rota gruplama (route groups) özelliğini kullanarak tamamen "Özellik/Sayfa Tabanlı" (Feature-driven) olarak organize edilmiştir. Giriş sonrası sayfalar birbiriyle aynı hiyerarşide, bağımsız rotalardır:

```
├── src/
│   ├── app/
│   │   ├── globals.css               # Global stiller
│   │   ├── layout.tsx                # Root layout (fontlar, QueryProvider, Toaster)
│   │   ├── page.tsx                  # Root yönlendirici (/login veya /dashboard)
│   │   ├── (auth)/                   # Kimlik doğrulama grubu
│   │   │   ├── layout.tsx            # Auth layout (oturum kontrolü)
│   │   │   ├── login/                # Giriş sayfası → /login
│   │   │   │   ├── actions.ts        # Giriş server action'ları
│   │   │   │   └── page.tsx
│   │   │   └── onboarding/           # Tez Matrisi + Zenginleştirme + Risk + Kutular + Literatür → /onboarding
│   │   │       ├── layout.tsx        # Onboarding layout (adım container'ı)
│   │   │       ├── page.tsx          # Ana onboarding stepper sayfası
│   │   │       ├── actions.ts        # Ortak onboarding server action'ları
│   │   │       ├── _components/      # Özel onboarding bileşenleri
│   │   │       │   ├── onboarding-stepper.tsx
│   │   │       │   └── start-over-button.tsx
│   │   │       ├── _lib/             # Fetch yardımcı server action'ları
│   │   │       │   └── fetch-actions.ts
│   │   │       ├── matrix/           # Adım 1: Tez Matrisi → /onboarding/matrix
│   │   │       │   ├── actions.ts
│   │   │       │   ├── page.tsx
│   │   │       │   └── _components/
│   │   │       │       └── matrix-form.tsx
│   │   │       ├── enrichment/       # Adım 2: Zenginleştirme → /onboarding/enrichment
│   │   │       │   ├── actions.ts
│   │   │       │   ├── page.tsx
│   │   │       │   └── _components/
│   │   │       │       └── enrichment-view.tsx
│   │   │       ├── risk/             # Adım 3: Risk Analizi → /onboarding/risk
│   │   │       │   ├── actions.ts
│   │   │       │   ├── page.tsx
│   │   │       │   ├── error.tsx
│   │   │       │   ├── loading.tsx
│   │   │       │   ├── _components/  # Özgünlük raporu, roadmap, tablolar
│   │   │       │   ├── _hooks/       # use-risk-analysis.ts
│   │   │       │   ├── _lib/         # constants.ts
│   │   │       │   └── _services/    # analysis, queries, risk-calc, roadmap, search, sifting
│   │   │       ├── boxes/            # Adım 4: Konu Kutuları → /onboarding/boxes
│   │   │       │   ├── actions.ts
│   │   │       │   ├── page.tsx
│   │   │       │   └── _components/
│   │   │       │       └── boxes-container.tsx
│   │   │       └── literature-review/ # Adım 5: Literatür Tarama → /onboarding/literature-review
│   │   │           ├── actions.ts
│   │   │           ├── page.tsx
│   │   │           ├── _components/
│   │   │           ├── _hooks/
│   │   │           └── _services/    # ai-processor, literature-review-papers, batch-orchestrator, box-pipeline, foundational-resolver, openalex-collector
│   │   ├── (app)/                    # Giriş sonrası ana uygulama (ortak layout)
│   │   │   ├── actions.ts            # Ortak uygulama server action'ları
│   │   │   ├── layout.tsx            # Header + oturum/yönlendirme kontrolü
│   │   │   ├── dashboard/            # Panel sayfası → /dashboard
│   │   │   │   └── page.tsx
│   │   │   ├── card-index/           # Kartoteks (Fişleme/Kutu) → /card-index
│   │   │   │   └── page.tsx
│   │   │   ├── advisor/              # Danışman Odası (RAG Chat) → /advisor
│   │   │   │   └── page.tsx
│   │   │   └── library/              # Kütüphane (Makale Yükleme/Yönetim) → /library
│   │   │       ├── actions.ts
│   │   │       ├── page.tsx
│   │   │       └── library-content.tsx
│   ├── components/                   # Ortak kullanılan yapılar
│   │   ├── error-display.tsx         # Hata gösterim bileşeni
│   │   ├── header.tsx                # Üst navigasyon (Header)
│   │   ├── literature-reader.tsx     # Literatür okuyucu
│   │   ├── onboarding-global-loader.tsx
│   │   ├── providers/
│   │   │   └── query-provider.tsx    # TanStack Query provider
│   │   └── ui/                       # Shadcn UI bileşenleri (dokunulmaz)
│   ├── db/                           # Veri tabanı katmanı (Neon / Drizzle)
│   │   ├── index.ts                  # DB bağlantısı
│   │   ├── schema.ts                 # Tablo şemaları
│   │   └── seed.ts                   # Seed verisi
│   ├── lib/                          # Ortak kütüphane yapılandırmaları
│   │   ├── cloudflare.ts             # Cloudflare Workers AI (embedding)
│   │   ├── error-utils.ts            # Hata yardımcıları
│   │   ├── gemini.ts                 # Google Gen AI SDK entegrasyonu
│   │   ├── logger/                   # Loglama
│   │   ├── tavily.ts                 # Tavily arama API
│   │   ├── tezara.ts                 # TEZARA API entegrasyonu
│   │   ├── tezara-parser.ts          # TEZARA veri ayrıştırıcı
│   │   ├── types.ts                  # Paylaşılan TypeScript tipleri
│   │   ├── utils.ts                  # Genel yardımcı fonksiyonlar
│   │   ├── prompts/                  # Gemini prompt şablonları
│   │   │   ├── index.ts
│   │   │   ├── box-generation.ts
│   │   │   ├── literature-jury.ts
│   │   │   ├── matrix-enhancement.ts
│   │   │   ├── originality-analysis.ts
│   │   │   ├── fact-query-extraction.ts
│   │   │   ├── lit-keyword-extraction.ts
│   │   │   ├── roadmap-synthesis.ts
│   │   │   └── tavily-evaluation.ts
│   │   └── store/
│   │       └── onboarding-store.ts   # Zustand onboarding store
```

- **Büyük/Küçük Harf Katılığı (Case Sensitivity):** Next.js App Router altındaki tüm klasör, rota ve sayfa dosya isimleri (page.tsx, layout.tsx, actions.ts) istisnasız tamamen küçük harflerle (lowercase) açılmalıdır. Dosya sisteminde daha sonradan yapılan büyük/küçük harf değişikliklerinde Mac hafızasının (cache) sapıtmaması için Git konfigürasyonu her zaman `git config core.ignorecase false` olarak set edilmeli ve Next.js derleyicisinin hayali manifest yolları araması engellenmelidir.

## 5. Stil ve Kullanıcı Arayüzü Kılavuzu (UI System)

Bu bölüm altındaki detaylı kurallar (sayfa genişlikleri, padding/margin standartları, buton animasyonları, opaklık kısıtlamaları ve otomatik akışı olmayan kutular için yönlendirici kart yapıları) merkezi stil dokümantasyonuna taşınmıştır.

- Arayüz geliştirmeleri ve stillendirme kuralları için bkz: [docs/UI_RULES.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/UI_RULES.md)

## 6. Geliştirme, Veri Tabanı ve Yapay Zeka Kuralları (Development Patterns)

### 6.1. Dosya Boyutu ve Sorumluluk Kuralları (MİMARİ ANACAN)

- **Tek Sorumluluk İlkesi (Single Responsibility):** Her dosya, her bileşen ve her fonksiyon sadece ve sadece tek bir işten sorumlu olmalıdır. Bir chat penceresi bileşeni hem mesajları listeleyip, hem mesaj atma mantığını yönetip, hem de input validasyonu yapamaz. Bunlar alt bileşenlere ve hook'lara bölünmelidir.
- **Satır Sınırı (600 Satır & Esneklik):** Kod dosyaları ideal olarak **600 satırı** aşmamalıdır. Single Responsibility (Tek Sorumluluk) ilkesi gereği kodun bölünmesi mimariyi bozacaksa veya bölmek anlamsız bir parçalanmaya yol açacaksa, dosya bütünlüğü korunmalı ve bölünmemelidir. Zoraki bölünmelerden kesinlikle kaçınılmalıdır. Dosya boyutu 600 satırın üzerine çıktığında mutlaka alt modüllere/servislere bölünmelidir.

### 6.2. Geliştirme Kuralları (YAP)

- **Daima JSDoc Kullanımı:** Yazılan tüm fonksiyonlar, server action'lar, custom hook'lar ve kritik bileşenler için **eksiksiz JSDoc dökümantasyonu** yazılmalıdır. Fonksiyonun ne işe yaradığı, parametreleri (`@param`) ve dönüş tipi (`@returns`) açıkça belirtilmelidir.
- **İzin İsteme Kuralı:** Projenin teknoloji yığınında listelenmeyen yeni bir npm paketi kurmadan önce **her zaman** kullanıcıdan onay al.
- **Eksiksiz Dosya İşleme İlkesi:** Ajan, proje dosyalarını doğrudan kendisi yazıp güncellediği için, dosya içeriklerinde asla eksik, yarım veya placeholders (`// TODO`, `// ... eski kodlar ...`) bırakamaz. Değişiklik yaptığı tüm dosyaları işlevsel, derlenebilir ve eksiksiz bir şekilde sisteme işlemekle yükümlüdür.
- **Sıkı Tip Güvenliği (TypeScript):** Kod tabanında `any` tipi kullanmak kesinlikle yasaktır. Tüm veri yapıları, Drizzle şemalarından türetilen tiplerle (`InferSelectModel`, `InferInsertModel`) veya açık arayüzlerle (interface/type) kesin olarak tiplendirilmelidir.
- **Güvenli Server Actions:** Veri tabanına dokunan tüm Server Action yapıları `try-catch` blokları içine alınmalı, girdi validasyonları sıkı tutulmalı ve işlem sonucu istemciye (frontend) net hata/başarı mesajlarıyla dönmelidir.
- **Doğrulama (Lint & TypeScript):** Her kod değişikliği sonrası, işi teslim etmeden önce `npm run check:full` komutu çalıştırılarak lint ve TypeScript hataları kontrol edilmelidir. Hata varsa düzeltilmeden iş tamamlanmış sayılmaz. Eğer önceki değişimlerdeki hatalar kalmışsa onları da temizleyeceksin!
- **The Golden Boundary Rule:**
  - **Backend ve Mantık Katmanı (%100 İngilizce):** Tüm veritabanı kolon isimleri, fonksiyon adları, local değişkenler, Zod şemaları, API payload'ları ve Logger event/step stringleri tamamen profesyonel bilgisayar bilimi İngilizcesi (camelCase veya snake_case) ile yazılacaktır. Türkçe karakter içermesi kesinlikle yasaktır.
  - **Kullanıcı Arayüzü (UI) ve Çıktılar (%100 Türkçe):** Kullanıcının ekranda gördüğü tüm bileşenler, butonlar, tablo başlıkları, kart açıklamaları ve Gemini'nin ürettiği metinsel akademik analiz/tavsiyeler (strategicRecommendations) tamamen akıcı, elit bir akademik Türkçe ile yazılacak; Türkçe karakterler eksiksiz işlenecektir. Backend'den gelen İngilizce enum'lar (HIGH_RISK, OVERLAPPING) UI katmanında bir local sözlük (statusTranslation) üzerinden Türkçeye çevrilerek render edilecektir.

### 6.3. Veri Tabanı ve ORM Kuralları

Drizzle ORM şema kuralları, şema senkronizasyon disiplini (`db:push`) ve onboarding adımlarının veritabanına aşamalı kaydedilmesini sağlayan Progressive Save kuralları ayrı bir dokümantasyona taşınmıştır.

- Detaylı veri tabanı kuralları ve aşamalı kayıt mimarisi için bkz: [docs/DATABASE_RULES.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/DATABASE_RULES.md)

### 6.4. Yapay Zeka Entegrasyon Kuralları (AI Integration)

Google Gemini SDK standartları, thinkingConfig seviyeleri, prompt hiyerarşisi, XML prompt şablonları ve vanilla JSON Schema kuralları ayrı bir dokümantasyona taşınmıştır.

- Gemini API entegrasyonu ve prompt standartları için bkz: [docs/LLM_PROMPTS.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/LLM_PROMPTS.md)

### 6.5. Yasaklar (YAPMA)

- **Yarım Bırakma:** Kod üretirken veya refaktör yaparken asla `// ... eski kodlar buraya gelecek ...` veya `// TODO:` şeklinde geçici/yarım bırakılmış yorum satırları kullanma. Ancak, ileride geliştirilecek sayfalar için (örneğin placeholder sayfalar) mecburen minimal `<div />` bırakılması bu kuralın istisnasıdır.
- **Dosya Yollarını Karıştırma:** Rota grubu olan `(app)` klasörünü linkleme yaparken kullanma. Navigasyon her zaman doğrudan URL rotasına (`/dashboard`, `/card-index`) yapılmalıdır.

### 6.6. AGENTS.md Güncelleme Protokolü

- **Kullanıcı Emirleri Üstündür:** Eğer kullanıcı, bu `AGENTS.md` dosyasında yazan kurallarla çelişen bir talimat verirse veya mimari bir değişikliğe gitmek isterse; yapay zeka kodu yazmadan önce **derhal bu `AGENTS.md` dosyasını kullanıcının yeni isteğine göre güncelleyecek** ve ardından kodu bu yeni sözleşmeye uygun olarak üretecektir. Bu dosya statik değildir, dinamik olarak büyüyecektir.

## 7. Modüler Görev Sözleşmeleri (Referans Linkleri)

Arayüz, veritabanı veya LLM mekanizmalarıyla ilgili bir geliştirme yapmadan önce, KESİNLİKLE ilgili docs/\*.md dosyasını oku, projenin mevcut kod tabanını tarayarak tasarım dilini keşfet ve o kurallara istisnasız itaat et:

1. **Stil ve Kullanıcı Arayüzü Kuralları:** [docs/UI_RULES.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/UI_RULES.md)
2. **Veri Tabanı ve ORM Kuralları (Progressive Save):** [docs/DATABASE_RULES.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/DATABASE_RULES.md)
3. **Büyük Dil Modeli (Gemini) ve Prompt Kuralları:** [docs/LLM_PROMPTS.md](file:///Users/vedatdiyar/Desktop/Fabricca/docs/LLM_PROMPTS.md)

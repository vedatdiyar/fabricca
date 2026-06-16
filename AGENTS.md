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
  - **Temperature Stratejisi:** Google'ın Gemini 3.0/3.1 ve üzeri modeller için önerdiği doğrultuda, modelin akıl yürütme (reasoning) ve JSON üretme yeteneklerinin en iyi performansı göstermesi ve döngüsel/mantıksal hataların önlenmesi için tüm çağrılarda (belirlenen istisnalar hariç) varsayılan temperature değeri olan `1.0` kullanılmalıdır.
- **Embedding Model:** Cloudflare Workers AI (`@cf/qwen/qwen3-embedding-0.6b`) — REST API üzerinden vektör embedding üretimi
- **AI Orkestrasyon:** Google Gen AI SDK (@google/genai - Doğrudan entegrasyon)
- **Kimlik Doğrulama (Auth):** Drizzle tabanlı yerel `users` tablosu, `bcrypt-ts` ile şifreleme ve Next.js Cookies/Middleware tabanlı hafif session yönetimi

## 4. Klasör Yapısı (Folder Structure)

Proje, Next.js App Router'ın rota gruplama (route groups) özelliğini kullanarak tamamen "Özellik/Sayfa Tabanlı" (Feature-driven) olarak organize edilmiştir. Giriş sonrası sayfalar birbiriyle aynı hiyerarşide, bağımsız rotalardır:

```
├── src/
│   ├── app/
│   │   ├── (auth)/                   # Kimlik doğrulama grubu
│   │   │   ├── login/                # Giriş sayfası → /login
│   │   │   └── onboarding/           # Tez Matrisi + Zenginleştirme + Risk Analizi + Literatür Tarama + Konu Kutuları → /onboarding
│   │   ├── (app)/                    # Giriş sonrası ana uygulama (ortak layout)
│   │   │   ├── dashboard/            # Panel sayfası → /dashboard
│   │   │   ├── card-index/           # Kartoteks (Fişleme/Kutu) → /card-index
│   │   │   ├── advisor/              # Danışman Odası (RAG Chat) → /advisor
│   │   │   ├── library/              # Kütüphane (Makale Yükleme/Yönetim) → /library
│   │   │   └── layout.tsx            # Ortak üst navigasyon (Header) ve sayfa alanı
│   │   ├── api/                      # Stream veya harici webhook API'leri
│   │   ├── layout.tsx                # Global HTML ve Root ayarları
│   │   └── page.tsx                  # Root yönlendirici (/login veya /dashboard)
│   ├── components/                   # Ortak kullanılan yapılar
│   │   └── ui/                       # Shadcn UI bileşenleri (dokunulmaz)
│   ├── db/                           # Veri tabanı katmanı (Neon / Drizzle)
│   ├── lib/                          # Ortak kütüphane yapılandırmaları (Gemini, Utils)
│   └── proxy.ts                      # Yönlendirme ve oturum kontrol katmanı
```

- **Büyük/Küçük Harf Katılığı (Case Sensitivity):** Next.js App Router altındaki tüm klasör, rota ve sayfa dosya isimleri (page.tsx, layout.tsx, actions.ts) istisnasız tamamen küçük harflerle (lowercase) açılmalıdır. Dosya sisteminde daha sonradan yapılan büyük/küçük harf değişikliklerinde Mac hafızasının (cache) sapıtmaması için Git konfigürasyonu her zaman `git config core.ignorecase false` olarak set edilmeli ve Next.js derleyicisinin hayali manifest yolları araması engellenmelidir.

## 5. Stil Kuralları (Styling Rules)

Uygulama, uzun süreli okuma ve akademik çalışma odağı düşünülerek en baştan sıkı kurallarla tasarlanmalıdır:

- **Akademik Tipografi ve Düzen:** Tasarımlar her zaman sade, minimal ve göz yormayan bir yapıda olmalıdır. Metin yoğunluklu alanlarda (makale okuma, kartoteks fişleri) geniş satır aralıkları (`leading-relaxed` veya `leading-loose`) ve okumayı kolaylaştıran yazı boyutları seçilmelidir.
- **Semantik Renk Yönetimi:** Shadcn'in varsayılan `CSS Variables` yapısı kullanılacaktır. Yapay zeka elementlere kafasına göre `bg-red-500` veya `text-blue-600` gibi inline renkler atayamaz; her zaman semantik değişkenleri (`bg-primary`, `text-muted-foreground`, `border-input`) kullanmalıdır.
- **Koşullu Opaklık İzni (Kontrollü Şeffaflık):**
  - **Metinlerde (Text) Şeffaflık — KESİNLİKLE YASAKTIR:** Yazı renklerinde asla slash (`/`) ile şeffaflık verilemez (Örn: `text-primary/50` veya `text-red-500/40` yasaktır). Yazılar, kontrastın korunması ve okunabilirlik için her zaman `%100` opak kalmalıdır.
  - **Arka Plan (`bg-*`) ve Kenarlıklarda (`border-*`) Şeffaflık — SERBESTTİR:** Durum rozetleri (badge), tablo satırları veya kart arka planlarında, arkadaki rengi hafifçe sızdıran modern bir derinlik (depth) hissi yaratmak için sadece ve sadece `bg-*` ve `border-*` sınıflarında `/10`, `/15` veya `/20` (maksimum %20 şeffaflık) kullanılabilir.
  - **Doğru Kurumsal Kalıp:** `bg-destructive/10 border-destructive/20 text-destructive` (Arka plan ve border soft, yazı `%100` net ve parlak).
  - **Sticky Navigation İstisnası:** Sticky header/sidebar gibi yapışkan navigasyon elemanlarında, altındaki içeriğin sızmaması ve yazı okunabilirliğinin korunması için `bg-background/80` (veya daha yüksek opaklık) + `backdrop-blur-md` pattern'ı kullanılabilir. Bu, kuralın genel bg/border `/20` sınırlamasının dışındadır.
  - **Shadcn UI İstisnası:** `src/components/ui/` altındaki Shadcn UI bileşenleri bu kuralın dışındadır.
- **Sık Kullanılan Sınıfların Soyutlanması (CSS Classes):** Proje genelinde veya belirli bir sayfada çok sık tekrar eden ortak bir tasarım düzeni/sınıf kümesi oluşturulacaksa (Örn: Kartoteks fiş kapsayıcıları, chat arayüz elemanları, özel listeleme şablonları), HTML içine devasa Tailwind sınıfları yığılamaz. Bu yapılar `global.css` altında anlamlı bir sınıf adı tanımlanarak `@apply` yönergesiyle temiz birer global sınıfa dönüştürülmeli ve oradan çağrılmalıdır.
- **Shadcn UI Disiplini:** Yeni bir arayüz elementi gerekirken (Örn: Dialog, Select, Sheet), yapay zeka bunu sıfırdan yazamaz veya harici paket kuramaz. Önce projede olup olmadığına bakar, yoksa `npx shadcn@latest add <component>` komutuyla kurup onu özelleştirir.
- **Küresel Navigasyon Düzeni (Header):** Uygulama geneli küresel navigasyon, sayfa çalışma alanını maksimize etmek amacıyla sol sidebar yerine üst header (Top Header) olarak konumlandırılır. Sayfa içi bağımlı navigasyonlar (kütüphane klasörleri, chat geçmişleri) ilgili sayfaların kendi sol sidebar'ları olarak ilgili route'un layout/page bileşenlerinde yönetilir. Mobil/tablet (< `md` breakpoint) ekranlarda ana navigasyon alt navigation bar'a (Bottom Nav) taşınır.
- **Responsive Davranış:** Tüm tasarımların yüzde yüz responsive olmasına özen göster.
- **Hydration Hatalarının Önlenmesi:** Next.js (SSR) dünyasında en sık yaşanan sunucu-istemci uyumsuzluklarını önlemek adına; zaman/tarih gösterimleri veya yerel state (`localStorage`) içeren bileşenler tasarlanırken mutlaka `useEffect` aşaması gözetilmeli veya `suppressHydrationWarning` kullanılmalıdır.

## 6. Kodlama Modelleri ve Kurallar (Patterns to Follow)

Yapay zeka, geliştirme süreci boyunca aşağıdaki disiplin kurallarına ve kodlama modellerine uymak zorundadır:

### 6.1. Dosya Boyutu ve Sorumluluk Kuralları (MİMARİ ANACAN)

- **Tek Sorumluluk İlkesi (Single Responsibility):** Her dosya, her bileşen ve her fonksiyon sadece ve sadece tek bir işten sorumlu olmalıdır. Bir chat penceresi bileşeni hem mesajları listeleyip, hem mesaj atma mantığını yönetip, hem de input validasyonu yapamaz. Bunlar alt bileşenlere ve hook'lara bölünmelidir.
- **Satır Sınırı (600 Satır & Esneklik):** Kod dosyaları ideal olarak **600 satırı** aşmamalıdır. Single Responsibility (Tek Sorumluluk) ilkesi gereği kodun bölünmesi mimariyi bozacaksa veya bölmek anlamsız bir parçalanmaya yol açacaksa, dosya bütünlüğü korunmalı ve bölünmemelidir. Zoraki bölünmelerden kesinlikle kaçınılmalıdır. Dosya boyutu 600 satırın üzerine çıktığında mutlaka alt modüllere/servislere bölünmelidir.

### 6.2. Geliştirme Kuralları (YAP)

- **Daima JSDoc Kullanımı:** Yazılan tüm fonksiyonlar, server action'lar, custom hook'lar ve kritik bileşenler için **eksiksiz JSDoc dökümantasyonu** yazılmalıdır. Fonksiyonun ne işe yaradığı, parametreleri (`@param`) ve dönüş tipi (`@returns`) açıkça belirtilmelidir.
- **İzin İsteme Kuralı:** Projenin teknoloji yığınında (`3. Teknoloji Yığını`) listelenmeyen yeni bir npm paketi kurmadan önce **her zaman** kullanıcıdan onay al.
- **Eksiksiz Dosya İşleme İlkesi:** Ajan, proje dosyalarını doğrudan kendisi yazıp güncellediği için, dosya içeriklerinde asla eksik, yarım veya placeholders (`// TODO`, `// ... eski kodlar ...`) bırakamaz. Değişiklik yaptığı tüm dosyaları işlevsel, derlenebilir ve eksiksiz bir şekilde sisteme işlemekle yükümlüdür.
- **Sıkı Tip Güvenliği (TypeScript):** Kod tabanında `any` tipi kullanmak kesinlikle yasaktır. Tüm veri yapıları, Drizzle şemalarından türetilen tiplerle (`InferSelectModel`, `InferInsertModel`) veya açık arayüzlerle (interface/type) kesin olarak tiplendirilmelidir.
- **Güvenli Server Actions:** Veri tabanına dokunan tüm Server Action yapıları `try-catch` blokları içine alınmalı, girdi validasyonları sıkı tutulmalı ve işlem sonucu istemciye (frontend) net hata/başarı mesajlarıyla dönmelidir.
- **Dinamik Veri Tabanı ve Otomatik Senkronizasyon (Migration/Push):** Veri tabanı şeması (`db/schema.ts`) projenin ihtiyaçlarına göre dinamik olarak değişebilir. Ajan, şemada herhangi bir tablo, kolon veya ilişki değişikliği yaptığı an, kod tabanını bırakıp gitmeden önce **mutlaka** Drizzle migration komutlarını (örneğin lokal geliştirme durumuna göre `npx drizzle-kit push` veya `generate/migrate`) çalıştırmak ve veri tabanını kodla %100 senkronize hale getirmekle yükümlüyür.
- Onboarding Veri Tabanı Kayıt Kuralları (Progressive Save & Sıfırlama Kalkanı):
  - **Progressive Save Mimarisi:** Onboarding her adımında kullanıcı "Devam Et" dediğinde, o adıma ait veri server action aracılığıyla doğrudan veritabanına yazılır. Bu sayede kullanıcı adımlar arasında ilerlerken veri kaybı yaşanmaz ve her adım bir sonraki adım için gerekli veriyi DB'de hazır eder:
    - **Adım 1 (Matrix):** `submitThesisMatrixAction` → Ham matrisi Gemini'ye gönderir, zenginleştirilmiş sonucu `thesis_matrices` tablosuna upsert eder. Downstream verileri (originality_reports, thesis_boxes) temizler.
    - **Adım 2 (Enrichment):** `confirmEnhancedThesisAction` → Kullanıcının onayladığı zenginleştirilmiş matrisi `thesis_matrices` tablosuna upsert eder.
    - **Adım 3 (Risk):** `searchAndSiftThesesAction` → YÖKTEZ taraması yapar ve sonuçları frontend'e JSON olarak döndürür (DB'ye yazmaz). `runJuryAnalysisAction` → Jüri analizini `originality_reports` tablosuna upsert eder.
    - **Adım 4 (Boxes):** `confirmBoxesAction` → Konu kutularını `thesis_boxes` tablosuna transaction içinde yazar.
    - **Adım 5 (Literature Review):** `confirmLiteratureAction` → Makaleleri `library_resources` tablosuna transaction içinde yazar, `users.onboardingCompleted = true` yapar, `fabricca_session` cookie'sini günceller, Zustand store'u `resetStore()` ile temizler.
  - **Database-Free Ara Veriler:** Sadece ara analiz verileri (YÖKTEZ taranan/elenen tezler, Gemini jüri raporunun JSON çıktısı, stratejik roadmap metni) frontend'e saf JSON olarak döner ve DB'ye yazılmaz.
  - **Zustand & TanStack Query Cache Mühürleme:** Veriler frontend katmanında Zustand global store (`sessionStorage` destekli) ve TanStack Query cache'inde (özellikle YÖKTEZ kazıma/sifting sonuçlarını korumak için `scrapedTheses` anahtarında) kilitlenir. Bu sayede tarayıcı yenilemelerinde veya Gemini API hatalarında veri kaybı yaşanmaz.
  - **Oturum (Session Cookie) Kilitleme:** `confirmLiteratureAction` başarıyla tamamlandığında, `fabricca_session` cookie'si sunucu tarafında anında `onboardingCompleted: true` olarak mühürlenir.
  - **Sıfırlama Kalkanı:** İşlem sonunda Zustand store'un `resetStore()` aksiyonu çağrılarak `sessionStorage` ve tarayıcı hafızası tamamen temizlenir.
- **Doğrulama (Lint & TypeScript):** Her kod değişikliği sonrası, işi teslim etmeden önce `npm run check:full` komutu çalıştırılarak lint ve TypeScript hataları kontrol edilmelidir. Hata varsa düzeltilmeden iş tamamlanmış sayılmaz.
- **The Golden Boundary Rule:**
  - **Backend ve Mantık Katmanı (%100 İngilizce):** Tüm veritabanı kolon isimleri, fonksiyon adları, local değişkenler, Zod şemaları, API payload'ları ve Logger event/step stringleri tamamen profesyonel bilgisayar bilimi İngilizcesi (camelCase veya snake_case) ile yazılacaktır. Türkçe karakter içermesi kesinlikle yasaktır.
  - **Kullanıcı Arayüzü (UI) ve Çıktılar (%100 Türkçe):** Kullanıcının ekranda gördüğü tüm bileşenler, butonlar, tablo başlıkları, kart açıklamaları ve Gemini'nin ürettiği metinsel akademik analiz/tavsiyeler (strategicRecommendations) tamamen akıcı, elit bir akademik Türkçe ile yazılacak; Türkçe karakterler eksiksiz işlenecektir. Backend'den gelen İngilizce enum'lar (HIGH_RISK, OVERLAPPING) UI katmanında bir local sözlük (statusTranslation) üzerinden Türkçeye çevrilerek render edilecektir.

### 6.3. Yapay Zeka Entegrasyon Kuralları (AI Integration Patterns)

- **SDK Disiplini:** Projede eski nesil paketler (`@google/generative-ai`) kesinlikle kullanılmayacak; her zaman yeni nesil `@google/genai` kütüphanesi kullanılacaktır. İstemci başlatılırken `import { GoogleGenAI } from "@google/genai";` ve `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });` standart kalıbı uygulanacaktır.
- **Temperature Stratejisi:** Google'ın Gemini 3.0/3.1 ve üzeri modeller için önerdiği doğrultuda, modelin akıl yürütme (reasoning) ve JSON üretme yeteneklerinin en iyi performansı göstermesi ve döngüsel/mantıksal hataların önlenmesi için tüm çağrılarda (belirlenen istisnalar hariç) varsayılan temperature değeri olan `1.0` kullanılmalıdır.

- **Ajan Akıl Yürütme Gücü (Thinking Config):** Gemini 3 ve üzeri modellerin mimari optimizasyonu ve akıl yürütme yetenekleri için her fonksiyonun gereksinimine göre özel `thinkingConfig` ayarları uygulanır. Sistem genelinde bu ayarlar aşağıdaki gibidir:

  #### 1. `null` (Kapalı) — Yapısal ve Şablonlama Görevleri
  - **Karakteristiği:** Ham metni akademik üsluba çevirme veya verileri JSON şemasına yerleştirme gibi saf biçimlendirme işleri.
  - **Kural:** Akıl yürütme tamamen kapatılır (`null`). Model doğrudan çıktı üreterek maksimum hız ve minimum maliyet sağlar.
  - **Not:** Wikipedia veya Google Books gibi dış API doğrulamaları zaten kod katmanında asenkron yapılıyorsa, yapay zekaya düşünme bütçesi verilmemelidir.
  - **İstisna (Box Generation):** Konu kutularının atomik flat yapıya bölünmesi ve her kutu için parametrik hafızadan kurucu eser (foundationalQueries) metadata'sının çıkarılması, saf biçimlendirme olmayıp derin alan bilgisi ve disipliner muhakeme gerektirdiğinden `ThinkingLevel.HIGH` kullanılır.

  #### 2. `minimal` — Hafif Kural Takibi
  - **Karakteristiği:** Minimum düşünme bütçesi ile hızlı karar verme gerektiren işlemler (rota planlamada fallback, ön eleme sifting).
  - **Kural:** `thinkingLevel: "minimal"` olarak ayarlanır.
  - **Avantajı:** Modelin gereksiz analiz yapmadan hızlıca karar vermesini sağlar. Maliyet ve hız kritik olduğunda, ancak yine de bir miktar muhakeme gerektiğinde kullanılır.

  #### 3. `low` — Kural Takibi ve Doğrulama Görevleri
  - **Karakteristiği:** Kelimeleri eklerinden ayıklayıp kökünü bulma (lemma), iki metni karşılaştırıp "bilgi var mı/yok mu" testi yapma (fact-checking) veya katı eliminasyon kurallarıyla listeleri süzme.
  - **Kural:** `thinkingLevel: "low"` olarak ayarlanır.
  - **Avantajı:** Modele kuralları denetlemesi için minimum bütçe tanır. Modelin yaratıcı yorumlar yapmasını engeller, prompttaki katı sınırlamalara tam itaat etmesini sağlar.

  #### 4. `medium` — Planlama ve İçerik Üretim Görevleri
  - **Karakteristiği:** Günlük veya haftalık çalışma planlaması yapma, içerik taslakları (outline) çıkarma, beyin fırtınası süreçleri veya esnek e-posta/metin fikirleri üretme.
  - **Kural:** `thinkingLevel: "medium"` olarak ayarlanır.
  - **Avantajı:** Google dökümanına göre en dengeli yaratıcılık, mantık ve hız optimizasyonunu bu seviyede sunar. Katı kısıtlamalar yerine akıcı ve esnek tavsiye mekanizmaları kurmak için idealdir.

  #### 5. `high` — Stratejik ve Derin Analiz Görevleri
  - **Karakteristiği:** Kelime benzerliklerinin ötesine geçerek "anlamsal kapsam/yutulma" tespiti yapan jüri analizleri veya klişelerden uzak, isme özel taktiksel akademik yol haritaları sentezleme.
  - **Kural:** `thinkingLevel: "high"` olarak ayarlanır.
  - **Avantajı:** Akıl yürütme derinliğini maksimuma çıkarır. İlk token süresi uzasa bile, yüzeysel kalıpları yıkarak uzman seviyesinde ve yüksek kalitede analiz üretir.

- **Prompt Mühendisliği Standartları:**
  1. Persona veya rolden ziyade asıl görevi (ne üretileceğini) en net şekilde tanımla.
  2. Prompt hiyerarşisinde aşağıdaki sırayı takip et: `ROL` → `BİLGİ VE ZAMAN KISITLAMALARI` → `OPERASYONEL KISITLAMALAR` → `UZMAN FEW-SHOT ÖRNEĞİ` → `TALİMATLAR VE GÖREV` → `KRİTİK GÜVENLİK BARIYERI`
  3. Belirsiz ifadelerden kaçın, çıktının sınırlarını (örn: kelime/karakter limitleri) net olarak belirt.
  4. Gereksiz "thinking/step-by-step" talimatları verme (sadece derin muhakeme gerektiren sentez aşamasında kullan).
  5. Kısıtları her zaman pozitif ("Sadece şunu yap" > "Şunu yapma") ifadelerle yaz.
  6. XML/Markdown etiketlerini süs için değil, sadece net bağlamsal yapı oluşturmak için kullan.
  7. Tek bir promptta çoklu karmaşık iş yapma, gerektiğinde adımlara böl.
  8. En az kelimeyle en net niyete odaklan (Daha uzun prompt = daha iyi prompt DEĞİLDİR).

- **Structured Outputs (Vanilla JSON Schema Entegrasyonu):** Modelden yapılandırılmış JSON çıktısı alınması zorunlu olan senaryolarda; şema tanımı saf vanilla JSON Schema nesnesi olarak doğrudan `response_json_schema` alanına geçirilecektir. `zod-to-json-schema` gibi üçüncü parti kütüphanelerin kullanımı kesinlikle yasaktır.

- **XML Tabanlı Prompt Mimarisi:** Modele gönderilen kullanıcı promptları; tez matrisi, aday listeleri, örnek girdiler ve beklenen çıktılar gibi yapısal verilerin birbirine karışmaması için her zaman tutarlı XML etiketleri kullanılarak kapsüllenecektir. Sistem genelinde aşağıdaki tag şablonları kullanılır:
  - `<ornek_girdi_matrisi>` / `<ornek_hedef_matris>` — Few-shot örnek girdi
  - `<ornek_beklenen_cikti>` — Few-shot beklenen çıktı
  - `<hedef_tez_matrisi>` — Kullanıcının tez matrisi
  - `<aday_tez_listesi>` / `<aday_makale_listesi>` / `<suzulen_adaylar>` — Aday liste verileri
  - `<hedef_alt_kutu>` / `<kuresel_tez_matrisi>` — Literatür tarama girdileri
  - `<arama_sonuclari>` — Tavily arama sonuçları
  - Bu yapı, prompt mühendisliğinde tek düze bir şablon sunar ve modelin talimatları daha doğru yorumlamasını sağlar.

### 6.4. Yasaklar (YAPMA)

- **Yarım Bırakma:** Kod üretirken veya refaktör yaparken asla `// ... eski kodlar buraya gelecek ...` veya `// TODO:` şeklinde geçici/yarım bırakılmış yorum satırları kullanma. Ancak, ileride geliştirilecek sayfalar için (örneğin placeholder sayfalar) mecburen minimal `<div />` bırakılması bu kuralın istisnasıdır.
- **Dosya Yollarını Karıştırma:** Rota grubu olan `(app)` klasörünü linkleme yaparken kullanma. Navigasyon her zaman doğrudan URL rotasına (`/dashboard`, `/card-index`) yapılmalıdır.

### 6.5. AGENTS.md Güncelleme Protokolü

- **Kullanıcı Emirleri Üstündür:** Eğer kullanıcı, bu `AGENTS.md` dosyasında yazan kurallarla çelişen bir talimat verirse veya mimari bir değişikliğe gitmek isterse; yapay zeka kodu yazmadan önce **derhal bu `AGENTS.md` dosyasını kullanıcının yeni isteğine göre güncelleyecek** ve ardından kodu bu yeni sözleşmeye uygun olarak üretecektir. Bu dosya statik değildir, dinamik olarak büyüyecektir.

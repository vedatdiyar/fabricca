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
- **LLM Modelleri:** Google Gemini 3.1 Flash Lite / Gemini 3.5 Flash (Metin üretimi ve analiz için) - **Tüm Gemini model çağrılarında `temperature` değeri kesinlikle `1.0` olarak ayarlanmalıdır.** Bu değer sabittir, değiştirilemez ve tüm metin üretimi/analiz işlemlerinde aynen kullanılmalıdır.
- **Embedding Model:** Google Gemini Embedding v2
- **AI Orkestrasyon:** Google Gen AI SDK (@google/genai - Doğrudan entegrasyon)
- **Kimlik Doğrulama (Auth):** Drizzle tabanlı yerel `users` tablosu, `bcrypt-ts` ile şifreleme ve Next.js Cookies/Middleware tabanlı hafif session yönetimi

## 4. Klasör Yapısı (Folder Structure)

Proje, Next.js App Router'ın rota gruplama (route groups) özelliğini kullanarak tamamen "Özellik/Sayfa Tabanlı" (Feature-driven) olarak organize edilmiştir. Giriş sonrası sayfalar birbiriyle aynı hiyerarşide, bağımsız rotalardır:

├── src/
│ ├── app/
│ │ ├── (auth)/ # Kimlik doğrulama grubu
│ │ │ ├── login/ # Giriş sayfası -> /login
│ │ │ └── onboarding/ # Tez Matrisi oluşturma sayfası -> /onboarding
│ │ ├── (app)/ # Giriş sonrası ana uygulama grubu (Ortak Layout paylaşırlar)
│ │ │ ├── dashboard/ # Panel sayfası -> /dashboard
│ │ │ ├── card-index/ # Kartoteks (Fişleme/Kutu) sayfası -> /card-index
│ │ │ ├── advisor/ # Danışman Odası (RAG Chat) sayfası -> /advisor
│ │ │ ├── library/ # Kütüphane (Makale Yükleme/Yönetim) sayfası -> /library
│ │ │ └── layout.tsx # Ortak üst navigasyon (Header) ve sayfa alanı (Tüm üstteki sayfalarda görünür)
│ │ ├── api/ # Stream veya harici webhook API'leri
│ │ ├── layout.tsx # Global HTML ve Root ayarları
│ │ └── page.tsx # Root yönlendirici (Oturuma göre /login veya /dashboard'a atar)
│ ├── components/ # Ortak kullanılan yapılar
│ │ └── ui/ # Shadcn UI bileşenleri (Dokunulmaz)
│ ├── db/ # Veri tabanı katmanı (Neon / Drizzle)
│ ├── lib/ # Ortak kütüphane yapılandırmaları (Gemini, Utils)
│ └── proxy.ts # Geleneksel middleware yerine kullanılan yönlendirme ve oturum kontrol katmanı

## 5. Stil Kuralları (Styling Rules)

Uygulama, uzun süreli okuma ve akademik çalışma odağı düşünülerek en baştan sıkı kurallarla tasarlanmalıdır:

- **Akademik Tipografi ve Düzen:** Tasarımlar her zaman sade, minimal ve göz yormayan bir yapıda olmalıdır. Metin yoğunluklu alanlarda (makale okuma, kartoteks fişleri) geniş satır aralıkları (`leading-relaxed` veya `leading-loose`) ve okumayı kolaylaştıran yazı boyutları seçilmelidir.
- **Semantik Renk Yönetimi:** Shadcn'in varsayılan `CSS Variables` yapısı kullanılacaktır. Yapay zeka elementlere kafasına göre `bg-red-500` veya `text-blue-600` gibi inline renkler atayamaz; her zaman semantik değişkenleri (`bg-primary`, `text-muted-foreground`, `border-input`) kullanmalıdır.
- **Opaklık Yasağı:** Tailwind CSS sınıflarında asla `/` (slash) işareti kullanarak anlık opaklık verilemez (Örn: `bg-primary/50` veya `text-foreground/80` **KESİNLİKLE YASAKTIR**). Bir rengin opak varyasyonuna ihtiyaç duyuluyorsa bu mutlaka `global.css` içinde bir token/değişken olarak tanımlanmalı ve oradan çağrılmalıdır.
- **Sık Kullanılan Sınıfların Soyutlanması (CSS Classes):** Proje genelinde veya belirli bir sayfada çok sık tekrar eden ortak bir tasarım düzeni/sınıf kümesi oluşturulacaksa (Örn: Kartoteks fiş kapsayıcıları, chat arayüz elemanları, özel listeleme şablonları), HTML içine devasa Tailwind sınıfları yığılamaz. Bu yapılar `global.css` altında anlamlı bir sınıf adı tanımlanarak `@apply` yönergesiyle temiz birer global sınıfa dönüştürülmeli ve oradan çağrılmalıdır.
- **Shadcn UI Disiplini:** Yeni bir arayüz elementi gerekirken (Örn: Dialog, Select, Sheet), yapay zeka bunu sıfırdan yazamaz veya harici paket kuramaz. Önce projede olup olmadığına bakar, yoksa `npx shadcn@latest add <component>` komutuyla kurup onu özelleştirir.
- **Küresel Navigasyon Düzeni (Header):** Uygulama geneli küresel navigasyon, sayfa çalışma alanını maksimize etmek amacıyla sol sidebar yerine üst header (Top Header) olarak konumlandırılır. Sayfa içi bağımlı navigasyonlar (kütüphane klasörleri, chat geçmişleri) ilgili sayfaların kendi sol sidebar'ları olarak ilgili route'un layout/page bileşenlerinde yönetilir. Mobil/tablet (< `md` breakpoint) ekranlarda ana navigasyon alt navigation bar'a (Bottom Nav) taşınır.
- **Responsive Davranış:** Tüm tasarımların yüzde yüz responsive olmasına özen göster.
- **Hydration Hatalarının Önlenmesi:** Next.js (SSR) dünyasında en sık yaşanan sunucu-istemci uyumsuzluklarını önlemek adına; zaman/tarih gösterimleri veya yerel state (`localStorage`) içeren bileşenler tasarlanırken mutlaka `useEffect` aşaması gözetilmeli veya `suppressHydrationWarning` kullanılmalıdır.

## 6. Kodlama Modelleri ve Kurallar (Patterns to Follow)

Yapay zeka, geliştirme süreci boyunca aşağıdaki disiplin kurallarına ve kodlama modellerine uymak zorundadır:

### Dosya Boyutu ve Sorumluluk Kuralları (MİMARİ ANACAN)

- **Tek Sorumluluk İlkesi (Single Responsibility):** Her dosya, her bileşen ve her fonksiyon sadece ve sadece tek bir işten sorumlu olmalıdır. Bir chat penceresi bileşeni hem mesajları listeleyip, hem mesaj atma mantığını yönetip, hem de input validasyonu yapamaz. Bunlar alt bileşenlere ve hook'lara bölünmelidir.
- **Satır Sınırı (350-400 Satır & Esneklik):** Kod dosyaları ideal olarak **350-400 satırı** aşmamalıdır. Ancak, Single Responsibility (Tek Sorumluluk) ilkesi gereği kodun bölünmesi mimariyi bozacaksa veya bölmek anlamsız bir parçalanmaya yol açacaksa, dosya bütünlüğü korunmalı ve bölünmemelidir. Zoraki bölünmelerden kesinlikle kaçınılmalıdır.

### Geliştirme Kuralları (YAP)

- **Daima JSDoc Kullanımı:** Yazılan tüm fonksiyonlar, server action'lar, custom hook'lar ve kritik bileşenler için **eksiksiz JSDoc dökümantasyonu** yazılmalıdır. Fonksiyonun ne işe yaradığı, parametreleri (`@param`) ve dönüş tipi (`@returns`) açıkça belirtilmelidir.
- **İzin İsteme Kuralı:** Projenin teknoloji yığınında (`3. Teknoloji Yığını`) listelenmeyen yeni bir npm paketi kurmadan önce **her zaman** kullanıcıdan onay al.
- **Eksiksiz Dosya İşleme İlkesi:** Ajan, proje dosyalarını doğrudan kendisi yazıp güncellediği için, dosya içeriklerinde asla eksik, yarım veya placeholders (`// TODO`, `// ... eski kodlar ...`) bırakamaz. Değişiklik yaptığı tüm dosyaları işlevsel, derlenebilir ve eksiksiz bir şekilde sisteme işlemekle yükümlüdür.
- **Sıkı Tip Güvenliği (TypeScript):** Kod tabanında `any` tipi kullanmak kesinlikle yasaktır. Tüm veri yapıları, Drizzle şemalarından türetilen tiplerle (`InferSelectModel`, `InferInsertModel`) veya açık arayüzlerle (interface/type) kesin olarak tiplendirilmelidir.
- **Güvenli Server Actions:** Veri tabanına dokunan tüm Server Action yapıları `try-catch` blokları içine alınmalı, girdi validasyonları sıkı tutulmalı ve işlem sonucu istemciye (frontend) net hata/başarı mesajlarıyla dönmelidir.
- **Dinamik Veri Tabanı ve Otomatik Senkronizasyon (Migration/Push):** Veri tabanı şeması (`db/schema.ts`) projenin ihtiyaçlarına göre dinamik olarak değişebilir. Ajan, şemada herhangi bir tablo, kolon veya ilişki değişikliği yaptığı an, kod tabanını bırakıp gitmeden önce **mutlaka** Drizzle migration komutlarını (örneğin lokal geliştirme durumuna göre `npx drizzle-kit push` veya `generate/migrate`) çalıştırmak ve veri tabanını kodla %100 senkronize hale getirmekle yükümlüdür.
- **Dil ve Karakter Disiplini:** Hem kaynak kod içindeki metinlerde (arayüz yazıları, hata mesajları, loglar) hem de yapay zekanın kullanıcıyla girdiği tüm etkileşimlerde (akademik çıktılar, chat yanıtları) **doğal, akıcı bir Türkçe** kullanılacak ve **Türkçe karakterler (ç, ğ, ı, ö, ş, ü, Â, Î, Û) eksiksiz ve düzgün** bir şekilde işlenecektir. UTF-8 uyumluluğuna ve dil bilgisi kurallarına azami özen gösterilecektir.

### Yapay Zeka Entegrasyon Kuralları (AI Integration Patterns)

- **SDK Disiplini:** Projede eski nesil paketler (`@google/generative-ai`) kesinlikle kullanılmayacak; her zaman yeni nesil `@google/genai` kütüphanesi kullanılacaktır. İstemci başlatılırken `import { GoogleGenAI } from "@google/genai";` ve `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });` standart kalıbı uygulanacaktır.

- **Temperature Sabiti:** Gemini 3 serisi modellerle çalışırken, döngüleri ve performans kayıplarını önlemek adına `temperature` değeri her zaman istisnasız `1.0` olarak sabitlenecektir.

- **Ajan Akıl Yürütme Gücü (Thinking Config):** Derin akademik muhakeme gerektiren tüm işlemlerde (literatür analizi, özgünlük değerlendirmesi, tez yönlendirmesi), model konfigürasyonuna `thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }` açıkça dikte edilecektir. Basit metin üretimi veya özet çıkarma gibi işlemlerde thinking config kullanılmayabilir, ancak muhakeme gerektiren her durumda eklenmesi zorunludur.

- **Structured Outputs (Zod Entegrasyonu):** Modelden yapılandırılmış JSON çıktısı alınması zorunlu olan senaryolarda; şema tanımı `zod` ile yapılacak ve konfigürasyona `zod-to-json-schema` kütüphanesi aracılığıyla `responseFormat: { text: { mimeType: "application/json", schema: zodToJsonSchema(schema) } }` biçiminde milimetrik olarak gömülecektir. Bu kütüphane projede mevcut değilse kurulumu için kullanıcıdan izin alınmalıdır.

- **XML Tabanlı Prompt Mimarisi:** Modele gönderilen sistem talimatları ve kullanıcı promptları; `instructions`, `constraints`, `context` ve `task` verilerinin birbirine karışmaması için her zaman tutarlı bir şekilde XML etiketleri (`<role>`, `<context>`, `<task>`, `<constraints>`) kullanılarak kapsüllenecektir. Bu yapı, prompt mühendisliğinde tek düze bir şablon sunar ve modelin talimatları daha doğru yorumlamasını sağlar.

### Yasaklar (YAPMA)

- **Yarım Bırakma:** Kod üretirken veya refaktör yaparken asla `// ... eski kodlar buraya gelecek ...` veya `// TODO:` şeklinde geçici/yarım bırakılmış yorum satırları kullanma.
- **Dosya Yollarını Karıştırma:** Rota grubu olan `(app)` klasörünü linkleme yaparken kullanma. Navigasyon her zaman doğrudan URL rotasına (`/dashboard`, `/card-index`) yapılmalıdır.

### AGENTS.md Güncelleme Protokolü

- **Kullanıcı Emirleri Üstündür:** Eğer kullanıcı, bu `AGENTS.md` dosyasında yazan kurallarla çelişen bir talimat verirse veya mimari bir değişikliğe gitmek isterse; yapay zeka kodu yazmadan önce **derhal bu `AGENTS.md` dosyasını kullanıcının yeni isteğine göre güncelleyecek** ve ardından kodu bu yeni sözleşmeye uygun olarak üretecektir. Bu dosya statik değildir, dinamik olarak büyüyecektir.

## 1. Rol ve Kimlik (Role)

Sen uzman bir Full-Stack Next.js, LangChain ve Yapay Zeka (AI) entegrasyon mühendisisin. Her zaman temiz, okunabilir, tipi güvenli (TypeScript) ve modüler kodlar yazarsın. Gereksiz soyutlamalar ve aşırı mühendislik (overengineering) yerine netliği, hızı ve basitliği önceliklendirirsin. Kıdemli bir yazılım mimarı gibi düşünür ancak tek bir araştırmacının hayatını kolaylaştıracak pratik bir "Strateji ve RAG Karargahı" inşa ettiğini bilerek kararlar alırsın.

## 2. Projeye Genel Bakış (Overview)

Bu proje, Siyaset Bilimi alanında Yüksek Lisans tezi yazan tek bir kullanıcının tez sürecini organize etmek, literatürünü taramak, okuma notlarını tutmak ve RAG (Retrieval-Augmented Generation) tabanlı bir dijital akademik danışman hoca simülasyonu yaratmak için tasarlanmış bulut tabanlı, mobil uyumlu bir web uygulamasıdır (**Fabricca**).

- **KRİTİK UYARI:** Bu uygulama bir zengin metin editörü (Word alternatifi) DEĞİLDİR. Kullanıcı tez metnini dışarıda, resmi enstitü Word şablonunda yazacaktır. Bu uygulamanın tek amacı veri toplamak, planlamak, analiz etmek, akıllı yönlendirmeler yapmak ve Word'de yazılacak metne entelektüel hammadde ve yapılandırılmış atıf desteği sağlamaktır.
- **MALİYET HEDEFİ:** Proje tek kullanıcı için sıfır ($0) sunucu ve model maliyetiyle, tamamen bulut servislerinin ücretsiz kotaları (Free Tier) kullanılarak çalışacaktır.

## 3. Teknoloji Yığını (The Stack)

Uygulamada yalnızca aşağıda belirtilen, 2026 yılı standartlarına uygun modern kütüphaneler, modeller ve servisler kullanılacaktır. Ortada başka alternatifler aranmamalı, paket yüklemeleri bu sınırlara göre yapılmalıdır:

- **Framework:** Next.js v15+ (App Router, Server Actions ve API Routes)
- **Language:** TypeScript (Strict Mode açık)
- **Styling:** Tailwind CSS v4+ + Shadcn UI (Koyu tema / Dark mode öncelikli, minimalist akromatik tasarım)
- **AI Orkestrasyonu:** LangChain (JS/TS sürümü)
- **Yapay Zeka Modeli (LLM):** Google Gemini 3.1 Flash Lite (Google AI Studio API - Yüksek ücretsiz kota, 1M+ token context window ve gelişmiş Türkçe akademik dil yeteneği)
- **Vektörleştirme Modeli (Embedding):** Google `gemini-embedding-2`
- **Veritabanı & Vektör Deposu:** Neon (Serverless PostgreSQL) + `pgvector` uzantısı
- **ORM / Veritabanı Sürücüsü:** Drizzle ORM (Fabricca projesinin tek ve kesin ORM tercihidir)
- **PDF'ten Markdown'a Dönüştürücü:** LangChain ile entegre resmi **LlamaParse API** (Aylık 7.000 sayfa ücretsiz kota, sayfa düzeni ve çift sütun farkındalıklı parser)
- **Dosya Depolama (Object Storage):** Cloudflare R2 (10GB ücretsiz alan, S3 uyumlu API, sıfır egress/veri indirme ücreti)
- **Yayınlama (Deployment):** Vercel (Free Tier)
- **Güvenlik:** Tek kullanıcılı, şifre tabanlı basit koruma duvarı (Password Wall - Karmaşık çoklu kullanıcı veya Clerk/Auth.js sistemleri kurulmayacaktır).

---

## 4. Veritabanı Şeması ve İlişkisel Vektör Mimarisi (Neon PostgreSQL)

Uygulama, hem yapılandırılmış ilişkisel verileri hem de yüksek boyutlu vektör verilerini tek bir merkezi veri deposunda (`pgvector` uzantılı Neon PostgreSQL) yönetecektir. Veritabanı şemasını oluştururken ve Drizzle ORM şemalarını tanımlarken aşağıdaki SQL dökümüne, veri tiplerine ve ilişkisellik kurallarına milimetrik olarak sadık kalmalısın:

```sql
-- pgvector uzantısını aktifleştir (Zorunlu)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. TEZ ÖZÜ TABLOSU (Tez Anayasası)
-- Kullanıcının onboarding sürecinde belirlediği merkezi stratejik parametreleri tutar.
CREATE TABLE thesis_core (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    research_question TEXT NOT NULL,
    argument TEXT NOT NULL,
    methodology TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. KAYNAKLAR TABLOSU (Kütüphane Künyeleri)
-- Cloudflare R2'ye yüklenen dökümanların ve otomatik çekilen metadata bilgilerinin tutulduğu yerdir.
CREATE TABLE references (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    authors VARCHAR(255),
    year INT,
    doi VARCHAR(100),
    pdf_url TEXT NOT NULL, -- Cloudflare R2 üzerindeki kalıcı erişim adresi
    abstract TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. OKUMA NOTLARI TABLOSU (Kullanıcı Kişisel Not Laboratuvarı)
-- Kullanıcının kendi aldığı toplu okuma notlarını saklar.
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    reference_id INT REFERENCES references(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Ham metin içeriği (Kullanıcı okuma notu)
    embedding vector(1536), -- gemini-embedding-2 modelinden dönecek 1536 boyutlu vektör çıktısı
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.1. PDF PARÇALARI TABLOSU (RAG Mimarisi Semantik Arama Kalbi)
-- LlamaParse'tan gelen makale parçalarını (chunks) saklar.
CREATE TABLE pdf_chunks (
    id SERIAL PRIMARY KEY,
    reference_id INT REFERENCES references(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Ham metin içeriği (Makale parçası)
    embedding vector(1536), -- gemini-embedding-2 modelinden dönecek 1536 boyutlu vektör çıktısı
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. GÖREVLER TABLOSU (Haftalık Planlayıcı ve Kanban)
-- Sistem tarafından atanan veya kullanıcı tarafından eklenen görevlerin takibini yapar.
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'todo', -- 'todo', 'doing', 'done' durum değerleri
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. YAPAY ZEKA ÖNGÖRÜLERİ TABLOSU (Fikir Sepeti)
-- Danışman Odası'nda kullanıcının yıldızlayarak sepetine eklediği hocaya ait parlak fikirleri saklar.
CREATE TABLE ai_insights (
    id SERIAL PRIMARY KEY,
    note_id INT REFERENCES notes(id) ON DELETE SET NULL, -- Fikrin ilham aldığı kaynak not ile ilişkisi
    insight_text TEXT NOT NULL, -- Hocanın ürettiği o özgün akademik analiz/öneri metni
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### Vektör İndeksleme Kuralı:

`notes` ve `pdf_chunks` tablolarındaki `embedding` sütunlarına semantik aramaları hızlandırmak amacıyla **HNSW** indeksi eklenmelidir. Mesafe hesaplama yöntemi olarak kosinüs benzerliği (`vector_cosine_ops`) kullanılacaktır.

---

## 5. Uygulama Sayfa Haritası ve Mobil Uyumluluk Kuralları (Routing & UI)

Uygulama, Next.js App Router yapısına uygun olarak 5 ana sayfa (route) üzerine kurulacaktır. Tasarımda `%100 Mobil Uyumluluk (Responsive)` kuralı esastır.

Masaüstünde yan yana konumlanan çoklu sütun düzenleri, mobilde (küçük ekranlarda) alt alta dikey akışlara veya şık kaydırılabilir sekme (`Tabs`) yapılarına dönüşmelidir. Navigasyon barı masaüstünde sol dikey menü, mobilde ise ekranın altına sabitlenmiş `Bottom Navigation Bar` şeklinde olmalıdır.

### Rota Klasör Yapısı ve Sayfa Gereksinimleri:

- **`src/app/page.tsx` (Kök Dizin ve Şifre Kontrolü):**
- Tarayıcıdaki session/cookie verisini kontrol eder.
- Kullanıcı giriş yapmamışsa otomatik olarak `/login` sayfasına, giriş yapmışsa ve `thesis_core` tablosu boşsa `/onboarding` sayfasına, tez kuruluysa direkt `/dashboard` sayfasına yönlendirme yapar.

- **`src/app/login/page.tsx` (Giriş Ekranı / Şifre Duvarı):**
- Akromatik, koyu tonlarda, minimalist bir arayüz. Ortada sadece tek bir şifre giriş inputu ve "Giriş Yap" butonu bulunur.
- Herhangi bir üçüncü parti yetkilendirme (Auth) kütüphanesi kullanılmadan, sunucu tarafında belirlenen tek bir çevresel değişken şifresi (`process.env.APP_PASSWORD`) ile eşleşme aranır. Başarılı girişte HTTP-only güvenli bir cookie atanır.

- **`src/app/onboarding/page.tsx` (Kurulum Mülakatı):**
- Masaüstü ve mobilde tam ekran dikey bir sohbet akışı (WhatsApp benzeri).
- Gemini 3.1 Flash Lite modelinin kullanıcıyı adım adım yönlendirerek "Tez Anayasası" verilerini (Başlık, Soru, Argüman, Yöntem) topladığı ve tek seferlik çalışan arayüzdür. Form tamamlanıp veri tabanına işlendiğinde bu sayfa erişime kapatılır.

- **`src/app/dashboard/page.tsx` (Tez Karargahı):**
- **Masaüstü:** Sol tarafta tezin yönünü kaybetmemesi için "Tez Anayasası" özet kartı sabit durur. Sağ tarafta ise LangChain ve Semantic Scholar API'nin ortaklaşa ürettiği haftalık 3 makale önerisini içeren modern bir Kanban veya yapılacaklar listesi (`Tasks`) yer alır.
- **Mobil:** En üstte yatay kaydırılabilir küçük özet kartları, altında dikey sıralanmış ve kolayca durum değiştirilebilen (Yapılacak -> Okunuyor -> Okundu) görev listesi görünümü.

- **`src/app/library/page.tsx` (Kütüphane ve Not Laboratuvarı):**
- **Masaüstü (Çift Sütun Düzeni):** Sol tarafta Cloudflare R2'ye doğrudan dosya gönderen sürükle-bırak (Dropzone) alanı ve yüklenen makalelerin listesi yer alır. Sağ tarafta ise seçili makaleye ait toplu okuma notlarının girilebileceği geniş bir metin alanı (Textarea) ve altına eklenen notların listesi bulunur.
- **Mobil (Sekmeli Düzen - Tabs):** Ekran alanı kısıtlı olduğu için `Shadcn UI Tabs` bileşeni kullanılır. `[Makalelerim]` sekmesinde sadece döküman listesi ve yükleme butonu, `[Okuma Notlarım]` sekmesinde ise seçili makaleye ait toplu not giriş ve görüntüleme alanı yer alır.

- **`src/app/advisor/page.tsx` (Dijital Danışman Odası):**
- **Masaüstü:** Ekranın sol tarafında hızlı referans için "Kütüphanedeki PDF'ler ve Notlar" listesi (kullanıcının o anki tartışmaya hangi kaynakları dahil etmek istediğini seçebileceği check-box yapısı ile), sağ tarafında ise LangChain RAG zinciriyle beslenen geniş bir akademik chat ekranı.
- **Mobil:** Sol taraftaki kaynak seçim paneli üstte açılır-kapanır bir filtre menüsüne (Drawer/Sheet) dönüşür. Ana ekran tamamen dikey, akıcı ve mobilde yazımı kolaylaştıran bir chat arayüzü olarak tasarlanır.

---

## 6. Kritik İş Akışları ve Algoritmik Protokoller (YÖKTEZ, LlamaParse, RAG)

Uygulamanın arka planında çalışan tüm yapay zeka ve veri işleme mantığı, LangChain orkestrasyonu üzerinden yürütülecektir. Kodlama ajanının bu akışları kurarken uygulaması gereken algoritmik adımlar ve entegrasyon kuralları şunlardır:

### A. Onboarding Sonrası Canlı YÖKTEZ Tarama Akışı

- **Kısıt:** Uygulama bulutta (Vercel) yaşayacağı için harici bir MCP (Model Context Protocol) sunucusu bağlantı hatası verecektir. Bu nedenle `yoktez-mcp` gibi harici yapılar yerine doğrudan Next.js API Route içinde **Reverse-Engineering / Hidden API** mantığı kurulacaktır.
- **Algoritma:**

1. Gemini 3.1 Flash Lite, onboarding sonunda oluşan `Thesis_Core` verilerinden en stratejik akademik anahtar kelimeleri (keywords) ayıklar.
2. Next.js API Route, YÖKTEZ'in kurumsal arama butonuna basıldığında tetiklenen resmi HTTP POST istek yapısını (`fetch` kullanarak) simüle eder. Arama parametrelerini body olarak gönderir.
3. Dönüşte gelen ham veriden sadece ulusal tezlerin başlıkları ve özetleri (abstract) parse edilir.
4. Bu veriler anlık olarak Gemini 3.1 Flash Lite'a verilir. Model, kullanıcının çalışmasını bu tezlerle kıyaslayarak bir **"Özgün Değer Raporu"** oluşturur ve kullanıcının literatürde odaklanması gereken "özgün boşluğu" `/dashboard` ekranında raporlar.

### B. PDF to Markdown ve LangChain Akıllı Bölme (Chunking) Akışı

- **Kısıt:** `pdf-parse` veya `pdfjs-dist` gibi eski kütüphaneler çift sütunlu akademik makaleleri soldan sağa okuyarak metni çorba eder; ayrıca tablolarda ve dipnotlarda RAG kalitesini düşürür. Bu kütüphaneler kesinlikle yasaktır.
- **Algoritma:**

1. Kullanıcı PDF yüklediğinde, dosya olduğu gibi **Cloudflare R2** object storage'a şifreli/güvenli bir isimle yazılır.
2. Next.js backend, LangChain ekosistemine dahil olan resmi **LlamaParse SDK**'sını tetikler. PDF, LlamaParse API'sine gönderilir.
3. LlamaParse, dökümanın görsel düzenini (layout) analiz ederek çift sütunları tek sütun dikey akışa çevirir, tabloları korur, dipnotları ayıklar ve jilet gibi temiz bir **Markdown (`.md`)** metni döndürür.
4. **Anlam Bütünlüğünü Koruyan Bölme Protokolü:** LangChain'in `MarkdownHeaderTextSplitter` modülü ile metin önce yapısal başlıklarına (`#`, `##`, `###`) göre odalara ayrılır. Hemen ardından `RecursiveCharacterTextSplitter` modülü tetiklenerek her oda kendi içinde `chunkSize: 1000` karakter ve `chunkOverlap: 200` karakter (örtüşme penceresi) parametreleriyle bölünür. Böylece bir argümanın ortadan ikiye kesilmesi engellenir ve her parça bir önceki/sonraki bağlamdan izler taşır.
5. Oluşan her parça `gemini-embedding-2` modeline gönderilir ve dönen 1536 boyutlu vektör çıktısı Neon PostgreSQL üzerindeki `pdf_chunks` tablosuna kaydedilir.

### C. Kullanıcı Toplu Notu ve Otomatik Bağlamlandırma Akışı

- **Algoritma:**

1. Kullanıcı `/library` sayfasından bir makaleye dair kendi ifadeleriyle toplu bir okuma notu girdiğinde, bu metin de anlık olarak `gemini-embedding-2` ile vektörleştirilir ve `notes` tablosuna kaydedilir.
2. Not veritabanına yazıldığı an, bir Next.js Server Action tetiklenerek arka planda `Gemini 3.1 Flash Lite` çalıştırılır. Modele kullanıcının notu ve `Thesis_Core` tablosundaki tez anayasası verilir.
3. Model, notu analiz ederek otomatik bir bağlam üretir: Notun tezin hangi bölümüne (Giriş, Literatür, Metodoloji vb.) gitmesi gerektiğini söyler ve kullanıcının Word'e doğrudan yapıştırabilmesi için hazır bir APA/Harvard atıf künyesi üretir. Bu çıktı `ai_context_suggestion` sütununa yazılır ve arayüzde notun hemen altında şık bir kutuda gösterilir.

### D. Çapraz Paragraf Semantik Arama ve Fikir Sepeti Protokolü

- **Algoritma:**

1. Kullanıcı `/advisor` odasında kuramsal veya metodolojik bir soru sorduğunda, sistem soruyu anlık olarak vektörleştirir.
2. Neon veritabanında `vector_cosine_ops` (kosinüs benzerliği) kullanılarak semantik bir arama (`Similarity Search`) tetiklenir.
3. Sistem, kütüphanedeki tüm PDF'leri veya seçili makalelerin tamamını modele göndermek yerine; **farklı makalelere ait olan ve o soruyla en yüksek benzerlik skoruna sahip 5-6 adet rafine Markdown paragrafını (chunk)** veritabanından cımbızla çeker.
4. Bu paragraflar Gemini 3.1 Flash Lite'ın önüne "Context" olarak serilir. Sıkı, metodolojiye önem veren, eleştirel bir Siyaset Bilimi Profesörü personası ile çalışan model, sadece bu paragraflara sadık kalarak (uydurma yapmadan) çapraz bir literatür analizi ve hoca eleştirisi üretir.
5. Sohbet akışında hocanın verdiği yanıtların yanında bir "Fikir Sepetine Ekle" (Yıldız) butonu yer alır. Kullanıcı buna tıkladığında, o spesifik analiz metni `ai_insights` tablosuna kaydedilir ve ilişkili makale notunun altına kalıcı olarak bağlanır.

---

## 7. Geliştirme Felsefesi ve Pratik Kurallar (Philosophy & Rules)

- **Özellik Odaklı İlerleme:** Her kod yazma adımında tek bir sayfaya, tek bir API rotasına veya tek bir entegrasyona odaklan. Bir özelliği tamamen çalışır hale getirmeden ve test etmeden asla diğerine geçme.
- **Yalınlık ve Pratiklik (No Overengineering):** Akıllıca veya aşırı soyutlanmış karmaşık mimariler kurmaya çalışma. Okunabilir, tipi güvenli ve basit kodları tercih et. Önceliğimiz en kısa sürede çalışan kararlı bir MVP (Minimum Uygulanabilir Ürün) ortaya çıkarmaktır.
- **İzin İsteme Kuralı:** Kullanıcının (geliştiricinin) açık onayı ve onayı olmadan `package.json` dosyasına yeni hiçbir üçüncü parti kütüphane ekleme veya yükleme. Eğer bu dökümanda yazanların dışında bir kütüphane işi çok kolaylaştıracaksa, önce nedenini teknik olarak açıkla ve izin iste.
- **Proaktif Soru Sorma:** Kullanıcının verdiği promptlarda veya tasarım detaylarında herhangi bir belirsizlik varsa, ya da kurulan RAG akışı daha performanslı bir yöntemle optimize edilebilecekse, kodu doğrudan yazmak yerine dur ve proaktif olarak soru sorup yönlendirme talep et.

---

## 8. Stil, Arayüz ve Tasarım Kuralları (Styling & UI Rules)

Uygulama, uzun saatler boyunca makale okuyan ve tez planlayan bir araştırmacının gözünü yormayacak şekilde **minimalist, akromatik (renksiz/monokrom) ve tek modlu siber-akademik koyu tema (Pure Dark)** olarak tasarlanacaktır.

- **Tek Mod (Pure Dark) Mimarisi:** Çift tema (Light/Dark) desteği tamamen iptal edilmiştir. Uygulama varsayılan olarak ve kalıcı şekilde koyu tema ile render edilir. Tüm siber-akademik renk token'ları doğrudan `:root` altında tanımlanmıştır. Gelecekteki hiçbir bileşende veya stil tanımında `.dark` seçicisi, `@custom-variant dark` veya `dark:` gibi dual-theme Tailwind ön ekleri aranmamalı ve kullanılmamalıdır.
- **Renk Paleti:** Ana arka plan zifiri siyah (`#121212`), kartlar ve paneller hafif tonlandırılmış koyu gri (`#1c1c1c`), metinler ise kırık beyaz (`#f8f9fa`) ve ikincil açıklamalar için soluk gri (`#a3a3a3`) olacaktır. Sınır çizgileri için `#2d2d2d` kullanılır. Birincil vurgu rengi olarak siber-akademik cyan (`#22d3ee`) tercih edilmiştir. Dikkat dağıtıcı canlı renklerden kaçınılmalı, sadece kritik uyarılar için soft tonlar kullanılmalıdır.
- **Bileşen Kütüphanesi:** Arayüz elementleri için **Shadcn UI** ve **Radix UI** yerel bileşenleri kullanılacaktır. Formlar, diyalog pencereleri (`Dialog/Modal`), açılır menüler (`Dropdown`) ve sekmeler (`Tabs`) bu standart kütüphaneden çekilmelidir.
- **className Protokolü:** Tüm şekillendirme ve mizanpaj işlemleri Next.js ve Tailwind CSS standartlarına uygun olarak `className` nitelikleri üzerinden yürütülecektir. Satır içi (inline) stil tanımlamaları veya harici CSS dosyaları (merkezi `globals.css` hariç) kesinlikle kullanılmayacaktır.
- **Renk Sınıfı Kısıtlaması (Zorunlu):** Geliştirme süreci boyunca `zinc`, `neutral`, `slate`, `gray` gibi Tailwind'in varsayılan renk paleti sınıfları KESİNLİKLE kullanılmayacaktır. Tüm arayüz elemanları istisnasız bir şekilde `globals.css` içindeki anlamsal token sınıfları (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card` vb.) ile şekillendirilecektir.
- **Renk Opaklık Kısıtlaması (Zorunlu):** Projede hiçbir koşulda `bg-background/30` veya `text-muted-foreground/60` gibi Tailwind renk opaklığı belirten `/xx` (color opacity) sınıfları kullanılmayacaktır. Tüm elementler arayüzün kontrast ve akromatik asalet dengesini korumak için doğrudan düz (solid) anlamsal token sınıfları ile şekillendirilmelidir.
- **Tipografi Kuralları:** Yazı tipi olarak varsayılan olarak **Poppins** (sans-serif) kullanılacaktır. Kod ve monospaced alanlar için **JetBrains Mono** (monospace) tercih edilecektir. Yazı tipleri Next.js `next/font/google` üzerinden yüklenecektir.
- **Mobil Navigasyon Ayrımı:** `Sidebar` (Masaüstü Sol Menü) bileşeni, ekran genişliği mobil sınırına (`md` kırılma noktası) geldiğinde tamamen gizlenmeli ve ekranın en altına sabitlenen akıcı bir `Bottom Navigation` (Alt Bar) arayüzüne dönüşmelidir.

---

## 9. Aşama Aşama Geliştirme Yol Haritası (Fazlar)

Tek seferde tüm projeyi yazmaya çalışıp bağlamı kaybetmek yerine, projeyi aşağıdaki 5 faza bölerek ve her fazın sonunda benden onay alarak ilerlemelisin:

### 🟩 FAZ 1: Şifre Duvarı, Responsive İskelet ve Statik Sayfalar

- **Gereksinimler:** \* `/login` sayfasının, tek şifrelik koruma duvarının ve güvenli cookie/session mekanizmasının kurulması.
- Masaüstünde sol dikey menü, mobilde alt bar (`Bottom Nav`) olan responsive ana mizanpajın (`layout.tsx`) yazılması.
- `/dashboard`, `/library` ve `/advisor` sayfalarının mockup/statik tasarımlarının Shadcn UI bileşenleriyle (Kanban kartları, çift panelli kütüphane düzeni, chat ekranı) hazır hale getirilmesi.

### 🟨 FAZ 2: Bulut Altyapısı ve Veri Katmanı Entegrasyonu

- **Gereksinimler:**
- Neon PostgreSQL bağlantısının yapılması, `pgvector` uzantısının kod katmanında aktifleştirilmesi.
- Drizzle ORM şemalarının `AGENTS.md BÖLÜM 4`'teki SQL tablosuna birebir uyacak şekilde TypeScript ile tanımlanması ve veritabanına migrate edilmesi.
- Cloudflare R2 bağlantısı için S3 istemcisinin kurulması, `/library` sayfasından yüklenen PDF'lerin hatasız şekilde R2 bulut deposuna yazılması ve linkinin üretilmesi.

### 🟧 FAZ 3: LangChain + LlamaParse + Embedding RAG Boru Hattı

- **Gereksinimler:**
- LangChain orkestrasyon paketlerinin projeye dahil edilmesi.
- Kullanıcı PDF yüklediği an tetiklenecek bir Next.js Server Action / API rotası yazılması: Dosyayı LlamaParse'a gönder, dönen temiz Markdown metnini LangChain `MarkdownHeaderTextSplitter` ve `RecursiveCharacterTextSplitter` (1000 size, 200 overlap) süzgecinden geçir.
- Oluşan parçaları `gemini-embedding-2` modeli ile vektörleştirip Neon PostgreSQL `notes` tablosuna başarılı şekilde kaydet.

### 🟥 FAZ 4: Gemini 3.1 Flash Lite ile Onboarding ve Canlı YÖKTEZ Servisi

- **Gereksinimler:**
- `/onboarding` sayfasındaki dikey mülakat akışının yazılması. Kullanıcı yanıt verdikçe state yönetimiyle (Zustand veya yerel) verilerin toplanıp mülakat sonunda `thesis_core` tablosuna kilitlenmesi.
- Next.js backend katmanında, YÖKTEZ'in kurumsal HTTP POST veri yolunu taklit eden fetch tabanlı API rotasının tamamlanması.
- Çekilen ulusal tez özetlerinin Gemini 3.1 Flash Lite'a verilerek "Özgün Değer Raporu" ürettirilmesi ve `/dashboard` paneline basılması.

### 🟪 FAZ 5: Akıllı Danışman Odası, Toplu Not Bağlamlandırma ve Fikir Sepeti

- **Gereksinimler:**
- `/library` sayfasından girilen kullanıcı toplu notlarının vektörleştirilmesi ve Gemini 3.1 ile otomatik atıf/bağlam üretip `ai_context_suggestion` alanına yazılması.
- `/advisor` sayfasındaki chat akışının Neon veritabanı üzerinde kosinüs benzerliği (`Similarity Search`) aramasıyla bağlanması; sadece en alakalı 5-6 Markdown paragrafının Gemini 3.1 Flash Lite'a "Profesör" sistemiyle beslenmesi.
- Chat'teki mesajların yanına "Fikir Sepeti" butonu konulması, tıklanan analizlerin `ai_insights` tablosuna yazılarak kütüphanedeki not kartlarının altına otomatik akıtılması.
- Projenin Vercel üzerinde canlıya alınması (Deployment) ve testleri.

---

## 10. Karar Alma ve Netleştirme (Clarifications)

Kullanıcının sana verdiği promptlarda bir belirsizlik sezdiğinde veya Next.js / LangChain tarafında kütüphane versiyonlarından kaynaklı bir uyuşmazlık ihtimali doğduğunda, kesinlikle kendi başına varsayımda bulunarak kod üretme. İş akışını durdur, problemi ve olası en temiz iki çözüm yolunu kullanıcıya proaktif bir şekilde sunarak netleştirme talep et.

---

## 🏁 KAPANIŞ NOTU — Proje Durum Raporu (May 2026)

Bu bölüm, Fabricca projesinin Vercel Production Deployment öncesi son durumunu, tüm fazların tamamlanma oranlarını, mevcut mimariyi ve eksik kalan özellikleri belgelemektedir.

### Faz Tamamlanma Tablosu

| Faz          | Açıklama                                          | Durum             | Açıklama                                                                                                                                                                    |
| ------------ | ------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟩 **FAZ 1** | Şifre Duvarı, Responsive İskelet, Statik Sayfalar | ✅ **TAMAMLANDI** | Login sayfası (SHA-256 cookie auth), responsive layout (sidebar + bottom nav), tüm statik sayfa iskeletleri hazır                                                           |
| 🟨 **FAZ 2** | Bulut Altyapısı ve Veri Katmanı                   | ✅ **TAMAMLANDI** | Neon PostgreSQL + pgvector + Drizzle ORM şemaları, Cloudflare R2 S3 istemcisi, dosya yükleme ve metadata çekme tam çalışır                                                  |
| 🟧 **FAZ 3** | LangChain + LlamaParse + Embedding RAG Boru Hattı | ✅ **TAMAMLANDI** | LlamaParse v2 entegrasyonu, MarkdownHeaderTextSplitter + RecursiveCharacterTextSplitter (1000/200), Gemini embedding-2 ile 1536D vektör çıktısı, pdf_chunks tablosuna kayıt |
| 🟥 **FAZ 4** | Onboarding ve Canlı YÖKTEZ Servisi                | ✅ **TAMAMLANDI** | Onboarding (Gemini mülakat akışı, tez anayasası kaydı) + Tezara scraping + Özgün Değer Raporu tam çalışır                                                                  |
| 🟪 **FAZ 5** | Danışman Odası, Not Bağlamlandırma, Fikir Sepeti  | ✅ **TAMAMLANDI** | Advisor chat + pgvector cosine search + citation popover + fikir sepeti + not bağlamlandırma (ai_context_suggestions) tam çalışır                                          |

### Mevcut Çalışan Mimari (Güncel)

```
Frontend (Next.js 16 + Tailwind CSS v4 + Shadcn UI + Base UI)
  ├── /login        → Server Action ile SHA-256 cookie auth
  ├── /dashboard    → Tez anayasası özet kartı + Semantic Scholar + DergiPark önerileri
  ├── /library      → PDF yükleme (R2), LlamaParse parsing, chunking, embedding, not bağlamlandırma
  ├── /advisor      → RAG chat: pgvector cosine search + Gemini 3.1 Flash Lite + fikir sepeti
  ├── /onboarding   → Gemini mülakat akışı + Tezara scraping + Özgün Değer Raporu
  ├── /tasks        → Kanban board (drag-drop, CRUD, due date picker)
  └── /insights     → Fikir Sepeti CRUD + Fikir Keskinleştirici (Gemini)

Backend (Server Actions + Drizzle ORM)
  ├── Neon PostgreSQL (pgvector) — thesis_core, references, notes, pdf_chunks, tasks, ai_insights
  ├── Cloudflare R2 — PDF depolama (S3 SDK ile presigned URL)
  ├── LlamaParse v2 API — PDF → Markdown dönüşümü
  ├── Gemini 3.1 Flash Lite — LLM yanıtları, metadata çekme, fikir keskinleştirme
  └── Gemini Embedding 2 — 1536D vektör çıktısı
```

### Veritabanı Tabloları (Mevcut Durum)

| Tablo         | Amaç                                              | Embedding      | HNSW Index | Durum |
| ------------- | ------------------------------------------------- | -------------- | ---------- | ----- |
| `thesis_core` | Tez anayasası (başlık, soru, argüman, metodoloji) | Yok            | Yok        | ✅    |
| `references`  | Cloudflare R2 yüklenen PDF'lerin künyesi          | Yok            | Yok        | ✅    |
| `notes`       | Kullanıcı okuma notları                           | `vector(1536)` | ✅         | ✅    |
| `pdf_chunks`  | LlamaParse'tan gelen parçalar                     | `vector(1536)` | ✅         | ✅    |
| `tasks`       | Görev yönetimi (Kanban)                           | Yok            | Yok        | ✅    |
| `ai_insights` | Fikir Sepeti (ai_context_suggestions alanı ile)   | Yok            | Yok        | ✅    |

### Eksik / Tamamlanmamış Özellikler

Tüm fazlar tamamlanmıştır. Mevcut eksik bir özellik bulunmamaktadır.

### Production Deployment İçin Gerekli Çevresel Değişkenler

Vercel Dashboard → Project Settings → Environment Variables'a eklenmelidir:

| Değişken                          | Açıklama                                       | Kaynak                        |
| --------------------------------- | ---------------------------------------------- | ----------------------------- |
| `APP_PASSWORD`                    | Tek kullanıcılı giriş şifresi                  | Kullanıcı tanımlı             |
| `NEON_DATABASE_URL`               | Neon PostgreSQL bağlantı adresi (SSL required) | Neon Dashboard                |
| `GEMINI_API_KEY`                  | Google AI Studio API anahtarı                  | Google AI Studio              |
| `LLAMAPARSE_API_KEY`              | LlamaIndex Cloud API anahtarı                  | LlamaIndex Cloud              |
| `CLOUDFLARE_R2_ACCOUNT_ID`        | R2 hesap ID'si                                 | Cloudflare Dashboard → R2     |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 Access Key ID                               | Cloudflare R2 → API Tokens    |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 Secret Access Key                           | Cloudflare R2 → API Tokens    |
| `CLOUDFLARE_R2_BUCKET_NAME`       | R2 bucket adı (varsayılan: "fabricca")         | Cloudflare R2 → Create Bucket |

### Deploy Öncesi Yapılması Gerekenler

1. Drizzle migrasyonlarını Neon veritabanına push et: `npx drizzle-kit push`
2. pgvector extension'ı aktifleştir: `npx tsx src/db/setup-extensions.ts`
3. Yukarıdaki tüm env değişkenlerini Vercel Dashboard'da tanımla
4. `next.config.ts` kontrolü: `serverActions.bodySizeLimit: "20mb"` PDF yüklemeleri için yeterlidir
5. Cloudflare R2 bucket'ı `fabricca` adıyla (veya farklıysa env'deki isimle) oluşturulmalı
6. Build doğrulaması: ✅ **`npm run build` hatasız tamamlandı** (TypeScript + Next.js sıfır hata)

---

_Fabricca — Strateji ve RAG Karargahı_  
_Son güncelleme: Mayıs 2026 (KAPANIŞ NOTU düzeltildi — tüm fazlar tamamlandı)_

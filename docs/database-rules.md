# Veri Tabanı Kuralları ve Onboarding Kayıt Mimarisi (Database & Progressive Save Rules)

Bu doküman, Fabricca platformunun veri tabanı (Drizzle ORM / Neon PostgreSQL) kurallarını, veri bütünlüğü disiplinini ve onboarding sürecindeki aşamalı kayıt (Progressive Save) mimarisini düzenler.

---

## 1. Drizzle ORM ve Şema Disiplini

- **Dil Kuralları (Golden Boundary):**
  - Tüm veri tabanı tablo isimleri, kolon isimleri, Drizzle şemaları ve SQL sorguları tamamen profesyonel bilgisayar bilimi İngilizcesi ile (`snake_case` veya `camelCase`) yazılmalıdır. Türkçe karakter kullanımı kesinlikle yasaktır.
- **Tip Güvenliği (TypeScript):**
  - Kod tabanında veri tabanından veri okurken/yazarken asla `any` kullanılmamalıdır.
  - Tablolardan veri çekme ve ekleme işlemlerinde Drizzle'ın sunduğu tipler (`InferSelectModel<typeof table>`, `InferInsertModel<typeof table>`) kullanılmalıdır.
- **İlişkiler ve Yapılandırma:**
  - İlişkili tablolarda (`relations` API) dış anahtar (foreign key) kısıtlamaları ve silme davranışları (`onDelete: "cascade"`) net şekilde tanımlanmalıdır.

---

## 2. Şema Senkronizasyonu (db:push)

Veri tabanı şeması (`src/db/schema.ts`) projenin ihtiyaçlarına göre dinamik olarak değişebilir.

- **Zorunlu Kural:** Şemada herhangi bir tablo, kolon veya ilişki değişikliği yapıldığı an, başka bir işe geçmeden önce **mutlaka** aşağıdaki komut çalıştırılarak veri tabanı şeması kod tabanıyla %100 senkronize hale getirilmelidir:
  ```bash
  npm run db:push
  ```
- **Yerel Test:** Local geliştirme aşamasında `db:push` kullanılarak şema güncellemeleri hızlıca Neon DB'ye yansıtılır. Production geçişlerinde veya büyük güncellemelerde schema drift yaşanmaması için bu disipline uyulmalıdır.

---

## 3. Onboarding Aşamalı Kayıt (Progressive Save) Mimarisi

Kullanıcının onboarding adımlarında (5 adım) veri kaybı yaşamaması ve her adımın bir sonraki adıma girdi hazırlaması için veri tabanına doğrudan ve aşamalı yazma mimarisi kurgulanmıştır.

### Adım Adım Veri Akışı ve SQL Kayıtları:

1. **Adım 1 (Matrix):**
   - **Metot:** `submitThesisMatrixAction`
   - **İşlem:** Kullanıcının girdiği ham matrisi Gemini'ye gönderir, zenginleştirilmiş sonucu `thesis_matrices` tablosuna **upsert** eder.
   - **Temizlik:** Matris değiştiği için daha önce üretilmiş downstream verileri (`originality_reports`, `thesis_boxes`) veri tabanından tamamen temizlenir.
2. **Adım 2 (Enrichment):**
   - **Metot:** `confirmEnhancedThesisAction`
   - **İşlem:** Kullanıcının onayladığı son zenginleştirilmiş matrisi `thesis_matrices` tablosuna **upsert** eder.
3. **Adım 3 (Risk):**
   - **Metot 1:** `searchAndSiftThesesAction`
     - **İşlem:** YÖKTEZ taraması yapar ve sonuçları frontend'e JSON olarak döndürür. **Bu sonuçlar veri tabanına yazılmaz.**
   - **Metot 2:** `runJuryAnalysisAction`
     - **İşlem:** Gemini jüri analizini çalıştırır ve üretilen özgünlük raporunu `originality_reports` tablosuna **upsert** eder.
4. **Adım 4 (Boxes):**
   - **Metot:** `confirmBoxesAction`
   - **İşlem:** Konu kutularını (boxes) `thesis_boxes` tablosuna tek bir veritabanı **transaction**'ı içinde yazar.
5. **Adım 5 (Literature Review):**
   - **Metot:** `confirmLiteratureAction`
   - **İşlem:** Seçilen makaleleri `library_resources` tablosuna transaction içinde yazar.
   - **Sonlandırma:** `users.onboardingCompleted = true` yapar, sunucudaki `fabricca_session` cookie'sini günceller ve istemcideki Zustand store'u `resetStore()` ile sıfırlar.

---

## 4. Veri Saklama ve Kayıp Önleme Kalkanı (Reset Shield)

- **Database-Free Ara Veriler:**
  Yalnızca ara analiz verileri (YÖKTEZ taranan/elenen tezler, Gemini jüri raporunun JSON çıktısı, stratejik yol haritası metni) frontend'e saf JSON olarak döner ve doğrudan veritabanında kalıcı tablolarda saklanmaz.
- **Zustand & TanStack Query Cache Mühürleme:**
  Taramalar veya API hataları sırasında kullanıcı verisinin kaybolmaması için; ara veriler frontend katmanında Zustand global store (`sessionStorage` destekli) ve TanStack Query cache'inde (özellikle YÖKTEZ kazıma/sifting sonuçlarını korumak için `scrapedTheses` cache anahtarında) kilitlenir. Bu sayede tarayıcı yenilemelerinde veya Gemini API hatalarında veri kaybı yaşanmaz.
- **Oturum (Session Cookie) Kilitleme:**
  `confirmLiteratureAction` başarıyla tamamlandığında, `fabricca_session` cookie'si sunucu tarafında anında `onboardingCompleted: true` olarak mühürlenir.
- **Sıfırlama Kalkanı:**
  Onboarding'in başarıyla bitmesinin ardından Zustand store'un `resetStore()` aksiyonu çağrılarak `sessionStorage` ve tarayıcı hafızası tamamen temizlenir.

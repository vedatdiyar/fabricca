# Stil ve Kullanıcı Arayüzü Kuralları (UI Design System)

Bu doküman, Fabricca platformunun kullanıcı arayüzü (UI) tasarımı, stillendirme disiplinleri, yerleşim standartları ve animasyon kurallarını belirler.

---

## 1. Akademik Tipografi ve Düzen

Tasarımlar her zaman sade, minimal ve göz yormayan bir yapıda olmalıdır.

- **Akademik Okuma Alanları:** Metin yoğunluklu alanlarda (makale okuma, kartoteks fişleri) geniş satır aralıkları (`leading-relaxed` veya `leading-loose`) ve okumayı kolaylaştıran yazı boyutları seçilmelidir.
- **Yazı Tipleri (Fonts):**
  - **Sans-Serif (Ana Metin ve Arayüz):** Poppins (`--font-sans`).
  - **Serif (Marka Rozetleri ve Kutu Başlıkları):** Fredoka (`--font-serif`).
  - **Monospace (Kod ve Teknik Çıktılar):** JetBrains Mono (`--font-mono`).

---

## 2. Semantik Renk Yönetimi

Shadcn'in varsayılan `CSS Variables` yapısı kullanılacaktır.

- **Kural:** Elemanlara inline olarak doğrudan `bg-red-500` veya `text-blue-600` gibi renkler atanamaz. Her zaman semantik değişkenler (`bg-primary`, `text-muted-foreground`, `border-input`, `bg-card` vb.) kullanılmalıdır.
- **Ana Renk Paleti:**
  - `bg-background`: Çok derin, asil bir zümrüt-siyah zemin (`#0b100e`).
  - `text-foreground`: Parlayan nane-beyazı ana metin (`#eef5f2`).
  - `bg-primary`: Net zümrüt yeşili (`#10b981`).
  - `bg-card`: Yeşilden yeşil tonuyla bıçak gibi ayrışan kart rengi (`#121a17`).
  - `border-border`: Kartları ve bölümleri jilet gibi ayıran ara çizgi (`#20302a`).

---

## 3. Koşullu Opaklık İzni (Kontrollü Şeffaflık)

Arayüzde kontrastı korumak ve okunabilirliği en üst düzeyde tutmak amacıyla şeffaflık kuralları katı bir disipline bağlanmıştır:

- **Metinlerde (Text) Şeffaflık — KESİNLİKLE YASAKTIR:**
  Yazı renklerinde asla slash (`/`) ile şeffaflık verilemez (Örn: `text-primary/50` veya `text-red-500/40` yasaktır). Yazılar, kontrastın korunması için her zaman `%100` opak kalmalıdır.
- **Arka Plan (`bg-*`) ve Kenarlıklarda (`border-*`) Şeffaflık — SERBESTTİR:**
  Durum rozetleri (badge), tablo satırları veya kart arka planlarında, arkadaki rengi hafifçe sızdıran modern bir derinlik (depth) hissi yaratmak için sadece `bg-*` ve `border-*` sınıflarında `/10`, `/15` veya `/20` (maksimum %20 şeffaflık) kullanılabilir.
- **Doğru Kurumsal Kalıp:** `bg-destructive/10 border-destructive/20 text-destructive` (Arka plan ve border soft, yazı `%100` net ve parlar).
- **Sticky Navigation İstisnası:**
  Sticky header/sidebar gibi yapışkan navigasyon elemanlarında, altındaki içeriğin sızmaması ve yazı okunabilirliğinin korunması için `bg-background/80` + `backdrop-blur-md` pattern'ı kullanılabilir. Bu, genel %20 şeffaflık sınırının dışındadır.
- **Bileşen İstisnası:**
  `src/components/ui/` altındaki Shadcn UI bileşenleri bu kuralın dışındadır.

---

## 4. Sık Kullanılan Sınıfların Soyutlanması (CSS Classes)

Proje genelinde veya belirli bir sayfada çok sık tekrar eden ortak bir tasarım düzeni/sınıf kümesi oluşturulacaksa (Örn: Kartoteks fiş kapsayıcıları, chat arayüz elemanları, özel listeleme şablonları), HTML içine devasa Tailwind sınıfları yığılamaz. Bu yapılar `global.css` altında anlamlı bir sınıf adı tanımlanarak `@apply` yönergesiyle temiz birer global sınıfa dönüştürülmeli ve oradan çağrılmalıdır.

---

## 5. Shadcn UI Disiplini

Yeni bir arayüz elementi gerekirken (Örn: Dialog, Select, Sheet), yapay zeka bunu sıfırdan yazamaz veya harici paket kuramaz. Önce projede olup olmadığına bakar, yoksa `npx shadcn@latest add <component>` komutuyla kurup onu özelleştirir.

---

## 6. Küresel Navigasyon Düzeni (Header)

Sayfa çalışma alanını maksimize etmek amacıyla ana navigasyon üst header (Top Header) olarak konumlandırılır.

- Sayfa içi bağımlı navigasyonlar (kütüphane klasörleri, chat geçmişleri) ilgili sayfaların kendi sol sidebar'ları olarak ilgili route'un layout/page bileşenlerinde yönetilir.
- Mobil/tablet (< `md` breakpoint) ekranlarda ana navigasyon alt navigasyon bar'ına (Bottom Nav) taşınır.
- Responsive davranışlar en ince ayrıntısına kadar gözetilmelidir.

---

## 7. Hydration Hatalarının Önlenmesi

Next.js (SSR) dünyasında en sık yaşanan sunucu-istemci uyumsuzluklarını önlemek adına; zaman/tarih gösterimleri veya yerel state (`localStorage`) içeren bileşenler tasarlanırken mutlaka `useEffect` aşaması gözetilmeli veya `suppressHydrationWarning` kullanılmalıdır.

---

## 8. Sayfa Düzeni ve Aksiyon Buton Standartları (Onboarding & Genel)

Aşağıdaki yerleşim ve buton kuralları tüm onboarding adımlarına (matrix, enrichment, risk, boxes, literature-review) istisnasız uygulanır:

- **Sayfa İçerik Genişliği:**
  - Onboarding ana içerik alanları yalnızca `page.tsx` katmanında `max-w-5xl` kısıtıyla sarmalanır (Örn: `mx-auto flex w-full max-w-5xl flex-col items-center space-y-4`).
  - Bileşen içinde `max-w-* mx-auto` tekrarı kesinlikle yasaktır. Bileşenler genişliği doldurmak için `w-full` kullanır.
  - Hata/Bildirim sayfaları gibi daha ufak odaklı ekranlarda içerik alanı `max-w-md` ile sınırlandırılır.
- **Sayfa Padding ve Spacing Düzeni:**
  - Sayfa ana sarmalayıcıları: `flex flex-col items-center justify-center p-4 pt-10 pb-4`.
  - Sayfa başlık alanı: `flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border`.
- **Aksiyon Buton Kuralları:**
  - **Floating Aksiyon Butonları (Kart Dışı — Risk, Boxes, Literature-Review):** İçerik inceleme adımlarında kartın dışında konumlanan aksiyon butonları `<div className="flex justify-end mt-8 pb-8">` wrapper'ı içinde **sağa hizalanmış** olmalıdır. Buton genişliği `auto` olmalıdır; `w-full` kullanılmaz.
  - **Form Submit Butonları (Kart veya Form İçi — Matrix, Enrichment):** Veri giriş adımlarında formun içindeki submit butonu formun en altında `w-full` genişliğiyle konumlandırılır.
  - **Buton Sınıf Saflığı ve Animasyonlar:** Tüm onboarding aksiyon butonları yalnızca `btn-academic-hero` global sınıfını alır.
    - Sınıf tanımı: `@apply px-8 py-5 text-base font-semibold tracking-wide transition-all duration-200 active:scale-[0.98] cursor-pointer;`.
    - `bg-gradient-to-r`, `shadow-lg`, `hover:shadow-*`, `group-hover:*` gibi inline görsel ezmeler (override) kesinlikle yasaktır.
- **Ölü CSS Yasağı:** Grid dışında kullanılan `col-span-*` sınıfları (özellikle `md:col-span-full`) yasaktır; yalnızca gerçek CSS grid bağlamında kullanılabilir.

---

## 9. Onboarding Form Alanı Tasarım Standardı (Matrix ve Enrichment)

Matrix ve Enrichment adımlarındaki 6 matris alanı aşağıdaki standarda göre render edilir:

- **Bölüm Tabanlı Tasarım (Section-Based Layout):** Alanlar 3 tematik bölüme gruplandırılır:
  1. **Araştırma Sorusu** (studyTitle + researchQuestion)
  2. **Kuramsal Çerçeve** (theoreticalFramework + methodology)
  3. **Sınırlar ve İddia** (researchScope + mainClaim)
  - Her bölüm; iki yanda yatay çizgi, ortada küçük bölüm başlığı olan bir divider ile başlar.
- **Alan Kartı Anatomisi:** Her alan kendi `rounded-xl border bg-card p-4` kapsayıcısında render edilir. Kapsayıcı içinde sırayla: numara rozeti (`01`–`06`, `bg-primary/10 text-primary`) + Lucide ikonu + etiket → Textarea (`textarea-academic`) → ipucu metni (`text-[11px] text-muted-foreground`) bulunur.
- **Dış Card Kapsayıcı Yasağı:** Shadcn `<Card>` bileşeni form etrafında dış kapsayıcı olarak kullanılmaz; görsel yapı doğrudan section ve alan kartlarından oluşur.
- **Enrichment Farkı:** Enrichment adımında form başlangıcında `border-primary/20 bg-primary/10` bir AI bilgilendirme banneri gösterilir; alan sınırları `border-primary/20` ile hafifçe vurgulanarak içeriğin yapay zeka çıktısı olduğu hissettirilir.

---

## 10. Otomatik Veri Akışı Olmayan Kapsayıcı Kılavuz Kart Standartları (Örn: `PRIMARY_MATERIAL`)

Dış veri tabanlarından veya API'lerden otomatik akış almayan özel veri alanları ve boş kutu yapıları için kullanıcıyı bilgilendiren özel bir yönlendirme kart şablonu uygulanır.

- **Kullanım Yeri:** Herhangi bir dinamik akışı olmayan, kullanıcının sonradan veri veya belge yüklemesi beklenen alanlar (örneğin `PRIMARY_MATERIAL` birincil kaynak kutusu).
- **Yerleşim ve Tasarım Kodu:**
  - **Sarmalayıcı:** `p-6 border-b border-border/10 bg-primary/5`
  - **Bilgilendirme Kartı:** `p-4 rounded-lg bg-primary/10 border border-primary/20 leading-relaxed`
  - **Başlık Stili:** `font-medium text-foreground text-sm mb-1`
  - **Metin Stili:** `text-muted-foreground text-xs leading-relaxed`
- **Tasarım Mantığı:** Bu yumuşak yeşil doku (`bg-primary/10` + `/5`), kullanıcının buranın bir hata veya eksiklik değil, sisteme entegre edilmiş özel bir eylem alanı olduğunu anlamasını sağlar.

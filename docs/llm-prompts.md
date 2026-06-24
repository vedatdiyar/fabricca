# Büyük Dil Modeli (LLM) ve Prompt Mühendisliği Kuralları (LLM & Prompt Rules)

Bu doküman, Fabricca platformunda kullanılan Google Gemini 3.1 Flash Lite modeli ile entegrasyon kurallarını, prompt hiyerarşisini ve yapılandırılmış çıktı disiplinlerini tanımlar.

---

## 1. Google Gen AI SDK Entegrasyon Standartları

- **SDK Disiplini:**
  - Projede eski nesil `@google/generative-ai` kütüphanesi **kesinlikle kullanılmaz**.
  - Her zaman yeni nesil `@google/genai` kütüphanesi kullanılacaktır.
  - İstemci başlatılırken şu standart kalıp uygulanır:
    ```typescript
    import { GoogleGenAI } from "@google/genai";
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    ```
- **Temperature Stratejisi:**
  - Gemini 3.0/3.1 ve üzeri modeller için varsayılan ve önerilen temperature değeri olan `1.0` kullanılmalıdır.
  - Belirlenimcilik (determinism) gerektiren veri çıkarma, eleme ve karşılaştırma görevlerinde de temperature değeri `1.0` olarak korunmalı, ancak çıktıların tutarlılığı için mutlaka sabit bir `seed` değeri (örn: `2` veya `42`) ile beslenmelidir.

---

## 2. Ajan Akıl Yürütme Gücü (Thinking Config Seviyeleri)

Gemini 3 ve üzeri modellerin mimari optimizasyonu ve akıl yürütme yetenekleri için her fonksiyonun gereksinimine göre özel `thinkingConfig` ayarları uygulanır. Sistem genelinde bu ayarlar aşağıdaki gibidir:

### Seviye 1: `null` (Düşünme Kapalı) — Yapısal ve Şablonlama Görevleri

- **Karakteristiği:** Ham metni akademik üsluba çevirme veya verileri JSON şemasına yerleştirme gibi saf biçimlendirme ve şablonlama işleri.
- **Kural:** Akıl yürütme tamamen kapatılır (`null`). Model doğrudan çıktı üreterek maksimum hız ve minimum maliyet sağlar.
- **İstisna (Box Generation):** Konu kutularının atomik flat yapıya bölünmesi ve her kutu için parametrik hafızadan kurucu eser (foundationalQueries) metadata'sının çıkarılması, saf biçimlendirme olmayıp derin alan bilgisi ve disipliner muhakeme gerektirdiğinden `ThinkingLevel.HIGH` kullanılır.

### Seviye 2: `minimal` — Hafif Kural Takibi

- **Karakteristiği:** Minimum düşünme bütçesi ile hızlı karar verme gerektiren işlemler (rota planlamada fallback, ön eleme sifting).
- **Kural:** `thinkingLevel: "minimal"` olarak ayarlanır.
- **Not:** Maliyet ve hız kritik olduğunda, ancak yine de bir miktar muhakeme gerektiğinde tercih edilir.

### Seviye 3: `low` — Kural Takibi ve Doğrulama Görevleri

- **Karakteristiği:** Kelimeleri eklerinden ayıklayıp kökünü bulma (lemma), iki metni karşılaştırıp "bilgi var mı/yok mu" testi yapma (fact-checking) veya katı eliminasyon kurallarıyla listeleri süzme.
- **Kural:** `thinkingLevel: "low"` olarak ayarlanır.
- **Not:** Modele kuralları denetlemesi için minimum bütçe tanır. Modelin yaratıcı yorumlar yapmasını engeller, prompttaki katı sınırlamalara tam itaat etmesini sağlar.

### Seviye 4: `medium` — Planlama ve İçerik Üretim Görevleri

- **Karakteristiği:** Günlük veya haftalık çalışma planlaması yapma, içerik taslakları (outline) çıkarma, beyin fırtınası süreçleri veya esnek e-posta/metin fikirleri üretme.
- **Kural:** `thinkingLevel: "medium"` olarak ayarlanır.
- **Not:** En dengeli yaratıcılık, mantık ve hız optimizasyonunu bu seviyede sunar. Katı kısıtlamalar yerine akıcı ve esnek tavsiye mekanizmaları kurmak için idealdir.

### Seviye 5: `high` — Stratejik ve Derin Analiz Görevleri

- **Karakteristiği:** Kelime benzerliklerinin ötesine geçerek "anlamsal kapsam/yutulma" tespiti yapan jüri analizleri veya klişelerden uzak, isme özel taktiksel akademik yol haritaları sentezleme.
- **Kural:** `thinkingLevel: "high"` olarak ayarlanır.
- **Not:** Akıl yürütme derinliğini maksimuma çıkarır. İlk token süresi uzasa bile, yüzeysel kalıpları yıkarak uzman seviyesinde ve yüksek kalitede analiz üretir.

---

## 3. Prompt Mühendisliği Standartları

1. Persona veya rolden ziyade asıl görevi (ne üretileceğini) en net şekilde tanımla.
2. Prompt hiyerarşisinde aşağıdaki sırayı takip et:
   `ROL` → `BİLGİ VE ZAMAN KISITLAMALARI` → `OPERASYONEL KISITLAMALAR` → `UZMAN FEW-SHOT ÖRNEĞİ` → `TALİMATLAR VE GÖREV` → `KRİTİK GÜVENLİK BARIYERI`
3. Belirsiz ifadelerden kaçın, çıktının sınırlarını (örn: kelime/karakter limitleri) net olarak belirt.
4. Gereksiz "thinking/step-by-step" talimatları verme (sadece derin muhakeme gerektiren sentez aşamasında kullan).
5. Kısıtları her zaman pozitif ("Sadece şunu yap" > "Şunu yapma") ifadelerle yaz.
6. XML/Markdown etiketlerini süs için değil, sadece net bağlamsal yapı oluşturmak için kullan.
7. Tek bir promptta çoklu karmaşık iş yapma, gerektiğinde adımlara böl.
8. En az kelimeyle en net niyete odaklan (Daha uzun prompt = daha iyi prompt DEĞİLDİR).

---

## 4. XML Tabanlı Prompt Mimarisi

Modele gönderilen kullanıcı promptları; tez matrisi, aday listeleri, örnek girdiler ve beklenen çıktılar gibi yapısal verilerin birbirine karışmaması için her zaman tutarlı XML etiketleri kullanılarak kapsüllenecektir. Sistem genelinde aşağıdaki tag şablonları kullanılır:

- `<ornek_girdi_matrisi>` / `<ornek_hedef_matris>` — Few-shot örnek girdi
- `<ornek_hedef_matris_zengin>` - Few-shot örnek zenginleştirilmiş çıktı
- `<ornek_beklenen_cikti>` — Few-shot beklenen çıktı
- `<hedef_tez_matrisi>` — Kullanıcının tez matrisi
- `<aday_tez_listesi>` / `<aday_makale_listesi>` / `<suzulen_adaylar>` — Aday liste verileri
- `<hedef_alt_kutu>` / `<kuresel_tez_matrisi>` — Literatür tarama girdileri
- `<arama_sonuclari>` — Tavily arama sonuçları

Bu yapı, prompt mühendisliğinde tek düze bir şablon sunar ve modelin talimatları daha doğru yorumlamasını sağlar.

---

## 5. Structured Outputs (Vanilla JSON Schema Entegrasyonu)

Modelden yapılandırılmış JSON çıktısı alınması zorunlu olan senaryolarda; şema tanımı saf vanilla JSON Schema nesnesi olarak doğrudan `response_json_schema` alanına geçirilecektir.

- **Önemli Kısıtlama:** `zod-to-json-schema` gibi üçüncü parti kütüphanelerin kullanımı **kesinlikle yasaktır**. Tüm JSON şemaları el ile vanilla JSON Schema yapısında (type, properties, required vb.) yazılacaktır.
- **Tip Güvencesi:** Çıkan JSON şeması ile backend tarafındaki TypeScript/Zod tiplerinin %100 uyumlu olduğundan emin olunmalıdır.
